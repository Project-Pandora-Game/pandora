import { produce, type Immutable } from 'immer';
import { isEqual } from 'lodash-es';
import { DEG_TO_RAD, Vector2 } from '../../math/index.ts';
import { AssertNever, CloneDeepMutable } from '../../utility/misc.ts';
import type { RoomId } from '../appearanceTypes.ts';
import { AppearanceItemProperties } from '../appearanceValidation.ts';
import type { AssetManager } from '../assetManager.ts';
import { CharacterPoseTransforms } from '../graphics/transform/characterPoseTransforms.ts';
import type { AppearanceItems, Item, ItemId } from '../item/index.ts';
import type { PersonalItemDeploymentFollow, PersonalItemFollowRequest } from '../item/personal.ts';
import { ValidateRoomInventoryItems } from '../roomValidation.ts';
import { GetRoomProjectionResolver } from './characterFollowOffset.ts';
import { CalculateCharacterPoseOffsets, CHARACTER_PIVOT_BASE } from './characterPoseOffsets.ts';
import type { AssetFrameworkCharacterState } from './characterState.ts';
import type { AssetFrameworkGlobalState } from './globalState.ts';
import type { RoomPosition } from './roomGeometry.ts';
import type { AssetFrameworkRoomState } from './roomState.ts';
import type { AssetFrameworkSpaceState } from './spaceState.ts';

type RoomProjectionResolver = ReturnType<typeof GetRoomProjectionResolver>;

//#region Helpers

/** Sign that flips the front-view-normalized values when the character is turned around */
function GetViewSign(character: AssetFrameworkCharacterState): 1 | -1 {
	return character.actualPose.view === 'back' ? -1 : 1;
}

function GetElbowBone(hand: 'left' | 'right'): string {
	return hand === 'left' ? 'elbow_l' : 'elbow_r';
}

/**
 * Describes how character-local pixels are mapped onto the room canvas.
 * This mirrors the rendering of `RoomCharacter` (pivot -> mirror -> rotation -> manual y offset -> scale -> position).
 */
type CharacterFrame = {
	evaluator: CharacterPoseTransforms;
	originX: number;
	originY: number;
	scale: number;
	pivotX: number;
	pivotY: number;
	mirror: 1 | -1;
	cos: number;
	sin: number;
	yOffsetExtra: number;
};

function GetCharacterFrame(character: AssetFrameworkCharacterState, resolver: RoomProjectionResolver): CharacterFrame {
	const evaluator = new CharacterPoseTransforms(character.assetManager, character.actualPose);
	const { baseScale, yOffset, rotationAngle } = CalculateCharacterPoseOffsets(evaluator);

	const [posX, posY, yOffsetExtra] = resolver.fixupPosition(character.position.position);
	const [originX, originY] = resolver.transform(posX, posY, 0);
	const angle = rotationAngle * DEG_TO_RAD;

	return {
		evaluator,
		originX,
		originY,
		scale: baseScale * resolver.scaleAt(posX, posY, 0),
		pivotX: CHARACTER_PIVOT_BASE.x,
		pivotY: CHARACTER_PIVOT_BASE.y - yOffset,
		mirror: GetViewSign(character),
		cos: Math.cos(angle),
		sin: Math.sin(angle),
		yOffsetExtra,
	};
}

function CharacterLocalToCanvas(frame: CharacterFrame, localX: number, localY: number): [x: number, y: number] {
	const dx = (localX - frame.pivotX) * frame.mirror;
	const dy = localY - frame.pivotY;

	const rx = dx * frame.cos - dy * frame.sin;
	const ry = dx * frame.sin + dy * frame.cos - frame.yOffsetExtra;

	return [
		frame.originX + frame.scale * rx,
		frame.originY + frame.scale * ry,
	];
}

function CanvasToCharacterLocal(frame: CharacterFrame, canvasX: number, canvasY: number): [x: number, y: number] {
	const rx = (canvasX - frame.originX) / frame.scale;
	const ry = (canvasY - frame.originY) / frame.scale + frame.yOffsetExtra;

	const dx = rx * frame.cos + ry * frame.sin;
	const dy = -rx * frame.sin + ry * frame.cos;

	return [
		dx * frame.mirror + frame.pivotX,
		dy + frame.pivotY,
	];
}

function SkinPoint(evaluator: CharacterPoseTransforms, bone: string, x: number, y: number): [x: number, y: number] {
	const vec = new Vector2(x, y);
	evaluator.skinPoint(vec, [{ bone, weight: 1 }]);
	return [vec.x, vec.y];
}

/** Takes character-local point in the current pose and returns where it is in the rest pose, relative to the bone */
function PoseLocalToBoneRest(evaluator: CharacterPoseTransforms, bone: string, localX: number, localY: number): [x: number, y: number] {
	// The bone chain is a rigid transform, so we find it by probing two points
	const origin = SkinPoint(evaluator, bone, 0, 0);
	const unitX = SkinPoint(evaluator, bone, 100, 0);
	const angle = Math.atan2(unitX[1] - origin[1], unitX[0] - origin[0]);

	const dx = localX - origin[0];
	const dy = localY - origin[1];
	const cos = Math.cos(-angle);
	const sin = Math.sin(-angle);

	return [dx * cos - dy * sin, dx * sin + dy * cos];
}

/**
 * Converts a point on the room canvas into an item position.
 * The depth (room Y) is chosen by the caller; the X is found so the point lands on the right canvas X at that depth
 * and the item's yOffset (raw canvas pixels above the floor at that depth) makes up the canvas Y.
 */
function CanvasPointToItemPosition(resolver: RoomProjectionResolver, canvasX: number, canvasY: number, wantedDepth: number): RoomPosition {
	const depth = resolver.fixupPosition([0, wantedDepth, 0])[1];
	const floorY = resolver.transform(0, depth, 0)[1];
	const [x] = resolver.inverseGivenZ(canvasX, floorY, 0, true);

	return resolver.fixupPosition([x, depth, floorY - canvasY]);
}

/**
 * Anchor of the character for the "relative lock" mode, on the room canvas.
 * Offsets in this mode are stored in units of the character's depth scale, so the item keeps its place relative
 * to the character's size when the character moves closer or further away.
 */
function GetLockAnchor(character: AssetFrameworkCharacterState, resolver: RoomProjectionResolver): { x: number; y: number; scale: number; } {
	const [posX, posY, yOffsetExtra] = resolver.fixupPosition(character.position.position);
	const [x, y] = resolver.transform(posX, posY, 0);
	const scale = resolver.scaleAt(posX, posY, 0);

	return { x, y: y - yOffsetExtra * scale, scale };
}

function IsFiniteVector(values: readonly number[]): boolean {
	return values.every((v) => Number.isFinite(v));
}

//#endregion

/**
 * Checks whether the follow mode can be used with the asset definitions at all
 * (e.g. hand mode needs the bones of the arm to exist).
 */
export function PersonalItemFollowIsSupported(request: Immutable<PersonalItemFollowRequest>, assetManager: AssetManager): boolean {
	if (request.followType === 'hand') {
		const bone = GetElbowBone(request.hand);
		return assetManager.getAllBones().some((b) => b.name === bone);
	}
	return true;
}

/**
 * Checks whether the character can currently carry items in the specified way.
 * Only considers state that is part of the global state (items), not character modifiers.
 */
export function CharacterCanCarryItems(character: AssetFrameworkCharacterState, followType: PersonalItemDeploymentFollow['followType']): boolean {
	// Characters in room devices cannot carry anything
	if (character.getRoomDeviceWearablePart() != null)
		return false;

	// Holding something in hand requires hands that are not blocked
	if (followType === 'hand' && AppearanceItemProperties(character.items).effects.blockHands)
		return false;

	return true;
}

/** Converts stored follow data back into a request describing its mode */
export function PersonalItemFollowToRequest(follow: Immutable<PersonalItemDeploymentFollow>): PersonalItemFollowRequest {
	switch (follow.followType) {
		case 'relativeLock':
			return { followType: 'relativeLock' };
		case 'hand':
			return { followType: 'hand', hand: follow.hand };
	}
	AssertNever(follow);
}

/**
 * Calculates the room position an item should have while following the target.
 * @param follow - The follow data of the item
 * @param target - State of the character being followed
 * @param room - The room the target is in (and so the item will be)
 * @throws If the asset definitions don't support the follow (e.g. missing bones); use `PersonalItemFollowIsSupported` to check beforehand
 */
export function ResolvePersonalItemFollowPosition(
	follow: Immutable<PersonalItemDeploymentFollow>,
	target: AssetFrameworkCharacterState,
	room: AssetFrameworkRoomState,
): RoomPosition {
	const resolver = GetRoomProjectionResolver(room);
	const sign = GetViewSign(target);
	const targetY = target.position.position[1];

	if (follow.followType === 'relativeLock') {
		const anchor = GetLockAnchor(target, resolver);

		return CanvasPointToItemPosition(
			resolver,
			anchor.x + sign * follow.offset[0] * anchor.scale,
			anchor.y + follow.offset[1] * anchor.scale,
			targetY + sign * follow.depth,
		);
	} else if (follow.followType === 'hand') {
		const frame = GetCharacterFrame(target, resolver);

		const [localX, localY] = SkinPoint(frame.evaluator, GetElbowBone(follow.hand), follow.offset[0], follow.offset[1]);
		const [handX, handY] = CharacterLocalToCanvas(frame, localX, localY);

		return CanvasPointToItemPosition(resolver, handX, handY, targetY + sign * follow.depth);
	}

	AssertNever(follow);
}

/**
 * Creates follow data so that an item currently at the `itemPosition` keeps that position relative to the target.
 * @param request - The mode of following
 * @param target - State of the character that is to be followed
 * @param room - The room the item (and the target) is in
 * @param itemPosition - Current position of the item in the room
 * @returns The follow data, or `null` if it cannot be created (unsupported by asset definitions or degenerate geometry)
 */
export function CreatePersonalItemFollow(
	request: Immutable<PersonalItemFollowRequest>,
	target: AssetFrameworkCharacterState,
	room: AssetFrameworkRoomState,
	itemPosition: RoomPosition,
): PersonalItemDeploymentFollow | null {
	if (!PersonalItemFollowIsSupported(request, target.assetManager))
		return null;

	const resolver = GetRoomProjectionResolver(room);
	const sign = GetViewSign(target);
	const targetY = target.position.position[1];
	const [itemX, itemY, itemYOffset] = itemPosition;

	let result: PersonalItemDeploymentFollow;
	if (request.followType === 'relativeLock') {
		const anchor = GetLockAnchor(target, resolver);
		const [itemCanvasX, itemFloorY] = resolver.transform(itemX, itemY, 0);

		result = {
			followType: 'relativeLock',
			target: target.id,
			offset: [
				Math.round(sign * (itemCanvasX - anchor.x) / anchor.scale),
				Math.round((itemFloorY - itemYOffset - anchor.y) / anchor.scale),
			],
			depth: Math.round(sign * (itemY - targetY)),
		};
	} else if (request.followType === 'hand') {
		const frame = GetCharacterFrame(target, resolver);

		const [itemCanvasX, itemFloorY] = resolver.transform(itemX, itemY, 0);
		const [localX, localY] = CanvasToCharacterLocal(frame, itemCanvasX, itemFloorY - itemYOffset);
		const [offsetX, offsetY] = PoseLocalToBoneRest(frame.evaluator, GetElbowBone(request.hand), localX, localY);

		result = {
			followType: 'hand',
			target: target.id,
			hand: request.hand,
			offset: [Math.round(offsetX), Math.round(offsetY)],
			depth: Math.round(sign * (itemY - targetY)),
		};
	} else {
		AssertNever(request);
	}

	// Degenerate geometry must never end up in the state
	if (!IsFiniteVector([...result.offset, result.depth]))
		return null;

	return result;
}

//#region Automatic processing

type FollowedItemRef = {
	room: RoomId;
	item: ItemId;
};

function ReplaceItemInRoom(space: AssetFrameworkSpaceState, roomId: RoomId, oldItem: Item, newItem: Item): AssetFrameworkSpaceState {
	if (oldItem === newItem)
		return space;

	return space.produceRoom(roomId, (room) => room.produceWithItems(room.items.map((i) => i === oldItem ? newItem : i))) ?? space;
}

function ClearFollow(item: Item): Item {
	if (!item.isType('personal') || item.deployment == null)
		return item;

	return item.withDeployment(produce(item.deployment, (d) => {
		delete d.following;
	}));
}

/**
 * Tries to resolve the position, returning `null` instead of throwing, so a broken follow can never break processing of the whole state.
 * This matters, because automatic actions run when a space loads - an exception there would prevent the space from loading.
 */
function TryResolvePersonalItemFollowPosition(
	follow: Immutable<PersonalItemDeploymentFollow>,
	target: AssetFrameworkCharacterState,
	room: AssetFrameworkRoomState,
	cachedFrame?: CharacterFrame, // S1 optimization: accept precomputed frame to avoid reconstructing evaluator
): RoomPosition | null {
	try {
		const resolver = GetRoomProjectionResolver(room);
		const sign = GetViewSign(target);
		const targetY = target.position.position[1];

		if (follow.followType === 'relativeLock') {
			const anchor = GetLockAnchor(target, resolver);

			return CanvasPointToItemPosition(
				resolver,
				anchor.x + sign * follow.offset[0] * anchor.scale,
				anchor.y + follow.offset[1] * anchor.scale,
				targetY + sign * follow.depth,
			);
		} else if (follow.followType === 'hand') {
			const frame = cachedFrame ?? GetCharacterFrame(target, resolver);

			const [localX, localY] = SkinPoint(frame.evaluator, GetElbowBone(follow.hand), follow.offset[0], follow.offset[1]);
			const [handX, handY] = CharacterLocalToCanvas(frame, localX, localY);

			return CanvasPointToItemPosition(resolver, handX, handY, targetY + sign * follow.depth);
		}

		AssertNever(follow);
	} catch {
		return null;
	}
}

/**
 * Moves items that are following a character, so they keep following.
 * Needs to run after the characters have been processed, so it sees their final positions.
 */
export function GlobalStateAutoProcessItemFollowing(globalState: AssetFrameworkGlobalState): AssetFrameworkGlobalState {
	// Cache room item arrays to skip full scans when no items are following
	const roomItemCache = new WeakMap<AppearanceItems, boolean>();
	const followed: FollowedItemRef[] = [];

	for (const room of globalState.space.rooms) {
		let hasFollowing = roomItemCache.get(room.items);
		if (hasFollowing === undefined) {
			hasFollowing = false;
			for (const item of room.items) {
				if (item.isType('personal') && item.deployment?.following != null) {
					hasFollowing = true;
					break;
				}
			}
			roomItemCache.set(room.items, hasFollowing);
		}

		if (!hasFollowing) continue; // Skip rooms already verified as empty of following items

		for (const item of room.items) {
			if (item.isType('personal') && item.deployment?.following != null) {
				followed.push({ room: room.id, item: item.id });
			}
		}
	}

	// Fast path: nothing is following anything
	if (followed.length === 0)
		return globalState;

	let space = globalState.space;

	// Cache frame evaluator and carry-check per target + follow mode combination
	const cache = new Map<string, { frame: CharacterFrame; canCarry: boolean; }>();

	for (const ref of followed) {
		const room = space.getRoom(ref.room);
		const item = room?.items.find((i) => i.id === ref.item);
		if (room == null || item == null || !item.isType('personal') || item.deployment?.following == null)
			continue;

		const following = item.deployment.following;
		const target = globalState.getCharacterState(following.target);
		const targetRoom = target != null ? space.getRoom(target.currentRoom) : null;

		// Stop following if the follow is not possible anymore
		if (
			target == null ||
			targetRoom == null ||
			!item.deployment.deployed
		) {
			space = ReplaceItemInRoom(space, room.id, item, ClearFollow(item));
			continue;
		}

		const cacheKey = `${following.target}:${following.followType}`;
		let cachedData = cache.get(cacheKey);
		if (!cachedData) {
			const resolver = GetRoomProjectionResolver(targetRoom);
			const frame = GetCharacterFrame(target, resolver);
			const canCarry = CharacterCanCarryItems(target, following.followType);
			cachedData = { frame, canCarry };
			cache.set(cacheKey, cachedData);
		}

		if (!cachedData.canCarry) {
			space = ReplaceItemInRoom(space, room.id, item, ClearFollow(item));
			continue;
		}

		// Pass precomputed frame to avoid reconstructing CharacterPoseTransforms per item
		const position = TryResolvePersonalItemFollowPosition(following, target, targetRoom, cachedData.frame);
		if (position == null) {
			space = ReplaceItemInRoom(space, room.id, item, ClearFollow(item));
			continue;
		}

		const updatedItem: Item = isEqual(position, item.deployment.position) ? item : item.withDeployment(produce(item.deployment, (d) => {
			d.position = CloneDeepMutable(position);
		}));

		// Same room - only update the position
		if (targetRoom.id === room.id) {
			space = ReplaceItemInRoom(space, room.id, item, updatedItem);
			continue;
		}

		// Target is in a different room - move the item there, unless the room cannot take it
		if (!ValidateRoomInventoryItems(space.assetManager, [...targetRoom.items, updatedItem]).success) {
			space = ReplaceItemInRoom(space, room.id, item, ClearFollow(item));
			continue;
		}

		space = space.produceRoom(room.id, (r) => r.produceWithItems(r.items.filter((i) => i.id !== item.id))) ?? space;
		space = space.produceRoom(targetRoom.id, (r) => r.produceWithItems([...r.items, updatedItem])) ?? space;
	}

	return space === globalState.space ? globalState : globalState.withSpaceState(space);
}

//#endregion
