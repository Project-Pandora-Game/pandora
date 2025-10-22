import { Immutable } from 'immer';
import { Assert, AssertNever } from '../../utility/misc.ts';
import type { AtomicCondition, AtomicPoseCondition, Condition } from './conditions.ts';
import { CharacterSize } from './graphics.ts';
import type { LayerImageOverride, LayerImageSetting } from './layers/common.ts';
import type { PointDefinition, TransformDefinition } from './points.ts';

export interface PointDefinitionCalculated extends PointDefinition {
	index: number;
	isMirror: boolean;
}

/** formatting for `<T extends (...)>` is different for ESLint and VS Code */
type Maybe<T> = T | undefined;
export function MirrorBoneLike<T extends Maybe<string>>(bone: T): T {
	return bone?.replace(/_[lr]$/, (m) => m === '_l' ? '_r' : '_l') as T;
}

export function MirrorAtomicPoseCondition(c: Immutable<AtomicPoseCondition>): AtomicPoseCondition {
	if ('bone' in c) {
		Assert(c.bone != null);
		return {
			...c,
			bone: MirrorBoneLike(c.bone),
		};
	} else if ('armType' in c) {
		Assert(c.armType != null);
		return {
			...c,
			side: c.side === 'left' ? 'right' : 'left',
		};
	} else if ('legs' in c) {
		Assert(c.legs != null);
		return {
			...c,
		};
	} else if ('view' in c) {
		Assert(c.view != null);
		return {
			...c,
		};
	}
	AssertNever(c);
}

export function MirrorAtomicCondition(c: Immutable<AtomicCondition>): AtomicCondition {
	if ('module' in c) {
		Assert(c.module != null);
		return {
			...c,
			module: MirrorBoneLike(c.module),
		};
	} else if ('attribute' in c) {
		Assert(c.attribute != null);
		return {
			...c,
		};
	} else if ('blinking' in c) {
		Assert(c.blinking != null);
		return {
			...c,
		};
	}

	return MirrorAtomicPoseCondition(c);
}

export function MirrorCondition(condition: Immutable<Condition>): Condition;
export function MirrorCondition(condition: Immutable<Condition> | undefined): Condition | undefined;
export function MirrorCondition(condition: Immutable<Condition> | undefined): Condition | undefined {
	if (!condition)
		return undefined;

	return condition.map((cause) => cause.map(MirrorAtomicCondition));
}

export function MirrorTransform(transform: Immutable<TransformDefinition>): TransformDefinition {
	const type = transform.type;
	const condition = transform.condition?.map(MirrorAtomicPoseCondition);
	switch (type) {
		case 'rotate': {
			const rotate = transform.value;
			return { condition, type, value: rotate * -1, bone: MirrorBoneLike(transform.bone) };
		}
		case 'const-shift': {
			const { x, y } = transform.value;
			return { condition, type, value: { x: x * -1, y } };
		}
		case 'shift': {
			const { x, y } = transform.value;
			return { condition, type, value: { x: x * -1, y }, bone: MirrorBoneLike(transform.bone) };
		}
		default:
			AssertNever(type);
	}
}

export function MirrorImageOverride({ condition, ...rest }: Immutable<LayerImageOverride>): LayerImageOverride {
	return { ...rest, condition: MirrorCondition(condition) };
}

export function MirrorLayerImageSetting(setting: Immutable<LayerImageSetting>): LayerImageSetting {
	return {
		...setting,
		overrides: setting.overrides.map(MirrorImageOverride),
	};
}

export function MirrorPoint(point: PointDefinitionCalculated): PointDefinitionCalculated {
	return {
		...point,
		pos: [CharacterSize.WIDTH - point.pos[0], point.pos[1]],
		transforms: point.transforms.map(MirrorTransform),
		skinning: point.skinning?.map((s) => ({ ...s, bone: s.bone && MirrorBoneLike(s.bone) })),
		pointType: MirrorBoneLike(point.pointType),
		isMirror: true,
	};
}

export function MakeMirroredPoints(point: PointDefinitionCalculated): [PointDefinitionCalculated] | [PointDefinitionCalculated, PointDefinitionCalculated] {
	if (!point.mirror)
		return [point];

	const point1: PointDefinitionCalculated = point;
	const point2: PointDefinitionCalculated = MirrorPoint(point);

	return [point1, point2];
}
