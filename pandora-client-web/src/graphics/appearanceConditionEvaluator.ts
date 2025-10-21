import type { Immutable } from 'immer';
import {
	AppearanceItemProperties,
	AppearancePose,
	Assert,
	AssertNever,
	AssetManager,
	AtomicCondition,
	CharacterPoseTransforms,
	Item,
	type AppearanceItems,
	type BoneDefinition,
	type WearableAssetType,
} from 'pandora-common';
import { DEG_TO_RAD, Matrix, Point } from 'pixi.js';
import { useMemo } from 'react';

export class CharacterPoseEvaluator extends CharacterPoseTransforms {
	public evalBoneTransform(bone: string, matrix?: Matrix): Matrix {
		matrix ??= new Matrix();

		const bones: BoneDefinition[] = [];
		let parentBone: BoneDefinition | undefined = this._getBone(bone);
		while (parentBone != null) {
			bones.unshift(parentBone);
			parentBone = parentBone.parent;
		}

		matrix.identity();
		const link = new Point();
		for (const b of bones) {
			link.set(b.x, b.y);
			matrix.apply(link, link);
			matrix
				.translate(-link.x, -link.y)
				.rotate(this.getBoneLikeValue(b.name) * DEG_TO_RAD * (b.isMirror ? -1 : 1))
				.translate(link.x, link.y);
		}

		return matrix;
	}
}

const poseEvaluatorInstanceCache = new WeakMap<AssetManager, WeakMap<Immutable<AppearancePose>, CharacterPoseEvaluator>>();
function GetCharacterPoseEvaluator(assetManager: AssetManager, pose: Immutable<AppearancePose>): CharacterPoseEvaluator {
	let assetManagerCache = poseEvaluatorInstanceCache.get(assetManager);
	if (assetManagerCache === undefined) {
		assetManagerCache = new WeakMap();
		poseEvaluatorInstanceCache.set(assetManager, assetManagerCache);
	}

	let cacheEntry: CharacterPoseEvaluator | undefined = assetManagerCache.get(pose);
	if (cacheEntry === undefined) {
		cacheEntry = new CharacterPoseEvaluator(assetManager, pose);
		assetManagerCache.set(pose, cacheEntry);
	}

	return cacheEntry;
}
/**
 * Gets an pose evaluator for the character
 * @param characterState - Character state
 * @returns The requested appearance condition evaluator
 */
export function useCharacterPoseEvaluator(assetManager: AssetManager, pose: Immutable<AppearancePose>): CharacterPoseEvaluator {
	return useMemo(() => GetCharacterPoseEvaluator(assetManager, pose), [assetManager, pose]);
}

export class AppearanceConditionEvaluator {
	public readonly attributes: ReadonlySet<string>;

	/** Whether the character is currently mid-blink */
	public readonly blinking: boolean;

	public readonly poseEvaluator: CharacterPoseEvaluator;

	constructor(poseEvaluator: CharacterPoseEvaluator, wornItems: AppearanceItems<WearableAssetType>, blinking: boolean) {
		this.poseEvaluator = poseEvaluator;
		this.attributes = AppearanceItemProperties(wornItems).attributes;
		this.blinking = blinking;
	}

	public evalCondition(condition: Immutable<AtomicCondition>, item: Item | null): boolean {
		if ('module' in condition) {
			Assert(condition.module != null);
			const m = (item?.isType('roomDeviceWearablePart') ? item?.roomDevice?.getModules() : item?.getModules())
				?.get(condition.module);
			// If there is no item or no module, the value is always not equal
			if (!m) {
				return condition.operator === '!=';
			}
			return m.evalCondition(condition.operator, condition.value);
		} else if ('attribute' in condition) {
			Assert(condition.attribute != null);
			if (condition.attribute[0] === '!') {
				return !this.attributes.has(condition.attribute.slice(1));
			} else {
				return this.attributes.has(condition.attribute);
			}
		} else if ('blinking' in condition) {
			Assert(condition.blinking != null);
			return this.blinking === condition.blinking;
		}

		return this.poseEvaluator.evalCondition(condition);
	}
}

type EvaluatorInstanceCacheValueEntry = {
	normal: AppearanceConditionEvaluator;
	blink: AppearanceConditionEvaluator;
};

const evaluatorInstanceCache = new WeakMap<CharacterPoseEvaluator, WeakMap<AppearanceItems<WearableAssetType>, EvaluatorInstanceCacheValueEntry>>();
/**
 * Gets an appearance condition evaluator for the character
 * @param characterState - Character state
 * @param isBlinking - Whether the character is currently mid-blink
 * @returns The requested appearance condition evaluator
 */
export function useAppearanceConditionEvaluator(poseEvaluator: CharacterPoseEvaluator, wornItems: AppearanceItems<WearableAssetType>, isBlinking: boolean = false): AppearanceConditionEvaluator {
	return useMemo((): AppearanceConditionEvaluator => {
		let poseCacheEntry = evaluatorInstanceCache.get(poseEvaluator);
		if (poseCacheEntry === undefined) {
			poseCacheEntry = new WeakMap();
			evaluatorInstanceCache.set(poseEvaluator, poseCacheEntry);
		}

		let cacheEntry: EvaluatorInstanceCacheValueEntry | undefined = poseCacheEntry.get(wornItems);
		if (cacheEntry === undefined) {
			cacheEntry = {
				normal: new AppearanceConditionEvaluator(poseEvaluator, wornItems, false),
				blink: new AppearanceConditionEvaluator(poseEvaluator, wornItems, true),
			};
			poseCacheEntry.set(wornItems, cacheEntry);
		}

		return isBlinking ? cacheEntry.blink : cacheEntry.normal;
	}, [poseEvaluator, wornItems, isBlinking]);
}

export class StandaloneConditionEvaluator {
	private readonly _evalCache = new Map<string, boolean>();
	public evalCondition(condition: Immutable<AtomicCondition>, item: Item | null): boolean {
		if ('module' in condition) {
			Assert(condition.module != null);
			const m = item?.getModules().get(condition.module);
			// If there is no item or no module, the value is always not equal
			if (!m) {
				return condition.operator === '!=';
			}
			return m.evalCondition(condition.operator, condition.value);
		} else if ('bone' in condition) {
			Assert(condition.bone != null);
			return false;
		} else if ('armType' in condition) {
			Assert(condition.armType != null);
			return false;
		} else if ('attribute' in condition) {
			Assert(condition.attribute != null);
			return false;
		} else if ('legs' in condition) {
			Assert(condition.legs != null);
			return false;
		} else if ('view' in condition) {
			Assert(condition.view != null);
			return false;
		} else if ('blinking' in condition) {
			Assert(condition.blinking != null);
			return false;
		} else {
			AssertNever(condition);
		}
	}
}

export function useStandaloneConditionEvaluator(): StandaloneConditionEvaluator {
	return useMemo(() => new StandaloneConditionEvaluator(), []);
}
