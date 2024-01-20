import { cloneDeep } from 'lodash';
import type { GameLogicCharacter } from '../character/character';
import type { PermissionConfig, PermissionSetup, PermissionType, PermissionConfigChange } from './permissionData';
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
		const characterOverride = config.characterOverrides[actingCharacter.id];
		if (characterOverride != null)
			return characterOverride;

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

	public setConfig(newConfig: PermissionConfigChange): boolean {
		if (newConfig == null) {
			if (this._config == null)
				return true;

			this._config = null;
			this.emit('configChanged', undefined);
			return true;
		}

		const next = this.getConfig() ?? MakePermissionConfigFromDefault(this.defaultConfig);

		const { selector, allowOthers } = newConfig;
		if (selector === 'default') {
			if (allowOthers == null) {
				next.allowOthers = this.defaultConfig.allowOthers;
			} else if (this.forbidDefaultAllowOthers?.includes(allowOthers)) {
				return false;
			} else if (allowOthers === null) {
				next.allowOthers = allowOthers;
			}
		} else {
			if (next.characterOverrides[selector] == null) {
				if (allowOthers != null) {
					next.characterOverrides[selector] = allowOthers;
				}
			} else if (allowOthers == null) {
				delete next.characterOverrides[selector];
			} else {
				next.characterOverrides[selector] = allowOthers;
			}
		}

		if (next.allowOthers === this.defaultConfig.allowOthers && Object.keys(next.characterOverrides).length === 0) {
			return this.setConfig(null);
		}

		this._config = next;

		this.emit('configChanged', undefined);

		return true;
	}
}
