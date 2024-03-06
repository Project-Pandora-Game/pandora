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
import { AssetFrameworkRoomState, RoomId } from './roomState';
import { AssetFrameworkSpaceInventoryState, SpaceInventoryBundleSchema, SpaceInventoryClientBundle } from './spaceInventoryState';
import { AssetFrameworkSpaceState, SpaceStateBundleSchema, SpaceStateClientBundle } from './spaceState';

// Fix for pnpm resolution weirdness
import type { } from '../../validation';
import type { } from '../item/base';

export const AssetFrameworkGlobalStateBundleSchema = z.object({
	characters: z.record(CharacterIdSchema, AppearanceBundleSchema),
	space: SpaceStateBundleSchema,
	spaceInventory: SpaceInventoryBundleSchema,
	clientOnly: z.boolean().optional(),
});
export type AssetFrameworkGlobalStateBundle = z.infer<typeof AssetFrameworkGlobalStateBundleSchema>;
export type AssetFrameworkGlobalStateClientBundle = AssetFrameworkGlobalStateBundle & {
	characters: Record<CharacterId, AppearanceClientBundle>;
	space: SpaceStateClientBundle;
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
	public readonly space: AssetFrameworkSpaceState;
	public readonly spaceInventory: AssetFrameworkSpaceInventoryState;

	private constructor(
		assetManager: AssetManager,
		characters: ReadonlyMap<CharacterId, AssetFrameworkCharacterState>,
		space: AssetFrameworkSpaceState,
		spaceInventory: AssetFrameworkSpaceInventoryState,
	) {
		this.assetManager = assetManager;
		this.characters = characters;
		this.space = space;
		this.spaceInventory = spaceInventory;
	}

	public getCharacterState(character: CharacterId): AssetFrameworkCharacterState | null {
		return this.characters.get(character) ?? null;
	}

	public getRoomState(room: RoomId): AssetFrameworkRoomState | null {
		return this.space.getRoomState(room);
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

		{
			const r = this.space.validate();
			if (!r.success)
				return r;
		}

		for (const character of this.characters.values()) {
			const r = character.validate(this.space);
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
		} else if (target.type === 'room') {
			const room = this.getRoomState(target.roomId);
			if (!room)
				return null;

			return room.items;
		} else if (target.type === 'spaceInventory') {
			return this.spaceInventory.items;
		}
		AssertNever(target);
	}

	public exportToBundle(options: IExportOptions = {}): AssetFrameworkGlobalStateBundle {
		const result: AssetFrameworkGlobalStateBundle = {
			characters: {},
			space: this.space.exportToBundle(options),
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
			space: this.space.exportToClientBundle(options),
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
			this.space,
			this.spaceInventory,
		);
	}

	public produceRoomState(room: RoomId, producer: (currentState: AssetFrameworkRoomState) => AssetFrameworkRoomState | null): AssetFrameworkGlobalState | null {
		return this.produceSpaceState((space) => space.produceRoomState(room, producer));
	}

	public withRoom(room: RoomId, roomState: AssetFrameworkRoomState | null): AssetFrameworkGlobalState {
		return this.withSpaceState(this.space.withRoom(room, roomState));
	}

	public produceSpaceState(producer: (currentState: AssetFrameworkSpaceState) => AssetFrameworkSpaceState | null): AssetFrameworkGlobalState | null {
		const newState = producer(this.space);
		if (!newState)
			return null;

		return this.withSpaceState(newState);
	}

	public withSpaceState(newState: AssetFrameworkSpaceState): AssetFrameworkGlobalState {
		Assert(this.assetManager === newState.assetManager);

		const newCharacters = new Map(this.characters);
		for (const [id, character] of newCharacters) {
			const characterRoom = character.getPhysicalRoom(newState);
			newCharacters.set(
				id,
				character.updateRoomStateLink(characterRoom, false),
			);
		}

		return new AssetFrameworkGlobalState(
			this.assetManager,
			this.characters,
			newState,
			this.spaceInventory,
		);
	}

	public produceSpaceInventoryState(producer: (currentState: AssetFrameworkSpaceInventoryState) => AssetFrameworkSpaceInventoryState | null): AssetFrameworkGlobalState | null {
		const newState = producer(this.spaceInventory);
		if (!newState)
			return null;

		return this.withSpaceInventoryState(newState);
	}

	public withSpaceInventoryState(newState: AssetFrameworkSpaceInventoryState): AssetFrameworkGlobalState {
		Assert(this.assetManager === newState.assetManager);

		return new AssetFrameworkGlobalState(
			this.assetManager,
			this.characters,
			this.space,
			newState,
		);
	}

	public listChanges(oldState: AssetFrameworkGlobalState): {
		spaceInventory: boolean;
		space: boolean;
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
			space: this.space !== oldState.space,
			characters,
		};
	}

	public static createDefault(assetManager: AssetManager): AssetFrameworkGlobalState {
		const instance = new AssetFrameworkGlobalState(
			assetManager,
			new Map(),
			AssetFrameworkSpaceState.createDefault(assetManager),
			AssetFrameworkSpaceInventoryState.createDefault(assetManager),
		);

		return freeze(instance, true);
	}

	public static loadFromBundle(assetManager: AssetManager, bundle: AssetFrameworkGlobalStateBundle, logger: Logger | undefined): AssetFrameworkGlobalState {
		const characters = new Map<CharacterId, AssetFrameworkCharacterState>();

		const space = AssetFrameworkSpaceState.loadFromBundle(assetManager, bundle.space, logger);

		for (const [key, characterData] of Object.entries(bundle.characters)) {
			AssertNotNullable(characterData);
			const characterId = CharacterIdSchema.parse(key);
			characters.set(
				characterId,
				AssetFrameworkCharacterState.loadFromBundle(assetManager, characterId, characterData, space, logger),
			);
		}

		const spaceInventory = AssetFrameworkSpaceInventoryState.loadFromBundle(assetManager, bundle.spaceInventory, logger);

		const resultState = new AssetFrameworkGlobalState(
			assetManager,
			characters,
			space,
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
