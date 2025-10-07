import { freeze } from 'immer';
import { noop } from 'lodash-es';
import {
	ActionSpaceContext,
	Assert,
	AssetFrameworkCharacterState,
	CharacterAppearance,
	CharacterId,
	CharacterRestrictionsManager,
	EvalItemPath,
	GameLogicCharacter,
	GameLogicCharacterClient,
	GetLogger,
	ICharacterRoomData,
	Item,
	ItemPath,
	ITypedEventEmitter,
	Logger,
	TypedEventEmitter,
	type ActionTargetSelector,
	type AssetFrameworkGlobalState,
} from 'pandora-common';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { PlayerCharacter } from './player.ts';

export interface Character<T extends ICharacterRoomData = ICharacterRoomData> extends ITypedEventEmitter<CharacterEvents<T>> {
	readonly type: 'character';
	readonly id: CharacterId;
	readonly name: string;
	readonly data: Readonly<T>;
	readonly actionSelector: ActionTargetSelector;
	readonly gameLogicCharacter: GameLogicCharacter;

	isPlayer(): this is PlayerCharacter;
	getAppearance(globalState: AssetFrameworkGlobalState): CharacterAppearance;
	getRestrictionManager(globalState: AssetFrameworkGlobalState, spaceContext: ActionSpaceContext | null): CharacterRestrictionsManager;
}

export class CharacterImpl<T extends ICharacterRoomData = ICharacterRoomData> extends TypedEventEmitter<CharacterEvents<T>> implements Character<T> {
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

	public getAppearance(globalState: AssetFrameworkGlobalState): CharacterAppearance {
		return new CharacterAppearance(globalState, this.gameLogicCharacter);
	}

	public getRestrictionManager(globalState: AssetFrameworkGlobalState, spaceContext: ActionSpaceContext): CharacterRestrictionsManager {
		return this.getAppearance(globalState).getRestrictionManager(spaceContext);
	}
}

export type CharacterEvents<T extends ICharacterRoomData> = {
	'update': Partial<T>;
};

export function useCharacterData<T extends ICharacterRoomData>(character: Character<T>): Readonly<T> {
	return useSyncExternalStore(character.getSubscriber('update'), () => character.data);
}

export function useCharacterDataOptional<T extends ICharacterRoomData>(character: Character<T> | null): Readonly<T> | null {
	const subscriber = useMemo(() => (character?.getSubscriber('update') ?? (() => noop)), [character]);

	return useSyncExternalStore(subscriber, () => (character?.data ?? null));
}

const MULTIPLE_DATA_CACHE = new WeakMap<readonly Character[], readonly Readonly<ICharacterRoomData>[]>();
export function useCharacterDataMultiple<T extends ICharacterRoomData>(characters: readonly Character<T>[]): readonly Readonly<T>[] {
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

export function useCharacterAppearance(globalState: AssetFrameworkGlobalState, character: Character): CharacterAppearance {
	return useMemo(() => character.getAppearance(globalState), [globalState, character]);
}

export function useCharacterAppearanceItem(characterState: AssetFrameworkCharacterState, path: ItemPath | null | undefined): Item | undefined {
	const items = characterState.items;

	return useMemo(() => (items && path) ? EvalItemPath(items, path) : undefined, [items, path]);
}

export function useCharacterRestrictionManager(character: Character, globalState: AssetFrameworkGlobalState, spaceContext: ActionSpaceContext): CharacterRestrictionsManager {
	return useMemo(() => character.getRestrictionManager(globalState, spaceContext), [character, globalState, spaceContext]);
}
