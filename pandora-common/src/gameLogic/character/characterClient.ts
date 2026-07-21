import type { Immutable } from 'immer';
import * as z from 'zod';
import { AccountOnlineStatusSchema, type AccountOnlineStatus } from '../../account/contacts.ts';
import { AssetPreferencesPublicSchema, type AssetPreferencesPublic } from '../../character/assetPreferences.ts';
import { CharacterPublicDataSchema, type ICharacterPublicData } from '../../character/characterData.ts';
import { CharacterPublicSettingsSchema, type CharacterPublicSettings } from '../../character/characterSettings.ts';
import type { Logger } from '../../logging/logger.ts';
import { AssertNever } from '../../utility/misc.ts';
import type { ZodObjectShape } from '../../validation.ts';
import { AssetPreferencesSubsystemClient } from '../assetPreferences/index.ts';
import { CharacterModifiersSubsystemClient } from '../characterModifiers/characterModifiersSubsystemClient.ts';
import { InteractionSubsystemClient } from '../interactions/interactionSubsystemClient.ts';
import { GameLogicPermissionClient, IPermissionProvider, PermissionGroup } from '../permissions/index.ts';
import { GameLogicCharacter } from './character.ts';

export interface ICharacterRoomData extends ICharacterPublicData {
	accountDisplayName: string;
	assetPreferences: AssetPreferencesPublic;
	publicSettings: Partial<CharacterPublicSettings>;
	onlineStatus: AccountOnlineStatus;
}
export const CharacterRoomDataSchema: z.ZodObject<ZodObjectShape<ICharacterRoomData>> = CharacterPublicDataSchema.extend({
	accountDisplayName: z.string(),
	assetPreferences: AssetPreferencesPublicSchema,
	publicSettings: CharacterPublicSettingsSchema.partial(),
	onlineStatus: AccountOnlineStatusSchema,
});
export const CharacterRoomDataDeltaSchema: z.ZodType<Partial<ICharacterRoomData>> = CharacterRoomDataSchema.partial();

export class GameLogicCharacterClient extends GameLogicCharacter {
	public readonly _dataGetter: () => Immutable<ICharacterRoomData>;

	public override readonly interactions: InteractionSubsystemClient;
	public override readonly assetPreferences: AssetPreferencesSubsystemClient;
	public override readonly characterModifiers: CharacterModifiersSubsystemClient;

	constructor(dataGetter: (() => Immutable<ICharacterRoomData>), _logger: Logger) {
		super(dataGetter());
		this._dataGetter = dataGetter;
		this.interactions = new InteractionSubsystemClient(this);
		this.assetPreferences = new AssetPreferencesSubsystemClient(this);
		this.characterModifiers = new CharacterModifiersSubsystemClient(this);
	}

	protected override _getPermissionProvider(permissionGroup: PermissionGroup): IPermissionProvider<GameLogicPermissionClient> {
		switch (permissionGroup) {
			case 'assetPreferences':
				return this.assetPreferences;
			case 'interaction':
				return this.interactions;
			case 'characterModifierType':
				return this.characterModifiers;
			default:
				AssertNever(permissionGroup);
		}
	}

	public override getPermission(permissionGroup: PermissionGroup, permissionId: string): GameLogicPermissionClient | null {
		return this._getPermissionProvider(permissionGroup)
			.getPermission(permissionId);
	}
}
