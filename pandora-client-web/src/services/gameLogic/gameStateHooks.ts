import { freeze, type Immutable } from 'immer';
import { noop } from 'lodash-es';
import {
	CompareSpaceRoles,
	EMPTY_ARRAY,
	IsAuthorized,
	type ActionRoomSelector,
	type ActionSpaceContext,
	type ActionTargetSelector,
	type AssetFrameworkCharacterState,
	type AssetFrameworkGlobalState,
	type CharacterId,
	type CharacterRestrictionsManager,
	type CurrentSpaceInfo,
	type ICharacterRoomData,
	type IDirectoryAccountInfo,
	type Item,
	type ItemContainerPath,
	type ItemId,
	type ItemPath,
	type Nullable,
	type SpaceCharacterModifierEffectData,
	type SpaceClientInfo,
	type SpaceFeature,
	type SpaceRole,
} from 'pandora-common';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useCharacterDataOptional, type Character } from '../../character/character.ts';
import { type GameState } from '../../components/gameContext/gameStateContextProvider.tsx';
import { useNullableObservable, useObservable } from '../../observable.ts';
import { useCurrentAccount } from '../accountLogic/accountManagerHooks.ts';
import { useGameLogicServiceOptional } from '../serviceProvider.tsx';

export function useGameStateOptional(): GameState | null {
	return useNullableObservable(useGameLogicServiceOptional('gameState')?.gameState);
}

export function useGameState(): GameState {
	const gameState = useGameStateOptional();
	if (!gameState) {
		throw new Error('Attempt to access GameState outside of context');
	}
	return gameState;
}

export function useSpaceCharacters(): readonly Character<ICharacterRoomData>[] {
	const context = useGameStateOptional();
	return useNullableObservable(context?.characters) ?? EMPTY_ARRAY;
}

export function useResolveCharacterName(characterId: CharacterId): string | null {
	// Look through space characters to see if we find matching one
	const characters = useSpaceCharacters();
	const character = characters.find((c) => c.id === characterId);

	const data = useCharacterDataOptional(character ?? null);

	return (data != null) ? data.name : null;
}

export function useSpaceInfo(): Immutable<CurrentSpaceInfo> {
	const context = useGameState();
	return useObservable(context.currentSpace);
}

export function useSpaceInfoOptional(): Immutable<CurrentSpaceInfo> | null {
	const context = useGameStateOptional();
	return useNullableObservable(context?.currentSpace);
}

export function useSpaceFeatures(): readonly SpaceFeature[] {
	const info = useSpaceInfo();
	return info.config.features;
}

export function MakeActionSpaceContext(
	spaceInfo: CurrentSpaceInfo,
	playerAccount: IDirectoryAccountInfo | null,
	playerModifierEffects: Immutable<SpaceCharacterModifierEffectData>,
): ActionSpaceContext {
	return {
		features: spaceInfo.config.features,
		getAccountSpaceRole: (accountId) => {
			if (accountId === playerAccount?.id) {
				return GetSpaceInfoAccountRole(spaceInfo.config, playerAccount);
			}
			return GetSpaceInfoAccountRole(spaceInfo.config, { id: accountId });
		},
		development: spaceInfo.config.development,
		getCharacterModifierEffects: (characterId) => {
			return playerModifierEffects[characterId] ?? EMPTY_ARRAY;
		},
	};
}

export function useActionSpaceContext(): ActionSpaceContext {
	const context = useGameState();
	const info = useObservable(context.currentSpace);
	const characterModifierEffects = useObservable(context.characterModifierEffects);
	const playerAccount = useCurrentAccount();
	return useMemo((): ActionSpaceContext => (MakeActionSpaceContext(info, playerAccount, characterModifierEffects)), [info, playerAccount, characterModifierEffects]);
}

export function useCharacterRestrictionsManager<T>(globalState: AssetFrameworkGlobalState, character: Character, use: (manager: CharacterRestrictionsManager) => T): T {
	const spaceContext = useActionSpaceContext();
	const manager = useMemo(() => character.getRestrictionManager(globalState, spaceContext), [character, globalState, spaceContext]);
	return useMemo(() => use(manager), [use, manager]);
}

export function useGlobalState(context: GameState): AssetFrameworkGlobalState;
export function useGlobalState(context: GameState | null): AssetFrameworkGlobalState | null;
export function useGlobalState(context: GameState | null): AssetFrameworkGlobalState | null {
	return useSyncExternalStore(
		useCallback((onChange) => {
			if (context == null)
				return noop;

			return context.on('globalStateChange', () => {
				onChange();
			});
		}, [context]),
		useCallback(() => (context?.globalState.currentState ?? null), [context]),
	);

}

export function useCharacterState(globalState: AssetFrameworkGlobalState, id: CharacterId | null): AssetFrameworkCharacterState | null {
	return useMemo(() => (id != null ? globalState.characters.get(id) ?? null : null), [globalState, id]);
}

export type FindItemResultEntry = {
	item: Item;
	target: ActionTargetSelector;
	path: ItemPath;
	room: ActionRoomSelector;
};
export type FindItemResult = readonly Readonly<FindItemResultEntry>[];

const FindItemByIdCache = new WeakMap<AssetFrameworkGlobalState, Map<ItemId, FindItemResult>>();

export function FindItemById(globalState: AssetFrameworkGlobalState | null, id: ItemId): FindItemResult {
	if (globalState == null) {
		return EMPTY_ARRAY;
	}

	let cache = FindItemByIdCache.get(globalState);
	if (cache == null) {
		cache = new Map();
		FindItemByIdCache.set(globalState, cache);
	}

	const cachedResult = cache.get(id);
	if (cachedResult != null) {
		return cachedResult;
	}
	const result: Readonly<FindItemResultEntry>[] = [];

	function processContainer(items: readonly Item[], target: ActionTargetSelector, container: ItemContainerPath, room: ActionRoomSelector): void {
		for (const item of items) {
			if (item.id === id) {
				result.push({
					item,
					target,
					path: {
						container,
						itemId: item.id,
					},
					room,
				});
			}

			for (const [moduleName, module] of item.getModules()) {
				processContainer(module.getContents(), target, [
					...container,
					{ item: item.id, module: moduleName },
				], room);
			}
		}
	}

	for (const character of globalState.characters.values()) {
		processContainer(character.items, { type: 'character', characterId: character.id }, [], { type: 'room', roomId: character.currentRoom });
	}
	for (const room of globalState.space.rooms) {
		processContainer(room.items, { type: 'room', roomId: room.id }, [], { type: 'room', roomId: room.id });
	}

	freeze(result);
	cache.set(id, result);
	return result;
}

export function useStateFindItemById(globalState: AssetFrameworkGlobalState | null, id: ItemId): FindItemResult {
	return useMemo(() => FindItemById(globalState, id), [globalState, id]);
}

export function GetSpaceInfoAccountRole(data: Immutable<SpaceClientInfo>, account: Nullable<Partial<IDirectoryAccountInfo>>): SpaceRole {
	if (account?.id == null)
		return 'everyone';

	if (data.owners.includes(account.id))
		return 'owner';
	if (data.admin.includes(account.id))
		return 'admin';

	if (data.development?.autoAdmin && IsAuthorized(account.roles, 'developer'))
		return 'admin';
	if (data.allow.includes(account.id))
		return 'allowlisted';

	return 'everyone';
}

export function IsSpaceAdmin(data: Immutable<SpaceClientInfo>, account: Nullable<Partial<IDirectoryAccountInfo>>): boolean {
	return CompareSpaceRoles(GetSpaceInfoAccountRole(data, account), 'admin') >= 0;
}

