import { Logger } from '../../logging';
import { AssertNotNullable } from '../../utility/misc';
import { ArrayIncludesGuard } from '../../validation';
import type { GameLogicCharacter } from '../character/character';
import { GameLogicPermissionServer, IPermissionProvider } from '../permissions';
import type { CharacterModifierSystemData, CharacterModifierTypeConfig } from './characterModifierData';
import { CharacterModifiersSubsystem } from './characterModifiersSubsystem';
import { GameLogicModifierTypeServer } from './characterModifierType';
import { CHARACTER_MODIFIER_TYPES, type CharacterModifierType } from './modifierTypes/_index';

export class CharacterModifiersSubsystemServer extends CharacterModifiersSubsystem implements IPermissionProvider<GameLogicPermissionServer> {
	private readonly modifierTypes: ReadonlyMap<CharacterModifierType, GameLogicModifierTypeServer>;

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

		// Link up events
		for (const interaction of this.modifierTypes.values()) {
			interaction.on('configChanged', () => {
				this.emit('dataChanged', undefined);
			});
		}
	}

	public getData(): CharacterModifierSystemData {
		const data: CharacterModifierSystemData = {
			typeConfig: {},
		};

		for (const [id, modifier] of this.modifierTypes.entries()) {
			data.typeConfig[id] = modifier.getConfig();
		}

		return data;
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
