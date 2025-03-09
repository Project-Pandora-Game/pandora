import { Immutable } from 'immer';
import { isEqual } from 'lodash-es';
import { ZodEnum } from 'zod';
import { Assert, CloneDeepMutable, IntervalSetIntersection, IsReadonlyArray, type Satisfies } from '../utility/misc.ts';
import type { AssetDefinitionArmOrderPoseLimit, AssetDefinitionArmPoseLimit, AssetDefinitionPoseLimit, AssetDefinitionPoseLimits } from './definitions.ts';
import { ArmFingersSchema, ArmPoseSchema, ArmRotationSchema, ArmSegmentOrderSchema, CharacterViewSchema, LegsPoseSchema } from './graphics/index.ts';
import type { AppearanceArmPose, AppearanceArmsOrder, AppearancePose } from './state/characterStatePose.ts';
import { GetDefaultAppearancePose, PartialAppearancePose } from './state/characterStatePose.ts';

type PoseTypeBase = Partial<Record<string, number | string | Partial<Record<string, number | string>>>>;

/** Converts partial pose object to dimension keys for the pose limit tree. */
type PoseTypeToDimensions<T extends PoseTypeBase> = {
	[K in (keyof T) & string]:
		NonNullable<T[K]> extends Partial<Record<string, number | string>> ? `${K}.${(keyof NonNullable<T[K]>) & string}` :
		K
}[(keyof T) & string];

/** Converts partial pose object to limits for that object */
export type PoseTypeToLimits<T extends PoseTypeBase> = {
	[K in (keyof T) & string]?:
		NonNullable<T[K]> extends Partial<Record<string, number | string>> ? PoseTypeToLimits<NonNullable<T[K]>> :
		NonNullable<T[K]> extends number ? (number | [number, number][]) :
		NonNullable<T[K]> extends string ? (NonNullable<T[K]> | NonNullable<T[K]>[]) :
		never
};

// Create a strongly-typed dimensional data, where each dimension is named and its value is a numeric coordinate.
type TreeLimitDimension = PoseTypeToDimensions<PartialAppearancePose>;
type TreeLimitDimensionData = ReadonlyMap<TreeLimitDimension, [number, number][]>;
type TreeLimitMutableDimensionData = Satisfies<Map<TreeLimitDimension, [number, number][]>, TreeLimitDimensionData>;

class TreeLimit {
	private readonly limit: TreeLimitDimensionData;

	constructor(limit: TreeLimitDimensionData = new Map<TreeLimitDimension, [number, number][]>()) {
		this.limit = limit;
	}

	public validate(data: ReadonlyMap<TreeLimitDimension, number>): boolean {
		for (const [key, value] of data) {
			const limit = this.limit.get(key);
			if (!limit)
				continue;

			if (!limit.some(([min, max]) => value >= min && value <= max))
				return false;
		}
		return true;
	}

	public force(data: ReadonlyMap<TreeLimitDimension, number>): [number, Map<TreeLimitDimension, number>] {
		let totalDiff = 0;
		const newData = new Map<TreeLimitDimension, number>(data);
		for (const [key, value] of data) {
			const limit = this.limit.get(key);
			if (!limit) {
				newData.set(key, value);
				continue;
			}

			let minDiff = Infinity;
			let minDiffValue = value;
			for (const [min, max] of limit) {
				if (value >= min && value <= max) {
					minDiff = 0;
					minDiffValue = value;
					break;
				}
				const diffMin = Math.abs(value - min);
				if (diffMin < minDiff) {
					minDiff = diffMin;
					minDiffValue = min;
				}
				const diffMax = Math.abs(value - max);
				if (diffMax < minDiff) {
					minDiff = diffMax;
					minDiffValue = max;
				}
			}

			totalDiff += minDiff * PoseChangeWeight(key);
			newData.set(key, minDiffValue);
		}
		return [totalDiff, newData];
	}

	public hasNoLimits(): boolean {
		return this.limit.size === 0;
	}

	/**
	 * Selects keys that are present in both limits and calculates the intersection of their values.
	 */
	public intersection(other: TreeLimit): TreeLimit | null {
		const newLimit: TreeLimitMutableDimensionData = new Map<TreeLimitDimension, [number, number][]>();
		for (const [key, value] of this.limit) {
			const otherValue = other.limit.get(key);
			if (!otherValue)
				continue;

			const newValue = IntervalSetIntersection(value, otherValue);
			if (newValue.length === 0)
				return null;

			newLimit.set(key, newValue);
		}
		return new TreeLimit(newLimit);
	}

	/**
	 * Adds all keys from other that are not present in the current limit.
	 */
	public extend(other: TreeLimit): TreeLimit {
		const newLimit: TreeLimitMutableDimensionData = new Map<TreeLimitDimension, [number, number][]>(this.limit);
		for (const [key, value] of other.limit) {
			if (newLimit.has(key))
				continue;

			newLimit.set(key, value);
		}
		return new TreeLimit(newLimit);
	}

	/**
	 * Removes all keys that store the same values as in other.
	 */
	public prune(other: TreeLimit): TreeLimit {
		const newLimit: TreeLimitMutableDimensionData = new Map<TreeLimitDimension, [number, number][]>(this.limit);
		for (const [key, value] of other.limit) {
			const newValue = newLimit.get(key);
			if (!newValue)
				continue;

			if (isEqual(newValue, value))
				newLimit.delete(key);
		}
		return new TreeLimit(newLimit);
	}
}

/**
 * Each node only stores a partial limit, the full limit is calculated by combining all nodes in the path from the root to the leaf node.
 */
class TreeNode {
	private readonly limit: TreeLimit;
	private readonly children: TreeNode[] | null;

	constructor(limit: TreeLimit | TreeLimitDimensionData = new TreeLimit(), children: TreeNode[] | null = null) {
		this.limit = limit instanceof TreeLimit ? limit : new TreeLimit(limit);
		this.children = children;
	}

	public validate(data: ReadonlyMap<TreeLimitDimension, number>): boolean {
		if (!this.limit.validate(data))
			return false;

		if (!this.children)
			return true;

		return this.children.some((child) => child.validate(data));
	}

	public force(data: ReadonlyMap<TreeLimitDimension, number>): [number, Map<TreeLimitDimension, number>] {
		const [diff, newData] = this.limit.force(data);
		if (!this.children)
			return [diff, newData];

		let minDiff = Infinity;
		let minData: Map<TreeLimitDimension, number> | null = null;
		for (const child of this.children) {
			const [childDiff, childData] = child.force(newData);
			if (childDiff < minDiff) {
				minDiff = childDiff;
				minData = childData;
			}
			if (minDiff === 0)
				break;
		}

		if (minData == null)
			return [diff, newData];

		return [diff + minDiff, minData];
	}

	public hasNoLimits(): boolean {
		return this.limit.hasNoLimits() && !this.children;
	}

	public intersection(other: TreeNode): TreeNode | null {
		const next = this.intersectionWithLimit(other.limit);
		if (next == null)
			return null;

		if (other.children == null)
			return next;

		const nodes: TreeNode[] = [];

		if (next.children == null) {
			nodes.push(...other.children
				.map((child) => child.intersectionWithLimit(next.limit, true))
				.filter((child): child is TreeNode => child != null));
		} else {
			const children = next.children;
			nodes.push(...other.children
				.flatMap((otherChild) => children
					.map((child) => child.intersection(otherChild))
					.filter((child): child is TreeNode => child != null)));
		}

		return TreeNode.fromResult(next.limit, nodes);
	}

	/**
	 * Calculates the intersection on the current limit on all keys present in the 'limit' parameter.
	 * If 'prune' is true, all matching values will be removed from the resulting limit, otherwise all missing keys will be added from the 'limit' parameter.
	 * Then all children will be intersected with the resulting limit.
	 */
	private intersectionWithLimit(limit: TreeLimit, prune: boolean = false): TreeNode | null {
		const intersection = this.limit.intersection(limit);
		if (intersection == null)
			return null;

		const newLimit = prune
			? intersection.extend(this.limit).prune(limit)
			: intersection.extend(this.limit).extend(limit);

		if (this.children == null)
			return new TreeNode(newLimit);

		const childLimiter = newLimit.prune(this.limit);
		const newChildren = this.children
			.map((child) => child.intersectionWithLimit(childLimiter, true))
			.filter((child): child is TreeNode => child != null);

		return TreeNode.fromResult(newLimit, newChildren);
	}

	private static fromResult(limit: TreeLimit, children: TreeNode[]): TreeNode | null {
		if (children.length === 0)
			return null;

		if (children.length === 1)
			return new TreeNode(children[0].limit.extend(limit), children[0].children);

		return new TreeNode(limit, children);
	}
}

export class AppearanceLimitTree {
	private root: TreeNode | null = new TreeNode();

	public get valid(): boolean {
		return this.root != null;
	}

	public hasNoLimits(): boolean {
		return this.root != null && this.root.hasNoLimits();
	}

	public validate(pose: Immutable<PartialAppearancePose>): boolean {
		return this.root != null && this.root.validate(FromPose(pose));
	}

	public force(pose: Immutable<AppearancePose>): { pose: AppearancePose; changed: boolean; } {
		if (this.root == null)
			return { pose, changed: false };

		const [diff, data] = this.root.force(FromPose(pose));
		if (diff === 0)
			return { pose, changed: false };

		return { pose: ToPose(data), changed: true };
	}

	public merge(limits?: Immutable<AssetDefinitionPoseLimits>): boolean {
		if (this.root == null)
			return false;

		if (limits == null)
			return true;

		this.root = this.root.intersection(CreateTreeNode(limits));

		return this.root != null;
	}
}

function CreateTreeNode(limits: Immutable<AssetDefinitionPoseLimits>): TreeNode {
	const nodeChildren = limits.options == null ? null : limits.options.map(CreateTreeNode);
	return new TreeNode(FromLimit(limits), nodeChildren);
}

function FromPose({ bones, leftArm, rightArm, arms, armsOrder, legs, view }: Immutable<PartialAppearancePose>): Map<TreeLimitDimension, number> {
	const data = new Map<TreeLimitDimension, number>();

	if (bones) {
		for (const [key, value] of Object.entries(bones)) {
			if (value == null)
				continue;

			data.set(`bones.${key}`, value);
		}
	}
	FromArmPose(data, 'leftArm', { ...arms, ...leftArm });
	FromArmPose(data, 'rightArm', { ...arms, ...rightArm });
	FromArmsOrder(data, armsOrder);
	FromPoseEnumValue(data, 'legs', LegsPoseSchema, legs);
	FromPoseEnumValue(data, 'view', CharacterViewSchema, view);

	return data;
}

function FromArmPose(data: Map<TreeLimitDimension, number>, prefix: 'leftArm' | 'rightArm', { position, rotation, fingers }: Partial<AppearanceArmPose> = {}): void {
	FromPoseEnumValue(data, `${prefix}.position`, ArmPoseSchema, position);
	FromPoseEnumValue(data, `${prefix}.rotation`, ArmRotationSchema, rotation);
	FromPoseEnumValue(data, `${prefix}.fingers`, ArmFingersSchema, fingers);
}

function FromArmsOrder(data: Map<TreeLimitDimension, number>, { upper }: Partial<AppearanceArmsOrder> = {}): void {
	FromPoseEnumValue(data, 'armsOrder.upper', ArmSegmentOrderSchema, upper);
}

function FromLimit({ bones, leftArm, rightArm, arms, armsOrder, legs, view }: Immutable<AssetDefinitionPoseLimit>): TreeLimitDimensionData {
	const data: TreeLimitMutableDimensionData = new Map<TreeLimitDimension, [number, number][]>();

	if (bones) {
		for (const [key, value] of Object.entries(bones)) {
			if (value == null)
				continue;

			if (typeof value === 'number')
				data.set(`bones.${key}`, [[value, value]]);
			else
				data.set(`bones.${key}`, CloneDeepMutable(value));
		}
	}
	FromArmLimit(data, 'leftArm', { ...arms, ...leftArm });
	FromArmLimit(data, 'rightArm', { ...arms, ...rightArm });
	FromArmsOrderLimit(data, armsOrder);
	FromLimitEnumValue(data, 'view', CharacterViewSchema, view);
	FromLimitEnumValue(data, 'legs', LegsPoseSchema, legs);
	return data;
}

function FromArmLimit(data: TreeLimitMutableDimensionData, prefix: 'leftArm' | 'rightArm', { position, rotation, fingers }: Immutable<AssetDefinitionArmPoseLimit> = {}): void {
	FromLimitEnumValue(data, `${prefix}.position`, ArmPoseSchema, position);
	FromLimitEnumValue(data, `${prefix}.rotation`, ArmRotationSchema, rotation);
	FromLimitEnumValue(data, `${prefix}.fingers`, ArmFingersSchema, fingers);
}

function FromArmsOrderLimit(data: TreeLimitMutableDimensionData, { upper }: Immutable<AssetDefinitionArmOrderPoseLimit> = {}): void {
	FromLimitEnumValue(data, 'armsOrder.upper', ArmSegmentOrderSchema, upper);
}

function FromPoseEnumValue<E extends [string, ...string[]]>(data: Map<TreeLimitDimension, number>, property: TreeLimitDimension, schema: ZodEnum<E>, value: E[number] | undefined): void {
	if (value != null) {
		const index = EnumToIndex(schema, value);
		data.set(property, index);
	}
}

function FromLimitEnumValue<E extends [string, ...string[]]>(data: TreeLimitMutableDimensionData, property: TreeLimitDimension, schema: ZodEnum<E>, value: E[number] | readonly (E[number])[] | undefined): void {
	if (value != null) {
		if (IsReadonlyArray(value)) {
			const result: [number, number][] = value
				.map((v) => EnumToIndex(schema, v))
				// We need to sort the values ascending for the algorithm to work properly
				.sort((a, b) => a - b)
				.map((v) => [v, v]);
			data.set(property, result);
		} else {
			const index = EnumToIndex(schema, value);
			data.set(property, [[index, index]]);
		}
	}
}

function ToArmPose(data: ReadonlyMap<TreeLimitDimension, number>, prefix: 'leftArm' | 'rightArm', pose: AppearancePose): void {
	IndexToEnum(ArmPoseSchema, data.get(`${prefix}.position`), (value) => pose[prefix].position = value);
	IndexToEnum(ArmRotationSchema, data.get(`${prefix}.rotation`), (value) => pose[prefix].rotation = value);
	IndexToEnum(ArmFingersSchema, data.get(`${prefix}.fingers`), (value) => pose[prefix].fingers = value);
}

function ToArmsOrder(data: ReadonlyMap<TreeLimitDimension, number>, pose: AppearancePose): void {
	IndexToEnum(ArmSegmentOrderSchema, data.get('armsOrder.upper'), (value) => pose.armsOrder.upper = value);
}

function ToPose(data: ReadonlyMap<TreeLimitDimension, number>): AppearancePose {
	const pose = GetDefaultAppearancePose();

	ToArmPose(data, 'leftArm', pose);
	ToArmPose(data, 'rightArm', pose);
	ToArmsOrder(data, pose);

	IndexToEnum(LegsPoseSchema, data.get('legs'), (value) => pose.legs = value);
	IndexToEnum(CharacterViewSchema, data.get('view'), (value) => pose.view = value);

	for (const [key, value] of data) {
		if (!key.startsWith('bones.'))
			continue;

		const bone = key.slice('bones.'.length);
		pose.bones[bone] = value;
	}

	return pose;
}

/** Gets a key and returns multiplier for cost of changing it */
function PoseChangeWeight(key: TreeLimitDimension): number {
	// Bones have base value
	if (key.startsWith('bones.')) {
		return 1;
	}

	// Everything else is considered the same as moving right angle
	return 90;
}

function EnumToIndex<E extends [string, ...string[]]>(schema: ZodEnum<E>, value: E[number]): number {
	const index = schema.options.indexOf(value);
	Assert(index >= 0, `Got invalid enum value: '${value}'`);

	return index;
}

function IndexToEnum<E extends [string, ...string[]]>(schema: ZodEnum<E>, index: number | undefined, set: (value: E[number]) => void): void {
	if (index == null)
		return;

	const value = schema.options[index];
	if (value == null)
		return;

	set(value);
}
