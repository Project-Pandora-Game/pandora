import type { Immutable } from 'immer';
import { ArmFingersSchema, ArmPoseSchema, ArmRotationSchema, ArmSegmentOrderSchema, Assert, AssertNever, BONE_MAX, BONE_MIN, CharacterViewSchema, LegSideOrderSchema, LegsPoseSchema, type AppearancePose, type AtomicPoseCondition, type BoneName, type TransformDefinition } from 'pandora-common';

export type PointTransformVariable =
	| 'leftArmPosition' | 'leftArmRotation' | 'leftArmFingers'
	| 'rightArmPosition' | 'rightArmRotation' | 'rightArmFingers'
	| 'armsOrderUpper'
	| 'legsUpper' | 'legsPose'
	| 'view'
	| `bone:${BoneName}`;

function CollectVariablesFromAtomicPoseCondition(condition: Immutable<AtomicPoseCondition>, variableSet: Set<PointTransformVariable>): void {
	if ('bone' in condition) {
		Assert(condition.bone != null);
		variableSet.add(`bone:${condition.bone}`);
	} else if ('armType' in condition) {
		Assert(condition.armType != null);
		switch (condition.armType) {
			case 'rotation':
				variableSet.add(`${condition.side}ArmRotation`);
				break;
			case 'fingers':
				variableSet.add(`${condition.side}ArmFingers`);
				break;
			default:
				AssertNever(condition);
		}
	} else if ('legs' in condition) {
		Assert(condition.legs != null);
		variableSet.add('legsPose');
	} else if ('view' in condition) {
		Assert(condition.view != null);
		variableSet.add('view');
	} else {
		AssertNever(condition);
	}
}

export function CollectVariablesFromTransform(transform: Immutable<TransformDefinition>, variableSet: Set<PointTransformVariable>): void {
	switch (transform.type) {
		case 'rotate':
			variableSet.add(`bone:${transform.bone}`);
			break;
		case 'shift':
			variableSet.add(`bone:${transform.bone}`);
			break;
		case 'const-shift':
			break;
		default:
			AssertNever(transform);
	}
	if (transform.condition != null) {
		for (const c of transform.condition) {
			CollectVariablesFromAtomicPoseCondition(c, variableSet);
		}
	}
}

export function* GeneratePossiblePoses(variable: PointTransformVariable, targetPose: AppearancePose): Generator<AppearancePose, void> {
	switch (variable) {
		case 'leftArmPosition':
			for (const position of ArmPoseSchema.options) {
				targetPose.leftArm.position = position;
				yield targetPose;
			}
			break;
		case 'leftArmRotation':
			for (const rotation of ArmRotationSchema.options) {
				targetPose.leftArm.rotation = rotation;
				yield targetPose;
			}
			break;
		case 'leftArmFingers':
			for (const fingers of ArmFingersSchema.options) {
				targetPose.leftArm.fingers = fingers;
				yield targetPose;
			}
			break;
		case 'rightArmPosition':
			for (const position of ArmPoseSchema.options) {
				targetPose.rightArm.position = position;
				yield targetPose;
			}
			break;
		case 'rightArmRotation':
			for (const rotation of ArmRotationSchema.options) {
				targetPose.rightArm.rotation = rotation;
				yield targetPose;
			}
			break;
		case 'rightArmFingers':
			for (const fingers of ArmFingersSchema.options) {
				targetPose.rightArm.fingers = fingers;
				yield targetPose;
			}
			break;
		case 'armsOrderUpper':
			for (const upper of ArmSegmentOrderSchema.options) {
				targetPose.armsOrder.upper = upper;
				yield targetPose;
			}
			break;
		case 'legsUpper':
			for (const upper of LegSideOrderSchema.options) {
				targetPose.legs.upper = upper;
				yield targetPose;
			}
			break;
		case 'legsPose':
			for (const pose of LegsPoseSchema.options) {
				targetPose.legs.pose = pose;
				yield targetPose;
			}
			break;
		case 'view':
			for (const view of CharacterViewSchema.options) {
				targetPose.view = view;
				yield targetPose;
			}
			break;
		default: {
			Assert(variable.startsWith('bone:'));
			const bone = variable.slice(5);
			for (let v = BONE_MIN; v <= BONE_MAX; v++) {
				targetPose.bones[bone] = v;
				yield targetPose;
			}
			break;
		}
	}
}

export function* GeneratePossiblePosesRecursive(variables: readonly PointTransformVariable[], targetPose: AppearancePose): Generator<AppearancePose, void> {
	if (variables.length === 0) {
		yield targetPose;
		return;
	}

	const variable = variables[0];
	const rest = variables.slice(1);

	for (const value of GeneratePossiblePoses(variable, targetPose)) {
		if (rest.length === 0) {
			yield value;
		} else {
			for (const upper of GeneratePossiblePosesRecursive(rest, value)) {
				yield upper;
			}
		}
	}
}
