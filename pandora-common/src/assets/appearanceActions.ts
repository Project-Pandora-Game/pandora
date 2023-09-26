import { z } from 'zod';
import { CharacterId, CharacterIdSchema, RestrictionResult } from '../character';
import { Assert, AssertNever, ShuffleArray } from '../utility';
import { SAFEMODE_EXIT_COOLDOWN } from './appearance';
import { AssetManager } from './assetManager';
import { AssetIdSchema, WearableAssetType } from './definitions';
import { ActionHandler, ActionMessageTemplateHandler, ActionProcessingContext, ItemContainerPath, ItemContainerPathSchema, ItemId, ItemIdSchema, ItemPath, ItemPathSchema, RoomActionTarget, RoomCharacterSelectorSchema, RoomTargetSelector, RoomTargetSelectorSchema } from './appearanceTypes';
import { CharacterRestrictionsManager, ItemInteractionType, Restriction } from '../character/restrictionsManager';
import { ItemModuleActionSchema, ModuleActionError, ModuleActionFailure } from './modules';
import { FilterItemWearable, Item, ItemColorBundle, ItemColorBundleSchema, ItemRoomDevice, RoomDeviceDeployment, RoomDeviceDeploymentSchema } from './item';
import { AppearanceRootManipulator } from './appearanceHelpers';
import { AppearanceItems, CharacterAppearanceLoadAndValidate, AppearanceValidationError, AppearanceValidationResult, ValidateAppearanceItems, ValidateAppearanceItemsPrefix } from './appearanceValidation';
import { isEqual, sample } from 'lodash';
import { nanoid } from 'nanoid';
import { Asset, FilterAssetType } from './asset';
import { CreateAssetPropertiesResult, MergeAssetProperties } from './properties';
import { AppearanceArmPoseSchema, AppearancePoseSchema } from './state/characterState';
import { AssetFrameworkGlobalStateContainer } from './state/globalState';
import { AssetFrameworkGlobalStateManipulator } from './manipulators/globalStateManipulator';
import { CharacterViewSchema, LegsPoseSchema } from './graphics/graphics';

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
	player: CharacterId;
	globalState: AssetFrameworkGlobalStateContainer;
	getTarget(target: RoomTargetSelector): RoomActionTarget | null;
	getCharacter(id: CharacterId): CharacterRestrictionsManager | null;
	/** Handler for sending messages to chat */
	actionHandler?: ActionHandler;
}

export type AppearanceActionFailure = {
	type: 'moduleActionFailure';
	reason: ModuleActionFailure;
};

export type AppearanceActionResult = {
	result: 'success';
} | {
	result: 'failure';
	failure: AppearanceActionFailure;
} | {
	result: 'invalidAction';
	reason?: 'noDeleteRoomDeviceWearable' | 'noDeleteDeployedRoomDevice';
} | {
	result: 'moduleActionError';
	reason: ModuleActionError;
} | {
	result: 'restrictionError';
	restriction: Restriction;
} | {
	result: 'validationError';
	validationError: AppearanceValidationError;
};

/** Context for performing module actions */
export interface AppearanceModuleActionContext {
	player: CharacterRestrictionsManager;
	target: RoomActionTarget;

	messageHandler: ActionMessageTemplateHandler;
	reject: (reason: ModuleActionError) => void;
	failure: (reason: ModuleActionFailure) => void;
}

export interface AppearanceActionHandlerArg<Action extends AppearanceAction = AppearanceAction> {
	action: Action;
	manipulator: AssetFrameworkGlobalStateManipulator;
	context: AppearanceActionContext;
	assetManager: AssetManager;
	player: CharacterRestrictionsManager;
	processingContext: ActionProcessingContext;
}

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

	const manipulator = context.globalState.getManipulator();

	const arg: Omit<AppearanceActionHandlerArg, 'action'> = {
		context,
		manipulator,
		assetManager,
		player,
		processingContext,
	};

	switch (action.type) {
		// Create and equip an item
		case 'create': {
			const asset = assetManager.getAssetById(action.asset);
			const target = context.getTarget(action.target);
			if (!asset || !target)
				return { result: 'invalidAction' };
			if (!asset.canBeSpawned())
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

			const targetManipulator = manipulator.getManipulatorFor(action.target);
			if (!targetManipulator)
				return { result: 'invalidAction' };
			if (!ActionAddItem(targetManipulator, action.container, item, action.insertBefore ?? null))
				return { result: 'invalidAction' };

			break;
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

			// Room device wearable parts cannot be deleted, you have to leave the device instead
			const item = target.getItem(action.item);
			if (item?.isType('roomDeviceWearablePart')) {
				return {
					result: 'invalidAction',
					reason: 'noDeleteRoomDeviceWearable',
				};
			}
			// Deployed room devices cannot be deleted, you must store them first
			if (item?.isType('roomDevice') && item.deployment != null) {
				return {
					result: 'invalidAction',
					reason: 'noDeleteDeployedRoomDevice',
				};
			}

			const targetManipulator = manipulator.getManipulatorFor(action.target);
			if (!ActionRemoveItem(targetManipulator, action.item))
				return { result: 'invalidAction' };

			break;
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

			const sourceManipulator = manipulator.getManipulatorFor(action.source);
			const targetManipulator = manipulator.getManipulatorFor(action.target);

			// Preform the transfer in manipulators
			if (!ActionTransferItem(sourceManipulator, action.item, targetManipulator, action.container, action.insertBefore ?? null))
				return { result: 'invalidAction' };

			break;
		}
		// Moves an item within inventory, reordering the worn order
		case 'move': {
			const target = context.getTarget(action.target);
			if (!target)
				return { result: 'invalidAction' };
			// Player moving the item must be able to interact with the item
			let r = player.canUseItem(target, action.item, ItemInteractionType.ADD_REMOVE);
			if (!r.allowed) {
				return {
					result: 'restrictionError',
					restriction: r.restriction,
				};
			}

			const targetManipulator = manipulator.getManipulatorFor(action.target);

			// Player moving the item must be able to interact with the item on target position (if it is being moved in root)
			if (action.item.container.length === 0) {
				const items = targetManipulator.getRootItems();
				const currentPos = items.findIndex((item) => item.id === action.item.itemId);
				const newPos = currentPos + action.shift;

				if (newPos >= 0 && newPos < items.length) {
					r = player.canUseItem(target, action.item, ItemInteractionType.ADD_REMOVE, items[newPos].id);
					if (!r.allowed) {
						return {
							result: 'restrictionError',
							restriction: r.restriction,
						};
					}
				}
			}

			if (!ActionMoveItem(targetManipulator, action.item, action.shift))
				return { result: 'invalidAction' };

			break;
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

			const targetManipulator = manipulator.getManipulatorFor(action.target);
			if (!ActionColorItem(targetManipulator, action.item, action.color))
				return { result: 'invalidAction' };

			break;
		}
		// Module-specific action
		case 'moduleAction': {
			const r = ActionModuleAction({
				...arg,
				action,
			});
			if (r.result !== 'success')
				return r;

			break;
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
			const target = context.getTarget({ type: 'character', characterId: action.target });
			if (!target)
				return { result: 'invalidAction' };

			const r = player.canInteractWithTarget(target);
			if (!r.allowed) {
				return {
					result: 'restrictionError',
					restriction: r.restriction,
				};
			}

			if (!manipulator.produceCharacterState(action.target, (character) => {
				return character.produceWithPose(action, action.type);
			})) {
				return { result: 'invalidAction' };
			}

			break;
		}
		// Changes view of the character - front or back
		case 'setView': {
			const target = context.getTarget({ type: 'character', characterId: action.target });
			if (!target)
				return { result: 'invalidAction' };

			const r = player.canInteractWithTarget(target);
			if (!r.allowed) {
				return {
					result: 'restrictionError',
					restriction: r.restriction,
				};
			}

			if (!manipulator.produceCharacterState(action.target, (character) => {
				return character.produceWithView(action.view);
			})) {
				return { result: 'invalidAction' };
			}

			break;
		}
		case 'safemode': {
			const current = player.appearance.getSafemode();
			if (action.action === 'enter') {
				// If we are already in it we cannot enter it again
				if (current)
					return { result: 'invalidAction' };

				if (!manipulator.produceCharacterState(player.appearance.id, (character) => {
					return character.produceWithSafemode({
						allowLeaveAt: Date.now() + (player.room?.features.includes('development') ? 0 : SAFEMODE_EXIT_COOLDOWN),
					});
				})) {
					return { result: 'invalidAction' };
				}

				processingContext.actionHandler?.({
					id: 'safemodeEnter',
					character: {
						type: 'character',
						id: player.appearance.id,
					},
				});
			} else if (action.action === 'exit') {
				// If we are already not in it we cannot exit it
				if (!current)
					return { result: 'invalidAction' };

				// Check the timer to leave it passed
				if (Date.now() < current.allowLeaveAt)
					return { result: 'invalidAction' };

				if (!manipulator.produceCharacterState(player.appearance.id, (character) => {
					return character.produceWithSafemode(null);
				})) {
					return { result: 'invalidAction' };
				}

				processingContext.actionHandler?.({
					id: 'safemodeLeave',
					character: {
						type: 'character',
						id: player.appearance.id,
					},
				});
			} else {
				AssertNever(action.action);
			}
			break;
		}
		case 'randomize': {
			const r = ActionAppearanceRandomize({
				...arg,
				action,
			});

			if (r.result !== 'success')
				return r;

			break;
		}
		case 'roomDeviceDeploy': {
			const target = context.getTarget(action.target);
			if (!target)
				return { result: 'invalidAction' };
			// Player deploying the device must be able to interact with it
			const r = player.canUseItem(target, action.item, ItemInteractionType.MODIFY);
			if (!r.allowed) {
				return {
					result: 'restrictionError',
					restriction: r.restriction,
				};
			}

			const targetManipulator = manipulator.getManipulatorFor(action.target);
			if (!ActionRoomDeviceDeploy(targetManipulator, action.item, action.deployment))
				return { result: 'invalidAction' };

			break;
		}
		case 'roomDeviceEnter': {
			const r = ActionRoomDeviceEnter({
				...arg,
				action,
			});
			if (r.result !== 'success')
				return r;

			break;
		}
		case 'roomDeviceLeave': {
			const r = ActionRoomDeviceLeave({
				...arg,
				action,
			});
			if (r.result !== 'success')
				return r;

			break;
		}
		default:
			AssertNever(action);
	}

	return AppearanceValidationResultToActionResult(
		context.globalState.commitChanges(manipulator, processingContext),
	);
}

export function AppearanceValidationResultToActionResult(result: AppearanceValidationResult): AppearanceActionResult {
	return result.success ? {
		result: 'success',
	} : {
		result: 'validationError',
		validationError: result.error,
	};
}

export function ActionAddItem(rootManipulator: AppearanceRootManipulator, container: ItemContainerPath, item: Item, insertBefore: ItemId | null): boolean {
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
			id: (!manipulatorContainer && rootManipulator.isCharacter()) ? 'itemAddCreate' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemAttach' : 'itemStore',
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
		id: (!manipulatorContainer && rootManipulator.isCharacter()) ? 'itemRemoveDelete' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemDetach' : 'itemUnload',
		item: {
			assetId: removedItems[0].asset.id,
		},
	});

	return true;
}

export function ActionTransferItem(sourceManipulator: AppearanceRootManipulator, itemPath: ItemPath, targetManipulator: AppearanceRootManipulator, targetContainer: ItemContainerPath, insertBefore: ItemId | null): boolean {
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
		sourceContainerManipulator.queueMessage({
			id: !manipulatorContainer ? 'itemRemove' : manipulatorContainer?.contentsPhysicallyEquipped ? 'itemDetach' : 'itemUnload',
			item: {
				assetId: item.asset.id,
			},
		});
	}
	if (targetManipulator.isCharacter() && (!sourceManipulator.isCharacter() || targetManipulator.characterId !== sourceManipulator.characterId)) {
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

export function ActionModuleAction({
	action,
	manipulator,
	context,
	player,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionModuleAction>>): AppearanceActionResult {
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

	const rootManipulator = manipulator.getManipulatorFor(action.target);

	const { container, itemId } = action.item;
	const containerManipulator = rootManipulator.getContainer(container);

	let rejectionReason: ModuleActionError | undefined;
	let failureReason: ModuleActionFailure | undefined;

	// Do change and store chat messages
	if (!containerManipulator.modifyItem(itemId, (it) => {
		const actionContext: AppearanceModuleActionContext = {
			player,
			target,
			messageHandler: (m) => containerManipulator.queueMessage({
				item: {
					assetId: it.asset.id,
				},
				...m,
			}),
			reject: (reason) => {
				rejectionReason ??= reason;
			},
			failure: (reason) => {
				failureReason ??= reason;
			},
		};

		return it.moduleAction(
			actionContext,
			action.module,
			action.action,
		);
	}) || rejectionReason || failureReason) {
		if (rejectionReason || failureReason == null) {
			return {
				result: 'moduleActionError',
				reason: rejectionReason ?? { type: 'invalid' },
			};
		}
		return {
			result: 'failure',
			failure: {
				type: 'moduleActionFailure',
				reason: failureReason,
			},
		};
	}

	return {
		result: 'success',
	};
}

export function ActionAppearanceRandomize({
	action,
	manipulator,
	processingContext,
	assetManager,
	player,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionRandomize>>): AppearanceActionResult {
	const kind = action.kind;
	const character = player;
	const characterManipulator = manipulator.getManipulatorFor({
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
	if (processingContext.dryRun)
		return { result: 'success' };

	// Filter appearance to get either body or nothing
	let newAppearance: Item<WearableAssetType>[] = kind === 'items' ? oldItems.filter((i) => !i.isType('personal') || i.asset.definition.bodypart != null) : [];
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
		newAppearance = CharacterAppearanceLoadAndValidate(assetManager, newAppearance).slice();
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
	characterManipulator.resetItemsTo(newAppearance);

	return {
		result: 'success',
	};
}

export function ActionRoomDeviceDeploy(rootManipulator: AppearanceRootManipulator, itemPath: ItemPath, deployment: RoomDeviceDeployment): boolean {
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
		manipulator.queueMessage({
			id: (deployment != null) ? 'roomDeviceDeploy' : 'roomDeviceStore',
			item: {
				assetId: previousDeviceState.asset.id,
			},
		});
	}

	return true;
}

export function ActionRoomDeviceEnter({
	action,
	manipulator,
	context,
	assetManager,
	player,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionRoomDeviceEnter>>): AppearanceActionResult {
	const target = context.getTarget(action.target);
	if (!target)
		return { result: 'invalidAction' };

	// The device must exist and be a device
	const item = target.getItem(action.item);
	if (!item || !item.isType('roomDevice'))
		return { result: 'invalidAction' };

	// The slot must exist
	const slot = item.asset.definition.slots[action.slot];
	if (!slot)
		return { result: 'invalidAction' };

	// We must know asset bound to the slot
	const asset = assetManager.getAssetById(slot.wearableAsset);
	if (!asset || !asset.isType('roomDeviceWearablePart'))
		return { result: 'invalidAction' };

	// Player must be able to interact with the device
	let r = player.canUseItemDirect(target, action.item.container, item, ItemInteractionType.MODIFY);
	if (!r.allowed) {
		return {
			result: 'restrictionError',
			restriction: r.restriction,
		};
	}

	// We must have target character
	const targetCharacter = context.getTarget(action.character);
	if (!targetCharacter)
		return { result: 'invalidAction' };

	const wearableItem = assetManager
		.createItem(action.itemId, asset, null)
		.withLink({
			device: item.id,
			slot: action.slot,
		});
	// Player adding the item must be able to use it
	r = player.canUseItemDirect(targetCharacter, [], wearableItem, ItemInteractionType.ADD_REMOVE);
	if (!r.allowed) {
		return {
			result: 'restrictionError',
			restriction: r.restriction,
		};
	}

	// Actual action

	if (target === targetCharacter)
		return { result: 'invalidAction' };

	const roomManipulator = manipulator.getManipulatorFor(action.target);
	const containerManipulator = roomManipulator.getContainer(action.item.container);
	const characterManipulator = manipulator.getManipulatorFor(action.character);

	// Do change
	if (!containerManipulator.modifyItem(action.item.itemId, (it) => {
		if (!it.isType('roomDevice'))
			return null;
		return it.changeSlotOccupancy(action.slot, action.character.characterId);
	}))
		return { result: 'invalidAction' };

	if (!characterManipulator.addItem(wearableItem))
		return { result: 'invalidAction' };

	// Change message to chat
	characterManipulator.queueMessage({
		id: 'roomDeviceSlotEnter',
		item: {
			assetId: item.asset.id,
		},
		dictionary: {
			ROOM_DEVICE_SLOT: item.asset.definition.slots[action.slot]?.name ?? '[UNKNOWN]',
		},
	});

	return {
		result: 'success',
	};
}

export function ActionRoomDeviceLeave({
	action,
	manipulator,
	context,
	assetManager,
	player,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionRoomDeviceLeave>>): AppearanceActionResult {
	const target = context.getTarget(action.target);
	if (!target)
		return { result: 'invalidAction' };

	// The device must exist and be a device
	const item = target.getItem(action.item);
	if (!item || !item.isType('roomDevice'))
		return { result: 'invalidAction' };

	// The slot must exist and be occupied
	const slot = item.asset.definition.slots[action.slot];
	const occupyingCharacterId = item.slotOccupancy.get(action.slot);
	if (!slot || !occupyingCharacterId)
		return { result: 'invalidAction' };

	// We must know asset bound to the slot
	const asset = assetManager.getAssetById(slot.wearableAsset);
	if (!asset || !asset.isType('roomDeviceWearablePart'))
		return { result: 'invalidAction' };

	// Player must be able to interact with the device
	let r = player.canUseItemDirect(target, action.item.container, item, ItemInteractionType.MODIFY);
	if (!r.allowed) {
		return {
			result: 'restrictionError',
			restriction: r.restriction,
		};
	}

	const roomManipulator = manipulator.getManipulatorFor(action.target);

	// We try to find the character and remove the device cleanly.
	// If character is not found, we ignore it (assuming cleanup-style instead of freeing character)
	const targetCharacter = context.getTarget({
		type: 'character',
		characterId: occupyingCharacterId,
	});

	let isCleanup = true;

	if (targetCharacter) {
		const characterManipulator = manipulator.getManipulatorFor({
			type: 'character',
			characterId: occupyingCharacterId,
		});

		// Find matching wearable part
		const wearablePart = characterManipulator.getRootItems().find((i) => i.asset === asset);

		// If we have a part to remove this is a free, not just cleanup
		if (wearablePart != null) {

			// Player must be able to remove the item
			r = player.canUseItem(targetCharacter, {
				container: [],
				itemId: wearablePart.id,
			}, ItemInteractionType.ADD_REMOVE);
			if (!r.allowed) {
				return {
					result: 'restrictionError',
					restriction: r.restriction,
				};
			}

			// Actually remove the item
			const removed = characterManipulator.removeMatchingItems((i) => i.asset === asset);
			Assert(removed.length === 1 && removed[0] === wearablePart);
			isCleanup = false;

			// Change message to chat
			characterManipulator.queueMessage({
				id: 'roomDeviceSlotLeave',
				item: {
					assetId: item.asset.id,
				},
				dictionary: {
					ROOM_DEVICE_SLOT: item.asset.definition.slots[action.slot]?.name ?? '[UNKNOWN]',
				},
			});
		}

		const exitPose = asset.definition.exitPose ?? item.asset.definition.exitPose;
		if (exitPose != null && !manipulator.produceCharacterState(occupyingCharacterId, (character) => character.produceWithPosePreset(exitPose))) {
			return {
				result: 'restrictionError',
				restriction: {
					type: 'exitPose',
					asset: item.asset.id,
				},
			};
		}
	}

	// Only after freeing character remove the reservation from the device - to do things in opposite order of putting character into it
	if (!roomManipulator.getContainer(action.item.container).modifyItem(action.item.itemId, (it) => {
		if (!it.isType('roomDevice'))
			return null;
		return it.changeSlotOccupancy(action.slot, null);
	})) {
		return { result: 'invalidAction' };
	}

	// If we didn't remove item from character, then this is just a cleanup, so send cleanup message
	if (isCleanup) {
		roomManipulator.queueMessage({
			id: 'roomDeviceSlotClear',
			item: {
				assetId: item.asset.id,
			},
			dictionary: {
				ROOM_DEVICE_SLOT: item.asset.definition.slots[action.slot]?.name ?? '[UNKNOWN]',
			},
		});
	}

	return {
		result: 'success',
	};
}
