import { Immutable, freeze, produce } from 'immer';
import { clamp, isEqual } from 'lodash-es';
import * as z from 'zod';
import { CalculateObjectKeysDelta } from '../../utility/deltas.ts';
import type { Satisfies } from '../../utility/misc.ts';
import type { AssetManager } from '../assetManager.ts';
import type { BoneType, CharacterView, LayerPriority } from '../graphics/index.ts';
import { ArmFingersSchema, ArmPoseSchema, ArmRotationSchema, ArmSegmentOrderSchema, BoneName, BoneNameSchema, CharacterViewSchema, LegSideOrderSchema, LegsPoseSchema } from '../graphics/index.ts';

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

export const AppearanceLegsPoseSchema = z.object({
	upper: LegSideOrderSchema.catch('left'),
	pose: LegsPoseSchema.catch('standing'),
});
export type AppearanceLegsPose = z.infer<typeof AppearanceLegsPoseSchema>;

export const BONE_MIN = -180;
export const BONE_MAX = 180;

export const AppearancePoseSchema = z.object({
	bones: z.partialRecord(BoneNameSchema, z.number().int().min(BONE_MIN).max(BONE_MAX)).default({}),
	leftArm: AppearanceArmPoseSchema.default({ position: 'front', rotation: 'forward', fingers: 'spread' }),
	rightArm: AppearanceArmPoseSchema.default({ position: 'front', rotation: 'forward', fingers: 'spread' }),
	armsOrder: AppearanceArmsOrderSchema.default({ upper: 'left' }),
	legs: z.preprocess((value) => {
		return typeof value === 'string' ? { pose: value } : value;
	}, AppearanceLegsPoseSchema).catch({
		upper: 'left',
		pose: 'standing',
	}),
	view: CharacterViewSchema.catch('front'),
});
export type AppearancePose = z.infer<typeof AppearancePoseSchema>;
export type CharacterArmsPose = Readonly<Pick<AppearancePose, 'leftArm' | 'rightArm' | 'armsOrder'>>;

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
		legs: {
			upper: 'left',
			pose: 'standing',
		},
		view: 'front',
	};
}

export type PartialAppearancePose<Bones extends BoneName = BoneName> = {
	bones?: Partial<Record<Bones, number>>;
	arms?: Partial<AppearanceArmPose>;
	leftArm?: Partial<AppearanceArmPose>;
	rightArm?: Partial<AppearanceArmPose>;
	armsOrder?: Partial<AppearanceArmsOrder>;
	legs?: Partial<AppearanceLegsPose>;
	view?: CharacterView;
};

export const PartialAppearancePoseSchema = z.object({
	bones: z.partialRecord(BoneNameSchema, z.number().int().min(BONE_MIN).max(BONE_MAX)).optional().catch(undefined),
	arms: AppearanceArmPoseSchema.partial().optional().catch(undefined),
	leftArm: AppearanceArmPoseSchema.partial().optional().catch(undefined),
	rightArm: AppearanceArmPoseSchema.partial().optional().catch(undefined),
	armsOrder: AppearanceArmsOrderSchema.partial().optional().catch(undefined),
	legs: z.preprocess((value) => {
		return typeof value === 'string' ? { pose: value } : value;
	}, AppearanceLegsPoseSchema.partial()).optional().catch(undefined),
	view: CharacterViewSchema.optional().catch(undefined),
});
type __satisfies__PartialAppearancePoseSchema = Satisfies<PartialAppearancePose<string>, z.infer<typeof PartialAppearancePoseSchema>>;

export type AssetsPosePresetPreview = {
	x?: number;
	y: number;
	size: number;
	basePose?: PartialAppearancePose;
	highlight?: readonly LayerPriority[];
};

export type AssetsPosePreset<Bones extends BoneName = BoneName> = PartialAppearancePose<Bones> & {
	name: string;
	optional?: PartialAppearancePose<Bones>;
	preview?: AssetsPosePresetPreview;
};

export type AssetsPosePresetCategory<Bones extends BoneName = BoneName> = {
	category: string;
	poses: AssetsPosePreset<Bones>[];
	preview?: AssetsPosePresetPreview;
};

export type AssetsPosePresets<Bones extends BoneName = BoneName> = AssetsPosePresetCategory<Bones>[];

export function MergePartialAppearancePoses(base: Immutable<PartialAppearancePose>, extend?: Immutable<PartialAppearancePose>): PartialAppearancePose {
	if (extend == null)
		return base;

	return {
		bones: { ...base.bones, ...extend.bones },
		arms: { ...base.arms, ...extend.arms },
		leftArm: { ...base.leftArm, ...extend.leftArm },
		rightArm: { ...base.rightArm, ...extend.rightArm },
		armsOrder: { ...base.armsOrder, ...extend.armsOrder },
		legs: { ...base.legs, ...extend.legs },
		view: extend.view ?? base.view,
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
				!isEqual(basePose.leftArm, leftArm) ||
				!isEqual(basePose.rightArm, rightArm);

			if (armsChanged) {
				draft.leftArm = freeze(leftArm, true);
				draft.rightArm = freeze(rightArm, true);
			}

			const armsOrder = { ...basePose.armsOrder, ...pose.armsOrder };
			if (!isEqual(basePose.armsOrder, armsOrder)) {
				draft.armsOrder = freeze(armsOrder, true);
			}
		}

		// Update legs
		{
			const legs = { ...basePose.legs, ...pose.legs };
			if (!isEqual(basePose.legs, legs)) {
				draft.legs = freeze(legs, true);
			}
		}

		// Update bones
		if (pose.bones != null) {
			for (const bone of assetManager.getAllBones()) {
				const newValue = pose.bones[bone.name];

				if (boneTypeFilter !== undefined && bone.type !== boneTypeFilter)
					continue;
				if (!missingBonesAsZero && newValue == null)
					continue;

				draft.bones[bone.name] = (newValue != null && Number.isInteger(newValue)) ? clamp(newValue, BONE_MIN, BONE_MAX) : 0;
			}
		}
	});
}

// The code below needs to be updated if appearance pose's properties change
type __satisfies__CalculateAppearancePosesDeltaKeys = Satisfies<keyof AppearancePose, 'bones' | 'leftArm' | 'rightArm' | 'armsOrder' | 'legs' | 'view'>;
export function CalculateAppearancePosesDelta(assetManager: AssetManager, base: Immutable<AppearancePose>, target: Immutable<AppearancePose>): PartialAppearancePose {
	const result: PartialAppearancePose = {};

	for (const bone of assetManager.getAllBones()) {
		if ((base.bones[bone.name] ?? 0) !== (target.bones[bone.name] ?? 0)) {
			result.bones ??= {};
			result.bones[bone.name] = (target.bones[bone.name] ?? 0);
		}
	}

	result.leftArm = CalculateObjectKeysDelta(base.leftArm, target.leftArm);
	result.rightArm = CalculateObjectKeysDelta(base.rightArm, target.rightArm);
	result.armsOrder = CalculateObjectKeysDelta(base.armsOrder, target.armsOrder);
	result.legs = CalculateObjectKeysDelta(base.legs, target.legs);

	if (base.view !== target.view) {
		result.view = target.view;
	}

	return result;
}

/**
 * Takes two poses and combines them using a ratio.
 * Bones are moved to a valid pose based on the ratio, while enum values are set to the closest of the two values.
 * @param poseA - Pose A, used at ratio=0
 * @param poseB - Pose B, used at ratio=1
 * @param ratio - The ratio to use, must be a value in range [0, 1]
 * @returns The combined pose.
 */
export function CombineAppearancePoses(
	poseA: Immutable<AppearancePose>,
	poseB: Immutable<AppearancePose>,
	ratio: number,
): Immutable<AppearancePose> {
	if (ratio <= 0)
		return poseA;

	if (ratio >= 1)
		return poseB;

	const pickA = ratio < 0.5;

	function combineArmsPose(armPoseA: Immutable<AppearanceArmPose>, armPoseB: Immutable<AppearanceArmPose>): Immutable<AppearanceArmPose> {
		return {
			position: pickA ? armPoseA.position : armPoseB.position,
			rotation: pickA ? armPoseA.rotation : armPoseB.rotation,
			fingers: pickA ? armPoseA.fingers : armPoseB.fingers,
		};
	}

	const bones: Record<string, number | undefined> = {};

	for (const bone of new Set([...Object.keys(poseA.bones), ...Object.keys(poseB.bones)])) {
		let a = poseA.bones[bone] ?? 0;
		let b = poseB.bones[bone] ?? 0;
		const diff = Math.abs(a - b);
		// If it is smaller distance to wrap around, then do that
		if (a < 0 && (Math.abs(a + 360 - b) < diff)) {
			a += 360;
		} else if (b < 0 && (Math.abs(a - (b + 360)) < diff)) {
			b += 360;
		}
		let res = Math.round((1 - ratio) * a + ratio * b);
		// Fix for wrap-around
		if (res > 360) {
			res -= 360;
		}
		bones[bone] = res;
	}

	return {
		bones,
		leftArm: combineArmsPose(poseA.leftArm, poseB.leftArm),
		rightArm: combineArmsPose(poseA.rightArm, poseB.rightArm),
		armsOrder: {
			upper: pickA ? poseA.armsOrder.upper : poseB.armsOrder.upper,
		},
		legs: pickA ? poseA.legs : poseB.legs,
		view: pickA ? poseA.view : poseB.view,
	};
}
