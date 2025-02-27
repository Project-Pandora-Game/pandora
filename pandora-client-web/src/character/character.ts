import { freeze } from 'immer';
import { noop } from 'lodash';
import {
	ActionSpaceContext,
	AppearanceItems,
	Assert,
	AssetFrameworkCharacterState,
	CharacterAppearance,
	CharacterId,
	CharacterRestrictionsManager,
	EvalItemPath,
	GameLogicCharacter,
	GameLogicCharacterClient,
	GetLogger,
	ICharacterPublicData,
	ICharacterRoomData,
	Item,
	ItemPath,
	ITypedEventEmitter,
	Logger,
	TypedEventEmitter,
	WearableAssetType,
	type ActionTargetSelector,
} from 'pandora-common';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { PlayerCharacter } from './player';

export interface ICharacter<T extends ICharacterPublicData = ICharacterPublicData> extends ITypedEventEmitter<CharacterEvents<T>> {
	readonly type: 'character';
	readonly id: CharacterId;
	readonly name: string;
	readonly data: Readonly<T>;
	readonly gameLogicCharacter: GameLogicCharacter;
	isPlayer(): boolean;
	getAppearance(state: AssetFrameworkCharacterState): CharacterAppearance;
	getRestrictionManager(state: AssetFrameworkCharacterState, spaceContext: ActionSpaceContext | null): CharacterRestrictionsManager;
}

export type IChatroomCharacter = ICharacter<ICharacterRoomData>;

export class Character<T extends ICharacterRoomData = ICharacterRoomData> extends TypedEventEmitter<CharacterEvents<T>> implements ICharacter<T> {
	public readonly type = 'character';

	public get id(): CharacterId {
		return this.data.id;
	}

	public get name(): string {
		return this.data.name;
	}

	public readonly actionSelector: ActionTargetSelector;

	protected readonly logger: Logger;

	protected _data: T;
	public get data(): Readonly<T> {
		return this._data;
	}

	public readonly gameLogicCharacter: GameLogicCharacterClient;

	constructor(data: T, logger?: Logger) {
		super();
		this.logger = logger ?? GetLogger('Character', `[Character ${data.id}]`);
		this._data = data;
		this.actionSelector = freeze<ActionTargetSelector>({ type: 'character', characterId: data.id }, true);

		this.gameLogicCharacter = new GameLogicCharacterClient(() => this._data, this.logger.prefixMessages('[GameLogic]'));

		this.logger.verbose('Loaded');
	}

	public isPlayer(): this is PlayerCharacter {
		return false;
	}

	public update(data: Partial<T>): void {
		this._data = { ...this.data, ...data };
		this.logger.debug('Updated', data);
		this.emit('update', data);
	}

	public getAppearance(state: AssetFrameworkCharacterState): CharacterAppearance {
		Assert(state.id === this.id);
		return new CharacterAppearance(state, this.gameLogicCharacter);
	}

	public getRestrictionManager(state: AssetFrameworkCharacterState, spaceContext: ActionSpaceContext): CharacterRestrictionsManager {
		return this.getAppearance(state).getRestrictionManager(spaceContext);
	}
}

export type CharacterEvents<T extends ICharacterPublicData> = {
	'update': Partial<T>;
};

export function useCharacterData<T extends ICharacterPublicData>(character: ICharacter<T>): Readonly<T> {
	return useSyncExternalStore(character.getSubscriber('update'), () => character.data);
}

export function useCharacterDataOptional<T extends ICharacterPublicData>(character: ICharacter<T> | null): Readonly<T> | null {
	const subscriber = useMemo(() => (character?.getSubscriber('update') ?? (() => noop)), [character]);

	return useSyncExternalStore(subscriber, () => (character?.data ?? null));
}

const MULTIPLE_DATA_CACHE = new WeakMap<readonly ICharacter<ICharacterPublicData>[], readonly Readonly<ICharacterPublicData>[]>();
export function useCharacterDataMultiple<T extends ICharacterPublicData>(characters: readonly ICharacter<T>[]): readonly Readonly<T>[] {
	freeze(characters, false);

	const subscribe = useCallback((cb: () => void): (() => void) => {
		const cleanup = characters.map((c) => c.on('update', cb));
		return () => {
			cleanup.forEach((cln) => cln());
		};
	}, [characters]);

	const getSnapshot = useCallback((): readonly Readonly<T>[] => {
		const existingValue = MULTIPLE_DATA_CACHE.get(characters);
		if (existingValue != null) {
			// The `characters` array should never mutate
			Assert(existingValue.length === characters.length);
			if (existingValue.every((v, i) => characters[i].data === v))
				return existingValue as (readonly Readonly<T>[]);
		}

		const value = characters.map((o) => o.data);
		MULTIPLE_DATA_CACHE.set(characters, value);
		return value;
	}, [characters]);

	return useSyncExternalStore(subscribe, getSnapshot);
}

export function useCharacterAppearance(characterState: AssetFrameworkCharacterState, character: Character): CharacterAppearance {
	return useMemo(() => character.getAppearance(characterState), [characterState, character]);
}

export function useCharacterAppearanceItems(characterState: AssetFrameworkCharacterState): AppearanceItems<WearableAssetType> {
	return characterState.items;
}

export function useCharacterAppearanceItem(characterState: AssetFrameworkCharacterState, path: ItemPath | null | undefined): Item | undefined {
	const items = useCharacterAppearanceItems(characterState);

	return useMemo(() => (items && path) ? EvalItemPath(items, path) : undefined, [items, path]);
}

export function useCharacterRestrictionManager(character: Character, state: AssetFrameworkCharacterState, spaceContext: ActionSpaceContext): CharacterRestrictionsManager {
	return useMemo(() => character.gameLogicCharacter.getRestrictionManager(state, spaceContext), [character, state, spaceContext]);
}
