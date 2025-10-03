import type { Immutable } from 'immer';
import {
	ActionSpaceContext,
	AppearanceAction,
	AppearanceActionProcessingContext,
	AppearanceActionProcessingResult,
	AppearanceItems,
	Assert,
	EMPTY_ARRAY,
	EvalItemPath,
	Item,
	ItemInteractionType,
	ItemPath,
	SplitContainerPath,
	type ActionTargetSelector,
	type ItemContainerPath,
} from 'pandora-common';
import { useMemo } from 'react';
import { ICharacter } from '../../character/character.ts';
import { useCheckAddPermissions } from '../gameContext/permissionCheckProvider.tsx';
import { useWardrobeActionContext } from './wardrobeActionContext.tsx';
import { WardrobeFocus } from './wardrobeTypes.ts';

export function WardrobeFocusesItem(focus: Immutable<WardrobeFocus>): focus is ItemPath {
	return focus.itemId != null;
}

export function useWardrobeTargetItems(target: ActionTargetSelector | null): AppearanceItems {
	const { globalState } = useWardrobeActionContext();

	const items = useMemo<AppearanceItems | null>(() => {
		if (target == null)
			return null;

		return globalState.getItems(target);
	}, [globalState, target]);

	return items ?? EMPTY_ARRAY;
}

export function useWardrobeTargetItem(target: ActionTargetSelector | null, itemPath: ItemPath | null | undefined): Item | undefined {
	const items = useWardrobeTargetItems(target);

	return useMemo(() => {
		if (!itemPath)
			return undefined;

		const { container, itemId } = itemPath;

		let current: AppearanceItems = items;
		for (const step of container) {
			const item = current.find((it) => it.id === step.item);
			if (!item)
				return undefined;
			current = item.getModuleItems(step.module);
		}
		return current.find((it) => it.id === itemId);
	}, [items, itemPath]);
}

export function useWardrobeContainerAccessCheck(target: ActionTargetSelector, container: ItemContainerPath): AppearanceActionProcessingResult {
	const { actions, globalState } = useWardrobeActionContext();

	const containerAccessCheckInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		const actionTarget = processingContext.getTarget(target);
		if (actionTarget == null)
			return processingContext.invalid();

		const containerPath = SplitContainerPath(container);
		if (containerPath != null) {
			processingContext.checkCanUseItemModule(actionTarget, containerPath.itemPath, containerPath.module, ItemInteractionType.MODIFY);
		}

		return processingContext.finalize();
	}, [actions, globalState, target, container]);

	return useCheckAddPermissions(containerAccessCheckInitial);
}

export function WardrobeCheckResultForConfirmationWarnings(
	player: ICharacter,
	spaceContext: ActionSpaceContext | null,
	action: Immutable<AppearanceAction>,
	result: AppearanceActionProcessingResult,
): string[] {
	if (!result.valid) {
		Assert(result.prompt != null);
		return [];
	}

	const originalRestrictionManager = player.getRestrictionManager(result.originalState, spaceContext);
	const resultRestrictionManager = player.getRestrictionManager(result.resultState, spaceContext);
	const resultCharacterState = resultRestrictionManager.appearance.characterState;

	const warnings: string[] = [];

	// Warn if player won't be able to use hands after this action
	if (
		originalRestrictionManager.canUseHands() &&
		!resultRestrictionManager.forceAllowItemActions() &&
		!resultRestrictionManager.canUseHands()
	) {
		const onlyStruggleableItems = resultCharacterState.items
			.filter((i) => i.getProperties().effects.blockHands)
			.map((i) => (i.isType('roomDeviceWearablePart') && i.roomDevice != null) ? i.roomDevice : i)
			.every((i) => !(i.isType('personal') || i.isType('roomDevice')) || !i.requireFreeHandsToUse);

		if (onlyStruggleableItems) {
			warnings.push(`This action will prevent you from using your hands (but you might still be able to struggle out)`);
		} else {
			warnings.push(`This action will prevent you from using your hands and you will not be able to get out yourself`);
		}
	}

	// Warn about room device undeploy removing characters from it
	if (action.type === 'roomDeviceDeploy' && !action.deployment.deployed) {
		const originalDeviceState = EvalItemPath(result.originalState.getItems(action.target) ?? [], action.item);
		if (
			originalDeviceState != null &&
			originalDeviceState.isType('roomDevice') &&
			originalDeviceState.deployment.deployed &&
			originalDeviceState.slotOccupancy.size > 0
		) {
			warnings.push(`Storing an occupied room device will remove all characters from it`);
		}
	}

	// Deleting room is often problematic
	if (action.type === 'spaceRoomLayout' && action.subaction.type === 'deleteRoom') {
		warnings.push(`Deleting a room deletes all items stored inside and cannot be easily undone`);
	}

	// Warn about deleting item containing other items
	if (action.type === 'delete') {
		const deletedItem = result.originalState.getItem(action.target, action.item);
		if (deletedItem != null) {
			function countSignificantDeletedItems(item: Item): number {
				return Array.from(item.getModules().keys())
					.reduce((s, module) => s + item.getModuleItems(module).reduce((s2, innerItem) => s2 + (!innerItem.isType('lock') ? 1 : 0) + countSignificantDeletedItems(innerItem), 0), 0);
			}

			const deletedCount = countSignificantDeletedItems(deletedItem);
			if (deletedCount > 0) {
				warnings.push(`Deleting this item will also delete ${deletedCount} ${ deletedCount > 1 ? 'items' : 'item' } stored inside (count does not include locks).`);
			}
		}
	}

	return warnings;
}

export function GetVisibleBoneName(name: string): string {
	return name
		.replace(/^\w/, (c) => c.toUpperCase())
		.replace(/_r$/, () => ' Right')
		.replace(/_l$/, () => ' Left')
		.replace(/_\w/g, (c) => ' ' + c.charAt(1).toUpperCase());
}
