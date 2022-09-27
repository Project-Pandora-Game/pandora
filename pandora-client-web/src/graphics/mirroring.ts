import { CharacterSize, Condition, LayerImageOverride, LayerImageSetting, PointDefinition, TransformDefinition } from 'pandora-common';
import { PointDefinitionCalculated } from '../assets/assetGraphics';

/** formatting for `<T extends (...)>` is different for ESLint and VS Code */
type Maybe<T> = T | undefined;
export function MirrorBoneLike<T extends Maybe<string>>(bone: T): T {
	return bone?.replace(/_[lr]$/, (m) => m === '_l' ? '_r' : '_l') as T;
}

export function MirrorCondition<T extends Maybe<Condition>>(condition: T): T {
	if (!condition)
		return condition;

	return condition.map((cause) => cause.map((c) => {
		if ('bone' in c && c.bone != null) {
			return {
				...c,
				bone: MirrorBoneLike(c.bone),
			};
		}
		if ('module' in c && c.module != null) {
			return {
				...c,
				module: MirrorBoneLike(c.module),
			};
		}
		return c;
	})) as T;
}

export function MirrorTransform(transform: TransformDefinition): TransformDefinition {
	const { type, bone, condition } = transform;
	const trans = {
		bone: MirrorBoneLike(bone),
		condition: MirrorCondition(condition),
	};
	switch (type) {
		case 'rotate': {
			const rotate = transform.value;
			return { ...trans, type, value: rotate * -1 };
		}
		case 'shift': {
			const { x, y } = transform.value;
			return { ...trans, type, value: { x: x * -1, y } };
		}
	}
}

export function MirrorImageOverride({ image, condition }: LayerImageOverride): LayerImageOverride {
	return { image, condition: MirrorCondition(condition) };
}

export function MirrorLayerImageSetting(setting: LayerImageSetting): LayerImageSetting {
	return {
		...setting,
		overrides: setting.overrides.map(MirrorImageOverride),
	};
}

export function MirrorPoint(point: PointDefinition): PointDefinition {
	return {
		pos: point.pos,
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
