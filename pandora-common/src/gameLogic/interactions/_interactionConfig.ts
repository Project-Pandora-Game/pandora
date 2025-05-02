import type { Immutable } from 'immer';
import type { InteractionGenericId } from './interactionData.ts';
import { PERMISSION_MAX_CHARACTER_OVERRIDES, PermissionConfigDefault, PermissionType } from '../permissions/index.ts';
import { KnownObject, ParseArrayNotEmpty } from '../../utility/misc.ts';

//#region Config for existing interactions; when adding an interaction edit only this

export const INTERACTION_CONFIG = {
	interact: {
		visibleName: 'Interact and to use other allowed permissions',
		icon: 'on-off',
		defaultPermissions: {
			allowOthers: 'prompt',
		},
		forbidDefaultAllowOthers: ['yes'],
		maxCharacterOverrides: PERMISSION_MAX_CHARACTER_OVERRIDES * 3,
	},
	modifyBody: {
		visibleName: `Modify this character's body`,
		icon: 'body',
		defaultPermissions: {
			allowOthers: 'no',
		},
	},
	changeItemColor: {
		visibleName: 'Change the color or style of worn items',
		icon: 'color',
		defaultPermissions: {
			allowOthers: 'yes',
		},
	},
	customizeItem: {
		visibleName: 'Customize worn items (such as their description)',
		icon: 'setting',
		defaultPermissions: {
			allowOthers: 'prompt',
		},
	},
	useStorageModule: {
		visibleName: 'Interact with items stored inside worn items',
		icon: 'storage',
		defaultPermissions: {
			allowOthers: 'no',
		},
	},
	useLockSlotModule: {
		visibleName: 'Change and interact with locks on worn items',
		icon: 'lock',
		defaultPermissions: {
			allowOthers: 'yes',
		},
	},
	useTypedModule: {
		visibleName: 'Change the state of worn items',
		icon: 'toggle',
		defaultPermissions: {
			allowOthers: 'yes',
		},
	},
	moveCharacter: {
		visibleName: 'Move or leash this character inside room (even as non-admin)',
		icon: 'movement',
		defaultPermissions: {
			allowOthers: 'prompt',
		},
	},
	deviceEnterLeave: {
		visibleName: 'Enter or leave a device',
		icon: 'device',
		defaultPermissions: {
			allowOthers: 'prompt',
		},
	},
	viewCharacterModifiers: {
		visibleName: 'View all added character modifiers',
		icon: 'modification-view',
		defaultPermissions: {
			allowOthers: 'prompt',
		},
	},
	modifyCharacterModifiers: {
		visibleName: 'Add, remove, or configure this character\'s modifiers',
		icon: 'modification-edit',
		defaultPermissions: {
			allowOthers: 'no',
		},
	},
	lockCharacterModifiers: {
		visibleName: 'Lock this character\'s modifiers or interact with existing locks',
		icon: 'modification-lock',
		defaultPermissions: {
			allowOthers: 'no',
		},
	},
} as const satisfies Immutable<Record<InteractionGenericId, IInteractionConfig>>;

//#endregion

export const INTERACTION_IDS = ParseArrayNotEmpty(
	KnownObject.keys(INTERACTION_CONFIG),
);
export type InteractionId = keyof typeof INTERACTION_CONFIG;

export interface IInteractionConfig {
	visibleName: string;
	icon: string;
	defaultPermissions: PermissionConfigDefault;
	forbidDefaultAllowOthers?: [PermissionType, ...PermissionType[]];
	maxCharacterOverrides?: number;
}
