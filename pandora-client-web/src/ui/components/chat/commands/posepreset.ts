import { Immutable } from 'immer';
import { camelCase } from 'lodash-es';
import { AssetsPosePresetCategory, CommandSelectorNamedValue, MergePartialAppearancePoses, type AssetsPosePreset } from 'pandora-common';
import { FixupStoredPosePreset, StoredPosePresets } from '../../../../components/wardrobe/poseDetail/customPosePresetStorage.ts';
import { CreateClientCommand } from '../commandsHelpers.ts';
import type { IClientCommand, ICommandExecutionContextClient } from '../commandsProcessor.ts';

export const COMMAND_POSEPRESET: IClientCommand<ICommandExecutionContextClient> = {
	key: ['posepreset', 'pp'],
	usage: '<category> <pose preset>',
	description: `Move your character to specified pose`,
	longDescription: `(alternative command: '/pp')`,
	handler: CreateClientCommand()
		.argumentDynamic('category', { preparse: 'quotedArgTrimmed', autocompleteShowValue: true }, ({ globalState }) => {
			const assetManager = globalState.assetManager;

			return CommandSelectorNamedValue<Immutable<AssetsPosePresetCategory> | 'custom'>([
				{ value: 'custom', name: 'custom', description: 'Saved custom pose' },
				...assetManager.posePresets.map((category) => ({
					value: category,
					name: camelCase(category.category.replaceAll(/[()[\]{}]/g, '')),
					description: category.category,
				})),
			]);
		})
		.argumentDynamic('pose', { preparse: 'allTrimmed' }, ({ globalState }, { category }) => {
			const assetManager = globalState.assetManager;

			if (category === 'custom') {
				return CommandSelectorNamedValue<Immutable<AssetsPosePreset>>([
					...(StoredPosePresets.value ?? []).map((pose) => ({
						value: FixupStoredPosePreset(pose, assetManager),
						name: pose.name,
					})),
				]);
			} else {
				return CommandSelectorNamedValue<Immutable<AssetsPosePreset>>([
					...category.poses.map((pose) => ({
						value: pose,
						name: pose.name,
					})),
				]);
			}
		})
		.handler(({ player, gameState }, { pose }) => {
			const { arms, leftArm, rightArm, ...copy } = MergePartialAppearancePoses(pose, pose.optional);

			gameState.doImmediateAction({
				type: 'pose',
				target: player.id,
				leftArm: { ...arms, ...leftArm },
				rightArm: { ...arms, ...rightArm },
				...copy,
			}).catch(() => { /** TODO */ });
			return true;
		}),
};
