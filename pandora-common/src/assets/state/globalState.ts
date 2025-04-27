import { freeze } from 'immer';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { CharacterId, CharacterIdSchema } from '../../character/characterTypes.ts';
import type { Logger } from '../../logging/logger.ts';
import { Assert, AssertNever, AssertNotNullable, MemoizeNoArg } from '../../utility/misc.ts';
import { EvalContainerPath } from '../appearanceHelpers.ts';
import { ActionTargetSelector, type ItemContainerPath, type ItemPath } from '../appearanceTypes.ts';
import { AppearanceValidationResult } from '../appearanceValidation.ts';
import { AssetManager } from '../assetManager.ts';
import type { Item } from '../item/base.ts';
import type { AppearanceItems } from '../item/index.ts';
import { IExportOptions } from '../modules/common.ts';
import { AssetFrameworkCharacterState } from './characterState.ts';
import { AppearanceBundleSchema, AppearanceClientBundle, AppearanceClientDeltaBundleSchema } from './characterStateTypes.ts';
import { AssetFrameworkRoomState, RoomInventoryBundleSchema, RoomInventoryClientBundle } from './roomState.ts';

export const AssetFrameworkGlobalStateBundleSchema = z.object({
	stateId: z.string().default(''),
	characters: z.record(CharacterIdSchema, AppearanceBundleSchema),
	room: RoomInventoryBundleSchema,
	clientOnly: z.boolean().optional(),
});
export type AssetFrameworkGlobalStateBundle = z.infer<typeof AssetFrameworkGlobalStateBundleSchema>;
export type AssetFrameworkGlobalStateClientBundle = AssetFrameworkGlobalStateBundle & {
	characters: Record<CharacterId, AppearanceClientBundle>;
	room: RoomInventoryClientBundle | null;
	clientOnly: true;
};

const AssetFrameworkGlobalStateCharacterClientDeltaSchema = z.union([
	z.tuple([z.literal('full'), AppearanceBundleSchema]),
	z.tuple([z.literal('delta'), AppearanceClientDeltaBundleSchema]),
	z.null(),
]);
export const AssetFrameworkGlobalStateClientDeltaBundleSchema = z.object({
	originalStateId: z.string(),
	targetStateId: z.string(),
	characters: z.record(CharacterIdSchema, AssetFrameworkGlobalStateCharacterClientDeltaSchema).optional(),
	room: RoomInventoryBundleSchema.optional(),
});
export type AssetFrameworkGlobalStateClientDeltaBundle = z.infer<typeof AssetFrameworkGlobalStateClientDeltaBundleSchema>;

/**
 * Class that stores immutable state for whole current context (so the current space, be it private or public one).
 *
 * The class is immutable.
 */
export class AssetFrameworkGlobalState {
	public readonly assetManager: AssetManager;
	public readonly characters: ReadonlyMap<CharacterId, AssetFrameworkCharacterState>;
	public readonly room: AssetFrameworkRoomState;

	/**
	 * Randomly generated ID of this state, used for detecting desyncs.
	 * Internally it is generated lazily to avoid creating it for every intermediate state during an action.
	 */
	private _stateId?: string;

	private constructor(
		assetManager: AssetManager,
		characters: ReadonlyMap<CharacterId, AssetFrameworkCharacterState>,
		room: AssetFrameworkRoomState,
		stateId?: string,
	) {
		this.assetManager = assetManager;
		this.characters = characters;
		this.room = room;
		this._stateId = stateId;
	}

	public getCharacterState(character: CharacterId): AssetFrameworkCharacterState | null {
		return this.characters.get(character) ?? null;
	}

	/**
	 * Returns a random ID for this state, used for detecting desyncs.
	 */
	public getStateId(): string {
		if (this._stateId == null) {
			this._stateId = nanoid(8);
		}
		return this._stateId;
	}

	public isValid(): boolean {
		return this.validate().success;
	}

	@MemoizeNoArg
	public validate(): AppearanceValidationResult {
		if (this.room != null) {
			const r = this.room.validate();
			if (!r.success)
				return r;
		}

		for (const character of this.characters.values()) {
			const r = character.validate(this.room);
			if (!r.success)
				return r;
		}

		return {
			success: true,
		};
	}

	/**
	 * Get items in specified target and its container.
	 * @param target - The target to look for
	 * @param containerPath - The container to look for
	 * @returns List of items if found, or `null` otherwise
	 */
	public getItems(target: ActionTargetSelector, containerPath?: ItemContainerPath): AppearanceItems | null {
		let result: AppearanceItems;
		if (target.type === 'character') {
			const character = this.getCharacterState(target.characterId);
			if (!character)
				return null;

			result = character.items;
		} else if (target.type === 'roomInventory') {
			result = this.room.items;
		} else {
			AssertNever(target);
		}
		if (containerPath != null) {
			return EvalContainerPath(result, containerPath) ?? null;
		}
		return result;
	}

	/**
	 * Get specific item.
	 * @param target - The target to look for the item on
	 * @param itemPath - Path to the item
	 * @returns The item, or `null` if not found
	 */
	public getItem(target: ActionTargetSelector, itemPath: ItemPath): Item | null {
		return this.getItems(target, itemPath.container)
			?.find((it) => it.id === itemPath.itemId) ?? null;
	}

	public exportToBundle(): AssetFrameworkGlobalStateBundle {
		const result: AssetFrameworkGlobalStateBundle = {
			stateId: this.getStateId(),
			characters: {},
			room: this.room.exportToBundle(),
		};

		for (const [characterId, characterState] of this.characters) {
			result.characters[characterId] = characterState.exportToBundle();
		}
		return result;
	}

	public exportToClientBundle(options: IExportOptions = {}): AssetFrameworkGlobalStateClientBundle {
		options.clientOnly = true;
		const result: AssetFrameworkGlobalStateClientBundle = {
			stateId: this.getStateId(),
			characters: {},
			room: this.room.exportToClientBundle(options),
			clientOnly: true,
		};
		for (const [characterId, characterState] of this.characters) {
			result.characters[characterId] = characterState.exportToClientBundle(options);
		}
		return result;
	}

	public exportToClientDeltaBundle(originalState: AssetFrameworkGlobalState, options: IExportOptions = {}): AssetFrameworkGlobalStateClientDeltaBundle {
		Assert(this.assetManager === originalState.assetManager);
		options.clientOnly = true;

		const result: AssetFrameworkGlobalStateClientDeltaBundle = {
			originalStateId: originalState.getStateId(),
			targetStateId: this.getStateId(),
		};

		// Find removed characters
		for (const id of originalState.characters.keys()) {
			if (!this.characters.has(id)) {
				result.characters ??= {};
				result.characters[id] = null;
			}
		}

		// Find added or updated characters
		for (const [id, character] of this.characters) {
			const originalCharacter = originalState.characters.get(id);
			if (originalCharacter !== character) {
				result.characters ??= {};
				if (originalCharacter != null) {
					result.characters[id] = ['delta', character.exportToClientDeltaBundle(originalCharacter, options)];
				} else {
					result.characters[id] = ['full', character.exportToClientBundle(options)];
				}
			}
		}

		// Check if room changed
		if (originalState.room !== this.room) {
			result.room = this.room.exportToClientBundle(options);
		}

		return result;
	}

	public applyClientDeltaBundle(bundle: AssetFrameworkGlobalStateClientDeltaBundle, logger: Logger | undefined): AssetFrameworkGlobalState {
		Assert(this.getStateId() === bundle.originalStateId, 'DESYNC: Mismatch in state id when applying delta bundle');

		let room = this.room;
		if (bundle.room != null) {
			room = AssetFrameworkRoomState.loadFromBundle(this.assetManager, bundle.room, logger);
		}

		let characters = this.characters;
		if (bundle.characters != null) {
			const newCharacters = new Map(characters);
			for (const [key, characterData] of Object.entries(bundle.characters)) {
				const characterId = CharacterIdSchema.parse(key);
				if (characterData == null) {
					newCharacters.delete(characterId);
				} else if (characterData[0] === 'full') {
					newCharacters.set(
						characterId,
						AssetFrameworkCharacterState.loadFromBundle(this.assetManager, characterId, characterData[1], room, logger),
					);
				} else if (characterData[0] === 'delta') {
					const originalCharacter = this.characters.get(characterId);
					Assert(originalCharacter != null, 'DESYNC: Character to update not found');
					newCharacters.set(
						characterId,
						originalCharacter.applyClientDeltaBundle(characterData[1], room, logger),
					);
				} else {
					AssertNever(characterData);
				}
			}
			characters = newCharacters;
		}

		const resultState = new AssetFrameworkGlobalState(
			this.assetManager,
			characters,
			room,
			bundle.targetStateId,
		);

		Assert(resultState.isValid(), 'State is invalid after delta update');
		return resultState;
	}

	public produceCharacterState(character: CharacterId, producer: (currentState: AssetFrameworkCharacterState) => AssetFrameworkCharacterState | null): AssetFrameworkGlobalState | null {
		const currentState = this.getCharacterState(character);
		if (!currentState)
			return null;

		const newState = producer(currentState);
		if (!newState)
			return null;

		const newCharacters = new Map(this.characters);
		newCharacters.set(character, newState);

		return new AssetFrameworkGlobalState(
			this.assetManager,
			newCharacters,
			this.room,
		);
	}

	public produceRoomState(producer: (currentState: AssetFrameworkRoomState) => AssetFrameworkRoomState | null): AssetFrameworkGlobalState | null {
		if (!this.room)
			return null;

		const newState = producer(this.room);
		if (!newState)
			return null;

		return this.withRoomState(newState);
	}

	public withRoomState(newState: AssetFrameworkRoomState): AssetFrameworkGlobalState {
		const newCharacters = new Map(this.characters);
		for (const [id, character] of newCharacters) {
			newCharacters.set(
				id,
				character.updateRoomStateLink(newState, false),
			);
		}

		return new AssetFrameworkGlobalState(
			this.assetManager,
			newCharacters,
			newState,
		);
	}

	public withCharacter(characterId: CharacterId, characterState: AssetFrameworkCharacterState | null): AssetFrameworkGlobalState {
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
			this.room,
		);
	}

	public listChanges(oldState: AssetFrameworkGlobalState): {
		room: boolean;
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
			room: this.room !== oldState.room,
			characters,
		};
	}

	public static createDefault(assetManager: AssetManager, room: AssetFrameworkRoomState): AssetFrameworkGlobalState {
		Assert(room.assetManager === assetManager);
		const instance = new AssetFrameworkGlobalState(
			assetManager,
			new Map(),
			room,
		);

		return freeze(instance, true);
	}

	public static loadFromBundle(assetManager: AssetManager, bundle: AssetFrameworkGlobalStateBundle, logger: Logger | undefined): AssetFrameworkGlobalState {
		const characters = new Map<CharacterId, AssetFrameworkCharacterState>();

		const room = AssetFrameworkRoomState.loadFromBundle(assetManager, bundle.room, logger);

		for (const [key, characterData] of Object.entries(bundle.characters)) {
			AssertNotNullable(characterData);
			const characterId = CharacterIdSchema.parse(key);
			characters.set(
				characterId,
				AssetFrameworkCharacterState.loadFromBundle(assetManager, characterId, characterData, room, logger),
			);
		}

		const resultState = new AssetFrameworkGlobalState(
			assetManager,
			characters,
			room,
			bundle.stateId,
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

		// Reset bundle state id, as change of assets definitions can be unpredictable
		bundle.stateId = nanoid(8);

		const newState = AssetFrameworkGlobalState.loadFromBundle(
			assetManager,
			bundle,
			this._logger.prefixMessages('Asset manager reload:'),
		);
		Assert(newState.isValid());
		this._currentState = newState;
		this._onChange(newState, oldState);
	}

	public setState(newState: AssetFrameworkGlobalState): void {
		Assert(newState.isValid(), 'Attempt to set invalid state');
		if (this._currentState === newState)
			return;

		const oldState = this._currentState;
		this._currentState = newState;
		this._onChange(newState, oldState);
	}

	private _onChange(newState: AssetFrameworkGlobalState, oldState: AssetFrameworkGlobalState) {
		this._onChangeHandler(newState, oldState);
	}
}
