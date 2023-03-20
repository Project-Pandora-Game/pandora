import { AppearanceActionResult, AssertNever } from 'pandora-common';
import { DescribeAsset, DescribeAssetSlot } from '../components/gameContext/chatRoomContextProvider';
import { AssetManagerClient } from './assetManager';

/** Returns if the button to do the action should be straight out hidden instead of only disabled */
export function AppearanceActionResultShouldHide(result: AppearanceActionResult): boolean {
	if (result.result === 'invalidAction')
		return true;

	if (
		result.result === 'validationError' &&
		result.validationError.problem === 'bodypartError' &&
		result.validationError.problemDetail === 'incorrectOrder'
	)
		return true;

	return false;
}

export function RenderAppearanceActionResult(assetManager: AssetManagerClient, result: AppearanceActionResult): string {
	if (result.result === 'success') {
		return 'No problem.';
	} else if (result.result === 'invalidAction') {
		return `This action creates invalid state.`;
	} else if (result.result === 'restrictionError') {
		const e = result.restriction;
		switch (e.type) {
			case 'permission':
				switch (e.missingPermission) {
					case 'modifyBodyOthers':
						return `You cannot modify body of other characters.`;
					case 'modifyBodyRoom':
						return `You cannot modify body in this room.`;
					case 'safemodeInteractOther':
						return `You cannot touch others while either you or they are in safemode.`;
				}
				break;
			case 'blockedAddRemove':
				return `The ${DescribeAsset(assetManager, e.asset)} cannot be added or removed${e.self ? ' on yourself' : ''}.`;
			case 'blockedModule': {
				const visibleModuleName = assetManager.getAssetById(e.asset)?.definition.modules?.[e.module]?.name ?? `[UNKNOWN MODULE '${e.module}']`;
				return `The ${DescribeAsset(assetManager, e.asset)}'s ${visibleModuleName} cannot be modified${e.self ? ' on yourself' : ''}.`;
			}
			case 'blockedSlot':
				return `The ${DescribeAsset(assetManager, e.asset)} cannot be added, removed, or modified, because ${DescribeAssetSlot(assetManager, e.slot)} is covered by another item.`;
			case 'blockedHands':
				return `You need to be able to use hands to do this.`;
			case 'invalid':
				return `The action is invalid.`;
		}
		AssertNever(e);
	} else if (result.result === 'validationError') {
		const e = result.validationError;
		switch (e.problem) {
			case 'bodypartError':
				switch (e.problemDetail) {
					case 'incorrectOrder':
						return `Bodyparts must be in a specific order.`;
					case 'multipleNotAllowed':
						return `Some bodyparts can only be equipped once.`;
					case 'missingRequired':
						return `Some bodyparts can only be replaced, not removed.`;
				}
				break;
			case 'unsatisfiedRequirement': {
				const negative = e.requirement.startsWith('!');
				const attributeName = negative ? e.requirement.substring(1) : e.requirement;
				const attribute = assetManager.getAttributeDefinition(attributeName);
				const description = attribute ? `"${attribute.description}"` : `[UNKNOWN ATTRIBUTE '${attributeName}']`;
				if (e.asset) {
					return `The ${DescribeAsset(assetManager, e.asset)} ${negative ? 'conflicts with' : 'requires'} ${description}.`;
				} else {
					return `The item ${negative ? 'must not' : 'must'} be ${description}.`;
				}
			}
			case 'poseConflict':
				return `This item requires a pose conflicting with the added items.`;
			case 'tooManyItems':
				return e.asset ?
					`At most ${e.limit} "${DescribeAsset(assetManager, e.asset)}" can be equipped.` :
					`At most ${e.limit} items can be present.`;
			case 'contentNotAllowed':
				return `The ${DescribeAsset(assetManager, e.asset)} cannot be used in that way.`;
			case 'slotFull':
				return `${DescribeAssetSlot(assetManager, e.slot)} doesn't have enough space to fit ${DescribeAsset(assetManager, e.asset)}.`;
			case 'slotBlockedOrder':
				return `The ${DescribeAsset(assetManager, e.asset)} cannot be worn on top of an item that is blocking ${DescribeAssetSlot(assetManager, e.slot)}.`;
			case 'invalid':
				return `The action results in a generally invalid state.`;
		}
		AssertNever(e);
	}
	AssertNever(result.result);
}
