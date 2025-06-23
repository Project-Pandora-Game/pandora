import type { Immutable } from 'immer';
import {
	CharacterSize,
	GetLogger,
	type AssetFrameworkPosePresetWithId,
	type AssetManager,
	type AssetsPosePreset,
} from 'pandora-common';
import React from 'react';
import { Observable, type ReadonlyObservable } from '../../../observable.ts';
import { useDirectoryChangeListener, useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';

export function FixupStoredPosePreset(preset: Immutable<AssetFrameworkPosePresetWithId>, assetManager: AssetManager): AssetsPosePreset {
	const pose: AssetsPosePreset = {
		...preset.pose,
		name: preset.name,
		preview: {
			y: 0,
			size: Math.max(CharacterSize.WIDTH, CharacterSize.HEIGHT),
			basePose: assetManager.randomization.pose,
		},
	};
	if (pose.bones != null) {
		const bones: Record<string, number> = {};
		const allBones = assetManager.getAllBones();
		for (const [bone, value] of Object.entries(pose.bones)) {
			if (value == null)
				continue;

			const def = allBones.find((b) => b.name === bone);
			if (def == null || def.type !== 'pose')
				continue;

			bones[bone] = value;
		}
		pose.bones = bones;
	}
	return pose;
}

const StoredPosePresetsInternal = new Observable<AssetFrameworkPosePresetWithId[] | undefined>(undefined);
/**
 * The saved pose presets or `undefined` if data is not yet ready
 */
export const StoredPosePresets: ReadonlyObservable<AssetFrameworkPosePresetWithId[] | undefined> = StoredPosePresetsInternal;

/**
 * Service component that loads the saved pose presets from server, listening for changes
 */
export function StoredPosePresetsLoaderService(): null {
	const directoryConnector = useDirectoryConnector();

	const fetchStoredPosePresets = React.useCallback(async () => {
		const result = await directoryConnector.awaitResponse('storedPosePresetsGetAll', {});
		StoredPosePresetsInternal.value = result.storedPosePresets;
	}, [directoryConnector]);

	useDirectoryChangeListener('storedPosePresets', () => {
		fetchStoredPosePresets().catch((err) => {
			GetLogger('StoredPosePresetsLoader').warning('Error getting stored pose presets:', err);
		});
	}, true);

	return null;
}
