import { AssertNever, AtomicCondition, Condition, ConditionOperator, CONDITION_OPERATORS, LayerImageOverride, TransformDefinition } from 'pandora-common';

export function SplitAndClean(input: string, separator: string): string[] {
	return input
		.split(separator)
		.map((l) => l.trim())
		.filter(Boolean);
}

function SplitFirst(input: string, separator: string): [string, string] {
	const index = input.indexOf(separator);
	return index < 0 ? [input, ''] : [input.substring(0, index), input.substring(index + 1)];
}

function ParseFloat(input: string): number {
	const result = Number.parseFloat(input);
	if (isNaN(result)) {
		throw new Error(`Not a number: '${input}'`);
	}
	return result;
}

function SerializeAtomicCondition(condition: AtomicCondition): string {
	return `${condition.bone}${condition.operator}${condition.value}`;
}

function ParseAtomicCondition(input: string, validBones: string[]): AtomicCondition {
	const parsed = /^\s*([-_a-z0-9]+)\s*([=<>!]+)\s*(-?[0-9.]+)\s*$/i.exec(input);
	if (!parsed) {
		throw new Error(`Failed to parse condition '${input}'`);
	}
	if (!validBones.includes(parsed[1])) {
		throw new Error(`Unknown bone in condition '${input}'`);
	}
	if (!(CONDITION_OPERATORS as string[]).includes(parsed[2])) {
		throw new Error(`Invalid operator in condition '${input}'`);
	}
	const value = ParseFloat(parsed[3]);
	return {
		bone: parsed[1],
		operator: parsed[2] as ConditionOperator,
		value,
	};
}

function SerializeCondition(condition: Condition): string {
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

function SerializeTransform(transform: TransformDefinition): string {
	if (transform.type === 'rotate') {
		const res = `rotate ${transform.bone} ${transform.value}`;
		return transform.condition ? `${res} ${SerializeCondition(transform.condition)}` : res;
	} else if (transform.type === 'shift') {
		const res = `shift ${transform.bone} ${transform.value.x} ${transform.value.y}`;
		return transform.condition ? `${res} ${SerializeCondition(transform.condition)}` : res;
	}
	AssertNever(transform);
}

function ParseTransform(input: string, validBones: string[]): TransformDefinition {
	const columns = SplitAndClean(input, ' ');
	const type = columns.shift();
	if (type === 'rotate') {
		if (columns.length < 2 || columns.length > 3) {
			throw new Error('Rot requires 2-3 arguments');
		}
		if (!validBones.includes(columns[0])) {
			throw new Error(`Unknown bone '${columns[0]}'`);
		}
		const ratio = ParseFloat(columns[1]);
		const condition = columns.length === 3 ? ParseCondition(columns[2], validBones) : undefined;
		return {
			type: 'rotate',
			bone: columns[0],
			value: ratio,
			condition,
		};
	} else if (type === 'shift') {
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
			type: 'shift',
			bone: columns[0],
			value: { x, y },
			condition,
		};
	}
	throw new Error(`Unknown transform '${columns[0]}'`);
}

export function SerializeTransforms(transforms: TransformDefinition[]): string {
	return transforms
		.map(SerializeTransform)
		.join('\n');
}

export function ParseTransforms(input: string, validBones: string[]): TransformDefinition[] {
	return SplitAndClean(input, '\n')
		.map((line) => ParseTransform(line, validBones));
}

export function SerializeLayerImageOverride(imageOverride: LayerImageOverride): string {
	return `${SerializeCondition(imageOverride.condition)} ${imageOverride.image}`;
}

export function ParseLayerImageOverride(input: string, validBones: string[]): LayerImageOverride {
	const [condition, image] = SplitFirst(input.trim(), ' ').map((i) => i.trim());
	return {
		image,
		condition: ParseCondition(condition, validBones),
	};
}

export function SerializeLayerImageOverrides(imageOverrides: LayerImageOverride[]): string {
	return imageOverrides
		.map(SerializeLayerImageOverride)
		.join('\n');
}

export function ParseLayerImageOverrides(input: string, validBones: string[]): LayerImageOverride[] {
	return SplitAndClean(input, '\n')
		.map((line) => ParseLayerImageOverride(line, validBones));
}
