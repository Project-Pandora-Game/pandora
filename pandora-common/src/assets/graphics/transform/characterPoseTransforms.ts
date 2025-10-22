import type { Immutable } from 'immer';
import { DEG_TO_RAD, DualQuaternion, Matrix4x4, Quaternion, Vector2, Vector2Rotate, Vector3, Vector4 } from '../../../math/index.ts';
import { Assert, AssertNever } from '../../../utility/misc.ts';
import type { AssetManager } from '../../assetManager.ts';
import type { AppearancePose } from '../../state/characterStatePose.ts';
import type { AtomicCondition, AtomicPoseCondition, BoneName, ConditionOperator } from '../conditions.ts';
import type { BoneDefinition } from '../graphics.ts';
import type { PointSkinningDefinition, TransformDefinition } from '../points.ts';

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

	public skinPoint(position: Vector2, skinning: Immutable<PointSkinningDefinition>, pretransforms?: Immutable<TransformDefinition[]>): void {
		if (pretransforms != null) {
			[position.x, position.y] = this.evalTransform([position.x, position.y], pretransforms);
		}

		const skinQuaterion = new DualQuaternion();
		const tmp = new DualQuaternion();
		for (const { bone, weight } of skinning) {
			if (weight === 0)
				continue;

			this._getBoneTransformQuaterion(tmp, bone);
			tmp.multiplyByScalar(weight);
			skinQuaterion.add(tmp);
		}

		const matrix = new Matrix4x4();
		skinQuaterion.toTransformationMatrix(matrix);

		const vec4 = new Vector4(position.x, position.y, 0, 1);
		vec4.multiplyByMatrix4x4(matrix);
		position.x = vec4.x;
		position.y = vec4.y;
	}

	private readonly _boneTransformCache = new Map<BoneName, DualQuaternion>();
	protected _getBoneTransformQuaterion(target: DualQuaternion, bone: BoneName | null): void {
		if (bone == null) {
			target.set(1, 0, 0, 0, 0, 0, 0, 0);
			return;
		}

		let result = this._boneTransformCache.get(bone);
		if (result === undefined) {
			result = new DualQuaternion().set(1, 0, 0, 0, 0, 0, 0, 0);
			this._boneTransformCache.set(bone, result);

			const boneDef = this._getBone(bone);

			const bonePos = new Vector2(boneDef.x, boneDef.y);
			if (boneDef.parent != null) {
				this._getBoneTransformQuaterion(result, boneDef.parent?.name ?? null);
				this.skinPoint(bonePos, [{ bone: boneDef.parent.name, weight: 1 }]);
			}
			const localTransform = new DualQuaternion();
			localTransform.fromRotationAroundPoint(
				Quaternion.fromAxisAngle(new Vector3(0, 0, 1), this.getBoneLikeValue(bone) * DEG_TO_RAD * (boneDef.isMirror ? -1 : 1)),
				new Vector3(bonePos.x, bonePos.y, 0),
			);

			// Apply parent transformation
			localTransform.multiply(result);
			result.assign(localTransform);
		}
		target.assign(result);
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
