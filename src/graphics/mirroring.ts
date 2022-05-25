import { CharacterSize, Condition, PointDefinition, TransformDefinition } from 'pandora-common';

/** formatting for `<T extends (...)>` is different for ESLint and VS Code */
type Maybe<T> = T | undefined;
export function MirrorBoneLike<T extends Maybe<string>>(bone: T): T {
	return bone?.replace(/_[lr]$/, (m) => m === '_l' ? '_r' : '_l') as T;
}

export function MirrorCondition<T extends Maybe<Condition>>(condition: T): T {
	if (!condition)
		return condition;

	return condition.map((cause) => cause.map(({ bone, ...rest }) => ({
		...rest,
		bone: MirrorBoneLike(bone),
	}))) as T;
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
			if (/_[rl]$/.test(bone))
				return { ...trans, type, value: { x: x * -1, y: y * -1 } };
			else
				return { ...trans, type, value: { x: x * -1, y } };
		}
	}
}

export function MirrorPoint(point: PointDefinition): PointDefinition {
	return {
		pos: point.pos,
		mirror: point.mirror,
		transforms: point.transforms.map(MirrorTransform),
		pointType: MirrorBoneLike(point.pointType),
	};
}

export function MakeMirroredPoints(point: PointDefinition): [PointDefinition] | [PointDefinition, PointDefinition] {
	if (!point.mirror)
		return [point];

	const { pos, transforms, pointType } = point;
	const type = pointType && (pos[0] < CharacterSize.WIDTH / 2 ? `${pointType}_r` : `${pointType}_l`);

	return [{ ...point, mirror: false, pointType: type }, {
		pos: [CharacterSize.WIDTH - pos[0], pos[1]],
		transforms: transforms.map(MirrorTransform),
		mirror: true,
		pointType: MirrorBoneLike(type),
	}];
}
