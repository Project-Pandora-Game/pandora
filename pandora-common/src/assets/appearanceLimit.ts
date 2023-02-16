import { IntervalSetIntersection } from '../utility';
import { AppearanceArmPose, AppearancePose, ArmsPose, CharacterView, GetDefaultAppearanceBundle } from './appearance';
import type { AssetDefinitionPoseLimits, PartialAppearancePose } from './definitions';

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
				if (diffMin < minDiff) {
					minDiff = diffMax;
					minDiffValue = max;
				}
			}

			totalDiff += minDiff;
			newData.set(key, minDiffValue);
		}
		return [totalDiff, newData];
	}

	public isEmpty(): boolean {
		return this.limit.size === 0;
	}

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

	public extend(other: TreeLimit): TreeLimit {
		const newLimit = new Map<string, [number, number][]>(this.limit);
		for (const [key, value] of other.limit) {
			if (newLimit.has(key))
				continue;

			newLimit.set(key, value);
		}
		return new TreeLimit(newLimit);
	}
}

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

	public isEmpty(): boolean {
		return this.limit.isEmpty();
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
				.map((child) => child.intersectionWithLimit(next.limit))
				.filter((child): child is TreeNode => child != null));
		} else {
			const children = next.children;
			nodes.push(...other.children
				.flatMap((otherChild) => children
					.map((child) => child.intersectionWithLimit(next.limit)?.intersection(otherChild))
					.filter((child): child is TreeNode => child != null)));
		}
		if (nodes.length === 0)
			return null;
		if (nodes.length === 1)
			return new TreeNode(nodes[0].limit.extend(next.limit), nodes[0].children);

		return new TreeNode(next.limit, nodes);
	}

	private intersectionWithLimit(limit: TreeLimit): TreeNode | null {
		const newLimit = limit.intersection(this.limit)?.extend(limit);
		if (newLimit == null)
			return null;

		if (this.children == null)
			return new TreeNode(newLimit.extend(this.limit));

		const newChildren = this.children
			.map((child) => child.intersectionWithLimit(newLimit))
			.filter((child): child is TreeNode => child != null);

		if (newChildren.length === 0)
			return null;

		if (newChildren.length === 1)
			return new TreeNode(newChildren[0].limit.extend(this.limit), newChildren[0].children);

		return new TreeNode(newLimit.extend(this.limit), newChildren);
	}
}

export class AppearanceLimitTree {
	private root: TreeNode | null = new TreeNode();

	public get valid(): boolean {
		return this.root != null;
	}

	public isEmpty(): boolean {
		return this.root != null && this.root.isEmpty();
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

	public merge(limits?: AssetDefinitionPoseLimits): boolean {
		if (this.root == null)
			return false;

		if (limits == null)
			return true;

		this.root = this.root.intersection(CreateTreeNode(limits));

		return this.root != null;
	}
}

function CreateTreeNode(limit: AssetDefinitionPoseLimits): TreeNode {
	const data = new Map<string, [number, number][]>();
	const { forceArms, forcePose } = limit;
	if (forceArms != null) {
		if (forceArms === ArmsPose.FRONT) {
			data.set('leftArm.position', [[0, 0]]);
			data.set('rightArm.position', [[0, 0]]);
		} else {
			data.set('leftArm.position', [[1, 1]]);
			data.set('rightArm.position', [[1, 1]]);
		}
	}
	if (forcePose != null) {
		for (const [key, value] of Object.entries(forcePose)) {
			if (value == null)
				continue;

			const array: [number, number] = typeof value === 'number' ? [value, value] : value;
			data.set(`bones.${key}`, [array]);
		}
	}
	return new TreeNode(data);
}

function FromPose({ bones, leftArm, rightArm, arms, view }: PartialAppearancePose): Map<string, number> {
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
	if (view != null)
		data.set('view', view === CharacterView.FRONT ? 0 : 1);

	return data;
}

function FromArmPose(data: Map<string, number>, prefix: 'leftArm' | 'rightArm', { position }: Partial<AppearanceArmPose> = {}): void {
	if (position != null) {
		data.set(`${prefix}.position`, position === ArmsPose.FRONT ? 0 : 1);
	}
}

function ToArmPose(data: ReadonlyMap<string, number>, prefix: 'leftArm' | 'rightArm', pose: AppearancePose): void {
	const position = data.get(`${prefix}.position`);
	if (position != null) {
		pose[prefix].position = position === 0 ? ArmsPose.FRONT : ArmsPose.BACK;
	}
}

function ToPose(data: ReadonlyMap<string, number>): AppearancePose {
	const pose = GetDefaultAppearanceBundle();

	ToArmPose(data, 'leftArm', pose);
	ToArmPose(data, 'rightArm', pose);

	const view = data.get('view');
	if (view != null)
		pose.view = view === 0 ? CharacterView.FRONT : CharacterView.BACK;

	for (const [key, value] of data) {
		if (!key.startsWith('bones.'))
			continue;

		const bone = key.slice('bones.'.length);
		pose.bones[bone] = value;
	}

	return pose;
}
