import { cloneDeep } from 'lodash-es';
import { nanoid } from 'nanoid';
import type { AssetManager } from '../../assets/assetManager.ts';
import { GetRestrictionOverrideConfig } from '../../assets/state/characterStateTypes.ts';
import type { AssetFrameworkGlobalState } from '../../assets/state/globalState.ts';
import { LIMIT_CHARACTER_MODIFIER_INSTANCE_COUNT } from '../../inputLimits.ts';
import type { Logger } from '../../logging/logger.ts';
import { GetLogger } from '../../logging/logging.ts';
import type { CurrentSpaceInfo } from '../../space/index.ts';
import { AssertNever, AssertNotNullable } from '../../utility/misc.ts';
import { ArrayIncludesGuard } from '../../validation.ts';
import type { GameLogicCharacter } from '../character/character.ts';
import type { LockActionContext } from '../locks/lockLogic.ts';
import { GameLogicPermissionServer, IPermissionProvider } from '../permissions/index.ts';
import type { CharacterModifierId } from './characterModifierBaseData.ts';
import type { CharacterModifierConfigurationChange, CharacterModifierEffectData, CharacterModifierInstanceClientData, CharacterModifierInstanceData, CharacterModifierLockAction, CharacterModifierSystemData, CharacterModifierTemplate, CharacterModifierTypeConfig } from './characterModifierData.ts';
import { GameLogicModifierInstanceServer, type GameLogicModifierLockActionResult } from './characterModifierInstance.ts';
import { CharacterModifiersSubsystem } from './characterModifiersSubsystem.ts';
import { GameLogicModifierTypeServer } from './characterModifierType.ts';
import { CHARACTER_MODIFIER_TYPE_DEFINITION, CHARACTER_MODIFIER_TYPES, type CharacterModifierType } from './modifierTypes/_index.ts';

export class CharacterModifiersSubsystemServer extends CharacterModifiersSubsystem implements IPermissionProvider<GameLogicPermissionServer> {
	private _assetManager: AssetManager;
	public readonly character: GameLogicCharacter;

	private readonly modifierTypes: ReadonlyMap<CharacterModifierType, GameLogicModifierTypeServer>;
	private _modifierInstances: GameLogicModifierInstanceServer[];

	public get modifierInstances(): readonly GameLogicModifierInstanceServer[] {
		return this._modifierInstances;
	}

	constructor(character: GameLogicCharacter, data: CharacterModifierSystemData, assetManager: AssetManager, logger: Logger) {
		super();
		this._assetManager = assetManager;
		this.character = character;
		// Load data
		const modifierTypes = new Map<CharacterModifierType, GameLogicModifierTypeServer>();
		for (const type of CHARACTER_MODIFIER_TYPES) {
			const typeConfig: CharacterModifierTypeConfig | undefined = data.typeConfig[type];
			modifierTypes.set(type, new GameLogicModifierTypeServer(character, type, typeConfig));
		}
		this.modifierTypes = modifierTypes;
		// Report ignored configs
		for (const dataId of Object.keys(data.typeConfig)) {
			if (!ArrayIncludesGuard(CHARACTER_MODIFIER_TYPES, dataId)) {
				logger.warning(`Ignoring unknown modifier config '${dataId}'`);
			}
		}

		// Load instances
		this._modifierInstances = data.modifiers.map((m) => new GameLogicModifierInstanceServer(
			m,
			assetManager,
			logger.prefixMessages(`Load modifier '${m.type}':`),
		));

		// Link up events
		for (const type of this.modifierTypes.values()) {
			type.on('configChanged', () => {
				this.emit('dataChanged', undefined);
			});
		}
	}

	public reloadAssetManager(manager: AssetManager) {
		const logger = GetLogger('CharacterModifiersSubsystemServer');

		this._assetManager = manager;

		// Re-create all modifier instances with new manager
		this._modifierInstances = this._modifierInstances
			.map((m) => m.getData())
			.map((m) => new GameLogicModifierInstanceServer(
				m,
				manager,
				logger.prefixMessages(`Asset manager reload for modifier '${m.type}':`),
			));

		this.emit('modifiersChanged', undefined);
		this.emit('dataChanged', undefined);
	}

	/**
	 * Add a new modifier instance on this character. This method does not check that the source is allowed to do so.
	 * @param template - The instance to be added
	 * @param source - Character adding it
	 * @returns Id of the new instance of error code
	 */
	public addModifier(template: CharacterModifierTemplate, enabled: boolean, _source: GameLogicCharacter): 'tooManyModifiers' | 'invalidConfiguration' | { id: `mod:${string}`; } {
		if (this._modifierInstances.length >= LIMIT_CHARACTER_MODIFIER_INSTANCE_COUNT) {
			return 'tooManyModifiers';
		}

		const typeDefinition = CHARACTER_MODIFIER_TYPE_DEFINITION[template.type];

		const parsedConfig = typeDefinition.configSchema.safeParse(template.config);

		if (!parsedConfig.success) {
			return 'invalidConfiguration';
		}

		const instanceData: CharacterModifierInstanceData = {
			id: `mod:${nanoid()}`,
			type: template.type,
			name: template.name,
			enabled,
			config: parsedConfig.data,
			conditions: cloneDeep(template.conditions),
			lockExceptions: [],
		};

		this._modifierInstances.push(new GameLogicModifierInstanceServer(instanceData, this._assetManager));

		this.emit('modifiersChanged', undefined);
		this.emit('dataChanged', undefined);

		return {
			id: instanceData.id,
		};
	}

	public reorderModifier(modifier: CharacterModifierId, shift: number): boolean {
		const currentPos = this._modifierInstances.findIndex((m) => m.id === modifier);
		const newPos = currentPos + shift;

		if (currentPos < 0 || newPos < 0 || newPos >= this._modifierInstances.length)
			return false;

		const moved = this._modifierInstances.splice(currentPos, 1);
		this._modifierInstances.splice(newPos, 0, ...moved);

		this.emit('modifiersChanged', undefined);
		this.emit('dataChanged', undefined);

		return true;
	}

	public deleteModifier(modifier: CharacterModifierId): void {
		const currentPos = this._modifierInstances.findIndex((m) => m.id === modifier);

		if (currentPos < 0)
			return;

		this._modifierInstances.splice(currentPos, 1);

		this.emit('modifiersChanged', undefined);
		this.emit('dataChanged', undefined);
	}

	public configureModifier(modifier: CharacterModifierId, change: CharacterModifierConfigurationChange): true | 'invalidConfiguration' | 'failure' {
		const instance = this._modifierInstances.find((m) => m.id === modifier);

		if (instance == null)
			return 'failure';

		const parsedConfig = (change.config != null) ? instance.definition.configSchema.partial().safeParse(change.config) : null;
		if (parsedConfig != null && !parsedConfig.success) {
			return 'invalidConfiguration';
		}

		if (change.name != null) {
			instance.setName(change.name);
		}
		if (change.enabled != null) {
			instance.setEnabled(change.enabled);
		}
		if (parsedConfig != null) {
			instance.setConfig(parsedConfig.data);
		}
		if (change.conditions != null) {
			instance.setConditions(change.conditions);
		}
		if (change.lockExceptions != null) {
			instance.setLockExceptions(change.lockExceptions);
		}

		this.emit('modifiersChanged', undefined);
		this.emit('dataChanged', undefined);
		return true;
	}

	public doLockAction(modifier: CharacterModifierId, ctx: LockActionContext, action: CharacterModifierLockAction): GameLogicModifierLockActionResult {
		const instance = this._modifierInstances.find((m) => m.id === modifier);

		if (instance == null) {
			return {
				result: 'failure',
				problems: [{ result: 'invalidAction' }],
			};
		}

		let result: GameLogicModifierLockActionResult;
		switch (action.action) {
			case 'addLock':
				result = instance.addLock(action.lockAsset);
				break;

			case 'removeLock':
				result = instance.removeLock();
				break;

			case 'lockAction':
				result = instance.doLockAction(ctx, action.lockAction);
				break;

			default:
				AssertNever(action);
		}

		if (result.result === 'ok') {
			this.emit('modifiersChanged', undefined);
			this.emit('dataChanged', undefined);
		}

		return result;
	}

	public getData(): CharacterModifierSystemData {
		const data: CharacterModifierSystemData = {
			modifiers: this._modifierInstances.map((m) => m.getData()),
			typeConfig: {},
		};

		for (const [id, modifier] of this.modifierTypes.entries()) {
			data.typeConfig[id] = modifier.getConfig();
		}

		return data;
	}

	public getClientData(): CharacterModifierInstanceClientData[] {
		return this._modifierInstances.map((m) => m.getClientData());
	}

	public getModifier(modifier: CharacterModifierId): GameLogicModifierInstanceServer | null {
		const instance = this._modifierInstances.find((m) => m.id === modifier);
		return instance ?? null;
	}

	public getActiveEffects(gameState: AssetFrameworkGlobalState, spaceInfo: CurrentSpaceInfo): CharacterModifierEffectData[] {
		const apppearance = this.character.getAppearance(gameState);
		const restrictionOverride = GetRestrictionOverrideConfig(apppearance.getRestrictionOverride());

		// If character is in safemode, then there are no active effects
		if (restrictionOverride.suppressCharacterModifiers)
			return [];

		return this._modifierInstances
			.filter((m) => m.isInEffect(gameState, spaceInfo, this.character))
			.map((m) => m.getEffect());
	}

	public override getModifierTypePermission(type: CharacterModifierType): GameLogicPermissionServer {
		const modifierType = this.modifierTypes.get(type);
		AssertNotNullable(modifierType);

		return modifierType.permission;
	}

	public override getPermission(permissionId: string): GameLogicPermissionServer | null {
		if (!ArrayIncludesGuard(CHARACTER_MODIFIER_TYPES, permissionId)) {
			return null;
		}

		return this.getModifierTypePermission(permissionId);
	}
}
