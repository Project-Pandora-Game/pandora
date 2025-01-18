import { nanoid } from 'nanoid';
import { LIMIT_CHARACTER_MODIFIER_INSTANCE_COUNT } from '../../inputLimits';
import { Logger } from '../../logging';
import { AssertNotNullable } from '../../utility/misc';
import { ArrayIncludesGuard } from '../../validation';
import type { GameLogicCharacter } from '../character/character';
import { GameLogicPermissionServer, IPermissionProvider } from '../permissions';
import type { CharacterModifierInstanceClientData, CharacterModifierInstanceData, CharacterModifierSystemData, CharacterModifierTemplate, CharacterModifierTypeConfig } from './characterModifierData';
import { GameLogicModifierInstanceServer } from './characterModifierInstance';
import { CharacterModifiersSubsystem } from './characterModifiersSubsystem';
import { GameLogicModifierTypeServer } from './characterModifierType';
import { CHARACTER_MODIFIER_TYPE_DEFINITION, CHARACTER_MODIFIER_TYPES, type CharacterModifierType } from './modifierTypes/_index';

export class CharacterModifiersSubsystemServer extends CharacterModifiersSubsystem implements IPermissionProvider<GameLogicPermissionServer> {
	private readonly modifierTypes: ReadonlyMap<CharacterModifierType, GameLogicModifierTypeServer>;
	private readonly modifierInstances: GameLogicModifierInstanceServer[];

	constructor(character: GameLogicCharacter, data: CharacterModifierSystemData, logger: Logger) {
		super();
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
		this.modifierInstances = data.modifiers.map((m) => new GameLogicModifierInstanceServer(m));

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
	public addModifier(template: CharacterModifierTemplate, _source: GameLogicCharacter): 'tooManyModifiers' | 'invalidConfiguration' | { id: `mod:${string}`; } {
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
			enabled: template.enabled,
			config: parsedConfig.data,
		};

		this.modifierInstances.push(new GameLogicModifierInstanceServer(instanceData));

		this.emit('modifiersChanged', undefined);
		this.emit('dataChanged', undefined);

		return {
			id: instanceData.id,
		};
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
