import type { Immutable } from 'immer';
import { Vector2Rotate } from '../../../math/index.ts';
import { Assert, AssertNever } from '../../../utility/misc.ts';
import type { AssetManager } from '../../assetManager.ts';
import type { AppearancePose } from '../../state/characterStatePose.ts';
import type { AtomicCondition, AtomicPoseCondition, ConditionOperator } from '../conditions.ts';
import type { BoneDefinition } from '../graphics.ts';
import type { TransformDefinition } from '../points.ts';

export class CharacterPoseTransforms {
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
					[vecX, vecY] = Vector2Rotate(vecX, vecY, value);
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
