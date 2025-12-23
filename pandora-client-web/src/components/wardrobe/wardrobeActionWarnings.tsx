import { produce, type Immutable } from 'immer';
import {
	ActionSpaceContext,
	AppearanceAction,
	AppearanceActionProcessingResult,
	ApplyAction,
	Assert,
	EvalItemPath,
	Item,
	LockLogic,
} from 'pandora-common';
import type { Character } from '../../character/character.ts';

export function WardrobeCheckResultForConfirmationWarnings(
	player: Character,
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

	// Warn if locking a lock that won't be unlockable
	if (
		result.valid &&
		action.type === 'moduleAction' &&
		action.action.moduleType === 'lockSlot' &&
		action.action.lockAction.action === 'lock'
	) {
		const unlockLockAction = LockLogic.makeUnlockActionFromLockAction(action.action.lockAction);
		const reverseAction = produce(action, (d) => {
			Assert(d.action.moduleType === 'lockSlot');
			d.action.lockAction = unlockLockAction;
		});

		const reverseResult = ApplyAction(result.createChainProcessingContext(), reverseAction);
		if (!reverseResult.valid) {
			warnings.push(`You will not be able to unlock this lock`);
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
				warnings.push(`Deleting this item will also delete ${deletedCount} ${deletedCount > 1 ? 'items' : 'item'} stored inside (count does not include locks).`);
			}
		}
	}

	return warnings;
}
