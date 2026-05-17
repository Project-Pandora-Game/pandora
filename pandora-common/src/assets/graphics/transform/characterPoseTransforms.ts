import type { Immutable } from 'immer';
import { DEG_TO_RAD, DualQuaternion, Matrix4x4, Quaternion, Vector2, Vector3, Vector4 } from '../../../math/index.ts';
import { Assert, AssertNever } from '../../../utility/misc.ts';
import type { AssetManager } from '../../assetManager.ts';
import type { AppearancePose } from '../../state/characterStatePose.ts';
import type { AtomicCondition, AtomicPoseCondition, BoneName, ConditionOperator } from '../conditions.ts';
import type { BoneDefinition } from '../graphics.ts';
import type { PointSkinningDefinition, TransformDefinition } from '../points.ts';

const TmpMatrix4x4 = /*@__PURE__*/ new Matrix4x4();
const TmpVec3 = /*@__PURE__*/ new Vector3();
const TmpVec4 = /*@__PURE__*/ new Vector4();
const TmpQ1 = /*@__PURE__*/ new Quaternion();
const TmpDQ1 = /*@__PURE__*/ new DualQuaternion();
const TmpDQ2 = /*@__PURE__*/ new DualQuaternion();
const TmpDQ3 = /*@__PURE__*/ new DualQuaternion();

const BONE_ROTATION_AXIS = /*@__PURE__*/ new Vector3(0, 0, 1);

export class CharacterPoseTransforms {
	public readonly assetManager: AssetManager;
	public readonly pose: Immutable<AppearancePose>;
	public readonly inverseProjection: boolean;

	constructor(assetManager: AssetManager, pose: Immutable<AppearancePose>, inverseProjection: boolean) {
		this.assetManager = assetManager;
		this.pose = pose;
		this.inverseProjection = inverseProjection;
	}

	//#region Point transform
	public evalTransform([x, y]: readonly [number, number], transforms: Immutable<TransformDefinition[]>): [number, number] {
		const vec = new Vector2(x, y);
		this.evalTransformVec(vec, transforms);
		return [vec.x, vec.y];
	}

	public evalTransformVec(position: Vector2, transforms: Immutable<TransformDefinition[]>): void {
		for (const transform of transforms) {
			const { type, condition } = transform;
			if (condition && !condition.every((c) => this.evalCondition(c))) {
				continue;
			}

			switch (type) {
				case 'shift': {
					const percent = this.getBoneLikeValue(transform.bone) / 180;
					position.x += percent * transform.value.x;
					position.y += percent * transform.value.y;
					break;
				}
				case 'const-shift':
					position.x += transform.value.x;
					position.y += transform.value.y;
					break;
			}
		}
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
			this.evalTransformVec(position, pretransforms);
		}

		const skinQuaterion = TmpDQ1.set(0, 0, 0, 0, 0, 0, 0, 0);
		const tmp = TmpDQ2;
		let remainingWeight = 1;
		for (const { bone, weight } of skinning) {
			if (weight === 0)
				continue;

			this.getBoneTransformQuaterion(tmp, bone);
			tmp.multiplyByScalar(weight);
			skinQuaterion.add(tmp);
			remainingWeight -= weight;
		}
		if (remainingWeight !== 0) {
			this.getBoneTransformQuaterion(tmp, null);
			tmp.multiplyByScalar(remainingWeight);
			skinQuaterion.add(tmp);
		}

		const matrix = TmpMatrix4x4;
		skinQuaterion.toTransformationMatrix(matrix);

		const vec4 = TmpVec4.set(position.x, position.y, 0, 1);
		vec4.multiplyByMatrix4x4(matrix);

		// TODO: Make this a constant
		const frustumNearDistance = 1815;
		const cameraX = 500;
		const cameraY = 432;
		const scale = frustumNearDistance / (vec4.z + frustumNearDistance);
		position.x = cameraX + scale * (vec4.x - cameraX);
		position.y = cameraY + scale * (vec4.y - cameraY);
	}

	private readonly _boneTransformCache = new Map<BoneName, DualQuaternion>();
	public getBoneTransformQuaterion(target: DualQuaternion, bone: BoneName | null): void {
		if (bone == null) {
			target.set(1, 0, 0, 0, 0, 0, 0, 0);
			return;
		}

		let result = this._boneTransformCache.get(bone);
		if (result === undefined) {
			result = new DualQuaternion(1, 0, 0, 0, 0, 0, 0, 0);
			this._boneTransformCache.set(bone, result);

			const boneDef = this._getBone(bone);

			result.fromRotationAroundPoint(
				TmpQ1.setFromAxisAngle(BONE_ROTATION_AXIS, this.getBoneLikeValue(bone) * DEG_TO_RAD * (boneDef.isMirror ? -1 : 1)),
				TmpVec3.set(boneDef.x, boneDef.y, 0),
			);

			// Apply conditional transforms
			if (boneDef.poseTransforms != null) {
				for (let i = boneDef.poseTransforms.length - 1; i >= 0; i--) {
					const transform = boneDef.poseTransforms[i];
					if (transform.condition.every((c) => this.evalCondition(c))) {
						const transformQ = TmpDQ3;
						const axis = TmpVec3.set(transform.axis[0], transform.axis[1], transform.axis[2]);
						if (this.inverseProjection) {
							axis.x *= -1;
							axis.z *= -1;
						}
						const q = TmpQ1.setFromAxisAngle(axis, transform.rotation * DEG_TO_RAD);
						transformQ.fromRotationAroundPoint(q, TmpVec3.set(boneDef.x, boneDef.y, 0));
						result.leftMultiply(transformQ);
					}
				}
			}

			// Apply parent transformation
			if (boneDef.parent != null) {
				const parent = TmpDQ3;
				this.getBoneTransformQuaterion(parent, boneDef.parent?.name ?? null);
				result.leftMultiply(parent);
			}
		}
		target.assign(result);
	}

	protected _getBone(bone: string): BoneDefinition {
		return this.assetManager.getBoneByName(bone);
	}

	public evalCondition(condition: Immutable<AtomicPoseCondition>): boolean {
		if ('bone' in condition) {
			Assert(condition.bone != null);
			const value = this.getBoneLikeValue(condition.bone);
			return this._evalConditionCore(condition, value);
		} else if ('armType' in condition) {
			Assert(condition.armType != null);
			const value = this.pose[`${condition.side}Arm`][condition.armType];
			return this._evalConditionCore(condition, value);
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
