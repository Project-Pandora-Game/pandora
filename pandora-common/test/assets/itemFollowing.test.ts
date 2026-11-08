import { describe, expect, it } from '@jest/globals';
import { Assert } from '../../src/utility/misc.ts';
import { AssetManager } from '../../src/assets/assetManager.ts';
import type { BoneDefinitionCompressed } from '../../src/assets/graphics/index.ts';
import type { PersonalItemDeploymentFollow } from '../../src/assets/item/personal.ts';
import { CalculateRelativeLockDeltaX, ApplyRelativeLockDeltaX, GetRoomProjectionResolver } from '../../src/assets/state/characterFollowOffset.ts';
import type { AssetFrameworkCharacterState } from '../../src/assets/state/characterState.ts';
import { GetDefaultAppearancePose } from '../../src/assets/state/characterStatePose.ts';
import {
	CharacterCanCarryItems,
	CreatePersonalItemFollow,
	PersonalItemFollowIsSupported,
	ResolvePersonalItemFollowPosition,
} from '../../src/assets/state/itemFollowing.ts';
import { ResolveBackground, type RoomPosition } from '../../src/assets/state/roomGeometry.ts';
import type { AssetFrameworkRoomState } from '../../src/assets/state/roomState.ts';

//#region Fixtures

/** A minimal set of bones: the arms (used by hand mode), plus the bones that are read for character placement. */
const TEST_BONES: Record<string, BoneDefinitionCompressed> = {
	arm_l: {
		pos: [578, 432],
		mirror: 'arm_r',
		type: 'pose',
	},
	elbow_l: {
		pos: [728, 434],
		mirror: 'elbow_r',
		parent: 'arm_l',
		type: 'pose',
	},
	leg_l: {
		pos: [521, 735],
		mirror: 'leg_r',
		baseRotation: 90,
		type: 'pose',
	},
	tiptoeing: { type: 'pose' },
	character_rotation: { baseRotation: -90, type: 'pose' },
};

function CreateAssetManager(bones: Record<string, BoneDefinitionCompressed> = TEST_BONES): AssetManager {
	return new AssetManager('test', { bones });
}

function CreateRoom(assetManager: AssetManager): AssetFrameworkRoomState {
	const roomBackground = ResolveBackground(assetManager, { type: 'plain', image: '#1099bb' });
	Assert(roomBackground != null);
	// Only the background is used by the follow logic
	return { roomBackground } as unknown as AssetFrameworkRoomState;
}

type TestCharacterOptions = {
	view?: 'front' | 'back';
	bones?: Record<string, number>;
	inRoomDevice?: boolean;
};

function CreateCharacter(assetManager: AssetManager, position: RoomPosition, { view = 'front', bones = {}, inRoomDevice = false }: TestCharacterOptions = {}): AssetFrameworkCharacterState {
	const pose = GetDefaultAppearancePose();
	pose.view = view;
	pose.bones = { ...bones };

	// Only the parts used by the follow logic are provided
	return {
		id: 'c1',
		assetManager,
		items: [],
		actualPose: pose,
		requestedPose: pose,
		currentRoom: 'room:default',
		position: { type: 'normal', room: 'room:default', position },
		getRoomDeviceWearablePart: () => inRoomDevice ? {} : null,
	} as unknown as AssetFrameworkCharacterState;
}

/** Where an item with the given position is displayed on the canvas */
function ItemCanvasPosition(room: AssetFrameworkRoomState, [x, y, yOffset]: RoomPosition): [x: number, y: number] {
	const [canvasX, canvasY] = GetRoomProjectionResolver(room).transform(x, y, 0);
	return [canvasX, canvasY - yOffset];
}

function ExpectCloseTo(actual: number, expected: number, tolerance: number): void {
	expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function ExpectPositionCloseTo(actual: RoomPosition, expected: RoomPosition, tolerance: number): void {
	ExpectCloseTo(actual[0], expected[0], tolerance);
	ExpectCloseTo(actual[1], expected[1], tolerance);
	ExpectCloseTo(actual[2], expected[2], tolerance);
}

function MustCreateFollow(...args: Parameters<typeof CreatePersonalItemFollow>): PersonalItemDeploymentFollow {
	const result = CreatePersonalItemFollow(...args);
	Assert(result != null);
	return result;
}

//#endregion

describe('Item following: relative lock', () => {
	const assetManager = CreateAssetManager();
	const room = CreateRoom(assetManager);
	const resolver = GetRoomProjectionResolver(room);

	const ITEM_POSITIONS: readonly RoomPosition[] = [
		[150, 500, 0],
		[-200, 300, 120],
		[300, 900, 60],
		[0, 1500, 0],
	];

	for (const view of ['front', 'back'] as const) {
		it(`resolving a freshly created follow keeps the item in place (${view} view)`, () => {
			const target = CreateCharacter(assetManager, [0, 500, 0], { view });

			for (const itemPosition of ITEM_POSITIONS) {
				const follow = MustCreateFollow({ followType: 'relativeLock' }, target, room, itemPosition);
				const resolved = ResolvePersonalItemFollowPosition(follow, target, room);

				// Offsets are stored as integers, so allow for a few units of rounding
				ExpectPositionCloseTo(resolved, itemPosition, 3);
			}
		});
	}

	it('flips the side of the item when the character turns around', () => {
		const targetFront = CreateCharacter(assetManager, [0, 500, 0], { view: 'front' });
		const targetBack = CreateCharacter(assetManager, [0, 500, 0], { view: 'back' });

		const follow = MustCreateFollow({ followType: 'relativeLock' }, targetFront, room, [100, 500, 0]);

		const resolved = ResolvePersonalItemFollowPosition(follow, targetBack, room);

		ExpectCloseTo(resolved[0], -100, 3);
		ExpectCloseTo(resolved[1], 500, 1);
	});

	it('keeps the same visual height relative to the character when the character moves in depth', () => {
		const targetNear = CreateCharacter(assetManager, [0, 300, 0]);
		const targetFar = CreateCharacter(assetManager, [0, 1500, 0]);

		const follow = MustCreateFollow({ followType: 'relativeLock' }, targetNear, room, [100, 300, 300]);
		const resolved = ResolvePersonalItemFollowPosition(follow, targetFar, room);

		// The elevation is in canvas pixels, so it has to shrink together with the character
		const expectedElevation = 300 * resolver.scaleAt(0, 1500, 0) / resolver.scaleAt(0, 300, 0);
		ExpectCloseTo(resolved[2], expectedElevation, 3);
	});

	it('keeps the visual distance when the character moves sideways', () => {
		const target = CreateCharacter(assetManager, [0, 1200, 0]);
		const itemPosition: RoomPosition = [200, 300, 40];

		const follow = MustCreateFollow({ followType: 'relativeLock' }, target, room, itemPosition);

		const originalDistance = ItemCanvasPosition(room, itemPosition)[0] - ItemCanvasPosition(room, [0, 1200, 0])[0];

		for (const targetX of [-800, 800]) {
			const movedTarget = CreateCharacter(assetManager, [targetX, 1200, 0]);
			const resolved = ResolvePersonalItemFollowPosition(follow, movedTarget, room);

			const distance = ItemCanvasPosition(room, resolved)[0] - ItemCanvasPosition(room, [targetX, 1200, 0])[0];
			ExpectCloseTo(distance, originalDistance, 2);
		}
	});
});

describe('Item following: hand', () => {
	const assetManager = CreateAssetManager();
	const room = CreateRoom(assetManager);

	const POSE_BONES = { arm_l: 30, elbow_l: -45, arm_r: -20, elbow_r: 60 };

	for (const hand of ['left', 'right'] as const) {
		for (const view of ['front', 'back'] as const) {
			it(`resolving a freshly created follow keeps the item in place (${hand} hand, ${view} view)`, () => {
				const target = CreateCharacter(assetManager, [100, 600, 0], { view, bones: POSE_BONES });
				const itemPosition: RoomPosition = [60, 560, 250];

				const follow = MustCreateFollow({ followType: 'hand', hand }, target, room, itemPosition);
				const resolved = ResolvePersonalItemFollowPosition(follow, target, room);

				ExpectPositionCloseTo(resolved, itemPosition, 4);
			});
		}
	}

	it('moves with the arm and comes back when the arm does', () => {
		const targetBefore = CreateCharacter(assetManager, [0, 600, 0], { bones: { arm_l: 0, elbow_l: 0 } });
		const targetMoved = CreateCharacter(assetManager, [0, 600, 0], { bones: { arm_l: 60, elbow_l: -40 } });
		const itemPosition: RoomPosition = [150, 600, 250];

		const follow = MustCreateFollow({ followType: 'hand', hand: 'left' }, targetBefore, room, itemPosition);

		const moved = ResolvePersonalItemFollowPosition(follow, targetMoved, room);
		const horizontalChange = Math.abs(moved[0] - itemPosition[0]);
		const verticalChange = Math.abs(moved[2] - itemPosition[2]);
		expect(Math.max(horizontalChange, verticalChange)).toBeGreaterThan(10);

		const back = ResolvePersonalItemFollowPosition(follow, targetBefore, room);
		ExpectPositionCloseTo(back, itemPosition, 4);
	});

	it('moves together with the character', () => {
		const target = CreateCharacter(assetManager, [0, 600, 0], { bones: POSE_BONES });
		const itemPosition: RoomPosition = [60, 600, 250];

		const follow = MustCreateFollow({ followType: 'hand', hand: 'right' }, target, room, itemPosition);

		const movedTarget = CreateCharacter(assetManager, [400, 600, 0], { bones: POSE_BONES });
		const resolved = ResolvePersonalItemFollowPosition(follow, movedTarget, room);

		ExpectPositionCloseTo(resolved, [itemPosition[0] + 400, itemPosition[1], itemPosition[2]], 4);
	});
});

describe('Item following: missing asset support', () => {
	const assetManagerWithoutArms = CreateAssetManager({ tiptoeing: { type: 'pose' } });
	const room = CreateRoom(assetManagerWithoutArms);

	it('reports hand mode as unsupported without arm bones, but relative lock as supported', () => {
		expect(PersonalItemFollowIsSupported({ followType: 'hand', hand: 'left' }, assetManagerWithoutArms)).toBe(false);
		expect(PersonalItemFollowIsSupported({ followType: 'hand', hand: 'right' }, assetManagerWithoutArms)).toBe(false);
		expect(PersonalItemFollowIsSupported({ followType: 'relativeLock' }, assetManagerWithoutArms)).toBe(true);
		expect(PersonalItemFollowIsSupported({ followType: 'hand', hand: 'left' }, CreateAssetManager())).toBe(true);
	});

	it('refuses to create hand follow without arm bones instead of throwing', () => {
		const target = CreateCharacter(assetManagerWithoutArms, [0, 500, 0]);

		expect(CreatePersonalItemFollow({ followType: 'hand', hand: 'left' }, target, room, [50, 500, 0])).toBeNull();
		expect(CreatePersonalItemFollow({ followType: 'relativeLock' }, target, room, [50, 500, 0])).not.toBeNull();
	});

	it('throws when resolving existing hand follow without arm bones (the automatic processing catches this and clears the follow)', () => {
		const target = CreateCharacter(assetManagerWithoutArms, [0, 500, 0]);
		const follow: PersonalItemDeploymentFollow = { followType: 'hand', target: target.id, hand: 'left', offset: [0, 0], depth: 0 };

		expect(() => ResolvePersonalItemFollowPosition(follow, target, room)).toThrow();
	});
});

describe('Item following: carrying restrictions', () => {
	const assetManager = CreateAssetManager();

	it('allows carrying with a normal character', () => {
		const character = CreateCharacter(assetManager, [0, 500, 0]);

		expect(CharacterCanCarryItems(character, 'relativeLock')).toBe(true);
		expect(CharacterCanCarryItems(character, 'hand')).toBe(true);
	});

	it('forbids carrying in a room device', () => {
		const character = CreateCharacter(assetManager, [0, 500, 0], { inRoomDevice: true });

		expect(CharacterCanCarryItems(character, 'relativeLock')).toBe(false);
		expect(CharacterCanCarryItems(character, 'hand')).toBe(false);
	});
});

describe('Character following: relative lock x delta', () => {
	const assetManager = CreateAssetManager();
	const room = CreateRoom(assetManager);
	const resolver = GetRoomProjectionResolver(room);

	const CASES: readonly (readonly [follower: RoomPosition, target: RoomPosition])[] = [
		[[200, 300, 0], [0, 1200, 0]],
		[[-350, 1500, 0], [100, 200, 0]],
		[[500, 700, 0], [-500, 700, 0]],
		[[0, 0, 0], [999, 1800, 0]],
	];

	it('the follower position is reproduced as closely as the integer delta allows', () => {
		for (const [follower, target] of CASES) {
			const delta = CalculateRelativeLockDeltaX(follower, target, room);
			const resultX = Math.round(ApplyRelativeLockDeltaX(delta, target, follower[1], room));

			// One delta unit is one unit at the target's depth, which can be several units at the follower's depth
			const ratio = Math.max(1, resolver.scaleAt(0, target[1], 0) / resolver.scaleAt(0, follower[1], 0));
			expect(Math.abs(resultX - follower[0])).toBeLessThanOrEqual(ratio / 2 + 0.5 + 1e-6);
		}
	});

	it('keeps the visual distance when both characters move sideways', () => {
		const follower: RoomPosition = [200, 300, 0];
		const target: RoomPosition = [0, 1200, 0];
		const delta = CalculateRelativeLockDeltaX(follower, target, room);

		const originalDistance = ItemCanvasPosition(room, follower)[0] - ItemCanvasPosition(room, target)[0];

		for (const targetX of [-900, 0, 900]) {
			const newTarget: RoomPosition = [targetX, 1200, 0];
			const followerX = Math.round(ApplyRelativeLockDeltaX(delta, newTarget, follower[1], room));
			const distance = ItemCanvasPosition(room, [followerX, follower[1], 0])[0] - ItemCanvasPosition(room, newTarget)[0];

			ExpectCloseTo(distance, originalDistance, 2);
		}
	});
});

