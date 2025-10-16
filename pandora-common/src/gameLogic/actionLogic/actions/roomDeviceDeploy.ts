import * as z from 'zod';
import { ActionTargetSelectorSchema, ItemPathSchema } from '../../../assets/appearanceTypes.ts';
import { RoomDeviceDeploymentChangeSchema, type ItemRoomDevice } from '../../../assets/item/roomDevice.ts';
import type { CharacterId } from '../../../character/characterTypes.ts';
import { ItemInteractionType } from '../../../character/restrictionTypes.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionRoomDeviceDeploy = z.object({
	type: z.literal('roomDeviceDeploy'),
	/** Target with the room device (so room) */
	target: ActionTargetSelectorSchema,
	/** Path to the room device */
	item: ItemPathSchema,
	/** The resulting deployment we want */
	deployment: RoomDeviceDeploymentChangeSchema,
});

/** Deploy (or stow) a room device. */
export function ActionRoomDeviceDeploy({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionRoomDeviceDeploy>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();
	// Player deploying the device must be able to interact with it
	processingContext.checkCanUseItem(target, action.item, ItemInteractionType.MODIFY);

	// To manipulate room devices, player must have appropriate role
	processingContext.checkPlayerHasSpaceRole(processingContext.getEffectiveRoomSettings(action.target.type === 'room' ? action.target.roomId : null).roomDeviceDeploymentMinimumRole);

	const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);

	const deployment = action.deployment;
	const { container, itemId } = action.item;
	const manipulator = targetManipulator.getContainer(container);

	let previousDeviceState: ItemRoomDevice | undefined;

	const affectedCharacters = new Set<CharacterId>();

	// Do change
	if (!manipulator.modifyItem(itemId, (it) => {
		if (!it.isType('roomDevice'))
			return null;

		for (const characterId of it.slotOccupancy.values()) {
			affectedCharacters.add(characterId);
		}

		previousDeviceState = it;
		return it.changeDeployment(deployment);
	}))
		return processingContext.invalid();

	// If we did undeploy, do character re-validation in case it was forceful (similar to admin kick)
	for (const characterId of affectedCharacters) {
		if (processingContext.getCharacter(characterId) == null)
			continue;

		if (!processingContext.manipulator.produceCharacterState(
			characterId,
			(character) => {
				const room = processingContext.manipulator.currentState.space.getRoom(character.currentRoom);
				if (room == null)
					return null;
				return character.updateRoomStateLink(room, true);
			},
		)) {
			return processingContext.invalid();
		}
	}

	// Change message to chat
	if (previousDeviceState != null && deployment.deployed !== previousDeviceState.isDeployed()) {
		processingContext.queueMessage(
			manipulator.makeMessage({
				id: (deployment != null) ? 'roomDeviceDeploy' : 'roomDeviceStore',
				item: previousDeviceState.getChatDescriptor(),
			}),
		);
	}

	return processingContext.finalize();
}
