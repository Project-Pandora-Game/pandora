import {
	ActionRoomContext,
	AppearanceAction,
	AppearanceActionProcessingResultValid,
	AppearanceItems,
	AssertNever,
	AssertNotNullable,
	EMPTY_ARRAY,
	Item,
	ItemPath,
} from 'pandora-common';
import { useMemo } from 'react';
import { WardrobeFocus, WardrobeTarget } from './wardrobeTypes';
import { useWardrobeContext } from './wardrobeContext';
import { ICharacter } from '../../character/character';

export function WardrobeFocusesItem(focus: WardrobeFocus): focus is ItemPath {
	return focus.itemId != null;
}

export function useWardrobeTargetItems(target: WardrobeTarget | null): AppearanceItems {
	const { globalState } = useWardrobeContext();

	const items = useMemo<AppearanceItems | null>(() => {
		if (target == null) {
			return null;
		} else if (target.type === 'character') {
			return globalState.getItems({
				type: 'character',
				characterId: target.id,
			});
		} else if (target.type === 'room') {
			return globalState.getItems({
				type: 'roomInventory',
			});
		}
		AssertNever(target);
	}, [globalState, target]);

	return items ?? EMPTY_ARRAY;
}

export function useWardrobeTargetItem(target: WardrobeTarget | null, itemPath: ItemPath | null | undefined): Item | undefined {
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

export function WardrobeCheckResultForConfirmationWarnings(player: ICharacter, roomContext: ActionRoomContext | null, action: AppearanceAction, result: AppearanceActionProcessingResultValid): string[] {
	const originalCharacterState = result.originalState.characters.get(player.id);
	AssertNotNullable(originalCharacterState);
	const resultCharacterState = result.resultState.characters.get(player.id);
	AssertNotNullable(resultCharacterState);

	const originalRestrictionManager = player.getRestrictionManager(originalCharacterState, roomContext);
	const resultRestrictionManager = player.getRestrictionManager(resultCharacterState, roomContext);

	const warnings: string[] = [];

	// Warn if player won't be able to use hands after this action
	if (
		originalRestrictionManager.canUseHands() &&
		!resultRestrictionManager.isInSafemode() &&
		!resultRestrictionManager.canUseHands()
	) {
		warnings.push(`This action will prevent you from using your hands`);
	}

	// Warn about storing a room device
	if (
		action.type === 'roomDeviceDeploy' &&
		action.deployment == null
	) {
		warnings.push(`Storing a room device removes all characters from it`);
		warnings.push(`Storing a room device resets its position inside the room`);
	}

	return warnings;
}
