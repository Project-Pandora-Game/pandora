import { z } from 'zod';
import { CharacterId, CharacterIdSchema, RestrictionResult } from '../character';
import { Assert, AssertNever, ShuffleArray } from '../utility';
import { AppearanceArmPoseSchema, AppearancePoseSchema, CharacterView, SAFEMODE_EXIT_COOLDOWN } from './appearance';
import { AssetManager } from './assetManager';
import { AssetIdSchema } from './definitions';
import { ActionHandler, ActionProcessingContext, ItemContainerPath, ItemContainerPathSchema, ItemIdSchema, ItemPath, ItemPathSchema, RoomActionTarget, RoomTargetSelector, RoomTargetSelectorSchema } from './appearanceTypes';
import { CharacterRestrictionsManager, ItemInteractionType, Restriction } from '../character/restrictionsManager';
import { ItemModuleAction, ItemModuleActionSchema } from './modules';
import { Item, ItemColorBundle, ItemColorBundleSchema } from './item';
import { AppearanceRootManipulator } from './appearanceHelpers';
import { AppearanceItems, AppearanceLoadAndValidate, AppearanceValidationError, AppearanceValidationResult, ValidateAppearanceItems, ValidateAppearanceItemsPrefix } from './appearanceValidation';
import { sample } from 'lodash';
import { nanoid } from 'nanoid';
import { Asset } from './asset';
import { CreateAssetPropertiesResult, MergeAssetProperties } from './properties';

export const AppearanceActionCreateSchema = z.object({
	type: z.literal('create'),
	/** ID to give the new item */
	itemId: ItemIdSchema,
	/** Asset to create the new item from */
	asset: AssetIdSchema,
	/** Target the item should be added to after creation */
	target: RoomTargetSelectorSchema,
	/** Container path on target where to add the item to */
	container: ItemContainerPathSchema,
});

export const AppearanceActionDeleteSchema = z.object({
	type: z.literal('delete'),
	/** Target with the item to delete */
	target: RoomTargetSelectorSchema,
	/** Path to the item to delete */
	item: ItemPathSchema,
});

/** Action that moves item between two containers (e.g. character and character or character and room or character and bag the charater is wearing) */
export const AppearanceActionTransferSchema = z.object({
	type: z.literal('transfer'),
	/** Target with the item to get */
	source: RoomTargetSelectorSchema,
	/** Path to the item */
	item: ItemPathSchema,
	/** Target the item should be added to after removing it from original place */
	target: RoomTargetSelectorSchema,
	/** Container path on target where to add the item to */
	container: ItemContainerPathSchema,
});

export const AppearanceActionPose = z.object({
	type: z.literal('pose'),
	target: CharacterIdSchema,
	bones: AppearancePoseSchema.shape.bones.optional(),
	leftArm: AppearanceArmPoseSchema.partial().optional(),
	rightArm: AppearanceArmPoseSchema.partial().optional(),
});

export const AppearanceActionBody = z.object({
	type: z.literal('body'),
	target: CharacterIdSchema,
	bones: AppearancePoseSchema.shape.bones,
});

export const AppearanceActionSetView = z.object({
	type: z.literal('setView'),
	target: CharacterIdSchema,
	view: z.nativeEnum(CharacterView),
});

export const AppearanceActionMove = z.object({
	type: z.literal('move'),
	/** Target with the item to move */
	target: RoomTargetSelectorSchema,
	/** Path to the item to move */
	item: ItemPathSchema,
	/** Relative shift for the item inside its container */
	shift: z.number().int(),
});

export const AppearanceActionColor = z.object({
	type: z.literal('color'),
	/** Target with the item to color */
	target: RoomTargetSelectorSchema,
	/** Path to the item to color */
	item: ItemPathSchema,
	/** The new color to set */
	color: ItemColorBundleSchema,
});

export const AppearanceActionModuleAction = z.object({
	type: z.literal('moduleAction'),
	/** Target with the item to color */
	target: RoomTargetSelectorSchema,
	/** Path to the item to interact with */
	item: ItemPathSchema,
	/** The module to interact with */
	module: z.string(),
	/** Action to do on the module */
	action: ItemModuleActionSchema,
});

export const AppearanceActionSafemode = z.object({
	type: z.literal('safemode'),
	/** What to do with the safemode */
	action: z.enum(['enter', 'exit']),
});

export const AppearanceActionRandomize = z.object({
	type: z.literal('randomize'),
	/** What to randomize */
	kind: z.enum(['items', 'full']),
});

export const AppearanceActionSchema = z.discriminatedUnion('type', [
	AppearanceActionCreateSchema,
	AppearanceActionDeleteSchema,
	AppearanceActionTransferSchema,
	AppearanceActionPose,
	AppearanceActionBody,
	AppearanceActionSetView,
	AppearanceActionMove,
	AppearanceActionColor,
	AppearanceActionModuleAction,
	AppearanceActionSafemode,
	AppearanceActionRandomize,
]);
export type AppearanceAction = z.infer<typeof AppearanceActionSchema>;

export interface AppearanceActionContext {
	player: CharacterId;
	getTarget(target: RoomTargetSelector): RoomActionTarget | null;
	getCharacter(id: CharacterId): CharacterRestrictionsManager | null;
	/** Handler for sending messages to chat */
	actionHandler?: ActionHandler;
}

export type AppearanceActionResult = {
	result: 'success' | 'invalidAction';
} | {
	result: 'restrictionError';
	restriction: Restriction;
} | {
	result: 'validationError';
	validationError: AppearanceValidationError;
};

export function DoAppearanceAction(
	action: AppearanceAction,
	context: AppearanceActionContext,
	assetManager: AssetManager,
	{
		dryRun = false,
	}: {
		dryRun?: boolean;
	} = {},
): AppearanceActionResult {
	const player = context.getCharacter(context.player);
	if (!player)
		return { result: 'invalidAction' };

	const processingContext: ActionProcessingContext = {
		sourceCharacter: context.player,
		actionHandler: context.actionHandler,
		dryRun,
	};

	switch (action.type) {
		// Create and equip an item
		case 'create': {
			const asset = assetManager.getAssetById(action.asset);
			const target = context.getTarget(action.target);
			if (!asset || !target)
				return { result: 'invalidAction' };
			const item = assetManager.createItem(action.itemId, asset, null);
			// Player adding the item must be able to use it
			const r = player.canUseItemDirect(target, action.container, item, ItemInteractionType.ADD_REMOVE);
			if (!r.allowed) {
				return {
					result: 'restrictionError',
					restriction: r.restriction,
				};
			}

			const manipulator = target.getManipulator();
			if (!ActionAddItem(manipulator, action.container, item))
				return { result: 'invalidAction' };
			return AppearanceValidationResultToActionResult(
				target.commitChanges(manipulator, processingContext),
			);
		}
		// Unequip and delete an item
		case 'delete': {
			const target = context.getTarget(action.target);
			if (!target)
				return { result: 'invalidAction' };
			// Player removing the item must be able to use it
			const r = player.canUseItem(target, action.item, ItemInteractionType.ADD_REMOVE);
			if (!r.allowed) {
				return {
					result: 'restrictionError',
					restriction: r.restriction,
				};
			}

			const manipulator = target.getManipulator();
			if (!ActionRemoveItem(manipulator, action.item))
				return { result: 'invalidAction' };
			return AppearanceValidationResultToActionResult(
				target.commitChanges(manipulator, processingContext),
			);
		}
		// Unequip item and equip on another target
		case 'transfer': {
			const source = context.getTarget(action.source);
			const target = context.getTarget(action.target);
			if (!source || !target)
				return { result: 'invalidAction' };

			// The item must exist
			const item = source.getItem(action.item);
			if (!item)
				return { result: 'invalidAction' };

			// Player removing the item must be able to use it on source
			let r = player.canUseItemDirect(source, action.item.container, item, ItemInteractionType.ADD_REMOVE);
			if (!r.allowed) {
				return {
					result: 'restrictionError',
					restriction: r.restriction,
				};
			}

			// Player adding the item must be able to use it on target
			r = player.canUseItemDirect(target, action.container, item, ItemInteractionType.ADD_REMOVE);
			if (!r.allowed) {
				return {
					result: 'restrictionError',
					restriction: r.restriction,
				};
			}

			const sourceManipulator = source.getManipulator();
			const targetManipulator = target.getManipulator();

			// Preform the transfer in manipulators
			if (!ActionTransferItem(sourceManipulator, action.item, targetManipulator, action.container))
				return { result: 'invalidAction' };

			// Test if source would accept it (dry run)
			let result = source.commitChanges(sourceManipulator, {
				dryRun: true,
			});
			if (!result.success)
				return AppearanceValidationResultToActionResult(result);

			// Try to update target
			result = target.commitChanges(targetManipulator, processingContext);
			if (!result.success)
				return AppearanceValidationResultToActionResult(result);

			// Update source (it passed before)
			result = source.commitChanges(sourceManipulator, processingContext);
			Assert(result.success, 'Action failed after a successful dryRun');

			return { result: 'success' };
		}
		// Moves an item within inventory, reordering the worn order
		case 'move': {
			const target = context.getTarget(action.target);
			if (!target)
				return { result: 'invalidAction' };
			// Player moving the item must be able to interact with the item
			const r = player.canUseItem(target, action.item, ItemInteractionType.ADD_REMOVE);
			if (!r.allowed) {
				return {
					result: 'restrictionError',
					restriction: r.restriction,
				};
			}

			const manipulator = target.getManipulator();

			// Player moving the item must be able to interact with the item on target position (if it is being moved in root)
			if (action.item.container.length === 0) {
				const items = manipulator.getRootItems();
				const currentPos = items.findIndex((item) => item.id === action.item.itemId);
				const newPos = currentPos + action.shift;

				if (newPos >= 0 && newPos < items.length) {
					const r = player.canUseItem(target, action.item, ItemInteractionType.ADD_REMOVE, items[newPos].id);
					if (!r.allowed) {
						return {
							result: 'restrictionError',
							restriction: r.restriction,
						};
					}
				}
			}

			if (!ActionMoveItem(manipulator, action.item, action.shift))
				return { result: 'invalidAction' };
			return AppearanceValidationResultToActionResult(
				target.commitChanges(manipulator, processingContext),
			);
		}
		// Changes the color of an item
		case 'color': {
			const target = context.getTarget(action.target);
			if (!target)
				return { result: 'invalidAction' };
			// Player coloring the item must be able to interact with the item
			const r = player.canUseItem(target, action.item, ItemInteractionType.STYLING);
			if (!r.allowed) {
				return {
					result: 'restrictionError',
					restriction: r.restriction,
				};
			}

			const manipulator = target.getManipulator();
			if (!ActionColorItem(manipulator, action.item, action.color))
				return { result: 'invalidAction' };
			return AppearanceValidationResultToActionResult(
				target.commitChanges(manipulator, processingContext),
			);
		}
		// Module-specific action
		case 'moduleAction': {
			const target = context.getTarget(action.target);
			if (!target)
				return { result: 'invalidAction' };
			// Player doing the action must be able to interact with the item
			const r = player.canUseItemModule(target, action.item, action.module);
			if (!r.allowed) {
				return {
					result: 'restrictionError',
					restriction: r.restriction,
				};
			}

			const manipulator = target.getManipulator();
			if (!ActionModuleAction(context, manipulator, action.item, action.module, action.action))
				return { result: 'invalidAction' };
			return AppearanceValidationResultToActionResult(
				target.commitChanges(manipulator, processingContext),
			);
		}
		// Resize body or change pose
		case 'body':
			if (context.player !== action.target) {
				return {
					result: 'restrictionError',
					restriction: {
						type: 'permission',
						missingPermission: 'modifyBodyOthers',
					},
				};
			}
		// falls through
		case 'pose': {
			const target = context.getCharacter(action.target);
			if (!target)
				return { result: 'invalidAction' };
			if (!dryRun) {
				target.appearance.importPose(action, action.type, false);
			}
			return { result: 'success' };
		}
		// Changes view of the character - front or back
		case 'setView': {
			const target = context.getCharacter(action.target);
			if (!target)
				return { result: 'invalidAction' };
			if (!dryRun) {
				target.appearance.setView(action.view);
			}
			return { result: 'success' };
		}
		case 'safemode': {
			const current = player.appearance.getSafemode();
			if (action.action === 'enter') {
				// If we are already in it we cannot enter it again
				if (current)
					return { result: 'invalidAction' };

				player.appearance.setSafemode({
					allowLeaveAt: Date.now() + (player.room?.features.includes('development') ? 0 : SAFEMODE_EXIT_COOLDOWN),
				}, processingContext);
				return { result: 'success' };
			} else if (action.action === 'exit') {
				// If we are already not in it we cannot exit it
				if (!current)
					return { result: 'invalidAction' };

				// Check the timer to leave it passed
				if (Date.now() < current.allowLeaveAt)
					return { result: 'invalidAction' };

				player.appearance.setSafemode(null, processingContext);
				return { result: 'success' };
			}
			AssertNever(action.action);
			break;
		}
		case 'randomize':
			return ActionAppearanceRandomize(player, action.kind, processingContext);
		default:
			AssertNever(action);
	}
}

export function AppearanceValidationResultToActionResult(result: AppearanceValidationResult): AppearanceActionResult {
	return result.success ? {
		result: 'success',
	} : {
		result: 'validationError',
		validationError: result.error,
	};
}

export function ActionAddItem(rootManipulator: AppearanceRootManipulator, container: ItemContainerPath, item: Item): boolean {
	const manipulator = rootManipulator.getContainer(container);

	// Do change
	let removed: AppearanceItems = [];
	// if this is a bodypart not allowing multiple do a swap instead, but only in root
	if (manipulator.isCharacter && item.asset.definition.bodypart && manipulator.assetManager.bodyparts.find((bp) => bp.name === item.asset.definition.bodypart)?.allowMultiple === false) {
		removed = manipulator.removeMatchingItems((oldItem) => oldItem.asset.definition.bodypart === item.asset.definition.bodypart);
	}
	if (!manipulator.addItem(item))
		return false;

	// Change message to chat
	if (removed.length > 0) {
		Assert(rootManipulator.isCharacter);
		manipulator.queueMessage({
			id: 'itemReplace',
			item: {
				assetId: item.asset.id,
			},
			itemPrevious: {
				assetId: removed[0].asset.id,
			},
		});
	} else {
		const manipulatorContainer = manipulator.container;
		manipulator.queueMessage({
			id: (!manipulatorContainer && rootManipulator.isCharacter) ? 'itemAddCreate' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemAttach' : 'itemStore',
			item: {
				assetId: item.asset.id,
			},
		});
	}

	return true;
}

export function ActionRemoveItem(rootManipulator: AppearanceRootManipulator, itemPath: ItemPath): boolean {
	const { container, itemId } = itemPath;
	const manipulator = rootManipulator.getContainer(container);

	// Do change
	const removedItems = manipulator.removeMatchingItems((i) => i.id === itemId);

	// Validate
	if (removedItems.length !== 1)
		return false;

	// Change message to chat
	const manipulatorContainer = manipulator.container;
	manipulator.queueMessage({
		id: (!manipulatorContainer && rootManipulator.isCharacter) ? 'itemRemoveDelete' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemDetach' : 'itemUnload',
		item: {
			assetId: removedItems[0].asset.id,
		},
	});

	return true;
}

export function ActionTransferItem(sourceManipulator: AppearanceRootManipulator, itemPath: ItemPath, targetManipulator: AppearanceRootManipulator, targetContainer: ItemContainerPath): boolean {
	const { container, itemId } = itemPath;
	const sourceContainerManipulator = sourceManipulator.getContainer(container);
	const targetContainerManipulator = targetManipulator.getContainer(targetContainer);

	// Do change
	const removedItems = sourceContainerManipulator.removeMatchingItems((i) => i.id === itemId);

	if (removedItems.length !== 1)
		return false;

	const item = removedItems[0];

	// No transfering bodyparts, thank you
	if (item.asset.definition.bodypart)
		return false;

	if (!targetContainerManipulator.addItem(item))
		return false;

	// Change message to chat
	if (sourceManipulator.isCharacter) {
		const manipulatorContainer = sourceContainerManipulator.container;
		sourceContainerManipulator.queueMessage({
			id: !manipulatorContainer ? 'itemRemove' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemDetach' : 'itemUnload',
			item: {
				assetId: item.asset.id,
			},
		});
	}
	if (targetManipulator.isCharacter) {
		const manipulatorContainer = targetContainerManipulator.container;
		targetContainerManipulator.queueMessage({
			id: !manipulatorContainer ? 'itemAdd' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemAttach' : 'itemStore',
			item: {
				assetId: removedItems[0].asset.id,
			},
		});
	}

	return true;
}

export function ActionMoveItem(rootManipulator: AppearanceRootManipulator, itemPath: ItemPath, shift: number): boolean {
	const { container, itemId } = itemPath;
	const manipulator = rootManipulator.getContainer(container);

	// Do change
	if (!manipulator.moveItem(itemId, shift))
		return false;

	// Change message to chat
	// TODO: Message to chat that items were reordered
	// Will need mechanism to rate-limit the messages not to send every reorder

	return true;
}

export function ActionColorItem(rootManipulator: AppearanceRootManipulator, itemPath: ItemPath, color: ItemColorBundle): boolean {
	const { container, itemId } = itemPath;
	const manipulator = rootManipulator.getContainer(container);

	// Do change
	if (!manipulator.modifyItem(itemId, (it) => it.changeColor(color)))
		return false;

	// Change message to chat
	// TODO: Message to chat that item was colored
	// Will need mechanism to rate-limit the messages not to send every color change

	return true;
}

export function ActionModuleAction(context: AppearanceActionContext, rootManipulator: AppearanceRootManipulator, itemPath: ItemPath, module: string, action: ItemModuleAction): boolean {
	const { container, itemId } = itemPath;
	const manipulator = rootManipulator.getContainer(container);

	// Do change and store chat messages
	if (!manipulator.modifyItem(itemId, (it) => it.moduleAction(
		context,
		module,
		action,
		(m) => manipulator.queueMessage({
			item: {
				assetId: it.asset.id,
			},
			...m,
		}),
	))) {
		return false;
	}

	return true;
}

export function ActionAppearanceRandomize(character: CharacterRestrictionsManager, kind: 'items' | 'full', context: ActionProcessingContext): AppearanceActionResult {
	const assetManager = character.appearance.getAssetManager();

	// Must be able to remove all items currently worn, have free hands and if modifying body also be in room that allows body changes
	const oldItems = character.appearance.getAllItems();
	const restriction = oldItems
		.map((i): RestrictionResult => {
			// Ignore bodyparts if we are not changing those
			if (kind === 'items' && i.asset.definition.bodypart != null)
				return { allowed: true };
			return character.canUseItemDirect(character.appearance, [], i, ItemInteractionType.ADD_REMOVE);
		})
		.find((res) => !res.allowed);
	if (restriction != null && !restriction.allowed) {
		return {
			result: 'restrictionError',
			restriction: restriction.restriction,
		};
	}

	// Room must allow body changes if running full randomization
	if (kind === 'full' && character.room && !character.room.features.includes('allowBodyChanges')) {
		return {
			result: 'restrictionError',
			restriction: {
				type: 'permission',
				missingPermission: 'modifyBodyRoom',
			},
		};
	}

	// Must have free hands to randomize
	if (!character.canUseHands() && !character.isInSafemode()) {
		return {
			result: 'restrictionError',
			restriction: {
				type: 'blockedHands',
			},
		};
	}

	// Dry run can end here as everything lower is simply random
	if (context.dryRun)
		return { result: 'success' };

	// Filter appearance to get either body or nothing
	let newAppearance: Item[] = kind === 'items' ? oldItems.filter((i) => i.asset.definition.bodypart != null) : [];
	// Collect info about already present items
	const usedAssets = new Set<Asset>();
	let properties = CreateAssetPropertiesResult();
	newAppearance.forEach((item) => {
		usedAssets.add(item.asset);
		properties = item.getPropertiesParts().reduce(MergeAssetProperties, properties);
	});

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
				.filter((a) => a.definition.bodypart != null &&
					a.definition.allowRandomizerUsage === true &&
					a.definition.attributes?.includes(requestedBodyAttribute) &&
					// Skip already present assets
					!usedAssets.has(a) &&
					// Skip already present bodyparts that don't allow multiple
					!usedSingularBodyparts.has(a.definition.bodypart),
				);

			// Pick one and add it to the appearance
			const asset = sample(possibleAssets);
			if (asset && asset.definition.bodypart != null) {
				const item = assetManager.createItem(`i/${nanoid()}`, asset, null);
				newAppearance.push(item);
				usedAssets.add(asset);
				properties = item.getPropertiesParts().reduce(MergeAssetProperties, properties);
				if (!assetManager.bodyparts.find((b) => b.name === asset.definition.bodypart)?.allowMultiple) {
					usedSingularBodyparts.add(asset.definition.bodypart);
				}
			}
		}

		// Re-load the appearance we have to make sure body is valid
		newAppearance = AppearanceLoadAndValidate(assetManager, newAppearance).slice();
	}

	// Make sure the appearance is valid (required for items step)
	let r = ValidateAppearanceItems(assetManager, newAppearance);
	if (!r.success) {
		return {
			result: 'validationError',
			validationError: r.error,
		};
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
			.filter((asset) => asset.definition.bodypart == null &&
				asset.definition.attributes?.includes(requestedAttribute) &&
				asset.definition.allowRandomizerUsage === true &&
				// Skip already present assets
				!usedAssets.has(asset),
			);

		// Shuffle them so we try to add randomly
		ShuffleArray(possibleAssets);

		// Try them one by one, stopping at first successful (if we skip all, nothing bad happens)
		for (const asset of possibleAssets) {
			const item = assetManager.createItem(`i/${nanoid()}`, asset, null);
			const newItems: Item[] = [...newAppearance, item];

			r = ValidateAppearanceItemsPrefix(assetManager, newItems);
			if (r.success) {
				newAppearance = newItems;
				usedAssets.add(asset);
				properties = item.getPropertiesParts().reduce(MergeAssetProperties, properties);
				break;
			}
		}
	}

	// Try to assign the new appearance
	const manipulator = character.appearance.getManipulator();
	manipulator.resetItemsTo(newAppearance);
	return AppearanceValidationResultToActionResult(
		character.appearance.commitChanges(manipulator, context),
	);
}
