import { useState, useEffect, useMemo } from 'react';
import { AssertNotNullable, AssetFrameworkCharacterState, CharacterId, ICharacterPrivateData } from 'pandora-common';
import { PlayerCharacter } from '../../character/player';
import { useNullableObservable } from '../../observable';
import { useShardConnector } from './shardConnectorContextProvider';
import { useCharacterState, useGameState } from './gameStateContextProvider';

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

export function usePlayerData(): Readonly<ICharacterPrivateData> | null {
	const player = usePlayer();
	const [data, setData] = useState<Readonly<ICharacterPrivateData> | null>(player ? player.data : null);
	useEffect(() => {
		setData(player ? player.data : null);
		return player?.onAny((ev) => {
			if (ev.update) {
				setData(player ? player.data : null);
			}
		});
	}, [player]);
	return data;
}

export function usePlayerId(): CharacterId | null {
	const player = usePlayer();
	const [id, setId] = useState<CharacterId | null>(player?.data.id ?? null);
	useEffect(() => {
		setId(player?.data.id ?? null);
	}, [id, player]);
	return id;
}
