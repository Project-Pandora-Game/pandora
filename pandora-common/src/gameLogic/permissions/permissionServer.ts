import { cloneDeep } from 'lodash';
import type { GameLogicCharacter } from '../character/character';
import type { PermissionConfig, PermissionSetup, PermissionType } from './permissionData';
import type { Immutable } from 'immer';
import { GameLogicPermission, MakePermissionConfigFromDefault } from './permission';

export class GameLogicPermissionServer extends GameLogicPermission {
	/**
	 * The current config. `null` means use default.
	 */
	private _config: PermissionConfig | null;

	constructor(character: GameLogicCharacter, setup: Immutable<PermissionSetup>, config: PermissionConfig | null) {
		super(character, setup);
		this._config = cloneDeep(config);
	}

	public override checkPermission(actingCharacter: GameLogicCharacter): PermissionType {
		if (actingCharacter.id === this.character.id)
			return 'yes';

		const config = this.getEffectiveConfig();

		return config.allowOthers;
	}

	public getConfig(): PermissionConfig | null {
		return cloneDeep(this._config);
	}

	public getEffectiveConfig(): PermissionConfig {
		if (this._config == null)
			return MakePermissionConfigFromDefault(this.defaultConfig);

		return this._config;
	}

	public setConfig(newConfig: PermissionConfig | null): boolean {
		if (newConfig?.allowOthers != null && this.forbidDefaultAllowOthers?.includes(newConfig.allowOthers)) {
			return false;
		}

		this._config = cloneDeep(newConfig);
		this.emit('configChanged', undefined);

		return true;
	}
}
