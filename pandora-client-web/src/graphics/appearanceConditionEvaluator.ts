import { AssertNever, AtomicCondition, BoneName, BoneState, CharacterArmsPose, CharacterView, Item, TransformDefinition } from 'pandora-common';
import { useMemo } from 'react';
import { AppearanceContainer, useCharacterAppearanceArmsPose, useCharacterAppearancePose, useCharacterAppearanceView } from '../character/character';
import { EvaluateCondition, RotateVector } from './utility';

export const FAKE_BONES: string[] = ['backView'];

export class AppearanceConditionEvaluator {
	public readonly pose: ReadonlyMap<BoneName, Readonly<BoneState>>;
	public readonly view: CharacterView;
	public readonly arms: CharacterArmsPose;

	constructor(pose: readonly BoneState[], view: CharacterView, arms: CharacterArmsPose) {
		const poseResult = new Map<BoneName, Readonly<BoneState>>();
		for (const bone of pose) {
			poseResult.set(bone.definition.name, bone);
		}
		this.pose = poseResult;
		this.view = view;
		this.arms = arms;
	}

	//#region Point transform
	private readonly _evalCache = new Map<string, boolean>();
	public evalCondition(condition: AtomicCondition, item: Item | null): boolean {
		if ('module' in condition && condition.module != null) {
			const m = item?.modules.get(condition.module);
			// If there is no item or no module, the value is always not equal
			if (!m) {
				return condition.operator === '!=';
			}
			return m.evalCondition(condition.operator, condition.value);
		}

		if ('bone' in condition && condition.bone != null) {
			const key = `${condition.bone}-${condition.operator}-${condition.value}`;
			let result = this._evalCache.get(key);
			if (result === undefined) {
				const value = this.getBoneLikeValue(condition.bone);
				this._evalCache.set(key, result = this._evalConditionCore(condition, value));
			}
			return result;
		}
		if ('armType' in condition && condition.armType != null) {
			const key = `${condition.armType}-${condition.side}-${condition.operator}-${condition.value}`;
			let result = this._evalCache.get(key);
			if (result === undefined) {
				const value = this.arms[`${condition.side}Arm`][condition.armType];
				this._evalCache.set(key, result = this._evalConditionCore(condition, value));
			}
			return result;
		}

		AssertNever();
	}

	private _evalConditionCore<T extends string | number>({ operator, value }: AtomicCondition & { value: T; }, currentValue: T): boolean {
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

	public getBone(bone: string): BoneState {
		const state = this.pose.get(bone);
		if (!state)
			throw new Error(`Attempt to get pose for unknown bone: ${bone}`);
		return state;
	}

	public getBoneLikeValue(name: string): number {
		if (name === 'backView') {
			return this.view === 'back' ? 1 : 0;
		}
		return this.getBone(name).rotation;
	}
}

export function useAppearanceConditionEvaluator(character: AppearanceContainer): AppearanceConditionEvaluator {
	const pose = useCharacterAppearancePose(character);
	const view = useCharacterAppearanceView(character);
	const arms = useCharacterAppearanceArmsPose(character);
	return useMemo(() => new AppearanceConditionEvaluator(pose, view, arms), [pose, view, arms]);
}
