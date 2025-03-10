import type { Immutable } from 'immer';
import {
	ActionSpaceContext,
	AppearanceAction,
	AppearanceActionProcessingResult,
	AppearanceItems,
	Assert,
	AssertNever,
	EMPTY_ARRAY,
	EvalItemPath,
	Item,
	ItemPath,
	type ActionTargetSelector,
} from 'pandora-common';
import { useMemo } from 'react';
import { ICharacter } from '../../character/character.ts';
import { useWardrobeActionContext } from './wardrobeActionContext.tsx';
import { WardrobeFocus } from './wardrobeTypes.ts';

export function WardrobeFocusesItem(focus: Immutable<WardrobeFocus>): focus is ItemPath {
	return focus.itemId != null;
}

export function useWardrobeTargetItems(target: ActionTargetSelector | null): AppearanceItems {
	const { globalState } = useWardrobeActionContext();

	const items = useMemo<AppearanceItems | null>(() => {
		if (target == null) {
			return null;
		} else if (target.type === 'character') {
			return globalState.getItems({
				type: 'character',
				characterId: target.characterId,
			});
		} else if (target.type === 'roomInventory') {
			return globalState.getItems({
				type: 'roomInventory',
			});
		}
		AssertNever(target);
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

	return warnings;
}
