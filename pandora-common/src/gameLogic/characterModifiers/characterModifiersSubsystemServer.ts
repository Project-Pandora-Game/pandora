import { cloneDeep } from 'lodash';
import { nanoid } from 'nanoid';
import { GetRestrictionOverrideConfig } from '../../assets/state/characterStateTypes';
import type { AssetFrameworkGlobalState } from '../../assets/state/globalState';
import { LIMIT_CHARACTER_MODIFIER_INSTANCE_COUNT } from '../../inputLimits';
import { Logger } from '../../logging';
import type { CurrentSpaceInfo } from '../../space';
import { AssertNever, AssertNotNullable } from '../../utility/misc';
import { ArrayIncludesGuard } from '../../validation';
import type { GameLogicCharacter } from '../character/character';
import type { LockActionContext } from '../locks/lockLogic';
import { GameLogicPermissionServer, IPermissionProvider } from '../permissions';
import type { CharacterModifierId } from './characterModifierBaseData';
import type { CharacterModifierConfigurationChange, CharacterModifierEffectData, CharacterModifierInstanceClientData, CharacterModifierInstanceData, CharacterModifierLockAction, CharacterModifierSystemData, CharacterModifierTemplate, CharacterModifierTypeConfig } from './characterModifierData';
import { GameLogicModifierInstanceServer, type GameLogicModifierLockActionResult } from './characterModifierInstance';
import { CharacterModifiersSubsystem } from './characterModifiersSubsystem';
import { GameLogicModifierTypeServer } from './characterModifierType';
import { CHARACTER_MODIFIER_TYPE_DEFINITION, CHARACTER_MODIFIER_TYPES, type CharacterModifierType } from './modifierTypes/_index';

export class CharacterModifiersSubsystemServer extends CharacterModifiersSubsystem implements IPermissionProvider<GameLogicPermissionServer> {
	public readonly character: GameLogicCharacter;

	private readonly modifierTypes: ReadonlyMap<CharacterModifierType, GameLogicModifierTypeServer>;
	private readonly modifierInstances: GameLogicModifierInstanceServer[];

	constructor(character: GameLogicCharacter, data: CharacterModifierSystemData, logger: Logger) {
		super();
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
		this.modifierInstances = data.modifiers.map((m) => new GameLogicModifierInstanceServer(
			m,
			logger.prefixMessages(`Load modifier '${m.type}':`)),
		);

		// Link up events
		for (const type of this.modifierTypes.values()) {
			type.on('configChanged', () => {
				this.emit('dataChanged', undefined);
			});
		}
	}

	/**
	 * Add a new modifier instance on this character. This method does not check that the source is allowed to do so.
	 * @param template - The instance to be added
	 * @param source - Character adding it
	 * @returns Id of the new instance of error code
	 */
	public addModifier(template: CharacterModifierTemplate, enabled: boolean, _source: GameLogicCharacter): 'tooManyModifiers' | 'invalidConfiguration' | { id: `mod:${string}`; } {
		if (this.modifierInstances.length >= LIMIT_CHARACTER_MODIFIER_INSTANCE_COUNT) {
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

		this.modifierInstances.push(new GameLogicModifierInstanceServer(instanceData));

		this.emit('modifiersChanged', undefined);
		this.emit('dataChanged', undefined);

		return {
			id: instanceData.id,
		};
	}

	public reorderModifier(modifier: CharacterModifierId, shift: number): boolean {
		const currentPos = this.modifierInstances.findIndex((m) => m.id === modifier);
		const newPos = currentPos + shift;

		if (currentPos < 0 || newPos < 0 || newPos >= this.modifierInstances.length)
			return false;

		const moved = this.modifierInstances.splice(currentPos, 1);
		this.modifierInstances.splice(newPos, 0, ...moved);

		this.emit('modifiersChanged', undefined);
		this.emit('dataChanged', undefined);

		return true;
	}

	public deleteModifier(modifier: CharacterModifierId): void {
		const currentPos = this.modifierInstances.findIndex((m) => m.id === modifier);

		if (currentPos < 0)
			return;

		this.modifierInstances.splice(currentPos, 1);

		this.emit('modifiersChanged', undefined);
		this.emit('dataChanged', undefined);
	}

	public configureModifier(modifier: CharacterModifierId, change: CharacterModifierConfigurationChange): true | 'invalidConfiguration' | 'failure' {
		const instance = this.modifierInstances.find((m) => m.id === modifier);

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
		const instance = this.modifierInstances.find((m) => m.id === modifier);

		if (instance == null) {
			return {
				result: 'failure',
				problems: [{ result: 'invalidAction' }],
			};
		}

		let result: GameLogicModifierLockActionResult;
		switch (action.action) {
			case 'addLock':
				result = instance.addLock(action.lockType);
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
			modifiers: this.modifierInstances.map((m) => m.getData()),
			typeConfig: {},
		};

		for (const [id, modifier] of this.modifierTypes.entries()) {
			data.typeConfig[id] = modifier.getConfig();
		}

		return data;
	}

	public getClientData(): CharacterModifierInstanceClientData[] {
		return this.modifierInstances.map((m) => m.getClientData());
	}

	public getModifier(modifier: CharacterModifierId): GameLogicModifierInstanceServer | null {
		const instance = this.modifierInstances.find((m) => m.id === modifier);
		return instance ?? null;
	}

	public getActiveEffects(gameState: AssetFrameworkGlobalState, spaceInfo: CurrentSpaceInfo): CharacterModifierEffectData[] {
		const apppearance = this.character.getAppearance(gameState);
		const restrictionOverride = GetRestrictionOverrideConfig(apppearance.getRestrictionOverride());

		// If character is in safemode, then there are no active effects
		if (restrictionOverride.suppressCharacterModifiers)
			return [];

		return this.modifierInstances
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
