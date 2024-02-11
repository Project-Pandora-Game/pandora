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
	 * Item being added, removed or reordered.
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
		self: boolean;
	}
	| {
		type: 'blockedModule';
		asset: AssetId;
		module: string;
		self: boolean;
	}
	| {
		type: 'covered';
		asset: AssetId;
		attribute: string;
	}
	| {
		type: 'blockedHands';
	}
	| {
		type: 'moveCharacterRestriction';
		reason: 'movementBlocked' | 'notAdmin';
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
	// Generic catch-all problem, supposed to be used when something simply went wrong (like bad data, target not found, and so on...)
	| {
		type: 'invalid';
	};

export type RestrictionResult = {
	allowed: true;
} | {
	allowed: false;
	restriction: Restriction;
};

