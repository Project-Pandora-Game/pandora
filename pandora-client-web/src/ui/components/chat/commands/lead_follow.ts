import { CloneDeepMutable, CommandSelectorNumber, type CommandRunner, type IEmpty } from 'pandora-common';
import { CommandSelectorCharacter, CreateClientCommand } from '../commandsHelpers.ts';
import type { IClientCommand, ICommandExecutionContextClient } from '../commandsProcessor.ts';

function MakeLeadFollowHandler(type: 'lead' | 'follow'): CommandRunner<ICommandExecutionContextClient, IEmpty> {
	return CreateClientCommand()
		.argument('character', CommandSelectorCharacter({ allowSelf: 'otherCharacter' }))
		.fork('followType', (forkCtx) => ({
			relative: {
				description: 'Keep relative position of the characters',
				handler: forkCtx
					.argumentOptional('x', CommandSelectorNumber())
					.argumentOptional('y', CommandSelectorNumber())
					.argumentOptional('offset', CommandSelectorNumber())
					.handler(({ gameState, globalState, player }, { character, x, y, offset }) => {
						const follower = globalState.getCharacterState((type === 'follow' ? player : character).id);
						const target = globalState.getCharacterState((type === 'follow' ? character : player).id);
						if (follower == null || target == null)
							return false;

						gameState.doImmediateAction({
							type: 'moveCharacter',
							target: { type: 'character', characterId: follower.id },
							moveTo: {
								type: 'normal',
								room: target.currentRoom,
								position: CloneDeepMutable(follower.position.position),
								following: {
									followType: 'relativeLock',
									target: target.id,
									delta: [
										x ?? (follower.position.position[0] - target.position.position[0]),
										y ?? (follower.position.position[1] - target.position.position[1]),
										offset ?? (follower.position.position[2] - target.position.position[2]),
									],
								},
							},
						}).catch(() => { /* TODO */ });
						return true;
					}),
			},
			leash: {
				description: 'Keep distance between the characters',
				handler: forkCtx
					.argumentOptional('distance', CommandSelectorNumber({ min: 1 }))
					.handler(({ gameState, globalState, player }, { character, distance }) => {
						const follower = globalState.getCharacterState((type === 'follow' ? player : character).id);
						const target = globalState.getCharacterState((type === 'follow' ? character : player).id);
						if (follower == null || target == null)
							return false;

						gameState.doImmediateAction({
							type: 'moveCharacter',
							target: { type: 'character', characterId: follower.id },
							moveTo: {
								type: 'normal',
								room: target.currentRoom,
								position: CloneDeepMutable(follower.position.position),
								following: {
									followType: 'leash',
									target: target.id,
									distance: distance ?? Math.ceil(Math.hypot(
										(follower.position.position[0] - target.position.position[0]),
										(follower.position.position[1] - target.position.position[1]),
										(follower.position.position[2] - target.position.position[2]),
									)),
								},
							},
						}).catch(() => { /* TODO */ });
						return true;
					}),
			},
		}));
}

export const COMMAND_LEAD: IClientCommand<ICommandExecutionContextClient> = {
	key: ['lead'],
	usage: '<character> <relative | leash> …',
	description: `Lead another character (make them move as your character moves)`,
	longDescription: `To stop leading a character use '/stopfollow <character>'`,
	handler: MakeLeadFollowHandler('lead'),
};

export const COMMAND_FOLLOW: IClientCommand<ICommandExecutionContextClient> = {
	key: ['follow'],
	usage: '<character> <relative | leash> …',
	description: `Follow another character (move as they move)`,
	longDescription: `To stop following another character use '/stopfollow'`,
	handler: MakeLeadFollowHandler('follow'),
};

export const COMMAND_STOPFOLLOW: IClientCommand<ICommandExecutionContextClient> = {
	key: ['stopfollow'],
	usage: '[character]',
	description: `Stop yourself or another character from following someone`,
	longDescription: ``,
	handler: CreateClientCommand()
		.argumentOptional('character', CommandSelectorCharacter({ allowSelf: 'any', filter: ({ characterState }) => characterState.position.following != null }))
		.handler(({ gameState, globalState, player, displayError }, { character }) => {
			character ??= player;
			const target = globalState.getCharacterState(character.id);
			if (target == null)
				return false;

			if (target.position.following == null) {
				displayError?.(`${character.isPlayer() ? 'You are' : (character.name + ' is')} not currently following anyone`);
				return false;
			}

			gameState.doImmediateAction({
				type: 'moveCharacter',
				target: { type: 'character', characterId: target.id },
				moveTo: {
					type: 'normal',
					room: target.currentRoom,
					position: CloneDeepMutable(target.position.position),
					following: undefined,
				},
			}).catch(() => { /* TODO */ });
			return true;
		}),
};
