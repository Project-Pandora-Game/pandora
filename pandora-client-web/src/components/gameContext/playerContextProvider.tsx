import { AssertNotNullable, AssetFrameworkCharacterState, CharacterId, ICharacterPrivateData, ICharacterRoomData, type AssetFrameworkGlobalState } from 'pandora-common';
import { useMemo } from 'react';
import { useCharacterDataOptional } from '../../character/character';
import { PlayerCharacter } from '../../character/player';
import { useNullableObservable } from '../../observable';
import { useCharacterState, useGameState, useGlobalState } from './gameStateContextProvider';
import { useShardConnector } from './shardConnectorContextProvider';

export function usePlayer(): PlayerCharacter | null {
	return useNullableObservable(useShardConnector()?.gameState)?.player ?? null;
}

export function usePlayerState(): {
	player: PlayerCharacter;
	globalState: AssetFrameworkGlobalState;
	playerState: AssetFrameworkCharacterState;
} {
	const player = usePlayer();
	AssertNotNullable(player);
	const globalState = useGlobalState(useGameState());
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
