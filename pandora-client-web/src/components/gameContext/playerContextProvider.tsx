import { useMemo } from 'react';
import { AssertNotNullable, AssetFrameworkCharacterState, CharacterId, ICharacterPrivateData, ICharacterRoomData } from 'pandora-common';
import { PlayerCharacter } from '../../character/player';
import { useNullableObservable } from '../../observable';
import { useShardConnector } from './shardConnectorContextProvider';
import { useCharacterState, useGameState } from './gameStateContextProvider';
import { useCharacterDataOptional } from '../../character/character';

export function usePlayer(): PlayerCharacter | null {
	return useNullableObservable(useShardConnector()?.gameState)?.player ?? null;
}

export function usePlayerState(): {
	player: PlayerCharacter;
	playerState: AssetFrameworkCharacterState;
} {
	const player = usePlayer();
	const gameState = useGameState();
	AssertNotNullable(player);
	const playerState = useCharacterState(gameState, player.id);
	AssertNotNullable(playerState);

	return useMemo(() => ({
		player,
		playerState,
	}), [player, playerState]);
}

export function usePlayerData(): Readonly<ICharacterPrivateData & ICharacterRoomData> | null {
	const player = usePlayer();
	return useCharacterDataOptional(player);
}

export function usePlayerId(): CharacterId | null {
	const player = usePlayer();
	return player?.id ?? null;
}
