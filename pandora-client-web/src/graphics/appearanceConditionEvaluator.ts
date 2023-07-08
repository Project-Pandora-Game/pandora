import { AppearanceItemProperties, Assert, AssertNever, AssetFrameworkCharacterState, AssetManager, AtomicCondition, BoneName, BoneState, CharacterArmsPose, CharacterView, ConditionOperator, Item, TransformDefinition } from 'pandora-common';
import { useMemo } from 'react';
import { EvaluateCondition, RotateVector } from './utility';
import type { Immutable } from 'immer';

export class AppearanceConditionEvaluator {
	public readonly pose: ReadonlyMap<BoneName, Readonly<BoneState>>;
	public readonly view: CharacterView;
	public readonly arms: CharacterArmsPose;
	public readonly attributes: ReadonlySet<string>;

	constructor(character: AssetFrameworkCharacterState) {
		const poseResult = new Map<BoneName, Readonly<BoneState>>();
		for (const bone of character.pose.values()) {
			poseResult.set(bone.definition.name, bone);
		}
		poseResult.set('backView', { definition: character.assetManager.getBoneByName('backView'), rotation: character.view === 'back' ? 1 : 0 });
		this.pose = poseResult;
		this.view = character.view;
		this.arms = character.arms;
		this.attributes = AppearanceItemProperties(character.items).attributes;
	}

	//#region Point transform
	private readonly _evalCache = new Map<string, boolean>();
	public evalCondition(condition: Immutable<AtomicCondition>, item: Item | null): boolean {
		if ('module' in condition) {
			Assert(condition.module != null);
			const m = item?.modules.get(condition.module);
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
				const value = this.arms[`${condition.side}Arm`][condition.armType];
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
		} else {
			AssertNever(condition);
		}
	}

	private _evalConditionCore<T extends string | number>({ operator, value }: AtomicCondition & { value: T; operator: ConditionOperator; }, currentValue: T): boolean {
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

	public evalTransform([x, y]: [number, number], transforms: readonly TransformDefinition[], _mirror: boolean, item: Item | null, valueOverrides?: Record<BoneName, number>): [number, number] {
		let [resX, resY] = [x, y];
		for (const transform of transforms) {
			const { type, condition } = transform;
			if (condition && !EvaluateCondition(condition, (c) => this.evalCondition(c, item))) {
				continue;
			}
			if (type === 'const-shift') {
				resX += transform.value.x;
				resY += transform.value.y;
				continue;
			}
			const boneName = transform.bone;
			const bone = this.getBone(boneName);
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

	private getBone(bone: string): Readonly<BoneState> {
		const state = this.pose.get(bone);
		if (!state)
			throw new Error(`Attempt to get pose for unknown bone: ${bone}`);
		return state;
	}

	public getBoneLikeValue(name: string): number {
		return this.getBone(name).rotation;
	}
}

export function useAppearanceConditionEvaluator(characterState: AssetFrameworkCharacterState): AppearanceConditionEvaluator {
	return useMemo(() => new AppearanceConditionEvaluator(characterState), [characterState]);
}
