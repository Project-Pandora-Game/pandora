import type { Immutable } from 'immer';
import { APPEARANCE_POSE_DEFAULT, AssetManager, CloneDeepMutable, Vector2, type BoneDefinition, type PointDefinition } from 'pandora-common';
import { memo, useMemo, type ReactElement } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { CharacterPoseEvaluator } from '../../../graphics/appearanceConditionEvaluator.ts';
import { CollectVariablesFromTransform, GeneratePossiblePosesRecursive, type PointTransformVariable } from './pointTransformComparison.ts';

interface PointTransformComparsionDetailProps {
	point: Immutable<PointDefinition>;
}

type PoseComparisonResult = {
	poseVariables: PointTransformVariable[];
	meanError: number;
};

const ComparePointTransformsCache = new WeakMap<AssetManager, WeakMap<Immutable<PointDefinition>, PoseComparisonResult>>();
function ComparePointTransforms(assetManager: AssetManager, point: Immutable<PointDefinition>): PoseComparisonResult {
	let assetManagerCache = ComparePointTransformsCache.get(assetManager);
	if (assetManagerCache === undefined) {
		assetManagerCache = new WeakMap();
		ComparePointTransformsCache.set(assetManager, assetManagerCache);
	}

	{
		const cacheResult = assetManagerCache.get(point);
		if (cacheResult !== undefined)
			return cacheResult;
	}

	const poseVariablesSet = new Set<PointTransformVariable>();

	for (const transform of point.transforms) {
		CollectVariablesFromTransform(transform, poseVariablesSet);
	}
	for (const skinBone of point.skinning ?? []) {
		let bone: BoneDefinition | undefined = assetManager.getBoneByName(skinBone.bone);
		while (bone != null) {
			poseVariablesSet.add(`bone:${bone.name}`);
			bone = bone.parent;
		}
	}

	const poseVariables = Array.from(poseVariablesSet);
	const skinningTransforms = point.transforms.filter((t) => t.type !== 'rotate');

	let totalError: number = 0;
	let count = 0;

	const skinResult = new Vector2();
	const oldResult = new Vector2();
	const errorVec = new Vector2();

	for (const pose of GeneratePossiblePosesRecursive(poseVariables, CloneDeepMutable(APPEARANCE_POSE_DEFAULT))) {
		const evaluator = new CharacterPoseEvaluator(assetManager, pose);

		skinResult.set(point.pos[0], point.pos[1]);
		if (point.skinning) {
			evaluator.skinPoint(
				skinResult,
				point.skinning,
				skinningTransforms,
			);
		}

		oldResult.set(point.pos[0], point.pos[1]);
		evaluator.evalTransformVec(
			oldResult,
			point.transforms,
		);

		const error = errorVec.assign(skinResult).substract(oldResult).getLengthSq();
		totalError += error;
		count++;
	}

	const result: PoseComparisonResult = {
		poseVariables,
		meanError: totalError / count,
	};
	assetManagerCache.set(point, result);

	return result;
}

export const PointTransformComparsionDetail = memo(function PointTransformComparsionDetail({ point }: PointTransformComparsionDetailProps): ReactElement {
	const assetManager = useAssetManager();

	const evaluated = useMemo(() => {
		return ComparePointTransforms(assetManager, point);
	}, [assetManager, point]);

	return (
		<span>Mean error: { evaluated.meanError.toFixed(2) }</span>
	);
});
