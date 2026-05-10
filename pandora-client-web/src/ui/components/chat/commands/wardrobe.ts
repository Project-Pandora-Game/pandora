import { ActionTargetToWardrobeUrl } from '../../../../components/wardrobe/wardrobeNavigation.tsx';
import { CommandSelectorRoom } from '../commandHelpers/selectorRoom.ts';
import { CommandSelectorCharacter, CreateClientCommand } from '../commandsHelpers.ts';
import type { IClientCommand, ICommandExecutionContextClient } from '../commandsProcessor.ts';

export const COMMAND_WARDROBE: IClientCommand<ICommandExecutionContextClient> = {
	key: ['wardrobe'],
	usage: '<room | character> …',
	description: `Opens a character's or room's wardrobe`,
	longDescription: '',
	handler: CreateClientCommand()
		.fork('targetType', (forkCtx) => {
			return {
				room: {
					description: 'Open wardrobe of the specified room. Defaults to current room. Note, that only space administrators can interact with all rooms freely.',
					handler: forkCtx
						.argumentOptional('room', CommandSelectorRoom())
						.handler(({ globalState, player, navigate, displayError }, { room }) => {
							// Default to player's current room
							room ??= (player.getAppearance(globalState).getCurrentRoom() ?? undefined);

							if (room == null) {
								displayError?.('Unable to determinate current room, try again later');
								return false;
							}

							navigate(ActionTargetToWardrobeUrl({ type: 'room', roomId: room.id }));
							return true;
						}),
				},
				character: {
					description: 'Open wardrobe of the specified character. Defaults to opening your own wardrobe.',
					handler: forkCtx
						.argumentOptional('character', CommandSelectorCharacter({ allowSelf: 'any' }))
						.handler(({ player, navigate }, { character }) => {
							// Default to player
							character ??= player;

							navigate(ActionTargetToWardrobeUrl({ type: 'character', characterId: character.id }));
						}),
				},
			};
		}),
};
