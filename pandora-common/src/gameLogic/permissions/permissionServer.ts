import _, { cloneDeep } from 'lodash';
import { GameLogicCharacter } from '../character/character';
import { PermissionConfig, PermissionSetup } from './permissionData';
import { Immutable } from 'immer';
import { GameLogicPermission, MakePermissionConfigFromDefault } from './permission';

export class GameLogicPermissionServer extends GameLogicPermission {
	/**
	 * The current config. `null` means use default.
	 */
	private _config: PermissionConfig | null;

	constructor(character: GameLogicCharacter, setup: Immutable<PermissionSetup>, config: PermissionConfig | null) {
		super(character, setup);
		this._config = _.cloneDeep(config);
	}

	public override checkPermission(actingCharacter: GameLogicCharacter): boolean {
		if (actingCharacter.id === this.character.id)
			return true;

		const config = this.getEffectiveConfig();

		if (config.allowOthers)
			return true;

		return false;
	}

	public getConfig(): PermissionConfig | null {
		return _.cloneDeep(this._config);
	}

	public getEffectiveConfig(): PermissionConfig {
		if (this._config == null)
			return MakePermissionConfigFromDefault(this.defaultConfig);

		return this._config;
	}

	public setConfig(newConfig: PermissionConfig | null): void {
		this._config = cloneDeep(newConfig);
		this.emit('configChanged', undefined);
	}
}
