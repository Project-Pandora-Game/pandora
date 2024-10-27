import { AppearanceItemProperties, Assert, AssertNever, AssetFrameworkCharacterState, AtomicCondition, BoneName, BoneState, ConditionOperator, Item, TransformDefinition, AppearancePose, AssetManager } from 'pandora-common';
import { useMemo } from 'react';
import { EvaluateCondition, RotateVector } from './utility';
import type { Immutable } from 'immer';

export abstract class ConditionEvaluatorBase {
	public readonly assetManager: AssetManager;

	constructor(assetManager: AssetManager) {
		this.assetManager = assetManager;
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

	public evalTransform([x, y]: readonly [number, number], transforms: Immutable<TransformDefinition[]>, _mirror: boolean, item: Item | null, valueOverrides?: Record<BoneName, number>): [number, number] {
		let [resX, resY] = [x, y];
		for (const transform of transforms) {
			const { type, condition } = transform;
			if (valueOverrides != null && (type === 'const-shift' || type === 'const-rotate')) {
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
			const bone = this._getBone(boneName);
			const rotation = valueOverrides ? (valueOverrides[boneName] ?? 0) : bone.rotation;

			switch (type) {
				case 'const-rotate':
				case 'rotate': {
					let vecX = resX - bone.definition.x;
					let vecY = resY - bone.definition.y;
					const value = type === 'const-rotate' ? transform.value : transform.value * rotation;
					[vecX, vecY] = RotateVector(vecX, vecY, value);
					resX = bone.definition.x + vecX;
					resY = bone.definition.y + vecY;
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

	protected abstract _getBone(bone: string): BoneState;

	public getBoneLikeValue(name: string): number {
		return this._getBone(name).rotation;
	}
}

export class AppearanceConditionEvaluator extends ConditionEvaluatorBase {
	public readonly pose: Immutable<AppearancePose>;
	public readonly attributes: ReadonlySet<string>;

	/** Whether the character is currently mid-blink */
	public readonly blinking: boolean;

	constructor(character: AssetFrameworkCharacterState, blinking: boolean) {
		super(character.assetManager);
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

	protected override _getBone(bone: string): BoneState {
		const definition = this.assetManager.getBoneByName(bone);
		if (definition == null)
			throw new Error(`Attempt to get pose for unknown bone: ${bone}`);
		return {
			definition,
			rotation: this.pose.bones[definition.name] || 0,
		};
	}
}

/**
 * Gets an appearance condition evaluator for the character
 * @param characterState Character state
 * @param isBlinking Whether the character is currently mid-blink
 * @returns The requested appearance condition evaluator
 */
export function useAppearanceConditionEvaluator(characterState: AssetFrameworkCharacterState, isBlinking: boolean = false): AppearanceConditionEvaluator {
	return useMemo(() => new AppearanceConditionEvaluator(characterState, isBlinking), [characterState, isBlinking]);
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

	protected override _getBone(_bone: string): BoneState {
		throw new Error(`Attempt to get bone in standalone evaluator`);
	}
}

export function useStandaloneConditionEvaluator(assetManager: AssetManager): StandaloneConditionEvaluator {
	return useMemo(() => new StandaloneConditionEvaluator(assetManager), [assetManager]);
}
