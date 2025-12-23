import { remove } from 'lodash-es';
import {
	AppearanceBundle,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	AssetFrameworkOutfit,
	AssetFrameworkSpaceState,
	CloneDeepMutable,
	CreateItemBundleFromTemplate,
	GetDefaultAppearanceBundle,
} from 'pandora-common';
import type { PlayerCharacter } from '../../../character/player.ts';

export function CreateOutfitPreviewDollState(
	outfit: AssetFrameworkOutfit,
	baseCharacterState: AssetFrameworkCharacterState,
	globalState: AssetFrameworkGlobalState,
	player: PlayerCharacter,
): readonly [AssetFrameworkCharacterState, AssetFrameworkGlobalState] {
	const assetManager = globalState.assetManager;

	// As a base use the current character, but only body - not any items
	const templateBundle = baseCharacterState.items
		.filter((item) => item.isType('bodypart'))
		.map((item) => item.exportToBundle({}));

	const overwrittenBodyparts = new Set<string>();

	for (const itemTemplate of outfit.items) {
		const itemBundle = CreateItemBundleFromTemplate(itemTemplate, {
			assetManager,
			creator: player.gameLogicCharacter,
			createItemBundleFromTemplate: CreateItemBundleFromTemplate,
		});
		if (itemBundle != null) {
			const asset = assetManager.getAssetById(itemBundle.asset);
			// We need to overwrite bodyparts of type we are adding for the preview to make sense
			if (asset?.isType('bodypart') && !overwrittenBodyparts.has(asset.definition.bodypart)) {
				const bodypart = asset.definition.bodypart;
				// But we don't want to drop bodyparts that are in the outfit multiple times (e.g. hairs)
				overwrittenBodyparts.add(bodypart);
				remove(templateBundle, (oldItem) => {
					const oldAsset = assetManager.getAssetById(oldItem.asset);
					return oldAsset?.isType('bodypart') && oldAsset.definition.bodypart === bodypart;
				});
			}

			templateBundle.push(itemBundle);
		}
	}

	const currentRoom = globalState.space.getRoom(baseCharacterState.currentRoom);

	const characterBundle: AppearanceBundle = GetDefaultAppearanceBundle();
	characterBundle.items = templateBundle;
	characterBundle.requestedPose = CloneDeepMutable(baseCharacterState.requestedPose);
	characterBundle.position = CloneDeepMutable(baseCharacterState.position);
	let previewSpaceState = AssetFrameworkSpaceState.createDefault(assetManager, null);
	if (currentRoom != null) {
		previewSpaceState = previewSpaceState.withRooms([currentRoom]);
	}
	const previewCharacterState = AssetFrameworkCharacterState.loadFromBundle(assetManager, baseCharacterState.id, characterBundle, previewSpaceState, undefined);
	return [
		previewCharacterState,
		AssetFrameworkGlobalState.createDefault(assetManager, previewSpaceState)
			.withCharacter(previewCharacterState.id, previewCharacterState),
	] as const;
}
