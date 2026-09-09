import { freeze, type Immutable } from 'immer';
import {
	Assert,
	AssetFrameworkGlobalState,
	AssetManager,
	GetLogger,
	KnownObject,
	ParseNotNullable,
	TypedEventEmitter,
	type BotPrivateData,
	type CharacterId,
	type CurrentSpaceInfo,
	type GameStateUpdate,
	type ICharacterRoomData,
	type Logger,
	type SpaceCharacterModifierEffectData,
} from 'pandora-common';
import type { BotId } from 'pandora-common/bots';
import type { IShardBotArgument } from 'pandora-common/networking/api/shard_bot';
import type { BotSpaceCharacter } from './botSpaceCharacter.ts';
import { BotSpaceCharacterImpl } from './botSpaceCharacterImpl.ts';
import type { BotSpaceState, BotSpaceStateEvents } from './botSpaceState.ts';

export class BotSpaceStateImpl extends TypedEventEmitter<BotSpaceStateEvents> implements BotSpaceState {
	private readonly logger: Logger;

	private _assetManager: AssetManager;
	public get assetManager(): AssetManager {
		return this._assetManager;
	}

	private _currentSpace: CurrentSpaceInfo;
	private _botPrivateData: Immutable<BotPrivateData>;
	private _globalState: AssetFrameworkGlobalState;
	private _characters: readonly BotSpaceCharacterImpl[];
	private _characterModifierEffects: Immutable<SpaceCharacterModifierEffectData>;

	public get currentSpace(): CurrentSpaceInfo {
		return this._currentSpace;
	}
	public get botPrivateData(): Immutable<BotPrivateData> {
		return this._botPrivateData;
	}
	public get globalState(): AssetFrameworkGlobalState {
		return this._globalState;
	}
	public get characters(): readonly BotSpaceCharacter[] {
		return this._characters;
	}
	public get characterModifierEffects(): Immutable<SpaceCharacterModifierEffectData> {
		return this._characterModifierEffects;
	}

	constructor({ assetsDefinitionHash, assetsDefinition, botPrivate, globalState, space }: IShardBotArgument['load'], bot: BotId) {
		super();
		this.logger = GetLogger('BotSpaceState', `[BotSpaceState ${bot}|${space.id}]`);

		// Load asset manager
		// TODO: Handle `assetsSource`
		this._assetManager = new AssetManager(assetsDefinitionHash, assetsDefinition);
		this.logger.debug(`Loaded asset definitions, version: ${this._assetManager.definitionsHash}`);

		const { id, info, characters, characterModifierEffects } = space;
		this._currentSpace = {
			id,
			config: info,
		};

		const loadedGlobalState = AssetFrameworkGlobalState
			.loadFromBundle(this._assetManager, globalState, id, this.logger.prefixMessages('State bundle load:'));

		this._globalState = loadedGlobalState;

		this._botPrivateData = botPrivate;
		this._characters = [];
		this._updateCharacters(characters);

		this._characterModifierEffects = freeze(characterModifierEffects, true);

		// No event emits, as at this point no-one can be listening anyway
	}

	public handleLoad({ assetsDefinitionHash, assetsDefinition, botPrivate, globalState, space }: IShardBotArgument['load']): void {
		// Load asset manager (if needed)
		let assetManagerChanged = false;
		if (this._assetManager.definitionsHash !== assetsDefinitionHash) {
			// TODO: Handle `assetsSource`
			this._assetManager = new AssetManager(assetsDefinitionHash, assetsDefinition);
			this.logger.debug(`Loaded asset definitions, version: ${this._assetManager.definitionsHash}`);
			assetManagerChanged = true;
		}

		const oldSpace = this._currentSpace;
		const { id, info, characters, characterModifierEffects } = space;
		this._currentSpace = {
			id,
			config: info,
		};
		Assert(oldSpace.id === id, 'Bot\'s space cannot change');

		this._botPrivateData = botPrivate;
		const characterUpdates = this._updateCharacters(characters);

		this.logger.debug('Loaded space data');

		if (!globalState.clientOnly) {
			this.logger.error('Received global state update that is not client-only');
		}
		const oldState = this._globalState;
		this._globalState = AssetFrameworkGlobalState
			.loadFromBundle(this._assetManager, globalState, this._currentSpace.id, this.logger.prefixMessages('State bundle load:'));
		this._characterModifierEffects = freeze(characterModifierEffects, true);

		this.emit('spaceConfigChanged', this._currentSpace);
		this.emit('privateBotDataChanged', this._botPrivateData);
		if (assetManagerChanged) {
			this.emit('assetsChanged', this._assetManager);
		}
		for (const left of characterUpdates.left) {
			this.emit('characterLeft', left);
		}
		for (const joined of characterUpdates.joined) {
			this.emit('characterJoined', joined);
		}
		this.emit('globalStateChanged', {
			previousState: oldState,
			newState: this._globalState,
		});
		this.emit('characterModifiersChanged', undefined);
	}

	public handleBotPrivateDataUpdate(data: Partial<BotPrivateData>): void {
		this._botPrivateData = {
			...this._botPrivateData,
			...data,
		};
		this.emit('privateBotDataChanged', this._botPrivateData);
	}

	public handleUpdate(data: GameStateUpdate): void {
		const { info, globalState, join, leave, characters, characterModifierEffects } = data;

		if (info) {
			this._currentSpace = {
				...this._currentSpace,
				config: {
					...this._currentSpace.config,
					...info,
				},
			};
		}
		if (leave) {
			this._characters = this._characters.filter((oc) => oc.id !== leave);
		}
		if (join) {
			let char = this._characters.find((oc) => oc.id === join.id);
			if (!char) {
				char = new BotSpaceCharacterImpl(join);
				this._characters = [...this._characters, char];
			} else {
				char.update(join);
			}
		}
		if (characters) {
			for (const [id, characterData] of Object.entries(characters)) {
				if (characterData == null)
					continue;
				const char = this._characters.find((oc) => oc.id === id);
				if (!char) {
					this.logger.error('Character not found during update', id);
				} else {
					char.update(characterData);
				}
			}
		}
		const oldState = this._globalState;
		if (globalState) {
			this._globalState = this._globalState
				.applyClientDeltaBundle(globalState, this.logger.prefixMessages('State bundle delta update:'));
		}
		if (characterModifierEffects != null) {
			freeze(characterModifierEffects, true);
			const newCharacterModifierEffects = { ...this._characterModifierEffects };
			for (const [k, v] of KnownObject.entries(characterModifierEffects)) {
				if (v == null) {
					delete newCharacterModifierEffects[k];
				} else {
					newCharacterModifierEffects[k] = v;
				}
			}
			this._characterModifierEffects = newCharacterModifierEffects;

		}
		this.logger.debug('Updated space data:', Object.keys(data));

		// Emit after all updates were applied
		if (info) {
			this.emit('spaceConfigChanged', this._currentSpace);
		}
		if (leave) {
			this.emit('characterLeft', leave);
		}
		if (join) {
			const char = ParseNotNullable(this._characters.find((it) => it.id === join.id));
			this.emit('characterJoined', char);
		}
		if (oldState !== this._globalState) {
			this.emit('globalStateChanged', {
				previousState: oldState,
				newState: this._globalState,
			});
		}
		if (characterModifierEffects != null) {
			this.emit('characterModifiersChanged', undefined);
		}
	}

	private _updateCharacters(characters: readonly ICharacterRoomData[]): { joined: BotSpaceCharacterImpl[]; left: CharacterId[]; } {
		const oldCharacters = this._characters;
		this._characters = characters.map((c) => {
			let char = oldCharacters.find((oc) => oc.id === c.id);
			if (char) {
				char.update(c);
			} else {
				char = new BotSpaceCharacterImpl(c);
			}
			return char;
		});

		return {
			joined: this._characters.filter((it) => !oldCharacters.some((oc) => oc.id === it.id)),
			left: oldCharacters.filter((it) => !this._characters.some((c) => c.id === it.id)).map((it) => it.id),
		};
	}
}
