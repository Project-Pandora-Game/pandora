import type { Immutable } from 'immer';
import { cloneDeep } from 'lodash-es';
import { KnownObject } from '../../utility/misc.ts';
import type { GameLogicCharacter } from '../character/character.ts';
import { GameLogicPermission, MakePermissionConfigFromDefault } from './permission.ts';
import type { PermissionConfig, PermissionConfigChange, PermissionSetup, PermissionType } from './permissionData.ts';

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

	public setConfig(newConfig: PermissionConfigChange): 'ok' | 'invalidConfig' | 'tooManyOverrides' {
		if (newConfig == null) {
			if (this._config == null)
				return 'ok';

			this._config = null;
			this.emit('configChanged', undefined);
			return 'ok';
		}

		const next = this.getConfig() ?? MakePermissionConfigFromDefault(this.defaultConfig);
		let checkOverrideCount = false;

		const { selector, allowOthers } = newConfig;
		if (selector === 'default') {
			if (allowOthers === 'accept') {
				return 'invalidConfig';
			}
			if (allowOthers == null) {
				next.allowOthers = this.defaultConfig.allowOthers;
			} else if (this.forbidDefaultAllowOthers?.includes(allowOthers)) {
				return 'invalidConfig';
			} else {
				next.allowOthers = allowOthers;
			}
		} else if (selector === 'clearOverridesWith') {
			if (allowOthers == null) {
				next.characterOverrides = {};
			} else {
				next.characterOverrides = KnownObject.fromEntries(KnownObject.entries(next.characterOverrides)
					.filter(([_, value]) => value != null && value as unknown !== allowOthers));
			}
		} else {
			if (allowOthers === 'accept') {
				if (next.allowOthers !== 'prompt' && next.characterOverrides[selector] !== 'prompt') {
					return 'ok';
				}
				next.characterOverrides[selector] = 'yes';
				checkOverrideCount = true;
			} else if (next.characterOverrides[selector] == null) {
				if (allowOthers != null) {
					next.characterOverrides[selector] = allowOthers;
				}
			} else if (allowOthers == null) {
				delete next.characterOverrides[selector];
			} else {
				next.characterOverrides[selector] = allowOthers;
				checkOverrideCount = true;
			}
		}

		if (next.allowOthers === this.defaultConfig.allowOthers && Object.keys(next.characterOverrides).length === 0) {
			return this.setConfig(null);
		}

		if (checkOverrideCount && Object.keys(next.characterOverrides).length > this.maxCharacterOverrides) {
			return 'tooManyOverrides';
		}

		this._config = next;

		this.emit('configChanged', undefined);

		return 'ok';
	}
}
