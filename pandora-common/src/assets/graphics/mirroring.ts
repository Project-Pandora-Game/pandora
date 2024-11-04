import { Immutable } from 'immer';
import { Assert, AssertNever } from '../../utility/misc';
import type { Condition } from './conditions';
import { CharacterSize, type LayerImageOverride, type LayerImageSetting } from './graphics';
import type { PointDefinition, TransformDefinition } from './points';

export interface PointDefinitionCalculated extends PointDefinition {
	index: number;
	mirrorPoint?: PointDefinitionCalculated;
	isMirror: boolean;
}

/** formatting for `<T extends (...)>` is different for ESLint and VS Code */
type Maybe<T> = T | undefined;
export function MirrorBoneLike<T extends Maybe<string>>(bone: T): T {
	return bone?.replace(/_[lr]$/, (m) => m === '_l' ? '_r' : '_l') as T;
}

export function MirrorCondition(condition: Immutable<Condition>): Condition;
export function MirrorCondition(condition: Immutable<Condition> | undefined): Condition | undefined;
export function MirrorCondition(condition: Immutable<Condition> | undefined): Condition | undefined {
	if (!condition)
		return undefined;

	return condition.map((cause) => cause.map((c) => {
		if ('bone' in c) {
			Assert(c.bone != null);
			return {
				...c,
				bone: MirrorBoneLike(c.bone),
			};
		} else if ('module' in c) {
			Assert(c.module != null);
			return {
				...c,
				module: MirrorBoneLike(c.module),
			};
		} else if ('armType' in c) {
			Assert(c.armType != null);
			return {
				...c,
				side: c.side === 'left' ? 'right' : 'left',
			};
		} else if ('attribute' in c) {
			Assert(c.attribute != null);
			return {
				...c,
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
		} else if ('blinking' in c) {
			Assert(c.blinking != null);
			return {
				...c,
			};
		} else {
			AssertNever(c);
		}
	}));
}

export function MirrorTransform(transform: Immutable<TransformDefinition>): TransformDefinition {
	const type = transform.type;
	const condition = MirrorCondition(transform.condition);
	switch (type) {
		case 'const-rotate': {
			const rotate = transform.value;
			return { condition, type, value: rotate * -1, bone: MirrorBoneLike(transform.bone) };
		}
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

export function MirrorImageOverride({ image, condition }: Immutable<LayerImageOverride>): LayerImageOverride {
	return { image, condition: MirrorCondition(condition) };
}

export function MirrorLayerImageSetting(setting: Immutable<LayerImageSetting>): LayerImageSetting {
	return {
		...setting,
		overrides: setting.overrides.map(MirrorImageOverride),
		alphaOverrides: setting.alphaOverrides?.map(MirrorImageOverride),
	};
}

export function MirrorPoint(point: Immutable<PointDefinition>): PointDefinition {
	return {
		pos: [...point.pos],
		mirror: point.mirror,
		transforms: point.transforms.map(MirrorTransform),
		pointType: MirrorBoneLike(point.pointType),
	};
}

export function MakeMirroredPoints(point: PointDefinitionCalculated): [PointDefinitionCalculated] | [PointDefinitionCalculated, PointDefinitionCalculated] {
	if (!point.mirror)
		return [point];

	const { pos, transforms, pointType } = point;

	const point1: PointDefinitionCalculated = { ...point };

	const point2: PointDefinitionCalculated = {
		...point,
		pos: [CharacterSize.WIDTH - pos[0], pos[1]],
		transforms: transforms.map(MirrorTransform),
		pointType: MirrorBoneLike(pointType),
		isMirror: true,
	};

	point1.mirrorPoint = point2;
	point2.mirrorPoint = point1;

	return [point1, point2];
}
