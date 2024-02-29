import { freeze } from 'immer';
import { z } from 'zod';
import { CharacterId, CharacterIdSchema } from '../../character';
import { Logger } from '../../logging';
import { Assert, AssertNever, AssertNotNullable, MemoizeNoArg } from '../../utility';
import { ActionTargetSelector } from '../appearanceTypes';
import { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import { AssetManager } from '../assetManager';
import { IExportOptions } from '../modules/common';
import { AssetFrameworkCharacterState } from './characterState';
import { AppearanceBundleSchema, AppearanceClientBundle } from './characterStateTypes';
import { AssetFrameworkSpaceInventoryState, SpaceInventoryBundleSchema, SpaceInventoryClientBundle } from './spaceInventoryState';

// Fix for pnpm resolution weirdness
import type { } from '../../validation';
import type { } from '../item/base';

export const AssetFrameworkGlobalStateBundleSchema = z.object({
	characters: z.record(CharacterIdSchema, AppearanceBundleSchema),
	spaceInventory: SpaceInventoryBundleSchema,
	clientOnly: z.boolean().optional(),
});
export type AssetFrameworkGlobalStateBundle = z.infer<typeof AssetFrameworkGlobalStateBundleSchema>;
export type AssetFrameworkGlobalStateClientBundle = AssetFrameworkGlobalStateBundle & {
	characters: Record<CharacterId, AppearanceClientBundle>;
	spaceInventory: SpaceInventoryClientBundle | null;
	clientOnly: true;
};

/**
 * Class that stores immutable state for whole current context (so usually room or only the character if not in room).
 *
 * The class is immutable.
 */
export class AssetFrameworkGlobalState {
	public readonly assetManager: AssetManager;
	public readonly characters: ReadonlyMap<CharacterId, AssetFrameworkCharacterState>;
	public readonly spaceInventory: AssetFrameworkSpaceInventoryState;

	private constructor(
		assetManager: AssetManager,
		characters: ReadonlyMap<CharacterId, AssetFrameworkCharacterState>,
		spaceInventory: AssetFrameworkSpaceInventoryState,
	) {
		this.assetManager = assetManager;
		this.characters = characters;
		this.spaceInventory = spaceInventory;
	}

	public getCharacterState(character: CharacterId): AssetFrameworkCharacterState | null {
		return this.characters.get(character) ?? null;
	}

	public isValid(): boolean {
		return this.validate().success;
	}

	@MemoizeNoArg
	public validate(): AppearanceValidationResult {
		{
			const r = this.spaceInventory.validate();
			if (!r.success)
				return r;
		}

		for (const character of this.characters.values()) {
			const r = character.validate(this.spaceInventory);
			if (!r.success)
				return r;
		}

		return {
			success: true,
		};
	}

	public getItems(target: ActionTargetSelector): AppearanceItems | null {
		if (target.type === 'character') {
			const character = this.getCharacterState(target.characterId);
			if (!character)
				return null;

			return character.items;
		} else if (target.type === 'spaceInventory') {
			return this.spaceInventory.items;
		}
		AssertNever(target);
	}

	public exportToBundle(options: IExportOptions = {}): AssetFrameworkGlobalStateBundle {
		const result: AssetFrameworkGlobalStateBundle = {
			characters: {},
			spaceInventory: this.spaceInventory.exportToBundle(options),
		};

		for (const [characterId, characterState] of this.characters) {
			result.characters[characterId] = characterState.exportToBundle(options);
		}
		return result;
	}

	public exportToClientBundle(options: IExportOptions = {}): AssetFrameworkGlobalStateClientBundle {
		options.clientOnly = true;
		const result: AssetFrameworkGlobalStateClientBundle = {
			characters: {},
			spaceInventory: this.spaceInventory.exportToClientBundle(options),
			clientOnly: true,
		};
		for (const [characterId, characterState] of this.characters) {
			result.characters[characterId] = characterState.exportToClientBundle(options);
		}
		return result;
	}

	public produceCharacterState(character: CharacterId, producer: (currentState: AssetFrameworkCharacterState) => AssetFrameworkCharacterState | null): AssetFrameworkGlobalState | null {
		const currentState = this.getCharacterState(character);
		if (!currentState)
			return null;

		const newState = producer(currentState);
		if (!newState)
			return null;

		return this.withCharacter(character, newState);
	}

	public produceSpaceInventoryState(producer: (currentState: AssetFrameworkSpaceInventoryState) => AssetFrameworkSpaceInventoryState | null): AssetFrameworkGlobalState | null {
		const newState = producer(this.spaceInventory);
		if (!newState)
			return null;

		return this.withSpaceInventoryState(newState);
	}

	public withSpaceInventoryState(newState: AssetFrameworkSpaceInventoryState): AssetFrameworkGlobalState {
		Assert(this.assetManager === newState.assetManager);
		const newCharacters = new Map(this.characters);
		for (const [id, character] of newCharacters) {
			newCharacters.set(
				id,
				character.updateRoomStateLink(newState, false),
			);
		}

		return new AssetFrameworkGlobalState(
			this.assetManager,
			this.characters,
			newState,
		);
	}

	public withCharacter(characterId: CharacterId, characterState: AssetFrameworkCharacterState | null): AssetFrameworkGlobalState {
		Assert(characterState == null || this.assetManager === characterState.assetManager);

		const newCharacters = new Map(this.characters);

		if (characterState == null) {
			newCharacters.delete(characterId);
		} else {
			Assert(characterId === characterState.id);
			newCharacters.set(characterId, characterState);
		}

		return new AssetFrameworkGlobalState(
			this.assetManager,
			newCharacters,
			this.spaceInventory,
		);
	}

	public listChanges(oldState: AssetFrameworkGlobalState): {
		spaceInventory: boolean;
		characters: Set<CharacterId>;
	} {
		const characters = new Set<CharacterId>();

		// Check changed and added characters
		for (const [characterId, character] of this.characters) {
			if (oldState.characters.get(characterId) !== character) {
				characters.add(characterId);
			}
		}

		// Check removed characters
		for (const characterId of oldState.characters.keys()) {
			if (!this.characters.has(characterId)) {
				characters.add(characterId);
			}
		}

		return {
			spaceInventory: this.spaceInventory !== oldState.spaceInventory,
			characters,
		};
	}

	public static createDefault(assetManager: AssetManager): AssetFrameworkGlobalState {
		const instance = new AssetFrameworkGlobalState(
			assetManager,
			new Map(),
			AssetFrameworkSpaceInventoryState.createDefault(assetManager),
		);

		return freeze(instance, true);
	}

	public static loadFromBundle(assetManager: AssetManager, bundle: AssetFrameworkGlobalStateBundle, logger: Logger | undefined): AssetFrameworkGlobalState {
		const characters = new Map<CharacterId, AssetFrameworkCharacterState>();

		const spaceInventory = AssetFrameworkSpaceInventoryState.loadFromBundle(assetManager, bundle.spaceInventory, logger);

		for (const [key, characterData] of Object.entries(bundle.characters)) {
			AssertNotNullable(characterData);
			const characterId = CharacterIdSchema.parse(key);
			characters.set(
				characterId,
				AssetFrameworkCharacterState.loadFromBundle(assetManager, characterId, characterData, spaceInventory, logger),
			);
		}

		const resultState = new AssetFrameworkGlobalState(
			assetManager,
			characters,
			spaceInventory,
		);

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}

export type AssetFrameworkGlobalStateContainerEventHandler = (newState: AssetFrameworkGlobalState, oldState: AssetFrameworkGlobalState) => void;

/**
 * Mutable class that contains current global state and ensures the state is always valid.
 */
export class AssetFrameworkGlobalStateContainer {
	private readonly _logger: Logger;

	private _currentState: AssetFrameworkGlobalState;
	public get currentState(): AssetFrameworkGlobalState {
		return this._currentState;
	}

	private readonly _onChangeHandler: AssetFrameworkGlobalStateContainerEventHandler;

	constructor(logger: Logger, onChangeHandler: AssetFrameworkGlobalStateContainerEventHandler, initialState: AssetFrameworkGlobalState) {
		this._logger = logger;
		this._onChangeHandler = onChangeHandler;

		this._currentState = initialState;
		Assert(this._currentState.isValid());
	}

	public reloadAssetManager(assetManager: AssetManager) {
		if (this.currentState.assetManager === assetManager)
			return;
		const oldState = this._currentState;
		const bundle = oldState.exportToBundle();

		const newState = AssetFrameworkGlobalState.loadFromBundle(assetManager, bundle, this._logger);
		Assert(newState.isValid());
		this._currentState = newState;
		this._onChange(newState, oldState);
	}

	public setState(newState: AssetFrameworkGlobalState): void {
		Assert(newState.isValid(), 'Attempt to set invalid state');
		const oldState = this._currentState;
		this._currentState = newState;
		this._onChange(newState, oldState);
	}

	private _onChange(newState: AssetFrameworkGlobalState, oldState: AssetFrameworkGlobalState) {
		this._onChangeHandler(newState, oldState);
	}
}
