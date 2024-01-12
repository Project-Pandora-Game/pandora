import { Immutable } from 'immer';
import { InteractionGenericId } from './interactionData';
import { PermissionConfigDefault } from '../permissions';
import { KnownObject, ParseArrayNotEmpty } from '../../utility';

//#region Config for existing interactions; when adding an interaction edit only this

export const INTERACTION_CONFIG = {
	interact: {
		visibleName: 'Interact with this character',
		defaultPermissions: {
			allowOthers: true,
		},
	},
	modifyBody: {
		visibleName: `Modify this character's body`,
		defaultPermissions: {
			allowOthers: false,
		},
	},
	changeItemColor: {
		visibleName: "Modify an item's color on this character",
		defaultPermissions: {
			allowOthers: false,
		},
	},
	useStorageModule: {
		visibleName: 'Interact with items stored inside worn items',
		defaultPermissions: {
			allowOthers: false,
		},
	},
	useLockSlotModule: {
		visibleName: 'Change and interact with locks on worn items',
		defaultPermissions: {
			allowOthers: true,
		},
	},
	useTypedModule: {
		visibleName: 'Change the state of worn items',
		defaultPermissions: {
			allowOthers: true,
		},
	},
	assetPrefFavorite: {
		visibleName: 'Add and remove assets with favorite preference',
		defaultPermissions: {
			allowOthers: true,
		},
	},
	assetPrefNormal: {
		visibleName: 'Add and remove assets with normal preference',
		defaultPermissions: {
			allowOthers: true,
		},
	},
	assetPrefMaybe: {
		visibleName: 'Add and remove assets with maybe preference',
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
	defaultPermissions: PermissionConfigDefault;
}
