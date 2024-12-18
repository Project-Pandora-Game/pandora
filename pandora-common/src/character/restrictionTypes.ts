import type { AssetId } from '../assets/base';
import type { PermissionGroup, PermissionTypeInvalid } from '../gameLogic';
import type { AssetPreferenceResolution } from './assetPreferences';
import type { CharacterId } from './characterTypes';

export enum ItemInteractionType {
	/**
	 * Special interaction that doesn't have prerequisites from the character itself.
	 *
	 * Requirements:
	 * - Player can interact with character (handling things like permissions and safeword state)
	 * - Player can use the asset of this item on character (blocked/limited items check)
	 */
	ACCESS_ONLY = 'ACCESS_ONLY',
	/**
	 * Special interaction for changing expression
	 *
	 * Requirements:
	 * - Requires all `ACCESS_ONLY` requirements
	 * - If asset __is__ bodypart:
	 *   - Must be targetting herself
	 * - If asset __is not__ bodypart this action is invalid (never allowed)
	 */
	EXPRESSION_CHANGE = 'EXPRESSION_CHANGE',
	/**
	 * Item modified only in stylistic way (e.g. color)
	 *
	 * Requirements:
	 * - Requires all `ACCESS_ONLY` requirements
	 * - If asset __is__ bodypart:
	 *   - Must not be in room or the room must allow body modification
	 *   - Must be targetting herself
	 * - If asset __is not__ bodypart:
	 *   - Player must be able to use hands
	 */
	STYLING = 'STYLING',
	/**
	 * Item being modified (e.g. changing its behavior or configuration)
	 *
	 * Requirements:
	 * - Requires all `ACCESS_ONLY` requirements
	 * - If asset __is__ bodypart:
	 *   - Must not be in room or the room must allow body modification
	 *   - Must be targetting herself
	 * - If asset __is not__ bodypart:
	 *   - Player must be able to use hands
	 */
	MODIFY = 'MODIFY',
	/**
	 * Item being added or removed.
	 *
	 * Requirements:
	 * - Requires all `ACCESS_ONLY` requirements
	 * - If asset __is__ bodypart:
	 *   - Must not be in room or the room must allow body modification
	 *   - Must be targetting herself
	 * - If asset __is not__ bodypart:
	 *   - Player must be able to use hands
	 *   - If asset has `blockAddRemove`, then denied
	 *   - If asset has `blockSelfAddRemove`, then cannot happen on self
	 */
	ADD_REMOVE = 'ADD_REMOVE',
	/**
	 * Item being reordered.
	 *
	 * Requirements:
	 * - Requires all `ACCESS_ONLY` requirements
	 * - If asset __is__ bodypart:
	 *   - Must not be in room or the room must allow body modification
	 *   - Must be targetting herself
	 * - If asset __is not__ bodypart:
	 *   - Player must be able to use hands
	 */
	REORDER = 'REORDER',
	/**
	 * Character is entering or leaving a room device.
	 * This action happens on _both_ the device itself and the wearable part.
	 *
	 * Requirements:
	 * - Requires all `ACCESS_ONLY` requirements
	 * - Asset is room device or its wearable part
	 * - If item has `blockAddRemove`, then denied
	 * - If item has `blockSelfAddRemove`, then cannot happen on self
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
	// Generic catch-all problem, supposed to be used when something simply went wrong (like bad data, target not found, and so on...)
	| {
		type: 'invalid';
	};
