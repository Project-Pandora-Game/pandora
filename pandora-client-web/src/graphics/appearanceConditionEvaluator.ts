import type { Immutable } from 'immer';
import {
	AppearanceItemProperties,
	AppearancePose,
	Assert,
	AssertNever,
	AssetFrameworkCharacterState,
	AssetManager,
	AtomicCondition,
	BoneName,
	ConditionOperator,
	Item,
	TransformDefinition,
	type BoneDefinition,
} from 'pandora-common';
import { useMemo } from 'react';
import { EvaluateCondition, RotateVector } from './utility.ts';

export abstract class ConditionEvaluatorBase {
	public readonly assetManager: AssetManager;
	public readonly valueOverrides: Readonly<Record<BoneName, number>> | undefined;

	constructor(assetManager: AssetManager, valueOverrides?: Record<BoneName, number>) {
		this.assetManager = assetManager;
		this.valueOverrides = valueOverrides;
	}

	//#region Point transform
	public abstract evalCondition(condition: Immutable<AtomicCondition>, item: Item | null): boolean;

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

	public evalTransform([x, y]: readonly [number, number], transforms: Immutable<TransformDefinition[]>, _mirror: boolean, item: Item | null): [number, number] {
		let resX = x;
		let resY = y;
		for (const transform of transforms) {
			const { type, condition } = transform;
			if (this.valueOverrides != null && (type === 'const-shift' || type === 'const-rotate')) {
				continue;
			}
			if (condition && !EvaluateCondition(condition, (c) => this.evalCondition(c, item))) {
				continue;
			}
			if (type === 'const-shift') {
				resX += transform.value.x;
				resY += transform.value.y;
				continue;
			}
			const boneName = transform.bone;
			const rotation = this.valueOverrides ? (this.valueOverrides[boneName] ?? 0) : this.getBoneLikeValue(boneName);

			switch (type) {
				case 'const-rotate':
				case 'rotate': {
					const bone = this._getBone(boneName);
					let vecX = resX - bone.x;
					let vecY = resY - bone.y;
					const value = type === 'const-rotate' ? transform.value : transform.value * rotation;
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
	//#endregion

	protected _getBone(bone: string): BoneDefinition {
		const definition = this.assetManager.getBoneByName(bone);
		if (definition == null)
			throw new Error(`Attempt to get pose for unknown bone: ${bone}`);
		return definition;
	}

	public abstract getBoneLikeValue(name: string): number;
}

export class AppearanceConditionEvaluator extends ConditionEvaluatorBase {
	public readonly pose: Immutable<AppearancePose>;
	public readonly attributes: ReadonlySet<string>;

	/** Whether the character is currently mid-blink */
	public readonly blinking: boolean;

	constructor(character: AssetFrameworkCharacterState, blinking: boolean, valueOverrides?: Record<BoneName, number>) {
		super(character.assetManager, valueOverrides);
		this.pose = character.actualPose;
		this.attributes = AppearanceItemProperties(character.items).attributes;
		this.blinking = blinking;
	}

	private readonly _evalCache = new Map<string, boolean>();
	public override evalCondition(condition: Immutable<AtomicCondition>, item: Item | null): boolean {
		if ('module' in condition) {
			Assert(condition.module != null);
			const m = (item?.isType('roomDeviceWearablePart') ? item?.roomDevice?.getModules() : item?.getModules())
				?.get(condition.module);
			// If there is no item or no module, the value is always not equal
			if (!m) {
				return condition.operator === '!=';
			}
			return m.evalCondition(condition.operator, condition.value);
		} else if ('bone' in condition) {
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
		} else if ('attribute' in condition) {
			Assert(condition.attribute != null);
			if (condition.attribute[0] === '!') {
				return !this.attributes.has(condition.attribute.slice(1));
			} else {
				return this.attributes.has(condition.attribute);
			}
		} else if ('legs' in condition) {
			Assert(condition.legs != null);
			if (condition.legs.startsWith('!')) {
				return this.pose.legs !== condition.legs.slice(1);
			}
			return this.pose.legs === condition.legs;
		} else if ('view' in condition) {
			Assert(condition.view != null);
			return this.pose.view === condition.view;
		} else if ('blinking' in condition) {
			Assert(condition.blinking != null);
			return this.blinking === condition.blinking;
		} else {
			AssertNever(condition);
		}
	}

	public override getBoneLikeValue(name: string): number {
		return this.pose.bones[name] || 0;
	}
}

type EvaluatorInstanceCacheValueEntry = {
	normal: AppearanceConditionEvaluator;
	blink: AppearanceConditionEvaluator;
};

type EvaluatorInstanceCacheEntry = {
	base: EvaluatorInstanceCacheValueEntry;
	withOverrides: WeakMap<Record<BoneName, number>, {
		normal: AppearanceConditionEvaluator;
		blink: AppearanceConditionEvaluator;
	}>;
};

const evaluatorInstanceCache = new WeakMap<AssetFrameworkCharacterState, EvaluatorInstanceCacheEntry>();

/**
 * Gets an appearance condition evaluator for the character
 * @param characterState - Character state
 * @param isBlinking - Whether the character is currently mid-blink
 * @param valueOverrides - Overrides for bone values the evaluator should use
 * @returns The requested appearance condition evaluator
 */
export function useAppearanceConditionEvaluator(characterState: AssetFrameworkCharacterState, isBlinking: boolean = false, valueOverrides?: Record<BoneName, number>): AppearanceConditionEvaluator {
	return useMemo((): AppearanceConditionEvaluator => {
		let cacheEntry: EvaluatorInstanceCacheEntry | undefined = evaluatorInstanceCache.get(characterState);
		if (cacheEntry === undefined) {
			cacheEntry = {
				base: {
					normal: new AppearanceConditionEvaluator(characterState, false),
					blink: new AppearanceConditionEvaluator(characterState, true),
				},
				withOverrides: new WeakMap(),
			};
			evaluatorInstanceCache.set(characterState, cacheEntry);
		}

		let value: EvaluatorInstanceCacheValueEntry = cacheEntry.base;
		if (valueOverrides != null) {
			let overrideValue: EvaluatorInstanceCacheValueEntry | undefined = cacheEntry.withOverrides.get(valueOverrides);
			if (overrideValue === undefined) {
				overrideValue = {
					normal: new AppearanceConditionEvaluator(characterState, false, valueOverrides),
					blink: new AppearanceConditionEvaluator(characterState, true, valueOverrides),
				};
				cacheEntry.withOverrides.set(valueOverrides, overrideValue);
			}
			value = overrideValue;
		}

		return isBlinking ? value.blink : value.normal;
	}, [characterState, isBlinking, valueOverrides]);
}

export class StandaloneConditionEvaluator extends ConditionEvaluatorBase {
	private readonly _evalCache = new Map<string, boolean>();
	public override evalCondition(condition: Immutable<AtomicCondition>, item: Item | null): boolean {
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

	public override getBoneLikeValue(_name: string): number {
		throw new Error(`Attempt to get bone value in standalone evaluator`);
	}
}

export function useStandaloneConditionEvaluator(assetManager: AssetManager): StandaloneConditionEvaluator {
	return useMemo(() => new StandaloneConditionEvaluator(assetManager), [assetManager]);
}
