import { Immutable } from 'immer';
import { InteractionGenericId } from './interactionData';
import { PermissionConfigDefault } from '../permissions';
import { KnownObject, ParseArrayNotEmpty } from '../../utility';

//#region Config for existing interactions; when adding an interaction edit only this

export const INTERACTION_CONFIG = {
	interact: {
		visibleName: 'Interact with this character',
		icon: 'on-off',
		defaultPermissions: {
			allowOthers: true,
		},
	},
	modifyBody: {
		visibleName: `Modify this character's body`,
		icon: 'body',
		defaultPermissions: {
			allowOthers: false,
		},
	},
	changeItemColor: {
		visibleName: 'Change the color or style of worn items',
		icon: 'color',
		defaultPermissions: {
			allowOthers: true,
		},
	},
	useStorageModule: {
		visibleName: 'Interact with items stored inside worn items',
		icon: 'storage',
		defaultPermissions: {
			allowOthers: false,
		},
	},
	useLockSlotModule: {
		visibleName: 'Change and interact with locks on worn items',
		icon: 'lock',
		defaultPermissions: {
			allowOthers: true,
		},
	},
	useTypedModule: {
		visibleName: 'Change the state of worn items',
		icon: 'toggle',
		defaultPermissions: {
			allowOthers: true,
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
}
