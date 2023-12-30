import { AppearanceActionProblem, AssertNever } from 'pandora-common';
import { DescribeAsset, DescribeAttribute } from '../components/chatroom/chatroomMessages';
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

export function RenderAppearanceActionProblem(assetManager: AssetManagerClient, result: AppearanceActionProblem): string {
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
						return `The ${DescribeAsset(assetManager, e.asset)} cannot be ${actionDescription[e.moduleAction]} on yourself.`;
					case 'noStoredPassword':
						return `The ${DescribeAsset(assetManager, e.asset)} cannot be ${actionDescription[e.moduleAction]} because it has no stored password.`;
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
				return `The ${DescribeAsset(assetManager, e.asset)} cannot be added or removed${e.self ? ' on yourself' : ''}.`;
			case 'blockedModule': {
				const asset = assetManager.getAssetById(e.asset);
				const visibleModuleName: string =
					(asset?.isType('personal') && asset.definition.modules?.[e.module]?.name) ||
					(asset?.isType('roomDevice') && asset.definition.modules?.[e.module]?.name) ||
					`[UNKNOWN MODULE '${e.module}']`;
				return `The ${DescribeAsset(assetManager, e.asset)}'s ${visibleModuleName} cannot be modified${e.self ? ' on yourself' : ''}.`;
			}
			case 'covered':
				return `The ${DescribeAsset(assetManager, e.asset)} cannot be added, removed, or modified, because "${DescribeAttribute(assetManager, e.attribute)}" is covered by another item.`;
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
					case 'missingConstructionTools':
						return `You must be holding 'Room Construction Tools' to do this.`;
				}
				break;
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
					return `The ${DescribeAsset(assetManager, e.asset)} ${negative ? 'conflicts with' : 'requires'} "${description}" (${negative ? 'must not' : 'must'} be worn under the ${DescribeAsset(assetManager, e.asset)}).`;
				} else {
					return `The item ${negative ? 'must not' : 'must'} be "${description}".`;
				}
			}
			case 'invalidState': {
				if (e.asset) {
					return `The ${DescribeAsset(assetManager, e.asset)} is in an invalid state:\n${e.reason}`;
				} else {
					return e.reason;
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
			case 'canOnlyBeInOneDevice':
				return `Character can only be in a single device at a time.`;
			case 'deviceOccupied':
				return `The ${DescribeAsset(assetManager, e.asset)} is occupied.`;
			case 'invalid':
				return `The action results in a generally invalid state.`;
		}
		AssertNever(e);
	} else if (result.result === 'failure') {
		const f = result.failure;
		if (f.type === 'moduleActionFailure') {
			if (f.reason.type === 'lockInteractionPrevented') {
				if (f.reason.reason === 'wrongPassword') {
					return `The password is incorrect.`;
				}
				AssertNever(f.reason.reason);
			}
			AssertNever(f.reason.type);
		}
		AssertNever(f.type);
	}
	AssertNever(result);
}
