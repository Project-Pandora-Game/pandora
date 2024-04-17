import { Immutable, freeze, produce } from 'immer';
import _ from 'lodash';
import { z } from 'zod';
import type { AssetManager } from '../assetManager';
import type { BoneType, CharacterView, LegsPose } from '../graphics/graphics';
import type { Satisfies } from '../../utility';
import { ArmFingersSchema, ArmPoseSchema, ArmRotationSchema, ArmSegmentOrderSchema, BoneName, BoneNameSchema, BoneState, CharacterViewSchema, LegsPoseSchema } from '../graphics/graphics';

// Fix for pnpm resolution weirdness
import type { } from '../../validation';

export const AppearanceArmPoseSchema = z.object({
	position: ArmPoseSchema.catch('front'),
	rotation: ArmRotationSchema.catch('forward'),
	fingers: ArmFingersSchema.catch('spread'),
});
export type AppearanceArmPose = z.infer<typeof AppearanceArmPoseSchema>;

export const AppearanceArmsOrderSchema = z.object({
	upper: ArmSegmentOrderSchema.catch('left'),
});
export type AppearanceArmsOrder = z.infer<typeof AppearanceArmsOrderSchema>;

export const BONE_MIN = -180;
export const BONE_MAX = 180;

export const AppearancePoseSchema = z.object({
	bones: z.record(BoneNameSchema, z.number().int().min(BONE_MIN).max(BONE_MAX).optional()).default({}),
	leftArm: AppearanceArmPoseSchema.default({}),
	rightArm: AppearanceArmPoseSchema.default({}),
	armsOrder: AppearanceArmsOrderSchema.default({}),
	legs: LegsPoseSchema.default('standing'),
	view: CharacterViewSchema.catch('front'),
});
export type AppearancePose = z.infer<typeof AppearancePoseSchema>;
export type CharacterArmsPose = Readonly<Pick<AppearancePose, 'leftArm' | 'rightArm' | 'armsOrder'>>;

export type AppearanceCharacterPose = ReadonlyMap<BoneName, BoneState>;
function GetDefaultAppearanceArmPose(): AppearanceArmPose {
	return {
		position: 'front',
		rotation: 'forward',
		fingers: 'spread',
	};
}

export function GetDefaultAppearancePose(): AppearancePose {
	return {
		bones: {},
		leftArm: GetDefaultAppearanceArmPose(),
		rightArm: GetDefaultAppearanceArmPose(),
		armsOrder: { upper: 'left' },
		legs: 'standing',
		view: 'front',
	};
}

export type PartialAppearancePose<Bones extends BoneName = BoneName> = {
	bones?: Partial<Record<Bones, number>>;
	arms?: Partial<AppearanceArmPose>;
	leftArm?: Partial<AppearanceArmPose>;
	rightArm?: Partial<AppearanceArmPose>;
	armsOrder?: Partial<AppearanceArmsOrder>;
	legs?: LegsPose;
	view?: CharacterView;
};

export const PartialAppearancePoseSchema = z.object({
	bones: z.record(BoneNameSchema, z.number().int().min(BONE_MIN).max(BONE_MAX).optional()).optional(),
	arms: AppearanceArmPoseSchema.partial().optional(),
	leftArm: AppearanceArmPoseSchema.partial().optional(),
	rightArm: AppearanceArmPoseSchema.partial().optional(),
	armsOrder: AppearanceArmsOrderSchema.partial().optional(),
	legs: LegsPoseSchema.optional(),
	view: CharacterViewSchema.optional(),
});
type __satisfies__PartialAppearancePoseSchema = Satisfies<PartialAppearancePose<string>, z.infer<typeof PartialAppearancePoseSchema>>;

export type AssetsPosePreset<Bones extends BoneName = BoneName> = PartialAppearancePose<Bones> & {
	name: string;
	optional?: PartialAppearancePose<Bones>;
};

export type AssetsPosePresets<Bones extends BoneName = BoneName> = {
	category: string;
	poses: AssetsPosePreset<Bones>[];
}[];

export function MergePartialAppearancePoses(base: Immutable<PartialAppearancePose>, extend?: Immutable<PartialAppearancePose>): PartialAppearancePose {
	if (extend == null)
		return base;

	return {
		bones: { ...base.bones, ...extend.bones },
		arms: { ...base.arms, ...extend.arms },
		leftArm: { ...base.leftArm, ...extend.leftArm },
		rightArm: { ...base.rightArm, ...extend.rightArm },
		armsOrder: { ...base.armsOrder, ...extend.armsOrder },
		legs: base.legs ?? extend.legs,
		view: base.view ?? extend.view,
	};
}

export function ProduceAppearancePose(
	basePose: Immutable<AppearancePose>,
	{
		assetManager,
		boneTypeFilter,
		missingBonesAsZero = false,
	}: {
		assetManager: AssetManager;
		boneTypeFilter?: BoneType;
		/** @default false */
		missingBonesAsZero?: boolean;
	},
	...changes: [(PartialAppearancePose | AssetsPosePreset), ...(PartialAppearancePose | AssetsPosePreset)[]]
): Immutable<AppearancePose> {
	const pose = changes.reduce(MergePartialAppearancePoses);

	return produce(basePose, (draft) => {
		// Update view
		if (pose.view != null) {
			draft.view = pose.view;
		}

		// Update arms
		{
			const leftArm = { ...basePose.leftArm, ...pose.arms, ...pose.leftArm };
			const rightArm = { ...basePose.rightArm, ...pose.arms, ...pose.rightArm };
			const armsChanged =
				!_.isEqual(basePose.leftArm, leftArm) ||
				!_.isEqual(basePose.rightArm, rightArm);

			if (armsChanged) {
				draft.leftArm = freeze(leftArm, true);
				draft.rightArm = freeze(rightArm, true);
			}

			const armsOrder = { ...basePose.armsOrder, ...pose.armsOrder };
			if (!_.isEqual(basePose.armsOrder, armsOrder)) {
				draft.armsOrder = freeze(armsOrder, true);
			}
		}

		// Update legs
		if (pose.legs != null) {
			draft.legs = pose.legs;
		}

		// Update bones
		if (pose.bones != null) {
			for (const bone of assetManager.getAllBones()) {
				const newValue = pose.bones[bone.name];

				if (boneTypeFilter !== undefined && bone.type !== boneTypeFilter)
					continue;
				if (!missingBonesAsZero && newValue == null)
					continue;

				draft.bones[bone.name] = (newValue != null && Number.isInteger(newValue)) ? _.clamp(newValue, BONE_MIN, BONE_MAX) : 0;
			}
		}
	});
}
