import { produce } from 'immer';
import { isEqual } from 'lodash-es';
import * as z from 'zod';
import { ActionTargetSelectorSchema, ItemPathSchema } from '../../../assets/appearanceTypes.ts';
import { PersonalItemFollowRequestSchema, type PersonalItemDeployment } from '../../../assets/item/personal.ts';
import { CreatePersonalItemFollow, PersonalItemFollowToRequest } from '../../../assets/state/itemFollowing.ts';
import { RoomPositionSchema } from '../../../assets/state/roomGeometry.ts';
import { ItemInteractionType } from '../../../character/restrictionTypes.ts';
import { CloneDeepMutable } from '../../../utility/misc.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

/** Move an item within its container */
export const AppearanceActionMoveItem = z.object({
	type: z.literal('moveItem'),
	/** Target with the item to move */
	target: ActionTargetSelectorSchema,
	/** Path to the item to move */
	item: ItemPathSchema,
	/** Relative shift for the item inside its container. If not set, defaults to zero. */
	shift: z.number().int().optional(),
	/** Sets personal item deployment. Only allowed if the item is currently in the room inventory and the asset allows room deployments. */
	personalItemDeployment: z.object({
		deployed: z.boolean().optional(),
		position: RoomPositionSchema.optional(),
		/**
		 * Makes the item follow the acting player's character (`relativeLock` keeps the position relative to the character,
		 * `hand` keeps it relative to the character's hand) or stops the following (`null`).
		 * If not set, current following is kept (and adjusted, if the position is changed).
		 */
		follow: PersonalItemFollowRequestSchema.nullable().optional(),
	}).optional(),
});

/** Moves an item within inventory, reordering the worn order. */
export function ActionMoveItem({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionMoveItem>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();

	const shift = action.shift ?? 0;

	// Player moving the item must be able to interact with the item
	processingContext.checkCanUseItem(target, action.item, shift !== 0 ? ItemInteractionType.REORDER : ItemInteractionType.ACCESS_ONLY);

	const { container, itemId } = action.item;
	const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);
	const manipulator = targetManipulator.getContainer(container);

	// Player moving the item must be able to interact with the item after moving it to target position
	// This check happens only if it is being moved in root (otherwise we shouldn't pass insertBeforeRootItem and so it is equivalent to the check above)
	if (shift !== 0 && action.item.container.length === 0) {
		const items = targetManipulator.getRootItems();
		const currentPos = items.findIndex((item) => item.id === action.item.itemId);
		const newPos = currentPos + shift;

		if (newPos < 0 || newPos > items.length)
			return processingContext.invalid();

		processingContext.checkCanUseItem(target, action.item, ItemInteractionType.REORDER, newPos < items.length ? items[newPos].id : undefined);
	}

	// If deployment is being changed, modify the item
	if (action.personalItemDeployment !== undefined) {
		const deploymentChange = action.personalItemDeployment;
		const followRequest = deploymentChange.follow;

		const currentState = processingContext.manipulator.currentState;
		const playerRestrictions = processingContext.getPlayerRestrictionManager();
		const playerState = playerRestrictions.appearance.characterState;

		// Following is only possible for items directly in a room inventory
		const currentRoom = (action.target.type === 'room' && container.length === 0) ?
			currentState.space.getRoom(action.target.roomId) :
			null;
		const currentItem = currentRoom?.items.find((i) => i.id === itemId);

		// Starting to follow (or changing the mode of following)
		if (followRequest != null) {
			if (currentRoom == null || currentItem == null || !currentItem.isType('personal') || currentItem.deployment == null)
				return processingContext.invalid();

			// Only the character in the same room can be followed
			if (playerState.currentRoom !== currentRoom.id)
				return processingContext.invalid();

			// Only deployed items can follow
			if (!(deploymentChange.deployed ?? currentItem.deployment.deployed))
				return processingContext.invalid();

			// Characters in room devices cannot carry anything
			if (playerRestrictions.getRoomDeviceLink() != null) {
				processingContext.addRestriction({ type: 'inRoomDevice' });
			}

			// Holding in hand requires usable hands
			if (followRequest.followType === 'hand') {
				playerRestrictions.checkUseHands(processingContext, false);
			}
		}

		if (!manipulator.modifyItem(itemId, (it) => {
			if (!it.isType('personal') || it.deployment == null)
				return null;

			const originalDeployment = it.deployment;

			let deployment = produce(originalDeployment, (d: PersonalItemDeployment) => {
				if (deploymentChange.deployed != null) {
					d.deployed = deploymentChange.deployed;
				}
				if (deploymentChange.position != null) {
					d.position = CloneDeepMutable(deploymentChange.position);
				}
			});

			if (followRequest === null || !deployment.deployed) {
				// Explicitly stopping or hiding the item
				deployment = produce(deployment, (d: PersonalItemDeployment) => {
					delete d.following;
				});
			} else if (followRequest !== undefined) {
				// Starting to follow the acting player
				if (currentRoom == null)
					return null;

				const newFollow = CreatePersonalItemFollow(followRequest, playerState, currentRoom, deployment.position);
				deployment = produce(deployment, (d: PersonalItemDeployment) => {
					d.following = CloneDeepMutable(newFollow);
				});
			} else if (deployment.following != null && !isEqual(deployment.position, originalDeployment.position)) {
				// Item that is following was moved - adjust the offset to the character instead of snapping it back
				const followTarget = currentState.getCharacterState(deployment.following.target);
				const followRequestFromCurrent = PersonalItemFollowToRequest(deployment.following);
				if (followTarget == null || currentRoom == null) {
					deployment = produce(deployment, (d: PersonalItemDeployment) => {
						delete d.following;
					});
				} else {
					const newFollow = CreatePersonalItemFollow(followRequestFromCurrent, followTarget, currentRoom, deployment.position);
					deployment = produce(deployment, (d: PersonalItemDeployment) => {
						d.following = CloneDeepMutable(newFollow);
					});
				}
			}

			return it.withDeployment(deployment);
		})) {
			return processingContext.invalid();
		}
	}

	// Do the reorder change
	if (shift !== 0) {
		if (!manipulator.moveItem(itemId, shift))
			return processingContext.invalid();
	}

	// Change message to chat
	// TODO: Message to chat that items were reordered
	// Will need mechanism to rate-limit the messages not to send every reorder

	return processingContext.finalize();
}
