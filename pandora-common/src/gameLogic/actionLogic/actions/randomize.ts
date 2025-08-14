import { nanoid } from 'nanoid';
import { z } from 'zod';
import { CharacterAppearanceLoadAndValidate, ValidateAppearanceItems, ValidateAppearanceItemsPrefix } from '../../../assets/appearanceValidation.ts';
import type { Asset } from '../../../assets/asset.ts';
import type { WearableAssetType } from '../../../assets/definitions.ts';
import { FilterItemWearable, type Item } from '../../../assets/item/base.ts';
import { CreateAssetPropertiesResult, MergeAssetProperties } from '../../../assets/properties.ts';
import { ItemInteractionType } from '../../../character/restrictionTypes.ts';
import { PseudoRandom } from '../../../math/index.ts';
import { SampleArray, ShuffleArray } from '../../../utility/index.ts';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext.ts';
import type { AppearanceActionHandlerArg } from './_common.ts';

export const AppearanceActionRandomize = z.object({
	type: z.literal('randomize'),
	/** What to randomize */
	kind: z.enum(['items', 'full']),
	/** Seed to use for pseudo random generation */
	seed: z.string().max(32),
});

/** Randomize own appearance. */
export function ActionAppearanceRandomize({
	action,
	processingContext,
	assetManager,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionRandomize>>): AppearanceActionProcessingResult {
	const kind = action.kind;
	const character = processingContext.getPlayerRestrictionManager();
	const characterManipulator = processingContext.manipulator.getManipulatorFor({
		type: 'character',
		characterId: character.appearance.id,
	});

	// Must be able to remove all items currently worn, have free hands and if modifying body also be in room that allows body changes
	const oldItems = characterManipulator.getRootItems().filter(FilterItemWearable);
	for (const i of oldItems) {
		// Ignore bodyparts if we are not changing those
		if (kind === 'items' && i.isType('bodypart'))
			continue;

		character.checkUseItemDirect(processingContext, character.appearance, [], i, ItemInteractionType.ADD_REMOVE);
	}

	// Room must allow body changes if running full randomization
	if (kind === 'full' && !character.spaceContext.features.includes('allowBodyChanges')) {
		processingContext.addProblem({
			result: 'restrictionError',
			restriction: {
				type: 'modifyBodyRoom',
			},
		});
	}

	// Must have free hands to randomize
	if (!character.canUseHands() && !character.forceAllowItemActions()) {
		processingContext.addProblem({
			result: 'restrictionError',
			restriction: {
				type: 'blockedHands',
			},
		});
	}

	if (character.getRoomDeviceLink() != null) {
		processingContext.addProblem({
			result: 'restrictionError',
			restriction: {
				type: 'inRoomDevice',
			},
		});
	}

	// Filter appearance to get either body or nothing
	let newAppearance: Item<WearableAssetType>[] = kind === 'items' ? oldItems.filter((i) => i.isType('bodypart')) : [];
	// Collect info about already present items
	const usedAssets = new Set<Asset>();
	let properties = CreateAssetPropertiesResult();
	newAppearance.forEach((item) => {
		usedAssets.add(item.asset);
		properties = item.getPropertiesParts().reduce(MergeAssetProperties, properties);
	});

	const room = processingContext.manipulator.currentState.space.getRoom(character.appearance.characterState.currentRoom);
	if (room == null)
		return processingContext.invalid();

	const randomSource = new PseudoRandom(action.seed);

	// Build body if running full randomization
	if (kind === 'full') {
		const usedSingularBodyparts = new Set<string>();
		// First build based on random generator
		for (const requestedBodyAttribute of assetManager.randomization.body) {
			// Skip already present attributes
			if (properties.attributes.has(requestedBodyAttribute))
				continue;

			// Find possible assets (intentionally using only always-present attributes, not statically collected ones)
			const possibleAssets = assetManager
				.getAllAssets()
				.filter((a) => a.isType('bodypart') &&
					a.definition.allowRandomizerUsage === true &&
					a.definition.attributes?.provides?.includes(requestedBodyAttribute) &&
					// Skip already present assets
					!usedAssets.has(a) &&
					// Skip already present bodyparts that don't allow multiple
					!usedSingularBodyparts.has(a.definition.bodypart),
				);

			// Pick one and add it to the appearance
			const asset = SampleArray(possibleAssets, randomSource);
			if (asset && asset.isType('bodypart')) {
				const item = assetManager.createItem(`i/${nanoid()}`, asset, processingContext.player);
				newAppearance.push(item);
				usedAssets.add(asset);
				properties = item.getPropertiesParts().reduce(MergeAssetProperties, properties);
				if (!assetManager.bodyparts.find((b) => b.name === asset.definition.bodypart)?.allowMultiple) {
					usedSingularBodyparts.add(asset.definition.bodypart);
				}
			}
		}

		// Re-load the appearance we have to make sure body is valid
		newAppearance = CharacterAppearanceLoadAndValidate(assetManager, newAppearance, processingContext.player, room).slice();
	}

	// Make sure the appearance is valid (required for items step)
	let r = ValidateAppearanceItems(assetManager, newAppearance, room);
	if (!r.success) {
		processingContext.addProblem({
			result: 'validationError',
			validationError: r.error,
		});
		return processingContext.invalid();
	}

	// Go through wanted attributes one-by one, always try to find matching items and try to add them in random order
	// After each time we try the item, we validate appearance in full to see if it is possible addition
	// Note: Yes, this is computationally costly. We might want to look into rate-limiting character randomization
	for (const requestedAttribute of assetManager.randomization.clothes) {
		// Skip already present attributes
		if (properties.attributes.has(requestedAttribute))
			continue;

		// Find possible assets (intentionally using only always-present attributes, not statically collected ones)
		const possibleAssets = assetManager
			.getAllAssets()
			.filter((asset) => asset.isType('personal'))
			.filter((asset) =>
				asset.definition.attributes?.provides?.includes(requestedAttribute) &&
				asset.definition.allowRandomizerUsage === true &&
				// Skip already present assets
				!usedAssets.has(asset),
			);

		// Shuffle them so we try to add randomly
		ShuffleArray(possibleAssets, randomSource);

		// Try them one by one, stopping at first successful (if we skip all, nothing bad happens)
		for (const asset of possibleAssets) {
			const item = assetManager.createItem(`i/${nanoid()}`, asset, processingContext.player);
			const newItems: Item<WearableAssetType>[] = [...newAppearance, item];

			r = ValidateAppearanceItemsPrefix(assetManager, newItems, room);
			if (r.success) {
				newAppearance = newItems;
				usedAssets.add(asset);
				properties = item.getPropertiesParts().reduce(MergeAssetProperties, properties);
				break;
			}
		}
	}

	// Try to assign the new appearance
	characterManipulator.resetItemsTo(newAppearance);

	// Reset character pose
	if (!processingContext.manipulator.produceCharacterState(character.appearance.id, (c) => c.produceWithPose(
		assetManager.randomization.pose,
		kind === 'full' ? true : 'pose',
		true,
	))) {
		return processingContext.invalid();
	}

	return processingContext.finalize();
}
