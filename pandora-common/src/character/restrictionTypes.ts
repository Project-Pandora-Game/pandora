import type { AssetId } from '../assets/base';
import type { CharacterModifierId, CharacterModifierType, PermissionGroup, PermissionTypeInvalid } from '../gameLogic';
import type { AssetPreferenceResolution } from './assetPreferences';
import type { CharacterId } from './characterTypes';

export enum ItemInteractionType {
	/**
	 * Special interaction that doesn't have prerequisites from the character itself.
	 */
	ACCESS_ONLY = 'ACCESS_ONLY',
	/**
	 * Special interaction for changing expression
	 */
	EXPRESSION_CHANGE = 'EXPRESSION_CHANGE',
	/**
	 * Item modified only in stylistic way (e.g. color)
	 */
	STYLING = 'STYLING',
	/**
	 * Item being modified (e.g. changing its behavior or configuration)
	 */
	MODIFY = 'MODIFY',
	/**
	 * Item modified by changing its name, description, or other create-time properties
	 */
	CUSTOMIZE = 'CUSTOMIZE',
	/**
	 * Item being added or removed.
	 */
	ADD_REMOVE = 'ADD_REMOVE',
	/**
	 * Item being reordered.
	 */
	REORDER = 'REORDER',
	/**
	 * Character is entering or leaving a room device.
	 * This action happens on _both_ the device itself and the wearable part.
	 */
	DEVICE_ENTER_LEAVE = 'DEVICE_ENTER_LEAVE',
}

export type PermissionRestriction = {
	type: 'missingPermission';
	target: CharacterId;
	permissionGroup: PermissionGroup;
	permissionId: string;
	permissionDescription: string;
	permissionResult: PermissionTypeInvalid;
};

export type Restriction =
	| PermissionRestriction
	| {
		type: 'missingAssetPermission';
		target: CharacterId;
		resolution: AssetPreferenceResolution;
	}
	| {
		type: 'blockedAddRemove';
		asset: AssetId;
		itemName: string;
		self: boolean;
	}
	| {
		type: 'blockedModule';
		asset: AssetId;
		itemName: string;
		module: string;
		self: boolean;
	}
	| {
		type: 'covered';
		asset: AssetId;
		itemName: string;
		attribute: string;
	}
	| {
		type: 'blockedHands';
	}
	| {
		type: 'safemodeInteractOther';
	}
	| {
		type: 'modifyBodyRoom';
	}
	| {
		type: 'modifyRoomRestriction';
		reason: 'notAdmin';
	}
	| {
		type: 'itemCustomizeOther';
	}
	| {
		type: 'inRoomDevice';
	}
	| {
		type: 'blockedByCharacterModifier';
		modifierId: CharacterModifierId;
		modifierType: CharacterModifierType;
	}
	| {
		type: 'characterModifierLocked'; // The modifier is protected by a locked lock
		modifierId: CharacterModifierId;
		modifierType: CharacterModifierType;
	}
	// Generic catch-all problem, supposed to be used when something simply went wrong (like bad data, target not found, and so on...)
	| {
		type: 'invalid';
	};
