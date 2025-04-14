import type { Immutable } from 'immer';
import { AssertNotNullable, AssetFrameworkCharacterState, CHARACTER_SETTINGS_DEFAULT, CharacterId, ICharacterPrivateData, ICharacterRoomData, type AssetFrameworkGlobalState, type CharacterSettings } from 'pandora-common';
import { useMemo } from 'react';
import { useCharacterDataOptional } from '../../character/character.ts';
import { PlayerCharacter } from '../../character/player.ts';
import { useNullableObservable } from '../../observable.ts';
import { useCharacterState, useGameState, useGlobalState } from './gameStateContextProvider.tsx';
import { useShardConnector } from './shardConnectorContextProvider.tsx';

export function usePlayer(): PlayerCharacter | null {
	return useNullableObservable(useShardConnector()?.gameState)?.player ?? null;
}

export function usePlayerState(): {
	player: PlayerCharacter;
	globalState: AssetFrameworkGlobalState;
	playerState: AssetFrameworkCharacterState;
} {
	const gameState = useGameState();
	const player = gameState.player;
	const globalState = useGlobalState(gameState);
	const playerState = useCharacterState(globalState, player.id);
	AssertNotNullable(playerState);

	return useMemo(() => ({
		player,
		globalState,
		playerState,
	}), [player, globalState, playerState]);
}

export function usePlayerData(): Readonly<ICharacterPrivateData & ICharacterRoomData> | null {
	const player = usePlayer();
	return useCharacterDataOptional(player);
}

export function usePlayerId(): CharacterId | null {
	const player = usePlayer();
	return player?.id ?? null;
}

/**
 * Gets modified settings for the current character.
 * @returns The partial settings object, or `undefined` if no character is loaded.
 */
export function useModifiedCharacterSettings(): Partial<Immutable<CharacterSettings>> | undefined {
	return usePlayerData()?.settings;
}

/**
 * Resolves full character settings to their effective values.
 * @returns The settings that apply to this account.
 */
export function useCharacterSettings(): Immutable<CharacterSettings> {
	const modifiedSettings = useModifiedCharacterSettings();
	return useMemo((): Immutable<CharacterSettings> => ({
		...CHARACTER_SETTINGS_DEFAULT,
		...modifiedSettings,
	}), [modifiedSettings]);
}
