import { CharacterId, CharacterIdSchema } from '../../character';
import { Logger } from '../../logging';
import { AssetManager } from '../assetManager';
import { freeze } from 'immer';
import { AppearanceBundleSchema, AssetFrameworkCharacterState } from './characterState';
import { z } from 'zod';
import { Assert, AssertNotNullable, MemoizeNoArg } from '../../utility';
import { AppearanceValidationResult } from '../appearanceValidation';
import { AssetFrameworkGlobalStateManipulator } from '../manipulators/globalStateManipulator';
import { ActionProcessingContext } from '../appearanceTypes';
import { AssetFrameworkRoomState, RoomInventoryBundleSchema } from './roomState';

export const AssetFrameworkGlobalStateBundleSchema = z.object({
	characters: z.record(CharacterIdSchema, AppearanceBundleSchema),
	room: RoomInventoryBundleSchema.nullable(),
});
export type AssetFrameworkGlobalStateBundle = z.infer<typeof AssetFrameworkGlobalStateBundleSchema>;

/**
 * Class that stores immutable state for whole current context (so usually room or only the character if not in room).
 *
 * The class is immutable.
 */
export class AssetFrameworkGlobalState {
	public readonly characters: ReadonlyMap<CharacterId, AssetFrameworkCharacterState>;
	public readonly room: AssetFrameworkRoomState | null;

	private constructor(characters: ReadonlyMap<CharacterId, AssetFrameworkCharacterState>, room: AssetFrameworkRoomState | null) {
		this.characters = characters;
		this.room = room;
	}

	public getCharacterState(character: CharacterId): AssetFrameworkCharacterState | null {
		return this.characters.get(character) ?? null;
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
			const r = character.validate();
			if (!r.success)
				return r;
		}

		return {
			success: true,
		};
	}

	public exportToBundle(): AssetFrameworkGlobalStateBundle {
		const result: AssetFrameworkGlobalStateBundle = {
			characters: {},
			room: this.room?.exportToBundle() ?? null,
		};

		for (const [characterId, characterState] of this.characters) {
			result.characters[characterId] = characterState.exportToBundle();
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

		const newCharacters = new Map(this.characters);
		newCharacters.set(character, newState);

		return new AssetFrameworkGlobalState(
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

		return new AssetFrameworkGlobalState(
			this.characters,
			newState,
		);
	}

	public static createDefault(): AssetFrameworkGlobalState {
		const instance = new AssetFrameworkGlobalState(
			new Map(),
			null,
		);

		return freeze(instance, true);
	}

	public static loadFromBundle(assetManager: AssetManager, bundle: AssetFrameworkGlobalStateBundle, logger: Logger | undefined): AssetFrameworkGlobalState {
		const characters = new Map<CharacterId, AssetFrameworkCharacterState>();

		for (const [key, characterData] of Object.entries(bundle.characters)) {
			AssertNotNullable(characterData);
			const characterId = CharacterIdSchema.parse(key);
			characters.set(
				characterId,
				AssetFrameworkCharacterState.loadFromBundle(assetManager, characterId, characterData, logger),
			);
		}

		const room = bundle.room == null ? null : AssetFrameworkRoomState.loadFromBundle(assetManager, bundle.room, logger);

		const resultState = new AssetFrameworkGlobalState(
			characters,
			room,
		);

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}

/**
 * Mutable class that contains current global state and ensures the state is always valid.
 */
export class AssetFrameworkGlobalStateContainer {
	private readonly _logger: Logger;

	private _assetManager: AssetManager;
	public get assetManager(): AssetManager {
		return this._assetManager;
	}

	private _currentState: AssetFrameworkGlobalState;
	public get currentState(): AssetFrameworkGlobalState {
		return this._currentState;
	}

	constructor(assetManager: AssetManager, logger: Logger) {
		this._assetManager = assetManager;
		this._logger = logger;

		this._currentState = AssetFrameworkGlobalState.createDefault();
		Assert(this._currentState.isValid());
	}

	public reloadAssetManager(assetManager: AssetManager) {
		if (this._assetManager === assetManager)
			return;
		const bundle = this.currentState.exportToBundle();
		this._assetManager = assetManager;

		this._currentState = AssetFrameworkGlobalState.loadFromBundle(assetManager, bundle, this._logger);
		Assert(this._currentState.isValid());
	}

	public getManipulator(): AssetFrameworkGlobalStateManipulator {
		return new AssetFrameworkGlobalStateManipulator(this._assetManager, this._currentState);
	}

	public commitChanges(manipulator: AssetFrameworkGlobalStateManipulator, context: ActionProcessingContext): AppearanceValidationResult {
		Assert(this.assetManager === manipulator.assetManager);
		const newState = manipulator.currentState;

		// Validate
		const r = newState.validate();
		if (!r.success)
			return r;

		if (context.dryRun)
			return { success: true };

		this._currentState = newState;

		for (const message of manipulator.getAndClearPendingMessages()) {
			context.actionHandler?.({
				...message,
				character: context.sourceCharacter ? {
					type: 'character',
					id: context.sourceCharacter,
				} : undefined,
			});
		}

		return { success: true };
	}
}
