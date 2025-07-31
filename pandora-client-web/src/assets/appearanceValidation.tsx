/* eslint-disable react/destructuring-assignment */
import {
	AppearanceActionProblem,
	AssertNever,
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	type AssetId,
	type GameLogicActionSlowdownReason,
	type ItemDisplayNameType,
	type LockActionProblem,
} from 'pandora-common';
import type { ReactNode } from 'react';
import { ResolveItemDisplayNameType } from '../components/wardrobe/itemDetail/wardrobeItemName.tsx';
import { DescribeAttribute } from '../ui/components/chat/chatMessages.tsx';
import { AssetManagerClient } from './assetManager.tsx';

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

function RenderLockLogicActionProblem(lockDescription: string, action: 'lock' | 'unlock' | 'showPassword' | 'updateFingerprint', problem: LockActionProblem): string {
	const actionDescription: Record<typeof action, string> = {
		lock: 'be locked',
		unlock: 'be unlocked',
		showPassword: 'have its password displayed',
		updateFingerprint: 'have its fingerprints updated',
	};

	switch (problem) {
		case 'blockSelf':
			return `The ${lockDescription} cannot ${actionDescription[action]} on yourself.`;
		case 'noStoredPassword':
			return `The ${lockDescription} cannot ${actionDescription[action]} because it has no stored password.`;
		case 'invalidPassword':
			return `The ${lockDescription} cannot ${actionDescription[action]} because the password is invalid.`;
		case 'noTimerSet':
			return `The ${lockDescription} cannot ${actionDescription[action]} because it has no timer set.`;
		case 'invalidTimer':
			return `The ${lockDescription} cannot ${actionDescription[action]} because the timer is invalid.`;
		case 'wrongPassword':
			return `The password is incorrect.`;
		case 'timerRunning':
			return `The ${lockDescription} cannot yet ${actionDescription[action]} as the timer is still running.`;
		case 'notAllowed':
			return `You are not allowed to view the password.`;
		case 'noRegisteredPrints':
			return `The ${lockDescription} cannot ${actionDescription[action]} because it has no registered fingerprints.`;
		case 'printNotRegistered':
			return `The ${lockDescription} cannot ${actionDescription[action]} because your fingerprint is not recognized.`;
		case 'tooManyPrints':
			return `The ${lockDescription} cannot ${actionDescription[action]} as all slots are full.`;
	}

	AssertNever(problem);
}

export function RenderAppearanceActionProblem(assetManager: AssetManagerClient, result: AppearanceActionProblem, itemDisplayNameType: ItemDisplayNameType): ReactNode {
	const describeItem = (asset: AssetId, itemName: string | null) => ResolveItemDisplayNameType(
		assetManager.getAssetById(asset)?.definition.name.toLocaleLowerCase() ?? `[UNKNOWN ASSET '${asset}']`,
		itemName,
		itemDisplayNameType,
	);

	if (result.result === 'invalidAction') {
		if (result.reason != null) {
			switch (result.reason) {
				case 'noDeleteRoomDeviceWearable':
					return `You cannot delete manifestation of a room device. Use the device's menu to exit it instead.`;
				case 'noDeleteDeployedRoomDevice':
					return `You cannot delete a deployed room device. Use the device's menu to store it first.`;
				case 'noDeleteOccupiedRoom':
					return `You cannot delete a room with characters inside it.`;
				case 'characterMoveCannotFollowTarget':
					return `The target character cannot be followed. Only characters in a room that are not following someone can be followed.`;
			}
			AssertNever(result.reason);
		}
		return '';
	} else if (result.result === 'moduleActionError') {
		const e = result.reason;
		switch (e.type) {
			case 'lockInteractionPrevented':
				return RenderLockLogicActionProblem(describeItem(e.asset, e.itemName), e.moduleAction, e.reason);
			case 'invalid':
				return '';
			default:
				AssertNever(e);
		}
	} else if (result.result === 'characterModifierActionError') {
		const e = result.reason;
		switch (e.type) {
			case 'lockInteractionPrevented':
				return RenderLockLogicActionProblem('lock on the modifier', e.moduleAction, e.reason);
			default:
				AssertNever(e.type);
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
			case 'blockedMove':
				return `An item or character modifier is preventing you from moving.`;
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
			case 'tooFar':
				switch (e.subtype) {
					case 'characterInteraction':
						return `The target character is too far for you to interact with them.`;
					case 'roomTarget':
						return `The target room is too far.`;
					case 'followTarget':
						return `The follow target is too far.`;
				}
				AssertNever(e.subtype);
				break;
			case 'blockedByCharacterModifier':
				return `Character modifier "${CHARACTER_MODIFIER_TYPE_DEFINITION[e.modifierType].visibleName}" is preventing this action.`;
			case 'characterModifierLocked':
				return `Character modifier "${e.modifierName}" modifier is locked.`;
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
					if (negative) {
						return `The ${describeItem(e.asset, e.itemName)} conflicts with "${description}" (must not be worn under the ${describeItem(e.asset, e.itemName)}).`;
					} else {
						return (
							<>
								The { describeItem(e.asset, e.itemName) } requires "{ description }" (must be worn under the { describeItem(e.asset, e.itemName) }).<br />
								The following assets can be used to satisfy this requirement (in at least one configuration):
								<ul>
									{ assetManager.assetList
										.filter((a) => a.isWearable())
										.filter((a) => a.staticAttributes.has(attributeName))
										.map((a) => <li key={ a.id }>{ a.definition.name }</li>) }
								</ul>
							</>
						);
					}
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
			case 'invalidText':
				return `The text is not valid.`;
			case 'canOnlyBeInOneDevice':
				return `Character can only be in a single device at a time.`;
			case 'tooManyRooms':
				return `The space can contain at most ${e.limit} rooms.`;
			case 'roomError':
				switch (e.problemDetail) {
					case 'roomsOverlap':
						return `Rooms cannot overlap (a single space tile cannot contain multiple rooms).`;
					case 'invalidPosition':
						return `Room's position is not valid (most likely too large or too small)`;
					default:
						AssertNever(e);
				}
				break;
			case 'invalid':
				return `This action results in a generally invalid state.`;
		}
		AssertNever(e);
	} else if (result.result === 'attemptRequired') {
		return 'This action requires starting an attempt to perform it first.';
	} else if (result.result === 'tooSoon') {
		return 'This action cannot be performed yet. Try again later.';
	}
	AssertNever(result);
}

export function RenderAppearanceActionSlowdown(reason: GameLogicActionSlowdownReason): string {
	switch (reason) {
		case 'blockedHands':
			return 'You need to be able to use hands to do this freely, but yours are bound.';
		case 'modifierSlowdown':
			return 'Character modifiers are affecting this action.';
	}

	AssertNever(reason);
}
