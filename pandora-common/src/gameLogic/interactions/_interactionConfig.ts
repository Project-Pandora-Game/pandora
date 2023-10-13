import { Immutable } from 'immer';
import { InteractionGenericId } from './interactionData';
import { PermissionConfigDefault } from '../permissions';
import { ParseArrayNotEmpty } from '../../utility';

//#region Config for existing interactions; when adding an interaction edit only this

export const INTERACTION_CONFIG = {
	interact: {
		visibleName: 'Any interaction',
		defaultPermissions: {
			allowOthers: true,
		},
	},
	modifyBody: {
		visibleName: 'Modify Character\'s body',
		defaultPermissions: {
			allowOthers: false,
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
