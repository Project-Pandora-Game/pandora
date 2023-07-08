import { Immutable } from 'immer';
import _ from 'lodash';
import { ZodEnum } from 'zod';
import { CloneDeepMutable, IntervalSetIntersection } from '../utility';
import { GetDefaultAppearanceBundle } from './appearance';
import type { AssetDefinitionPoseLimit, AssetDefinitionPoseLimits, PartialAppearancePose } from './definitions';
import { ArmFingersSchema, ArmPoseSchema, ArmRotationSchema, LegsPoseSchema } from './graphics/graphics';
import { AppearanceArmPose, AppearancePose, CharacterViewSchema } from './state/characterState';

class TreeLimit {
	private readonly limit: ReadonlyMap<string, [number, number][]>;

	constructor(limit: ReadonlyMap<string, [number, number][]> = new Map<string, [number, number][]>()) {
		this.limit = limit;
	}

	public validate(data: ReadonlyMap<string, number>): boolean {
		for (const [key, value] of data) {
			const limit = this.limit.get(key);
			if (!limit)
				continue;

			if (!limit.some(([min, max]) => value >= min && value <= max))
				return false;
		}
		return true;
	}

	public force(data: ReadonlyMap<string, number>): [number, Map<string, number>] {
		let totalDiff = 0;
		const newData = new Map<string, number>(data);
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

			totalDiff += minDiff;
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
		const newLimit = new Map<string, [number, number][]>();
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
		const newLimit = new Map<string, [number, number][]>(this.limit);
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
		const newLimit = new Map<string, [number, number][]>(this.limit);
		for (const [key, value] of other.limit) {
			const newValue = newLimit.get(key);
			if (!newValue)
				continue;

			if (_.isEqual(newValue, value))
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

	constructor(limit: TreeLimit | ReadonlyMap<string, [number, number][]> = new TreeLimit(), children: TreeNode[] | null = null) {
		this.limit = limit instanceof TreeLimit ? limit : new TreeLimit(limit);
		this.children = children;
	}

	public validate(data: ReadonlyMap<string, number>): boolean {
		if (!this.limit.validate(data))
			return false;

		if (!this.children)
			return true;

		return this.children.some((child) => child.validate(data));
	}

	public force(data: ReadonlyMap<string, number>): [number, Map<string, number>] {
		const [diff, newData] = this.limit.force(data);
		if (!this.children)
			return [diff, newData];

		let minDiff = Infinity;
		let minData: Map<string, number> | null = null;
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

	public validate(pose: PartialAppearancePose): boolean {
		return this.root != null && this.root.validate(FromPose(pose));
	}

	public force(pose: AppearancePose): { pose: AppearancePose; changed: boolean; } {
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

function FromPose({ bones, leftArm, rightArm, arms, legs, view }: PartialAppearancePose): Map<string, number> {
	const data = new Map<string, number>();

	if (bones) {
		for (const [key, value] of Object.entries(bones)) {
			if (value == null)
				continue;

			data.set(`bones.${key}`, value);
		}
	}
	FromArmPose(data, 'leftArm', { ...arms, ...leftArm });
	FromArmPose(data, 'rightArm', { ...arms, ...rightArm });
	EnumToIndex(LegsPoseSchema, legs, (index) => data.set('legs', index));
	EnumToIndex(CharacterViewSchema, view, (index) => data.set('view', index));

	return data;
}

function FromArmPose(data: Map<string, number>, prefix: 'leftArm' | 'rightArm', { position, rotation, fingers }: Partial<AppearanceArmPose> = {}): void {
	EnumToIndex(ArmPoseSchema, position, (index) => data.set(`${prefix}.position`, index));
	EnumToIndex(ArmRotationSchema, rotation, (index) => data.set(`${prefix}.rotation`, index));
	EnumToIndex(ArmFingersSchema, fingers, (index) => data.set(`${prefix}.fingers`, index));
}

function FromLimit({ bones, leftArm, rightArm, arms, legs, view }: Immutable<AssetDefinitionPoseLimit>): Map<string, [number, number][]> {
	const data = new Map<string, [number, number][]>();

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
	EnumToIndex(CharacterViewSchema, view, (index) => data.set('view', [[index, index]]));
	if (typeof legs === 'string') {
		EnumToIndex(LegsPoseSchema, legs, (index) => data.set('legs', [[index, index]]));
	} else if (legs != null) {
		data.set('legs', legs
			.map((leg) => LegsPoseSchema.options.indexOf(leg))
			.filter((index) => index !== -1)
			.map((index) => [index, index]));
	}
	return data;
}

function FromArmLimit(data: Map<string, [number, number][]>, prefix: 'leftArm' | 'rightArm', { position, rotation, fingers }: Partial<AppearanceArmPose> = {}): void {
	EnumToIndex(ArmPoseSchema, position, (index) => data.set(`${prefix}.position`, [[index, index]]));
	EnumToIndex(ArmRotationSchema, rotation, (index) => data.set(`${prefix}.rotation`, [[index, index]]));
	EnumToIndex(ArmFingersSchema, fingers, (index) => data.set(`${prefix}.fingers`, [[index, index]]));
}

function ToArmPose(data: ReadonlyMap<string, number>, prefix: 'leftArm' | 'rightArm', pose: AppearancePose): void {
	IndexToEnum(ArmPoseSchema, data.get(`${prefix}.position`), (value) => pose[prefix].position = value);
	IndexToEnum(ArmRotationSchema, data.get(`${prefix}.rotation`), (value) => pose[prefix].rotation = value);
	IndexToEnum(ArmFingersSchema, data.get(`${prefix}.fingers`), (value) => pose[prefix].fingers = value);
}

function ToPose(data: ReadonlyMap<string, number>): AppearancePose {
	const pose = GetDefaultAppearanceBundle();

	ToArmPose(data, 'leftArm', pose);
	ToArmPose(data, 'rightArm', pose);

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

function EnumToIndex<E extends [string, ...string[]], Z extends ZodEnum<E>>(schema: Z, value: Z['options'][number] | undefined, set: (index: number) => void): void {
	if (value == null)
		return;

	const index = schema.options.indexOf(value);
	if (index === -1)
		return;

	set(index);
}

function IndexToEnum<E extends [string, ...string[]], Z extends ZodEnum<E>>(schema: Z, index: number | undefined, set: (value: Z['options'][number]) => void): void {
	if (index == null)
		return;

	const value = schema.options[index];
	if (value == null)
		return;

	set(value);
}
