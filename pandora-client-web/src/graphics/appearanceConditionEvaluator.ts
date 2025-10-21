import type { Immutable } from 'immer';
import {
	AppearanceItemProperties,
	AppearancePose,
	Assert,
	AssertNever,
	AssetManager,
	AtomicCondition,
	ConditionOperator,
	Item,
	TransformDefinition,
	type AppearanceItems,
	type AtomicPoseCondition,
	type BoneDefinition,
	type WearableAssetType,
} from 'pandora-common';
import { DEG_TO_RAD, Matrix, Point } from 'pixi.js';
import { useMemo } from 'react';
import { RotateVector } from './utility.ts';

export class CharacterPoseEvaluator {
	public readonly assetManager: AssetManager;
	public readonly pose: Immutable<AppearancePose>;

	constructor(assetManager: AssetManager, pose: Immutable<AppearancePose>) {
		this.assetManager = assetManager;
		this.pose = pose;
	}

	//#region Point transform
	public evalTransform([x, y]: readonly [number, number], transforms: Immutable<TransformDefinition[]>): [number, number] {
		let resX = x;
		let resY = y;
		for (const transform of transforms) {
			const { type, condition } = transform;
			if (condition && !condition.every((c) => this.evalCondition(c))) {
				continue;
			}
			if (type === 'const-shift') {
				resX += transform.value.x;
				resY += transform.value.y;
				continue;
			}
			const boneName = transform.bone;
			const rotation = this.getBoneLikeValue(boneName);

			switch (type) {
				case 'rotate': {
					const bone = this._getBone(boneName);
					let vecX = resX - bone.x;
					let vecY = resY - bone.y;
					const value = transform.value * rotation;
					[vecX, vecY] = RotateVector(vecX, vecY, value);
					resX = bone.x + vecX;
					resY = bone.y + vecY;
					break;
				}
				case 'shift': {
					const percent = rotation / 180;
					resX += percent * transform.value.x;
					resY += percent * transform.value.y;
					break;
				}
			}
		}
		return [resX, resY];
	}

	public evalTransformAngle(transforms: Immutable<TransformDefinition[]>): number {
		let angle = 0;
		for (const transform of transforms) {
			const { type, condition } = transform;
			if (condition && !condition.every((c) => this.evalCondition(c))) {
				continue;
			}
			if (type === 'rotate') {
				const boneName = transform.bone;
				const rotation = this.getBoneLikeValue(boneName);
				const value = transform.value * rotation;
				angle += value;
			}
		}
		return angle;
	}
	//#endregion

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

	public evalBoneTransformAngle(bone: string): number {
		let result: number = 0;
		let parentBone: BoneDefinition | undefined = this._getBone(bone);
		while (parentBone != null) {
			result += this.getBoneLikeValue(parentBone.name) * (parentBone.isMirror ? -1 : 1);
			parentBone = parentBone.parent;
		}

		return result;
	}

	protected _getBone(bone: string): BoneDefinition {
		const definition = this.assetManager.getBoneByName(bone);
		if (definition == null)
			throw new Error(`Attempt to get pose for unknown bone: ${bone}`);
		return definition;
	}

	private readonly _evalCache = new Map<string, boolean>();
	public evalCondition(condition: Immutable<AtomicPoseCondition>): boolean {
		if ('bone' in condition) {
			Assert(condition.bone != null);
			const key = `${condition.bone}-${condition.operator}-${condition.value}`;
			let result = this._evalCache.get(key);
			if (result === undefined) {
				const value = this.getBoneLikeValue(condition.bone);
				this._evalCache.set(key, result = this._evalConditionCore(condition, value));
			}
			return result;
		} else if ('armType' in condition) {
			Assert(condition.armType != null);
			const key = `${condition.armType}-${condition.side}-${condition.operator}-${condition.value}`;
			let result = this._evalCache.get(key);
			if (result === undefined) {
				const value = this.pose[`${condition.side}Arm`][condition.armType];
				this._evalCache.set(key, result = this._evalConditionCore(condition, value));
			}
			return result;
		} else if ('legs' in condition) {
			Assert(condition.legs != null);
			if (condition.legs.startsWith('!')) {
				return this.pose.legs.pose !== condition.legs.slice(1);
			}
			return this.pose.legs.pose === condition.legs;
		} else if ('view' in condition) {
			Assert(condition.view != null);
			return this.pose.view === condition.view;
		} else {
			AssertNever(condition);
		}
	}

	protected _evalConditionCore<T extends string | number>({ operator, value }: AtomicCondition & { value: T; operator: ConditionOperator; }, currentValue: T): boolean {
		let diff = 0;
		if (typeof currentValue === 'string' && typeof value === 'string') {
			diff = currentValue.localeCompare(value);
		} else if (typeof currentValue === 'number' && typeof value === 'number') {
			diff = currentValue - value;
		} else {
			AssertNever();
		}
		switch (operator) {
			case '>':
				return diff > 0;
			case '<':
				return diff < 0;
			case '=':
				return diff === 0;
			case '!=':
				return diff !== 0;
			case '>=':
				return diff >= 0;
			case '<=':
				return diff <= 0;
		}
		AssertNever(operator);
	}

	public getBoneLikeValue(name: string): number {
		return this.pose.bones[name] || 0;
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
