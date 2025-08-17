import { clamp } from 'lodash-es';
import {
	Assert,
	AssertNever,
	CloneDeepMutable,
	CommandSelectorNumber,
	GenerateInitialRoomPosition,
	GetRoomPositionBounds,
	type CharacterRoomPosition,
	type CommandForkDescriptor,
	type Coordinates,
	type RoomId,
} from 'pandora-common';
import { toast } from 'react-toastify';
import type { Writable } from 'type-fest';
import type { PlayerCharacter } from '../../../../character/player.ts';
import type { GameState } from '../../../../components/gameContext/gameStateContextProvider.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../../persistentToast.ts';
import { CommandDoGameAction } from '../commandHelpers/gameAction.tsx';
import { CommandSelectorRoom } from '../commandHelpers/selectorRoom.ts';
import { CommandSelectorCharacter, CreateClientCommand } from '../commandsHelpers.ts';
import type { IClientCommand, ICommandExecutionContextClient } from '../commandsProcessor.ts';

export const COMMAND_MOVETO: IClientCommand<ICommandExecutionContextClient> = {
	key: ['moveto', 'mt'],
	usage: '<room | character | north | south | west | east> …',
	description: `Moves your character to another room or towards another character`,
	longDescription: '',
	handler: CreateClientCommand()
		.fork('targetType', (forkCtx) => {
			function moveToRoom(gameState: GameState, player: PlayerCharacter, roomId: RoomId): boolean {
				const room = gameState.globalState.currentState.space.getRoom(roomId);
				if (room == null) {
					toast('Target room not found', TOAST_OPTIONS_ERROR);
					return false;
				}

				return CommandDoGameAction(gameState, {
					type: 'moveCharacter',
					target: { type: 'character', characterId: player.id },
					moveTo: {
						type: 'normal',
						room: room.id,
						position: GenerateInitialRoomPosition(room.roomBackground),
					},
				});
			}

			function makeCardinalDirectionHandler(direction: 'north' | 'south' | 'west' | 'east'): CommandForkDescriptor<ICommandExecutionContextClient> {
				return {
					description: `Move one room to the ${direction}`,
					handler: forkCtx.handler(({ gameState, globalState, player, displayError }) => {
						const playerState = globalState.getCharacterState(player.id);
						Assert(playerState != null);
						const currentRoom = globalState.space.getRoom(playerState.currentRoom);
						Assert(currentRoom != null);

						const targetCoordinates: Coordinates = { x: currentRoom.position.x, y: currentRoom.position.y };
						switch (direction) {
							case 'north':
								targetCoordinates.y--;
								break;
							case 'south':
								targetCoordinates.y++;
								break;
							case 'west':
								targetCoordinates.x--;
								break;
							case 'east':
								targetCoordinates.x++;
								break;
							default:
								AssertNever(direction);
						}

						const targetRoom = globalState.space.rooms.find((r) => r.position.x === targetCoordinates.x && r.position.y === targetCoordinates.y);
						if (targetRoom == null) {
							displayError?.(`There is no room to the ${direction} of you`);
							return false;
						}

						return moveToRoom(gameState, player, targetRoom.id);
					}),
				};
			}

			return {
				room: {
					description: 'Move to a specified room. Note, that only space administrators can move to all rooms freely.',
					handler: forkCtx
						.argument('room', CommandSelectorRoom())
						.handler(({ gameState, player }, { room }) => {
							return moveToRoom(gameState, player, room.id);
						}),
				},
				character: {
					description: 'Move to the room of the specified character, if possible. If a distance is also specified, move next to the character at that distance in the room they are in. Note, that only space administrators can move to all rooms freely.',
					handler: forkCtx
						.argument('character', CommandSelectorCharacter({ allowSelf: 'otherCharacter' }))
						.argumentOptional('distance', CommandSelectorNumber({ min: 1 }))
						.handler(({ gameState, globalState, player, displayError }, { character, distance }) => {
							const playerState = globalState.getCharacterState(player.id);
							Assert(playerState != null);

							const targetCharacter = globalState.getCharacterState(character.id);
							if (targetCharacter == null) {
								displayError?.('Target character not found');
								return false;
							}
							const targetRoom = globalState.space.getRoom(targetCharacter.currentRoom);
							if (targetRoom == null) {
								displayError?.('Target character not found');
								return false;
							}

							const targetPosition: Writable<CharacterRoomPosition> = CloneDeepMutable(
								targetRoom.id === playerState.position.room ? playerState.position.position :
									GenerateInitialRoomPosition(targetRoom.roomBackground),
							);

							if (distance != null) {
								// Calculate a leash-like movement for distance
								const deltaVector: Writable<CharacterRoomPosition> = CloneDeepMutable(targetPosition);
								for (let i = 0; i <= 2; i++) {
									deltaVector[i] -= targetCharacter.position.position[i];
								}
								const currentDistance = Math.hypot(...deltaVector);
								if (currentDistance > distance) {
									const ratio = distance / currentDistance;
									for (let i = 0; i <= 2; i++) {
										targetPosition[i] = targetCharacter.position.position[i] + Math.round(deltaVector[i] * ratio);
									}
									const { minX, maxX, minY, maxY } = GetRoomPositionBounds(targetRoom.roomBackground);
									targetPosition[0] = clamp(targetPosition[0], minX, maxX);
									targetPosition[1] = clamp(targetPosition[1], minY, maxY);
								}
							}

							return CommandDoGameAction(gameState, {
								type: 'moveCharacter',
								target: { type: 'character', characterId: player.id },
								moveTo: {
									type: 'normal',
									room: targetRoom.id,
									position: targetPosition,
								},
							});
						}),
				},
				north: makeCardinalDirectionHandler('north'),
				south: makeCardinalDirectionHandler('south'),
				west: makeCardinalDirectionHandler('west'),
				east: makeCardinalDirectionHandler('east'),
			};
		}),
};
