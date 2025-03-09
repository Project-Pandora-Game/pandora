import { AppearanceActionProblem, AssertNever, type AssetId, type GameLogicActionSlowdownReason, type ItemDisplayNameType } from 'pandora-common';
import { ResolveItemDisplayNameType } from '../components/wardrobe/itemDetail/wardrobeItemName';
import { DescribeAsset, DescribeAttribute } from '../ui/components/chat/chatMessages';
import { AssetManagerClient } from './assetManager';

/** Returns if the button to do the action should be straight out hidden instead of only disabled */
export function AppearanceActionProblemShouldHide(result: AppearanceActionProblem): boolean {
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

export function RenderAppearanceActionProblem(assetManager: AssetManagerClient, result: AppearanceActionProblem, itemDisplayNameType: ItemDisplayNameType): string {
	const describeItem = (asset: AssetId, itemName: string | null) => ResolveItemDisplayNameType(DescribeAsset(assetManager, asset), itemName, itemDisplayNameType);

	if (result.result === 'invalidAction') {
		if (result.reason != null) {
			switch (result.reason) {
				case 'noDeleteRoomDeviceWearable':
					return `You cannot delete manifestation of a room device. Use the device's menu to exit it instead.`;
				case 'noDeleteDeployedRoomDevice':
					return `You cannot delete a deployed room device. Use the device's menu to store it first.`;
			}
			AssertNever(result.reason);
		}
		return '';
	} else if (result.result === 'moduleActionError') {
		const e = result.reason;
		switch (e.type) {
			case 'lockInteractionPrevented': {
				const actionDescription: Record<typeof e.moduleAction, string> = {
					lock: 'locked',
					unlock: 'unlocked',
				};

				switch (e.reason) {
					case 'blockSelf':
						return `The ${describeItem(e.asset, e.itemName)} cannot be ${actionDescription[e.moduleAction]} on yourself.`;
					case 'noStoredPassword':
						return `The ${describeItem(e.asset, e.itemName)} cannot be ${actionDescription[e.moduleAction]} because it has no stored password.`;
					case 'noTimerSet':
						return `The ${describeItem(e.asset, e.itemName)} cannot be ${actionDescription[e.moduleAction]} because it has no timer set.`;
					case 'invalidTimer':
						return `The ${describeItem(e.asset, e.itemName)} cannot be ${actionDescription[e.moduleAction]} because the timer is invalid.`;
				}

				AssertNever(e);
				break;
			}
			case 'invalid':
				return '';
			default:
				AssertNever(e);
		}
	} else if (result.result === 'restrictionError') {
		const e = result.restriction;
		switch (e.type) {
			case 'missingPermission':
				return `You are missing permission to:\n${e.permissionDescription}`;
			case 'missingAssetPermission':
				// Original: This asset is blocked by character preference.
				if (e.resolution.type === 'asset') {
					return `You are missing permission to use this item on this character.\nThis item is blocked.`;
				} else if (e.resolution.type === 'attribute') {
					return `You are missing permission to use this item on this character.\nThe item cannot be used, because "${DescribeAttribute(assetManager, e.resolution.attribute)}" is blocked.`;
				}
				AssertNever(e.resolution);
				break;
			case 'blockedAddRemove':
				return `The ${describeItem(e.asset, e.itemName)} cannot be added or removed${e.self ? ' on yourself' : ''}.`;
			case 'blockedModule': {
				const asset = assetManager.getAssetById(e.asset);
				const visibleModuleName: string =
					(asset?.isType('bodypart') && asset.definition.modules?.[e.module]?.name) ||
					(asset?.isType('personal') && asset.definition.modules?.[e.module]?.name) ||
					(asset?.isType('roomDevice') && asset.definition.modules?.[e.module]?.name) ||
					`[UNKNOWN MODULE '${e.module}']`;
				return `The ${describeItem(e.asset, e.itemName)}'s ${visibleModuleName} cannot be modified${e.self ? ' on yourself' : ''}.`;
			}
			case 'covered':
				return `The ${describeItem(e.asset, e.itemName)} cannot be added, removed, or modified, because "${DescribeAttribute(assetManager, e.attribute)}" is covered by another item.`;
			case 'blockedHands':
				return `You need to be able to use hands to do this.`;
			case 'safemodeInteractOther':
				return `You cannot touch others while either you or they are in safemode or timeout mode.`;
			case 'modifyBodyRoom':
				return `You cannot modify body in this room.`;
			case 'modifyRoomRestriction':
				switch (e.reason) {
					case 'notAdmin':
						return `You must be a room admin or a room owner to do this.`;
				}
				break;
			case 'itemCustomizeOther':
				return `You cannot customize other people's items.`;
			case 'inRoomDevice':
				return `You cannot do this while in a room device.`;
			case 'invalid':
				return '';
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
				const description = DescribeAttribute(assetManager, attributeName);
				if (e.asset) {
					return `The ${describeItem(e.asset, e.itemName)} ${negative ? 'conflicts with' : 'requires'} "${description}" (${negative ? 'must not' : 'must'} be worn under the ${describeItem(e.asset, e.itemName)}).`;
				} else {
					return `The item ${negative ? 'must not' : 'must'} be "${description}".`;
				}
			}
			case 'invalidState': {
				if (e.asset) {
					return `The ${describeItem(e.asset, e.itemName)} would be in an invalid state:\n${e.reason}`;
				} else {
					return e.reason;
				}
			}
			case 'poseConflict':
				return `This item would require a pose conflicting with the added items.`;
			case 'tooManyItems':
				return e.asset ?
					`At most ${e.limit} "${describeItem(e.asset, e.itemName)}" can be equipped.` :
					`At most ${e.limit} items can be present.`;
			case 'contentNotAllowed':
				return `The ${describeItem(e.asset, e.itemName)} cannot be used in that way.`;
			case 'canOnlyBeInOneDevice':
				return `Character can only be in a single device at a time.`;
			case 'invalid':
				return `This action results in a generally invalid state.`;
		}
		AssertNever(e);
	} else if (result.result === 'attemptRequired') {
		return 'This action requires starting an attempt to perform it first.';
	} else if (result.result === 'tooSoon') {
		return 'This action cannot be performed yet. Try again later.';
	} else if (result.result === 'failure') {
		const f = result.failure;
		if (f.type === 'moduleActionFailure') {
			if (f.reason.type === 'lockInteractionPrevented') {
				switch (f.reason.reason) {
					case 'wrongPassword':
						return `The password is incorrect.`;
					case 'timerRunning':
						return `The lock cannot be unlocked yet.`;
					case 'notAllowed':
						return `You are not allowed to view the password.`;
				}
				AssertNever(f.reason);
			}
			AssertNever(f.reason.type);
		}
		AssertNever(f.type);
	}
	AssertNever(result);
}

export function RenderAppearanceActionSlowdown(reason: GameLogicActionSlowdownReason): string {
	switch (reason) {
		case 'blockedHands':
			return 'You need to be able to use hands to do this freely, but yours are bound.';
	}

	AssertNever(reason);
}
