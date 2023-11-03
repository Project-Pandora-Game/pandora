import { z } from 'zod';
import { CharacterId, CharacterIdSchema, RestrictionResult } from '../character';
import { Assert, AssertNever, ShuffleArray } from '../utility';
import { SAFEMODE_EXIT_COOLDOWN } from './appearance';
import { AssetManager } from './assetManager';
import { AssetIdSchema, WearableAssetType } from './definitions';
import { ActionMessageTemplateHandler, ItemContainerPath, ItemContainerPathSchema, ItemId, ItemIdSchema, ItemPath, ItemPathSchema, RoomActionTarget, RoomCharacterSelectorSchema, RoomTargetSelectorSchema } from './appearanceTypes';
import { ItemInteractionType } from '../character/restrictionsManager';
import { ItemModuleActionSchema, ModuleActionError, ModuleActionFailure } from './modules';
import { FilterItemWearable, Item, ItemColorBundle, ItemColorBundleSchema, ItemRoomDevice, RoomDeviceDeployment, RoomDeviceDeploymentSchema } from './item';
import { AppearanceRootManipulator } from './appearanceHelpers';
import { AppearanceItems, CharacterAppearanceLoadAndValidate, ValidateAppearanceItems, ValidateAppearanceItemsPrefix } from './appearanceValidation';
import { isEqual, sample } from 'lodash';
import { nanoid } from 'nanoid';
import { Asset, FilterAssetType } from './asset';
import { CreateAssetPropertiesResult, MergeAssetProperties } from './properties';
import { AppearanceArmPoseSchema, AppearancePoseSchema } from './state/characterState';
import { AssetFrameworkGlobalStateContainer } from './state/globalState';
import { CharacterViewSchema, LegsPoseSchema } from './graphics/graphics';
import { AppearanceActionProcessingContext, AppearanceActionProcessingResult } from './appearanceActionProcessingContext';
import { GameLogicCharacter } from '../gameLogic';
import { ActionRoomContext } from '../chatroom';

// Fix for pnpm resolution weirdness
import type { } from '../validation';

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
	/** Item to insert the new one in front of in the target container */
	insertBefore: ItemIdSchema.optional(),
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

export const AppearanceActionRoomDeviceDeploy = z.object({
	type: z.literal('roomDeviceDeploy'),
	/** Target with the room device (so room) */
	target: RoomTargetSelectorSchema,
	/** Path to the room device */
	item: ItemPathSchema,
	/** The resulting deployment we want */
	deployment: RoomDeviceDeploymentSchema,
});

export const AppearanceActionRoomDeviceEnter = z.object({
	type: z.literal('roomDeviceEnter'),
	/** Target with the room device (so room) */
	target: RoomTargetSelectorSchema,
	/** Path to the room device */
	item: ItemPathSchema,
	/** The slot the character wants to enter */
	slot: z.string(),
	/** The target character to enter the device */
	character: RoomCharacterSelectorSchema,
	/** ID to give the new wearable part item */
	itemId: ItemIdSchema,
});

export const AppearanceActionRoomDeviceLeave = z.object({
	type: z.literal('roomDeviceLeave'),
	/** Target with the room device (so room) */
	target: RoomTargetSelectorSchema,
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
	AppearanceActionSafemode,
	AppearanceActionRandomize,
	AppearanceActionRoomDeviceDeploy,
	AppearanceActionRoomDeviceEnter,
	AppearanceActionRoomDeviceLeave,
]);
export type AppearanceAction = z.infer<typeof AppearanceActionSchema>;

export interface AppearanceActionContext {
	player: GameLogicCharacter;
	globalState: AssetFrameworkGlobalStateContainer;
	roomContext: ActionRoomContext | null;
	getCharacter(id: CharacterId): GameLogicCharacter | null;
}

/** Context for performing module actions */
export interface AppearanceModuleActionContext {
	processingContext: AppearanceActionProcessingContext;
	target: RoomActionTarget;

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
			const asset = assetManager.getAssetById(action.asset);
			const target = processingContext.getTarget(action.target);
			if (!asset || !target)
				return processingContext.invalid();
			if (!asset.canBeSpawned())
				return processingContext.invalid();
			const item = assetManager.createItem(action.itemId, asset, null);
			// Player adding the item must be able to use it
			const r = playerRestrictionManager.canUseItemDirect(processingContext, target, action.container, item, ItemInteractionType.ADD_REMOVE);
			if (!r.allowed) {
				processingContext.addProblem({
					result: 'restrictionError',
					restriction: r.restriction,
				});
			}

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
			const r = playerRestrictionManager.canUseItem(processingContext, target, action.item, ItemInteractionType.ADD_REMOVE);
			if (!r.allowed) {
				processingContext.addProblem({
					result: 'restrictionError',
					restriction: r.restriction,
				});
			}

			// Room device wearable parts cannot be deleted, you have to leave the device instead
			const item = target.getItem(action.item);
			if (item?.isType('roomDeviceWearablePart')) {
				return processingContext.invalid('noDeleteRoomDeviceWearable');
			}
			// Deployed room devices cannot be deleted, you must store them first
			if (item?.isType('roomDevice') && item.deployment != null) {
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
			let r = playerRestrictionManager.canUseItemDirect(processingContext, source, action.item.container, item, ItemInteractionType.ADD_REMOVE);
			if (!r.allowed) {
				processingContext.addProblem({
					result: 'restrictionError',
					restriction: r.restriction,
				});
			}

			// Player adding the item must be able to use it on target
			r = playerRestrictionManager.canUseItemDirect(processingContext, target, action.container, item, ItemInteractionType.ADD_REMOVE);
			if (!r.allowed) {
				processingContext.addProblem({
					result: 'restrictionError',
					restriction: r.restriction,
				});
			}

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
			let r = playerRestrictionManager.canUseItem(processingContext, target, action.item, ItemInteractionType.ADD_REMOVE);
			if (!r.allowed) {
				processingContext.addProblem({
					result: 'restrictionError',
					restriction: r.restriction,
				});
			}

			const targetManipulator = processingContext.manipulator.getManipulatorFor(action.target);

			// Player moving the item must be able to interact with the item on target position (if it is being moved in root)
			if (action.item.container.length === 0) {
				const items = targetManipulator.getRootItems();
				const currentPos = items.findIndex((item) => item.id === action.item.itemId);
				const newPos = currentPos + action.shift;

				if (newPos >= 0 && newPos < items.length) {
					r = playerRestrictionManager.canUseItem(processingContext, target, action.item, ItemInteractionType.ADD_REMOVE, items[newPos].id);
					if (!r.allowed) {
						processingContext.addProblem({
							result: 'restrictionError',
							restriction: r.restriction,
						});
					}
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
			// Player coloring the item must be able to interact with the item
			const r = playerRestrictionManager.canUseItem(processingContext, target, action.item, ItemInteractionType.STYLING);
			if (!r.allowed) {
				processingContext.addProblem({
					result: 'restrictionError',
					restriction: r.restriction,
				});
			}

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

			const r = playerRestrictionManager.canInteractWithTarget(processingContext, target);
			if (!r.allowed) {
				processingContext.addProblem({
					result: 'restrictionError',
					restriction: r.restriction,
				});
			}

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

			const r = playerRestrictionManager.canInteractWithTarget(processingContext, target);
			if (!r.allowed) {
				processingContext.addProblem({
					result: 'restrictionError',
					restriction: r.restriction,
				});
			}

			if (!processingContext.manipulator.produceCharacterState(action.target, (character) => {
				return character.produceWithView(action.view);
			})) {
				return processingContext.invalid();
			}

			return processingContext.finalize();
		}
		case 'safemode': {
			const current = playerRestrictionManager.appearance.getSafemode();
			if (action.action === 'enter') {
				// If we are already in it we cannot enter it again
				if (current)
					return processingContext.invalid();

				if (!processingContext.manipulator.produceCharacterState(playerRestrictionManager.appearance.id, (character) => {
					return character.produceWithSafemode({
						allowLeaveAt: Date.now() + (playerRestrictionManager.room?.features.includes('development') ? 0 : SAFEMODE_EXIT_COOLDOWN),
					});
				})) {
					return processingContext.invalid();
				}

				processingContext.queueMessage({
					id: 'safemodeEnter',
				});
			} else if (action.action === 'exit') {
				// If we are already not in it we cannot exit it
				if (!current)
					return processingContext.invalid();

				// Check the timer to leave it passed
				if (Date.now() < current.allowLeaveAt)
					return processingContext.invalid();

				if (!processingContext.manipulator.produceCharacterState(playerRestrictionManager.appearance.id, (character) => {
					return character.produceWithSafemode(null);
				})) {
					return processingContext.invalid();
				}

				processingContext.queueMessage({
					id: 'safemodeLeave',
				});
			} else {
				AssertNever(action.action);
			}
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
			const r = playerRestrictionManager.canUseItem(processingContext, target, action.item, ItemInteractionType.MODIFY);
			if (!r.allowed) {
				processingContext.addProblem({
					result: 'restrictionError',
					restriction: r.restriction,
				});
			}

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
	const playerRestrictionManager = processingContext.getPlayerRestrictionManager();
	const target = processingContext.getTarget(action.target);
	if (!target)
		return processingContext.invalid();
	// Player doing the action must be able to interact with the item
	const r = playerRestrictionManager.canUseItemModule(processingContext, target, action.item, action.module);
	if (!r.allowed) {
		processingContext.addProblem({
			result: 'restrictionError',
			restriction: r.restriction,
		});
	}

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
	if (kind === 'full' && character.room && !character.room.features.includes('allowBodyChanges')) {
		processingContext.addProblem({
			result: 'restrictionError',
			restriction: {
				type: 'modifyBodyRoom',
			},
		});
	}

	// Must have free hands to randomize
	if (!character.canUseHands() && !character.isInSafemode()) {
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
					a.definition.attributes?.includes(requestedBodyAttribute) &&
					// Skip already present assets
					!usedAssets.has(a) &&
					// Skip already present bodyparts that don't allow multiple
					!usedSingularBodyparts.has(a.definition.bodypart),
				);

			// Pick one and add it to the appearance
			const asset = sample(possibleAssets);
			if (asset && asset.isType('personal') && asset.definition.bodypart != null) {
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
			.filter(FilterAssetType('personal'))
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

export function ActionRoomDeviceDeploy(processingContext: AppearanceActionProcessingContext, rootManipulator: AppearanceRootManipulator, itemPath: ItemPath, deployment: RoomDeviceDeployment): boolean {
	const { container, itemId } = itemPath;
	const manipulator = rootManipulator.getContainer(container);

	let previousDeviceState: ItemRoomDevice | undefined;

	// Do change
	if (!manipulator.modifyItem(itemId, (it) => {
		if (!it.isType('roomDevice'))
			return null;
		previousDeviceState = it;
		return it.changeDeployment(deployment);
	}))
		return false;

	// Change message to chat
	if (previousDeviceState != null && (deployment == null) !== (previousDeviceState.deployment == null)) {
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
	const playerRestrictionManager = processingContext.getPlayerRestrictionManager();
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
	let r = playerRestrictionManager.canUseItemDirect(processingContext, target, action.item.container, item, ItemInteractionType.MODIFY);
	if (!r.allowed) {
		processingContext.addProblem({
			result: 'restrictionError',
			restriction: r.restriction,
		});
	}

	// We must have target character
	const targetCharacter = processingContext.getTarget(action.character);
	if (!targetCharacter)
		return processingContext.invalid();

	const wearableItem = assetManager
		.createItem(action.itemId, asset, null)
		.withLink(item, action.slot);
	// Player adding the item must be able to use it
	r = playerRestrictionManager.canUseItemDirect(processingContext, targetCharacter, [], wearableItem, ItemInteractionType.ADD_REMOVE);
	if (!r.allowed) {
		processingContext.addProblem({
			result: 'restrictionError',
			restriction: r.restriction,
		});
	}

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
		(character) => character.updateRoomStateLink(processingContext.manipulator.currentState.room),
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
	const playerRestrictionManager = processingContext.getPlayerRestrictionManager();
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
	let r = playerRestrictionManager.canUseItemDirect(processingContext, target, action.item.container, item, ItemInteractionType.MODIFY);
	if (!r.allowed) {
		processingContext.addProblem({
			result: 'restrictionError',
			restriction: r.restriction,
		});
	}

	const roomManipulator = processingContext.manipulator.getManipulatorFor(action.target);

	// We try to find the character and remove the device cleanly.
	// If character is not found, we ignore it (assuming cleanup-style instead of freeing character)
	const targetCharacter = processingContext.getTarget({
		type: 'character',
		characterId: occupyingCharacterId,
	});

	let isCleanup = true;

	if (targetCharacter) {
		const characterManipulator = processingContext.manipulator.getManipulatorFor({
			type: 'character',
			characterId: occupyingCharacterId,
		});

		// Find matching wearable part
		const wearablePart = characterManipulator.getRootItems().find((i) => i.asset === asset);

		// If we have a part to remove this is a free, not just cleanup
		if (wearablePart != null) {

			// Player must be able to remove the item
			r = playerRestrictionManager.canUseItem(processingContext, targetCharacter, {
				container: [],
				itemId: wearablePart.id,
			}, ItemInteractionType.ADD_REMOVE);
			if (!r.allowed) {
				processingContext.addProblem({
					result: 'restrictionError',
					restriction: r.restriction,
				});
			}

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
