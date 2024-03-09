import { isEqual, sample } from 'lodash';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { CharacterId, CharacterIdSchema } from '../character/characterTypes';
import { ItemInteractionType, RestrictionResult } from '../character/restrictionTypes';
import type { GameLogicCharacter } from '../gameLogic';
import { PseudoRandom } from '../math/pseudoRandom';
import type { ActionSpaceContext } from '../space/space';
import { Assert, AssertNever, ShuffleArray } from '../utility';
import { AppearanceActionProcessingContext, AppearanceActionProcessingResult } from './appearanceActionProcessingContext';
import { AppearanceRootManipulator } from './appearanceHelpers';
import { ActionMessageTemplateHandler, ActionTarget, ActionTargetSelectorSchema, CharacterSelectorSchema, ItemContainerPath, ItemContainerPathSchema, ItemPath, ItemPathSchema } from './appearanceTypes';
import { AppearanceItems, CharacterAppearanceLoadAndValidate, ValidateAppearanceItems, ValidateAppearanceItemsPrefix } from './appearanceValidation';
import type { Asset } from './asset';
import type { AssetManager } from './assetManager';
import { WearableAssetType } from './definitions';
import { CharacterViewSchema, LegsPoseSchema } from './graphics/graphics';
import { ItemRoomDevice, ItemTemplateSchema, RoomDeviceDeploymentChange, RoomDeviceDeploymentChangeSchema } from './item';
import { FilterItemWearable, Item, ItemColorBundle, ItemColorBundleSchema, ItemId, ItemIdSchema } from './item/base';
import { ItemModuleActionSchema, ModuleActionError, ModuleActionFailure } from './modules';
import { CreateAssetPropertiesResult, MergeAssetProperties } from './properties';
import { AppearanceArmPoseSchema, AppearancePoseSchema } from './state/characterStatePose';
import { RestrictionOverride } from './state/characterStateTypes';
import { AssetFrameworkGlobalStateContainer } from './state/globalState';

// Fix for pnpm resolution weirdness
import type { } from '../validation';

export const AppearanceActionCreateSchema = z.object({
	type: z.literal('create'),
	/** Template describing an item configuration for creating the new item */
	itemTemplate: ItemTemplateSchema,
	/** Target the item should be added to after creation */
	target: ActionTargetSelectorSchema,
	/** Container path on target where to add the item to */
	container: ItemContainerPathSchema,
	/** Item to insert the new one in front of in the target container */
	insertBefore: ItemIdSchema.optional(),
});

export const AppearanceActionDeleteSchema = z.object({
	type: z.literal('delete'),
	/** Target with the item to delete */
	target: ActionTargetSelectorSchema,
	/** Path to the item to delete */
	item: ItemPathSchema,
});

/** Action that moves item between two containers (e.g. character and character or character and room inventory or character and bag the charater is wearing) */
export const AppearanceActionTransferSchema = z.object({
	type: z.literal('transfer'),
	/** Target with the item to get */
	source: ActionTargetSelectorSchema,
	/** Path to the item */
	item: ItemPathSchema,
	/** Target the item should be added to after removing it from original place */
	target: ActionTargetSelectorSchema,
	/** Container path on target where to add the item to */
	container: ItemContainerPathSchema,
	/** Item to insert the current one in front of in the target container */
	insertBefore: ItemIdSchema.optional(),
});

export const AppearanceActionPose = z.object({
	type: z.literal('pose'),
	target: CharacterIdSchema,
	bones: AppearancePoseSchema.shape.bones.optional(),
	leftArm: AppearanceArmPoseSchema.partial().optional(),
	rightArm: AppearanceArmPoseSchema.partial().optional(),
	legs: LegsPoseSchema.optional(),
	view: CharacterViewSchema.optional(),
});

export const AppearanceActionBody = z.object({
	type: z.literal('body'),
	target: CharacterIdSchema,
	bones: AppearancePoseSchema.shape.bones,
});

export const AppearanceActionSetView = z.object({
	type: z.literal('setView'),
	target: CharacterIdSchema,
	view: CharacterViewSchema,
});

export const AppearanceActionMove = z.object({
	type: z.literal('move'),
	/** Target with the item to move */
	target: ActionTargetSelectorSchema,
	/** Path to the item to move */
	item: ItemPathSchema,
	/** Relative shift for the item inside its container */
	shift: z.number().int(),
});

export const AppearanceActionColor = z.object({
	type: z.literal('color'),
	/** Target with the item to color */
	target: ActionTargetSelectorSchema,
	/** Path to the item to color */
	item: ItemPathSchema,
	/** The new color to set */
	color: ItemColorBundleSchema,
});

export const AppearanceActionModuleAction = z.object({
	type: z.literal('moduleAction'),
	/** Target with the item to color */
	target: ActionTargetSelectorSchema,
	/** Path to the item to interact with */
	item: ItemPathSchema,
	/** The module to interact with */
	module: z.string(),
	/** Action to do on the module */
	action: ItemModuleActionSchema,
});

export const AppearanceActionRestrictionOverrideChange = z.object({
	type: z.literal('restrictionOverrideChange'),
	/** Which mode we are changing to */
	mode: z.enum(['normal', 'safemode', 'timeout']),
});

export const AppearanceActionRandomize = z.object({
	type: z.literal('randomize'),
	/** What to randomize */
	kind: z.enum(['items', 'full']),
	/** Seed to use for pseudo random generation */
	seed: z.string().max(32),
});

export const AppearanceActionRoomDeviceDeploy = z.object({
	type: z.literal('roomDeviceDeploy'),
	/** Target with the room device (so room) */
	target: ActionTargetSelectorSchema,
	/** Path to the room device */
	item: ItemPathSchema,
	/** The resulting deployment we want */
	deployment: RoomDeviceDeploymentChangeSchema,
});

export const AppearanceActionRoomDeviceEnter = z.object({
	type: z.literal('roomDeviceEnter'),
	/** Target with the room device (so room) */
	target: ActionTargetSelectorSchema,
	/** Path to the room device */
	item: ItemPathSchema,
	/** The slot the character wants to enter */
	slot: z.string(),
	/** The target character to enter the device */
	character: CharacterSelectorSchema,
	/** ID to give the new wearable part item */
	itemId: ItemIdSchema,
});

export const AppearanceActionRoomDeviceLeave = z.object({
	type: z.literal('roomDeviceLeave'),
	/** Target with the room device (so room) */
	target: ActionTargetSelectorSchema,
	/** Path to the room device */
	item: ItemPathSchema,
	/** The slot that should be cleared */
	slot: z.string(),
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
	AppearanceActionRestrictionOverrideChange,
	AppearanceActionRandomize,
	AppearanceActionRoomDeviceDeploy,
	AppearanceActionRoomDeviceEnter,
	AppearanceActionRoomDeviceLeave,
]);
export type AppearanceAction = z.infer<typeof AppearanceActionSchema>;

export interface AppearanceActionContext {
	player: GameLogicCharacter;
	globalState: AssetFrameworkGlobalStateContainer;
	spaceContext: ActionSpaceContext;
	getCharacter(id: CharacterId): GameLogicCharacter | null;
}

/** Context for performing module actions */
export interface AppearanceModuleActionContext {
	processingContext: AppearanceActionProcessingContext;
	target: ActionTarget;

	messageHandler: ActionMessageTemplateHandler;
	reject: (reason: ModuleActionError) => void;
	failure: (reason: ModuleActionFailure) => void;
}

export interface AppearanceActionHandlerArg<Action extends AppearanceAction = AppearanceAction> {
	action: Action;
	assetManager: AssetManager;
	processingContext: AppearanceActionProcessingContext;
}

export function DoAppearanceAction(
	action: AppearanceAction,
	context: AppearanceActionContext,
	assetManager: AssetManager,
): AppearanceActionProcessingResult {
	const processingContext = new AppearanceActionProcessingContext(context);
	const playerRestrictionManager = processingContext.getPlayerRestrictionManager();

	const arg: Omit<AppearanceActionHandlerArg, 'action'> = {
		assetManager,
		processingContext,
	};

	switch (action.type) {
		// Create and equip an item
		case 'create': {
			const target = processingContext.getTarget(action.target);
			if (!target)
				return processingContext.invalid();
			const item = assetManager.createItemFromTemplate(action.itemTemplate, processingContext.player);
			if (item == null)
				return processingContext.invalid();
			// Player adding the item must be able to use it
			processingContext.checkCanUseItemDirect(
				target,
				action.container,
				item,
				ItemInteractionType.ADD_REMOVE,
				action.container.length === 0 ? action.insertBefore : undefined,
			);

			const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);
			if (!targetManipulator)
				return processingContext.invalid();
			if (!ActionAddItem(processingContext, targetManipulator, action.container, item, action.insertBefore ?? null))
				return processingContext.invalid();

			return processingContext.finalize();
		}
		// Unequip and delete an item
		case 'delete': {
			const target = processingContext.getTarget(action.target);
			if (!target)
				return processingContext.invalid();
			// Player removing the item must be able to use it
			processingContext.checkCanUseItem(target, action.item, ItemInteractionType.ADD_REMOVE);

			// Room device wearable parts cannot be deleted, you have to leave the device instead
			const item = target.getItem(action.item);
			if (item?.isType('roomDeviceWearablePart')) {
				return processingContext.invalid('noDeleteRoomDeviceWearable');
			}
			// Deployed room devices cannot be deleted, you must store them first
			if (item?.isType('roomDevice') && item.isDeployed()) {
				return processingContext.invalid('noDeleteDeployedRoomDevice');
			}

			const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);
			if (!ActionRemoveItem(processingContext, targetManipulator, action.item))
				return processingContext.invalid();

			return processingContext.finalize();
		}
		// Unequip item and equip on another target
		case 'transfer': {
			const source = processingContext.getTarget(action.source);
			const target = processingContext.getTarget(action.target);
			if (!source || !target)
				return processingContext.invalid();

			// The item must exist
			const item = source.getItem(action.item);
			if (!item)
				return processingContext.invalid();

			// Player removing the item must be able to use it on source
			processingContext.checkCanUseItemDirect(source, action.item.container, item, ItemInteractionType.ADD_REMOVE);

			// Player adding the item must be able to use it on target
			processingContext.checkCanUseItemDirect(
				target,
				action.container,
				item,
				ItemInteractionType.ADD_REMOVE,
				action.container.length === 0 ? action.insertBefore : undefined,
			);

			const sourceManipulator = processingContext.manipulator.getManipulatorFor(action.source);
			const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);

			// Preform the transfer in manipulators
			if (!ActionTransferItem(processingContext, sourceManipulator, action.item, targetManipulator, action.container, action.insertBefore ?? null))
				return processingContext.invalid();

			return processingContext.finalize();
		}
		// Moves an item within inventory, reordering the worn order
		case 'move': {
			const target = processingContext.getTarget(action.target);
			if (!target)
				return processingContext.invalid();
			// Player moving the item must be able to interact with the item
			processingContext.checkCanUseItem(target, action.item, ItemInteractionType.ADD_REMOVE);

			const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);

			// Player moving the item must be able to interact with the item on target position (if it is being moved in root)
			if (action.item.container.length === 0) {
				const items = targetManipulator.getRootItems();
				const currentPos = items.findIndex((item) => item.id === action.item.itemId);
				const newPos = currentPos + action.shift;

				if (newPos >= 0 && newPos < items.length) {
					processingContext.checkCanUseItem(target, action.item, ItemInteractionType.ADD_REMOVE, items[newPos].id);
				}
			}

			if (!ActionMoveItem(targetManipulator, action.item, action.shift))
				return processingContext.invalid();

			return processingContext.finalize();
		}
		// Changes the color of an item
		case 'color': {
			const target = processingContext.getTarget(action.target);
			if (!target)
				return processingContext.invalid();
			const item = target.getItem(action.item);
			// To manipulate the color of room devices, player must be an admin
			if (item?.isType('roomDevice')) {
				processingContext.checkPlayerIsSpaceAdmin();
			}
			// Player coloring the item must be able to interact with the item
			processingContext.checkCanUseItem(target, action.item, ItemInteractionType.STYLING);

			const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);
			if (!ActionColorItem(targetManipulator, action.item, action.color))
				return processingContext.invalid();

			return processingContext.finalize();
		}
		// Module-specific action
		case 'moduleAction': {
			return ActionModuleAction({
				...arg,
				action,
			});
		}
		// Resize body or change pose
		case 'body': {
			const target = processingContext.getTarget({ type: 'character', characterId: action.target });
			if (!target || target.type !== 'character')
				return processingContext.invalid();
			processingContext.addInteraction(target.character, 'modifyBody');

			// falls through
		}
		case 'pose': {
			const target = processingContext.getTarget({ type: 'character', characterId: action.target });
			if (!target)
				return processingContext.invalid();

			processingContext.checkInteractWithTarget(target);

			if (!processingContext.manipulator.produceCharacterState(action.target, (character) => {
				return character.produceWithPose(action, action.type);
			})) {
				return processingContext.invalid();
			}

			return processingContext.finalize();
		}
		// Changes view of the character - front or back
		case 'setView': {
			const target = processingContext.getTarget({ type: 'character', characterId: action.target });
			if (!target)
				return processingContext.invalid();

			processingContext.checkInteractWithTarget(target);

			if (!processingContext.manipulator.produceCharacterState(action.target, (character) => {
				return character.produceWithView(action.view);
			})) {
				return processingContext.invalid();
			}

			return processingContext.finalize();
		}
		case 'restrictionOverrideChange': {
			const current = playerRestrictionManager.appearance.getRestrictionOverride();
			const oldMode = current?.type ?? 'normal';

			// If we are already in a mode it we cannot enter it again
			if (oldMode === action.mode)
				return processingContext.invalid();
			// If we are not in normal mode we cannot enter any other mode
			if (oldMode !== 'normal' && action.mode !== 'normal')
				return processingContext.invalid();
			// Check the timer to leave it passed
			if (current?.allowLeaveAt != null && Date.now() < current.allowLeaveAt)
				return processingContext.invalid();

			const removeAllowLeaveAt = !!playerRestrictionManager.spaceContext.features.includes('development');

			if (!processingContext.manipulator.produceCharacterState(playerRestrictionManager.appearance.id, (character) =>
				character.produceWithRestrictionOverride(action.mode, removeAllowLeaveAt),
			)) {
				return processingContext.invalid();
			}

			let id: `${RestrictionOverride['type']}${'Enter' | 'Leave'}`;
			if (action.mode === 'normal') {
				Assert(oldMode !== 'normal');
				id = `${oldMode}Leave`;
			} else {
				id = `${action.mode}Enter`;
			}

			processingContext.queueMessage({ id });

			return processingContext.finalize();
		}
		case 'randomize': {
			return ActionAppearanceRandomize({
				...arg,
				action,
			});
		}
		case 'roomDeviceDeploy': {
			const target = processingContext.getTarget(action.target);
			if (!target)
				return processingContext.invalid();
			// Player deploying the device must be able to interact with it
			processingContext.checkCanUseItem(target, action.item, ItemInteractionType.MODIFY);

			// To manipulate room devices, player must be an admin
			processingContext.checkPlayerIsSpaceAdmin();

			const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);
			if (!ActionRoomDeviceDeploy(processingContext, targetManipulator, action.item, action.deployment))
				return processingContext.invalid();

			return processingContext.finalize();
		}
		case 'roomDeviceEnter': {
			return ActionRoomDeviceEnter({
				...arg,
				action,
			});
		}
		case 'roomDeviceLeave': {
			return ActionRoomDeviceLeave({
				...arg,
				action,
			});
		}
		default:
			AssertNever(action);
	}
}

export function ActionAddItem(processingContext: AppearanceActionProcessingContext, rootManipulator: AppearanceRootManipulator, container: ItemContainerPath, item: Item, insertBefore: ItemId | null): boolean {
	const manipulator = rootManipulator.getContainer(container);

	// Do change
	let removed: AppearanceItems = [];
	// if this is a bodypart not allowing multiple do a swap instead, but only in root
	if (manipulator.isCharacter() &&
		item.isType('personal') &&
		item.asset.definition.bodypart &&
		manipulator.assetManager.bodyparts.find((bp) => item.isType('personal') &&
			bp.name === item.asset.definition.bodypart)?.allowMultiple === false
	) {
		removed = manipulator.removeMatchingItems((oldItem) => oldItem.isType('personal') &&
			oldItem.asset.definition.bodypart === item.asset.definition.bodypart,
		);
	}

	let targetIndex: number | undefined;
	if (insertBefore != null) {
		targetIndex = manipulator.getItems().findIndex((anchor) => anchor.id === insertBefore);
		if (targetIndex < 0)
			return false;
	}

	if (!manipulator.addItem(item, targetIndex))
		return false;

	// if this is a bodypart, we sort bodyparts to be valid, to be more friendly
	if (manipulator.isCharacter() &&
		item.isType('personal') &&
		item.asset.definition.bodypart
	) {
		if (!manipulator.fixBodypartOrder())
			return false;
	}

	// Change message to chat
	if (removed.length > 0) {
		Assert(rootManipulator.isCharacter());
		processingContext.queueMessage(
			manipulator.makeMessage({
				id: 'itemReplace',
				item: {
					assetId: item.asset.id,
				},
				itemPrevious: {
					assetId: removed[0].asset.id,
				},
			}),
		);
	} else {
		const manipulatorContainer = manipulator.container;
		processingContext.queueMessage(
			manipulator.makeMessage({
				id: (!manipulatorContainer && rootManipulator.isCharacter()) ? 'itemAddCreate' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemAttach' : 'itemStore',
				item: {
					assetId: item.asset.id,
				},
			}),
		);
	}

	return true;
}

export function ActionRemoveItem(processingContext: AppearanceActionProcessingContext, rootManipulator: AppearanceRootManipulator, itemPath: ItemPath): boolean {
	const { container, itemId } = itemPath;
	const manipulator = rootManipulator.getContainer(container);

	// Do change
	const removedItems = manipulator.removeMatchingItems((i) => i.id === itemId);

	// Validate
	if (removedItems.length !== 1)
		return false;

	// Change message to chat
	const manipulatorContainer = manipulator.container;
	processingContext.queueMessage(
		manipulator.makeMessage({
			id: (!manipulatorContainer && rootManipulator.isCharacter()) ? 'itemRemoveDelete' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemDetach' : 'itemUnload',
			item: {
				assetId: removedItems[0].asset.id,
			},
		}),
	);

	return true;
}

export function ActionTransferItem(processingContext: AppearanceActionProcessingContext, sourceManipulator: AppearanceRootManipulator, itemPath: ItemPath, targetManipulator: AppearanceRootManipulator, targetContainer: ItemContainerPath, insertBefore: ItemId | null): boolean {
	const { container, itemId } = itemPath;
	const sourceContainerManipulator = sourceManipulator.getContainer(container);
	const targetContainerManipulator = targetManipulator.getContainer(targetContainer);

	// Do change
	const removedItems = sourceContainerManipulator.removeMatchingItems((i) => i.id === itemId);

	if (removedItems.length !== 1)
		return false;

	const item = removedItems[0];

	// Check if item allows being transferred
	if (!item.canBeTransferred()) {
		// If not, then check this is actually a transfer (moving not between targets nor containers is fine, as then it is essentially a move)
		if (!isEqual(sourceManipulator.target, targetManipulator.target) ||
			!isEqual(itemPath.container, targetContainer)
		) {
			return false;
		}
	}

	let targetIndex: number | undefined;
	if (insertBefore != null) {
		targetIndex = targetContainerManipulator.getItems().findIndex((anchor) => anchor.id === insertBefore);
		if (targetIndex < 0)
			return false;
	}

	if (!targetContainerManipulator.addItem(item, targetIndex))
		return false;

	// Change message to chat
	if (sourceManipulator.isCharacter() && (!targetManipulator.isCharacter() || sourceManipulator.characterId !== targetManipulator.characterId)) {
		const manipulatorContainer = sourceContainerManipulator.container;
		processingContext.queueMessage(
			sourceContainerManipulator.makeMessage({
				id: !manipulatorContainer ? 'itemRemove' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemDetach' : 'itemUnload',
				item: {
					assetId: item.asset.id,
				},
			}),
		);
	}
	if (targetManipulator.isCharacter() && (!sourceManipulator.isCharacter() || targetManipulator.characterId !== sourceManipulator.characterId)) {
		const manipulatorContainer = targetContainerManipulator.container;
		processingContext.queueMessage(
			targetContainerManipulator.makeMessage({
				id: !manipulatorContainer ? 'itemAdd' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemAttach' : 'itemStore',
				item: {
					assetId: removedItems[0].asset.id,
				},
			}),
		);
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

export function ActionModuleAction({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionModuleAction>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();
	// Player doing the action must be able to interact with the item
	processingContext.checkCanUseItemModule(target, action.item, action.module);

	const rootManipulator = processingContext.manipulator.getManipulatorFor(action.target);

	const { container, itemId } = action.item;
	const containerManipulator = rootManipulator.getContainer(container);

	let rejectionReason: ModuleActionError | undefined;

	// Do change and store chat messages
	if (!containerManipulator.modifyItem(itemId, (it) => {
		const actionContext: AppearanceModuleActionContext = {
			processingContext,
			target,
			messageHandler: (m) => {
				processingContext.queueMessage(
					containerManipulator.makeMessage({
						item: {
							assetId: it.asset.id,
						},
						...m,
					}),
				);
			},
			reject: (reason) => {
				rejectionReason ??= reason;
			},
			failure: (reason) => {
				processingContext.addProblem({
					result: 'failure',
					failure: {
						type: 'moduleActionFailure',
						reason,
					},
				});
			},
		};

		return it.moduleAction(
			actionContext,
			action.module,
			action.action,
		);
	}) || rejectionReason) {
		processingContext.addProblem({
			result: 'moduleActionError',
			reason: rejectionReason ?? { type: 'invalid' },
		});
		return processingContext.invalid();
	}

	return processingContext.finalize();
}

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
	const restriction = oldItems
		.map((i): RestrictionResult => {
			// Ignore bodyparts if we are not changing those
			if (kind === 'items' && i.isType('personal') && i.asset.definition.bodypart != null)
				return { allowed: true };
			return character.canUseItemDirect(processingContext, character.appearance, [], i, ItemInteractionType.ADD_REMOVE);
		})
		.find((res) => !res.allowed);
	if (restriction != null && !restriction.allowed) {
		processingContext.addProblem({
			result: 'restrictionError',
			restriction: restriction.restriction,
		});
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

	// Filter appearance to get either body or nothing
	let newAppearance: Item<WearableAssetType>[] = kind === 'items' ? oldItems.filter((i) => !i.isType('personal') || i.asset.definition.bodypart != null) : [];
	// Collect info about already present items
	const usedAssets = new Set<Asset>();
	let properties = CreateAssetPropertiesResult();
	newAppearance.forEach((item) => {
		usedAssets.add(item.asset);
		properties = item.getPropertiesParts().reduce(MergeAssetProperties, properties);
	});

	const room = processingContext.manipulator.currentState.room;

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
				.filter((a) => a.isType('personal') && a.definition.bodypart != null &&
					a.definition.allowRandomizerUsage === true &&
					a.definition.attributes?.provides?.includes(requestedBodyAttribute) &&
					// Skip already present assets
					!usedAssets.has(a) &&
					// Skip already present bodyparts that don't allow multiple
					!usedSingularBodyparts.has(a.definition.bodypart),
				);

			// Pick one and add it to the appearance
			const asset = sample(possibleAssets);
			if (asset && asset.isType('personal') && asset.definition.bodypart != null) {
				const item = assetManager.createItem(`i/${nanoid()}`, asset);
				newAppearance.push(item);
				usedAssets.add(asset);
				properties = item.getPropertiesParts().reduce(MergeAssetProperties, properties);
				if (!assetManager.bodyparts.find((b) => b.name === asset.definition.bodypart)?.allowMultiple) {
					usedSingularBodyparts.add(asset.definition.bodypart);
				}
			}
		}

		// Re-load the appearance we have to make sure body is valid
		newAppearance = CharacterAppearanceLoadAndValidate(assetManager, newAppearance, room).slice();
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

	const randomSource = new PseudoRandom(action.seed);

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
			.filter((asset): asset is Asset<'personal'> => asset.isType('personal'))
			.filter((asset) => asset.definition.bodypart == null &&
				asset.definition.attributes?.provides?.includes(requestedAttribute) &&
				asset.definition.allowRandomizerUsage === true &&
				// Skip already present assets
				!usedAssets.has(asset),
			);

		// Shuffle them so we try to add randomly
		ShuffleArray(possibleAssets, randomSource);

		// Try them one by one, stopping at first successful (if we skip all, nothing bad happens)
		for (const asset of possibleAssets) {
			const item = assetManager.createItem(`i/${nanoid()}`, asset);
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

	return processingContext.finalize();
}

export function ActionRoomDeviceDeploy(processingContext: AppearanceActionProcessingContext, rootManipulator: AppearanceRootManipulator, itemPath: ItemPath, deployment: RoomDeviceDeploymentChange): boolean {
	const { container, itemId } = itemPath;
	const manipulator = rootManipulator.getContainer(container);

	let previousDeviceState: ItemRoomDevice | undefined;

	const affectedCharacters = new Set<CharacterId>();

	// Do change
	if (!manipulator.modifyItem(itemId, (it) => {
		if (!it.isType('roomDevice'))
			return null;

		for (const characterId of it.slotOccupancy.values()) {
			affectedCharacters.add(characterId);
		}

		previousDeviceState = it;
		return it.changeDeployment(deployment);
	}))
		return false;

	// If we did undeploy, do character re-validation in case it was forceful (similar to admin kick)
	for (const characterId of affectedCharacters) {
		if (processingContext.getCharacter(characterId) == null)
			continue;

		if (!processingContext.manipulator.produceCharacterState(
			characterId,
			(character) => character.updateRoomStateLink(processingContext.manipulator.currentState.room, true),
		)) {
			return false;
		}
	}

	// Change message to chat
	if (previousDeviceState != null && deployment.deployed !== previousDeviceState.isDeployed()) {
		processingContext.queueMessage(
			manipulator.makeMessage({
				id: (deployment != null) ? 'roomDeviceDeploy' : 'roomDeviceStore',
				item: {
					assetId: previousDeviceState.asset.id,
				},
			}),
		);
	}

	return true;
}

export function ActionRoomDeviceEnter({
	action,
	processingContext,
	assetManager,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionRoomDeviceEnter>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();

	// The device must exist and be a device
	const item = target.getItem(action.item);
	if (!item || !item.isType('roomDevice'))
		return processingContext.invalid();

	// The slot must exist
	const slot = item.asset.definition.slots[action.slot];
	if (!slot)
		return processingContext.invalid();

	// We must know asset bound to the slot
	const asset = assetManager.getAssetById(slot.wearableAsset);
	if (!asset || !asset.isType('roomDeviceWearablePart'))
		return processingContext.invalid();

	// Player must be able to interact with the device
	processingContext.checkCanUseItemDirect(target, action.item.container, item, ItemInteractionType.MODIFY);

	// We must have target character
	const targetCharacter = processingContext.getTarget(action.character);
	if (!targetCharacter)
		return processingContext.invalid();

	if (targetCharacter.type === 'character')
		processingContext.addInteraction(targetCharacter.character, 'deviceEnterLeave');

	const wearableItem = assetManager
		.createItem(action.itemId, asset)
		.withLink(item, action.slot);
	// Player adding the item must be able to use it
	processingContext.checkCanUseItemDirect(targetCharacter, [], wearableItem, ItemInteractionType.ADD_REMOVE);

	// Actual action

	if (target === targetCharacter)
		return processingContext.invalid();

	const roomManipulator = processingContext.manipulator.getManipulatorFor(action.target);
	const containerManipulator = roomManipulator.getContainer(action.item.container);
	const characterManipulator = processingContext.manipulator.getManipulatorFor(action.character);

	// Do change
	if (!containerManipulator.modifyItem(action.item.itemId, (it) => {
		if (!it.isType('roomDevice'))
			return null;
		return it.changeSlotOccupancy(action.slot, action.character.characterId);
	}))
		return processingContext.invalid();

	if (!characterManipulator.addItem(wearableItem))
		return processingContext.invalid();

	if (!processingContext.manipulator.produceCharacterState(
		action.character.characterId,
		(character) => character.updateRoomStateLink(processingContext.manipulator.currentState.room, false),
	))
		return processingContext.invalid();

	// Change message to chat
	processingContext.queueMessage(
		characterManipulator.makeMessage({
			id: 'roomDeviceSlotEnter',
			item: {
				assetId: item.asset.id,
			},
			dictionary: {
				ROOM_DEVICE_SLOT: item.asset.definition.slots[action.slot]?.name ?? '[UNKNOWN]',
			},
		}),
	);

	return processingContext.finalize();
}

export function ActionRoomDeviceLeave({
	action,
	processingContext,
	assetManager,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionRoomDeviceLeave>>): AppearanceActionProcessingResult {
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();

	// The device must exist and be a device
	const item = target.getItem(action.item);
	if (!item || !item.isType('roomDevice'))
		return processingContext.invalid();

	// The slot must exist and be occupied
	const slot = item.asset.definition.slots[action.slot];
	const occupyingCharacterId = item.slotOccupancy.get(action.slot);
	if (!slot || !occupyingCharacterId)
		return processingContext.invalid();

	// We must know asset bound to the slot
	const asset = assetManager.getAssetById(slot.wearableAsset);
	if (!asset || !asset.isType('roomDeviceWearablePart'))
		return processingContext.invalid();

	// Player must be able to interact with the device
	processingContext.checkCanUseItemDirect(target, action.item.container, item, ItemInteractionType.MODIFY);

	const roomManipulator = processingContext.manipulator.getManipulatorFor(action.target);

	// We try to find the character and remove the device cleanly.
	// If character is not found, we ignore it (assuming cleanup-style instead of freeing character)
	const targetCharacter = processingContext.getTarget({
		type: 'character',
		characterId: occupyingCharacterId,
	});

	let isCleanup = true;

	if (targetCharacter) {
		if (targetCharacter.type === 'character')
			processingContext.addInteraction(targetCharacter.character, 'deviceEnterLeave');

		const characterManipulator = processingContext.manipulator.getManipulatorFor({
			type: 'character',
			characterId: occupyingCharacterId,
		});

		// Find matching wearable part
		const wearablePart = characterManipulator.getRootItems().find((i) => i.asset === asset);

		// If we have a part to remove this is a free, not just cleanup
		if (wearablePart != null) {

			// Player must be able to remove the item
			processingContext.checkCanUseItem(targetCharacter, {
				container: [],
				itemId: wearablePart.id,
			}, ItemInteractionType.ADD_REMOVE);

			// Actually remove the item
			const removed = characterManipulator.removeMatchingItems((i) => i.asset === asset);
			Assert(removed.length === 1 && removed[0] === wearablePart);
			isCleanup = false;

			// Change message to chat
			processingContext.queueMessage(
				characterManipulator.makeMessage({
					id: 'roomDeviceSlotLeave',
					item: {
						assetId: item.asset.id,
					},
					dictionary: {
						ROOM_DEVICE_SLOT: item.asset.definition.slots[action.slot]?.name ?? '[UNKNOWN]',
					},
				}),
			);
		}
	}

	// Only after freeing character remove the reservation from the device - to do things in opposite order of putting character into it
	if (!roomManipulator.getContainer(action.item.container).modifyItem(action.item.itemId, (it) => {
		if (!it.isType('roomDevice'))
			return null;
		return it.changeSlotOccupancy(action.slot, null);
	})) {
		return processingContext.invalid();
	}

	// If we didn't remove item from character, then this is just a cleanup, so send cleanup message
	if (isCleanup) {
		processingContext.queueMessage(
			roomManipulator.makeMessage({
				id: 'roomDeviceSlotClear',
				item: {
					assetId: item.asset.id,
				},
				dictionary: {
					ROOM_DEVICE_SLOT: item.asset.definition.slots[action.slot]?.name ?? '[UNKNOWN]',
				},
			}),
		);
	}

	return processingContext.finalize();
}
