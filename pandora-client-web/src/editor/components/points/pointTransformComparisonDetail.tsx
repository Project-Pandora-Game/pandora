import type { Immutable } from 'immer';
import { APPEARANCE_POSE_DEFAULT, Assert, AssetManager, CloneDeepMutable, Vector2, type BoneDefinition, type PointDefinition, type TransformDefinition } from 'pandora-common';
import { memo, useState, type ReactElement, type ReactNode } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { CharacterPoseEvaluator } from '../../../graphics/appearanceConditionEvaluator.ts';
import { CollectVariablesFromTransform, GeneratePossiblePosesRecursive, type PointTransformVariable } from './pointTransformComparison.ts';
import { PointTransformationsTextarea } from './points.tsx';

type PoseComparisonResult = {
	poseVariables: PointTransformVariable[];
	minError: number;
	meanError: number;
	maxError: number;
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

	let minError: number = Infinity;
	let maxError: number = -Infinity;
	let totalError: number = 0;
	let count = 0;

	const skinResult = new Vector2();
	const oldResult = new Vector2();
	const errorVec = new Vector2();

	for (const pose of GeneratePossiblePosesRecursive(poseVariables, CloneDeepMutable(APPEARANCE_POSE_DEFAULT), 5)) {
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
		minError = Math.min(minError, error);
		maxError = Math.max(maxError, error);
		count++;
	}

	const result: PoseComparisonResult = {
		poseVariables,
		minError,
		meanError: totalError / count,
		maxError,
	};

	return result;
}

interface PointTransformComparsionDetailProps {
	point: Immutable<PointDefinition>;
}

export const PointTransformComparsionDetail = memo(function PointTransformComparsionDetail({ point }: PointTransformComparsionDetailProps): ReactElement {
	const assetManager = useAssetManager();

	const [baselineTransforms, setBaselineTransforms] = useState(point.transforms);
	const [result, setResult] = useState<PoseComparisonResult | [text: ReactNode, result: PoseComparisonResult][] | null>(null);

	return (
		<>
			<div>Transformations to compare against:</div>
			<PointTransformationsTextarea transforms={ baselineTransforms } setTransforms={ (newTransforms) => {
				setBaselineTransforms(newTransforms);
				setResult(null);
			} } />
			<Row>
				<Button slim onClick={ () => {
					setResult(ComparePointTransforms(assetManager, point, baselineTransforms));
				} }>
					Calculate
				</Button>
				{ point.skinning != null && point.skinning.length >= 1 ? (
					<Button slim onClick={ () => {
						const SKINNING_PRECISION = 1000;
						const STEP_SIZE = 1;
						const BATCH_SIZE = 1;

						const testResult: [text: ReactNode, result: PoseComparisonResult][] = [];

						Assert(point.skinning != null && point.skinning.length >= 1);
						const base = Math.round(SKINNING_PRECISION * point.skinning[0].weight);
						const start = Math.max(base - 10, 0);
						const end = Math.min(base + 10, SKINNING_PRECISION);

						const testPoint = CloneDeepMutable(point);

						function calculateStep(step: number) {
							for (let i = 0; i < BATCH_SIZE; i++) {
								Assert(testPoint.skinning != null && testPoint.skinning.length >= 1);
								testPoint.skinning[0].weight = step / SKINNING_PRECISION;
								const remainderRatio = Math.max(0, SKINNING_PRECISION - step) / SKINNING_PRECISION;
								for (let j = 1; j < testPoint.skinning.length; j++) {
									testPoint.skinning[j].weight = Math.round(SKINNING_PRECISION * remainderRatio * point.skinning![j].weight) / SKINNING_PRECISION;
								}

								testResult.push([step, ComparePointTransforms(assetManager, testPoint, baselineTransforms)] as const);

								step += STEP_SIZE;
								if (step > end)
									break;
							}
							setResult(testResult.slice());

							if (step <= end) {
								setTimeout(() => {
									calculateStep(step);
								}, 10);
							}
						}

						calculateStep(start);
					} }>
						Calculate variants
					</Button>
				) : null }
			</Row>
			{ result != null ? (
				Array.isArray(result) ? (
					result.map(([text, ires], i) => (
						<span key={ i }>{ text }: { ires.minError.toFixed(2) } / { ires.meanError.toFixed(2) } / { ires.maxError.toFixed(2) }</span>
					))
				) : (
					<span>Error: { result.minError.toFixed(2) } / { result.meanError.toFixed(2) } / { result.maxError.toFixed(2) }</span>
				)
			) : null }
		</>
	);
});
