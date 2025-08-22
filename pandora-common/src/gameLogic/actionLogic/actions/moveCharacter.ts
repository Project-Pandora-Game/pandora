import { uniq } from 'lodash-es';
import { z } from 'zod';
import { CharacterSelectorSchema } from '../../../assets/appearanceTypes.ts';
import { CharacterCanBeFollowed, CharacterCanFollow, CharacterSpacePositionSchema, IsValidRoomPosition } from '../../../assets/state/roomGeometry.ts';
import { AssertNever } from '../../../utility/misc.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionMoveCharacter = z.object({
	type: z.literal('moveCharacter'),
	/** Target with the item to move */
	target: CharacterSelectorSchema,
	/** Where to move the character */
	moveTo: CharacterSpacePositionSchema,
});

/** Moves a character within a space or a room in a space. */
export function ActionMoveCharacter({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionMoveCharacter>>): AppearanceActionProcessingResult {
	const player = processingContext.getPlayerRestrictionManager();
	const playerRoom = player.appearance.getCurrentRoom();
	const target = processingContext.getCharacter(action.target.characterId);
	const originalRoom = target?.appearance.getCurrentRoom();
	if (playerRoom == null || target == null || originalRoom == null)
		return processingContext.invalid();

	const originalPosition = target.appearance.characterState.position;

	if (target.getRoomDeviceLink() != null) {
		processingContext.addRestriction({
			type: 'inRoomDevice',
		});
	}

	if (target.character.id === player.character.id) {
		// If moving self, must not be restricted by items
		if (player.getEffects().blockRoomMovement) {
			processingContext.addRestriction({
				type: 'blockedMove',
			});
		}
	} else {
		// Admins can move others freely, non-admins need to be able to interact with target and a permission
		if (!player.isCurrentSpaceAdmin()) {
			processingContext.checkInteractWithTarget(target.appearance);
			processingContext.addInteraction(target.character, 'moveCharacter');
		}
	}

	if (action.moveTo.type === 'normal') {
		const spaceContext = processingContext.getSpaceContext();
		// Target room must exist
		const room = processingContext.manipulator.currentState.space.getRoom(action.moveTo.room);
		if (room == null)
			return processingContext.invalid();
		// And be reachable from both starting point and for current player (ignored for admins)
		if (!player.isCurrentSpaceAdmin()) {
			if (originalRoom.id !== room.id && originalRoom.getLinkToRoom(room) == null) {
				processingContext.addRestriction({ type: 'tooFar', subtype: 'roomTarget' });
			}
			if (playerRoom.id !== room.id && playerRoom.getLinkToRoom(room) == null) {
				processingContext.addRestriction({ type: 'tooFar', subtype: 'roomTarget' });
			}
		}
		// Development rooms don't have position enforcement to allow fine-tuning positioning arguments
		if (!spaceContext.features.includes('development')) {
			if (!IsValidRoomPosition(room.roomBackground, action.moveTo.position)) {
				return processingContext.invalid();
			}
		}
		// Additional checks if follow/leash is in use
		if (action.moveTo.following != null) {
			// Cannot follow oneself
			if (action.moveTo.following.target === target.character.id)
				return processingContext.invalid();
			// Check this character can follow
			if (!CharacterCanFollow(target.appearance.characterState, target.appearance.gameState)) {
				return processingContext.invalid('characterMoveCannotFollow');
			}

			// All follow modes need move permission (even if admin)
			player.checkInteractWithTarget(processingContext, target.appearance);
			processingContext.addInteraction(target.character, 'moveCharacter');
			// ... and generic access permission to the follow target (to prevent people annoying people)
			const followTarget = processingContext.getCharacter(action.moveTo.following.target);
			const followTargetRoom = followTarget?.appearance.getCurrentRoom();
			if (followTarget == null || followTargetRoom == null)
				return processingContext.invalid();
			player.checkInteractWithTarget(processingContext, followTarget.appearance);
			// And check that the target can actually be followed
			if (!CharacterCanBeFollowed(followTarget.appearance.characterState)) {
				return processingContext.invalid('characterMoveCannotFollowTarget');
			}
			// And check the follow target is reachable from the current player (not the player following)
			if (playerRoom.id !== followTargetRoom.id && playerRoom.getLinkToRoom(followTargetRoom) == null) {
				processingContext.addRestriction({ type: 'tooFar', subtype: 'followTarget' });
			}
			// Messages if follow starts
			if ((originalPosition.following?.target) !== action.moveTo.following?.target) {
				if (action.target.characterId === player.appearance.id) {
					processingContext.queueMessage({
						id: 'characterPositionFollowStartFollow',
						rooms: uniq([originalRoom.id, followTargetRoom.id]),
						target: {
							type: 'character',
							id: followTarget.appearance.id,
						},
					});
				} else {
					processingContext.queueMessage({
						id: 'characterPositionFollowStartLead',
						rooms: uniq([originalRoom.id, followTargetRoom.id]),
						target: {
							type: 'character',
							id: target.appearance.id,
						},
					});
				}
			}
		} else {
			// Message if follow stops
			if (originalPosition.following != null) {
				if (action.target.characterId === player.appearance.id) {
					processingContext.queueMessage({
						id: 'characterPositionFollowStopFollow',
						rooms: [originalRoom.id],
						target: {
							type: 'character',
							id: originalPosition.following.target,
						},
					});
				} else {
					processingContext.queueMessage({
						id: 'characterPositionFollowStopLead',
						rooms: [originalRoom.id],
						target: {
							type: 'character',
							id: target.appearance.id,
						},
					});
				}
			}
		}
	} else {
		AssertNever(action.moveTo.type);
	}

	if (!processingContext.manipulator.produceCharacterState(target.character.id, (character) => {
		return character.produceWithSpacePosition(action.moveTo);
	})) {
		return processingContext.invalid();
	}

	return processingContext.finalize();
}
