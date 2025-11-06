import type { Immutable } from 'immer';
import { APPEARANCE_POSE_DEFAULT, AssetManager, CloneDeepMutable, Vector2, type BoneDefinition, type PointDefinition, type TransformDefinition } from 'pandora-common';
import { memo, useEffect, useState, type ReactElement } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { CharacterPoseEvaluator } from '../../../graphics/appearanceConditionEvaluator.ts';
import { CollectVariablesFromTransform, GeneratePossiblePosesRecursive, type PointTransformVariable } from './pointTransformComparison.ts';
import { PointTransformationsTextarea } from './points.tsx';

type PoseComparisonResult = {
	poseVariables: PointTransformVariable[];
	meanError: number;
};

function ComparePointTransforms(assetManager: AssetManager, point: Immutable<PointDefinition>, baseTransforms: Immutable<TransformDefinition[]>): PoseComparisonResult {
	const poseVariablesSet = new Set<PointTransformVariable>();

	for (const transform of point.transforms) {
		CollectVariablesFromTransform(transform, poseVariablesSet);
	}
	for (const transform of baseTransforms) {
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
		} else {
			evaluator.evalTransformVec(
				skinResult,
				point.transforms,
			);
		}

		oldResult.set(point.pos[0], point.pos[1]);
		evaluator.evalTransformVec(
			oldResult,
			baseTransforms,
		);

		const error = errorVec.assign(skinResult).substract(oldResult).getLengthSq();
		totalError += error;
		count++;
	}

	const result: PoseComparisonResult = {
		poseVariables,
		meanError: totalError / count,
	};

	return result;
}

interface PointTransformComparsionDetailProps {
	point: Immutable<PointDefinition>;
}

export const PointTransformComparsionDetail = memo(function PointTransformComparsionDetail({ point }: PointTransformComparsionDetailProps): ReactElement {
	const assetManager = useAssetManager();

	const [baselineTransforms, setBaselineTransforms] = useState(point.transforms);
	const [result, setResult] = useState<PoseComparisonResult | null>(null);

	useEffect(() => {
		setResult(null);
	}, [point]);

	return (
		<>
			<div>Transformations to compare against:</div>
			<PointTransformationsTextarea transforms={ baselineTransforms } setTransforms={ (newTransforms) => {
				setBaselineTransforms(newTransforms);
				setResult(null);
			} } />
			<Button slim onClick={ () => {
				setResult(ComparePointTransforms(assetManager, point, baselineTransforms));
			} }>
				Calculate
			</Button>
			{ result != null ? (
				<span>Mean error: { result.meanError.toFixed(2) }</span>
			) : null }
		</>
	);
});
