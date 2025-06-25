import { capitalize, clamp, lowerCase } from 'lodash-es';
import {
	ArmFingersSchema,
	ArmPoseSchema,
	ArmRotationSchema,
	ArmSegmentOrderSchema,
	Assert,
	BONE_MAX,
	BONE_MIN,
	CommandSelectorEnum,
	LegSideOrderSchema,
	LegsPoseSchema,
	type PartialAppearancePose,
	type Satisfies,
} from 'pandora-common';
import type { PlayerCharacter } from '../../../../character/player.ts';
import type { GameState } from '../../../../components/gameContext/gameStateContextProvider.tsx';
import { GetVisibleBoneName } from '../../../../components/wardrobe/wardrobeUtils.ts';
import { CreateClientCommand } from '../commandsHelpers.ts';
import type { IClientCommand, ICommandExecutionContextClient } from '../commandsProcessor.ts';

export const COMMAND_POSEMANUAL: IClientCommand<ICommandExecutionContextClient> = {
	key: ['posemanual', 'pm'],
	usage: '<bone | arms | armLeft | armRight | armOrder | legs | legOrder | rotation> …',
	description: `Alter details of your character's pose`,
	longDescription: `(alternative command: '/pm')`,
	handler: CreateClientCommand()
		.fork('type', (forkCtx) => {
			function doPose(gameState: GameState, player: PlayerCharacter, { arms, leftArm, rightArm, ...copy }: PartialAppearancePose) {
				gameState.doImmediateAction({
					type: 'pose',
					target: player.id,
					leftArm: { ...arms, ...leftArm },
					rightArm: { ...arms, ...rightArm },
					...copy,
				}).catch(() => { /* TODO */ });
			}

			function armHandler(arm: Satisfies<'leftArm' | 'rightArm' | 'arms', keyof PartialAppearancePose>) {
				return forkCtx.fork('armType', (armForkCtx) => ({
					position: {
						description: 'Change position of the arms in relation to the body',
						handler: armForkCtx
							.argument('value', CommandSelectorEnum(ArmPoseSchema.options.map((o) => [o, capitalize(lowerCase(o))])))
							.handler(({ gameState, player }, { value }) => {
								doPose(gameState, player, { [arm]: { position: value } });
								return true;
							}),
					},
					fingers: {
						description: 'Change state of the arm\'s fingers',
						handler: armForkCtx
							.argument('value', CommandSelectorEnum(ArmFingersSchema.options.map((o) => [o, capitalize(lowerCase(o))])))
							.handler(({ gameState, player }, { value }) => {
								doPose(gameState, player, { [arm]: { fingers: value } });
								return true;
							}),
					},
					rotation: {
						description: 'Change rotation of the arm (direction of thumb)',
						handler: armForkCtx
							.argument('value', CommandSelectorEnum(ArmRotationSchema.options.map((o) => [o, capitalize(lowerCase(o))])))
							.handler(({ gameState, player }, { value }) => {
								doPose(gameState, player, { [arm]: { rotation: value } });
								return true;
							}),
					},
				}));
			}

			return {
				bone: {
					description: 'Change rotation of a specific bone',
					handler: forkCtx
						.argumentDynamic('bone', { preparse: 'quotedArgTrimmed' }, ({ globalState }) => {
							const assetManager = globalState.assetManager;

							return CommandSelectorEnum(assetManager.getAllBones()
								.filter(({ type }) => type === 'pose')
								.flatMap(({ name, isMirror }) => {
									// For mirror bone add an universal entry
									if (isMirror) {
										const basePart = /^(.*_)[lr]$/.exec(name);
										if (basePart != null) {
											return [
												[
													basePart[1],
													assetManager.getAllBones()
														.filter(({ name: groupedName, type }) => type === 'pose' && groupedName.startsWith(basePart[1]))
														.map(({ name: groupedName }) => GetVisibleBoneName(groupedName))
														.join(' & '),
												],
												[name, GetVisibleBoneName(name)],
											];
										}
									}

									return [[name, GetVisibleBoneName(name)]];
								}),
							);
						})
						.handler({ restArgName: '[+|-] <value>' }, ({ gameState, globalState, player, displayError }, { bone }, rest) => {
							const playerState = globalState.getCharacterState(player.id);
							Assert(playerState != null);

							const restMatch = /^(?:([+-])\s+)?(-?\d+)$/.exec(rest);
							if (restMatch == null) {
								displayError?.(`Expected number between ${BONE_MIN} and ${BONE_MAX}, optionally prefixed by '+ ' or '- ' for only shifting from current state`);
								return false;
							}

							const restValue = Number.parseInt(restMatch[2]);
							if (!Number.isSafeInteger(restValue) || restValue < BONE_MIN || restValue > BONE_MAX) {
								displayError?.(`Expected number between ${BONE_MIN} and ${BONE_MAX}, optionally prefixed by '+ ' or '- ' for only shifting from current state`);
								return false;
							}

							const setBones: Record<string, number> = {};
							for (const assetBone of globalState.assetManager.getAllBones()) {
								if (assetBone.type === 'pose' && assetBone.name.startsWith(bone)) {
									setBones[assetBone.name] = clamp(
										(
											((restMatch[1] === '+' || restMatch[1] === '-') ? (playerState.requestedPose.bones[assetBone.name] ?? 0) : 0) +
											(restMatch[1] === '-' ? -1 : 1) * restValue
										),
										BONE_MIN,
										BONE_MAX,
									);
								}
							}

							doPose(gameState, player, { bones: setBones });
							return true;
						}),
				},
				arms: {
					description: 'Change pose of both arms at the same time',
					handler: armHandler('arms'),
				},
				armLeft: {
					description: 'Change pose of the left arm',
					handler: armHandler('leftArm'),
				},
				armRight: {
					description: 'Change pose of the right arm',
					handler: armHandler('rightArm'),
				},
				armOrder: {
					description: 'Change order of the arms (which arm is on top)',
					handler: forkCtx
						.argument('value', CommandSelectorEnum(ArmSegmentOrderSchema.options.map((o) => [o, capitalize(lowerCase(o))])))
						.handler(({ gameState, player }, { value }) => {
							doPose(gameState, player, { armsOrder: { upper: value } });
							return true;
						}),
				},
				legs: {
					description: 'Change pose of the legs',
					handler: forkCtx.fork('legType', (armForkCtx) => ({
						pose: {
							description: 'Change pose of the legs (identical to the /stand, /sit and /kneel commands)',
							handler: armForkCtx
								.argument('value', CommandSelectorEnum(LegsPoseSchema.options.map((o) => [o, capitalize(lowerCase(o))])))
								.handler(({ gameState, player }, { value }) => {
									doPose(gameState, player, { legs: { pose: value } });
									return true;
								}),
						},
					})),
				},
				legOrder: {
					description: 'Change order of the legs (which leg is on top)',
					handler: forkCtx
						.argument('value', CommandSelectorEnum(LegSideOrderSchema.options.map((o) => [o, capitalize(lowerCase(o))])))
						.handler(({ gameState, player }, { value }) => {
							doPose(gameState, player, { legs: { upper: value } });
							return true;
						}),
				},
				rotation: {
					description: 'Rotate the character (shortcut for "bone character_rotation")',
					handler: forkCtx.handler({ restArgName: '[+|-] <value>' }, ({ gameState, globalState, player, displayError }, _args, rest) => {
						const playerState = globalState.getCharacterState(player.id);
						Assert(playerState != null);

						const restMatch = /^(?:([+-])\s+)?(-?\d+)$/.exec(rest);
						if (restMatch == null) {
							displayError?.(`Expected number between ${BONE_MIN} and ${BONE_MAX}, optionally prefixed by '+ ' or '- ' for only shifting from current state`);
							return false;
						}

						const restValue = Number.parseInt(restMatch[2]);
						if (!Number.isSafeInteger(restValue) || restValue < BONE_MIN || restValue > BONE_MAX) {
							displayError?.(`Expected number between ${BONE_MIN} and ${BONE_MAX}, optionally prefixed by '+ ' or '- ' for only shifting from current state`);
							return false;
						}

						const rotation = clamp(
							(
								((restMatch[1] === '+' || restMatch[1] === '-') ? (playerState.requestedPose.bones.character_rotation ?? 0) : 0) +
								(restMatch[1] === '-' ? -1 : 1) * restValue
							),
							BONE_MIN,
							BONE_MAX,
						);

						doPose(gameState, player, { bones: { character_rotation: rotation } });
						return true;
					}),
				},
			};
		}),
};
