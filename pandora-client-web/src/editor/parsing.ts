import { Immutable } from 'immer';
import { ArmFingersSchema, ArmRotationSchema, Assert, AssertNever, AtomicCondition, Condition, ConditionOperatorSchema, LayerImageOverride, TransformDefinition, ZodMatcher, AtomicConditionLegsSchema, CharacterViewSchema, SplitStringFirstOccurrence } from 'pandora-common';

const IsConditionOperator = ZodMatcher(ConditionOperatorSchema);

export function SplitAndClean(input: string, separator: string): string[] {
	return input
		.split(separator)
		.map((l) => l.trim())
		.filter(Boolean);
}

function ParseFloat(input: string): number {
	const result = Number.parseFloat(input);
	if (isNaN(result)) {
		throw new Error(`Not a number: '${input}'`);
	}
	return result;
}

export function SerializeAtomicCondition(condition: Immutable<AtomicCondition>): string {
	if ('bone' in condition) {
		Assert(condition.bone != null);
		return `${condition.bone}${condition.operator}${condition.value}`;
	} else if ('module' in condition) {
		Assert(condition.module != null);
		return `m_${condition.module}${condition.operator}${condition.value}`;
	} else if ('armType' in condition) {
		Assert(condition.armType != null);
		return `hand_${condition.armType}_${condition.side}${condition.operator}${condition.value}`;
	} else if ('attribute' in condition) {
		Assert(condition.attribute != null);
		return `a_${condition.attribute}`;
	} else if ('legs' in condition) {
		Assert(condition.legs != null);
		return `legs_${condition.legs}`;
	} else if ('view' in condition) {
		Assert(condition.view != null);
		return `view_${condition.view}`;
	} else if ('blinking' in condition) {
		Assert(condition.blinking != null);
		return condition.blinking ? `blinking` : `!blinking`;
	} else {
		AssertNever(condition);
	}
}

function ParseAtomicCondition(input: string, validBones: string[]): AtomicCondition {
	if (input.startsWith('a_')) {
		const attribute = /^a_(!?[-_a-z0-9]+)$/i.exec(input);
		if (!attribute) {
			throw new Error(`Failed to parse attribute condition '${input}'`);
		}
		return {
			attribute: attribute[1],
		};
	}
	if (input.startsWith('legs_')) {
		const legs = /^legs_(!?[-_a-z0-9]+)$/i.exec(input);
		if (!legs) {
			throw new Error(`Failed to parse legs condition '${input}'`);
		}
		if (!ZodMatcher(AtomicConditionLegsSchema.shape.legs)(legs[1])) {
			throw new Error(`Invalid legs pose '${legs[1]}'`);
		}
		return {
			legs: legs[1],
		};
	}
	if (input.startsWith('view_')) {
		const view = /^view_([-_a-z0-9]+)$/i.exec(input);
		if (!view) {
			throw new Error(`Failed to parse view condition '${input}'`);
		}
		if (!ZodMatcher(CharacterViewSchema)(view[1])) {
			throw new Error(`Invalid view '${view[1]}'`);
		}
		return {
			view: view[1],
		};
	}
	if (/^!?blinking$/i.exec(input)) {
		return {
			blinking: !input.startsWith('!'),
		};
	}
	const parsed = /^([-_a-z0-9]+)([=<>!]+)\s*(-?[-_a-z0-9.]+)$/i.exec(input);
	if (!parsed) {
		throw new Error(`Failed to parse condition '${input}'`);
	}
	if (!IsConditionOperator(parsed[2])) {
		throw new Error(`Invalid operator in condition '${input}'`);
	}

	if (parsed[1].startsWith('m_')) {
		return {
			module: parsed[1].slice(2),
			operator: parsed[2],
			value: parsed[3],
		};
	}
	if (parsed[1].startsWith('hand_')) {
		const [, armType, side] = parsed[1].split('_');
		if (side !== 'left' && side !== 'right') {
			throw new Error(`Invalid arm side in condition '${input}'`);
		}
		if (armType === 'rotation') {
			return {
				armType,
				side,
				operator: parsed[2],
				value: ArmRotationSchema.parse(parsed[3]),
			};
		}
		if (armType === 'fingers') {
			return {
				armType,
				side,
				operator: parsed[2],
				value: ArmFingersSchema.parse(parsed[3]),
			};
		}
		throw new Error(`Invalid arm type in condition '${input}'`);
	}

	const value = ParseFloat(parsed[3]);
	if (isNaN(value)) {
		throw new Error(`Expected decimal number, found '${parsed[3]}'`);
	}
	if (!validBones.includes(parsed[1])) {
		throw new Error(`Unknown bone in condition '${input}'`);
	}
	return {
		bone: parsed[1],
		operator: parsed[2],
		value,
	};
}

function SerializeCondition(condition: Immutable<Condition>): string {
	return condition
		.map((clause) =>
			clause
				.map(SerializeAtomicCondition)
				.join('&'),
		)
		.join('|');
}

export function ParseCondition(input: string, validBones: string[]): Condition {
	return SplitAndClean(input, '|')
		.map((clause) =>
			SplitAndClean(clause, '&')
				.map((statement) => ParseAtomicCondition(statement, validBones)),
		);
}

function SerializeTransform(transform: Immutable<TransformDefinition>): string {
	switch (transform.type) {
		case 'rotate':
		case 'const-rotate': {
			const res = `${transform.type} ${transform.bone} ${transform.value}`;
			return transform.condition ? `${res} ${SerializeCondition(transform.condition)}` : res;
		}
		case 'shift': {
			const res = `shift ${transform.bone} ${transform.value.x} ${transform.value.y}`;
			return transform.condition ? `${res} ${SerializeCondition(transform.condition)}` : res;
		}
		case 'const-shift': {
			const res = `const-shift ${transform.value.x} ${transform.value.y}`;
			return transform.condition ? `${res} ${SerializeCondition(transform.condition)}` : res;
		}
		default:
			AssertNever(transform);
	}
}

function ParseTransform(input: string, validBones: string[]): TransformDefinition {
	const columns = SplitAndClean(input, ' ');
	const type = columns.shift();
	switch (type) {
		case 'rotate':
		case 'const-rotate': {
			if (columns.length < 2 || columns.length > 3) {
				throw new Error('Rot requires 2-3 arguments');
			}
			if (!validBones.includes(columns[0])) {
				throw new Error(`Unknown bone '${columns[0]}'`);
			}
			const ratio = ParseFloat(columns[1]);
			const condition = columns.length === 3 ? ParseCondition(columns[2], validBones) : undefined;
			return {
				type,
				bone: columns[0],
				value: ratio,
				condition,
			};
		}
		case 'shift': {
			if (columns.length < 3 || columns.length > 4) {
				throw new Error('Shift requires 3-4 arguments');
			}
			if (!validBones.includes(columns[0])) {
				throw new Error(`Unknown bone '${columns[0]}'`);
			}
			const x = ParseFloat(columns[1]);
			const y = ParseFloat(columns[2]);
			const condition = columns.length === 4 ? ParseCondition(columns[3], validBones) : undefined;
			return {
				type,
				bone: columns[0],
				value: { x, y },
				condition,
			};
		}
		case 'const-shift': {
			if (columns.length < 2 || columns.length > 3) {
				throw new Error('Const-rotate requires 2-3 arguments');
			}
			const x = ParseFloat(columns[0]);
			const y = ParseFloat(columns[1]);
			const condition = columns.length === 3 ? ParseCondition(columns[2], validBones) : undefined;
			return {
				type,
				value: { x, y },
				condition,
			};
		}
		default:
			throw new Error(`Unknown transform '${type || 'undefined'}'`);
	}
}

export function SerializeTransforms(transforms: Immutable<TransformDefinition[]>): string {
	return transforms
		.map(SerializeTransform)
		.join('\n');
}

export function ParseTransforms(input: string, validBones: string[]): TransformDefinition[] {
	return SplitAndClean(input, '\n')
		.map((line) => ParseTransform(line, validBones));
}

export function SerializeLayerImageOverride(imageOverride: Immutable<LayerImageOverride>): string {
	return `${SerializeCondition(imageOverride.condition)} ${imageOverride.image}`;
}

export function ParseLayerImageOverride(input: string, validBones: string[]): LayerImageOverride {
	const [condition, image] = SplitStringFirstOccurrence(input.trim(), ' ').map((i) => i.trim());
	return {
		image,
		condition: ParseCondition(condition, validBones),
	};
}

export function SerializeLayerImageOverrides(imageOverrides: Immutable<LayerImageOverride[]>): string {
	return imageOverrides
		.map(SerializeLayerImageOverride)
		.join('\n');
}

export function ParseLayerImageOverrides(input: string, validBones: string[]): LayerImageOverride[] {
	return SplitAndClean(input, '\n')
		.map((line) => ParseLayerImageOverride(line, validBones));
}
