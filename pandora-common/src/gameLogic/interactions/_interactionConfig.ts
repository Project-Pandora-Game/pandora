import { Immutable } from 'immer';
import { InteractionGenericId } from './interactionData';
import { PermissionConfigDefault } from '../permissions';
import { ParseArrayNotEmpty } from '../../utility';

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
	useStorageModule: {
		visibleName: 'Interact with items stored inside worn items',
		defaultPermissions: {
			allowOthers: true,
		},
	},
	useLockSlotModule: {
		visibleName: 'Change and interact with locks on worn items',
		defaultPermissions: {
			allowOthers: false,
		},
	},
	useTypedModule: {
		visibleName: 'Change the state of worn items',
		defaultPermissions: {
			allowOthers: true,
		},
	},
} as const satisfies Immutable<Record<InteractionGenericId, IInteractionConfig>>;

//#endregion

export const INTERACTION_IDS = ParseArrayNotEmpty(
	Object.keys(INTERACTION_CONFIG) as (keyof typeof INTERACTION_CONFIG)[],
);
export type InteractionId = keyof typeof INTERACTION_CONFIG;

export interface IInteractionConfig {
	visibleName: string;
	defaultPermissions: PermissionConfigDefault;
}
