import { useState, useEffect } from 'react';
import { AssertNotNullable, AssetFrameworkCharacterState, CharacterId, ICharacterPrivateData } from 'pandora-common';
import { PlayerCharacter } from '../../character/player';
import { useNullableObservable } from '../../observable';
import { useShardConnector } from './shardConnectorContextProvider';
import { useCharacterState, useChatroomRequired } from './chatRoomContextProvider';

export function usePlayer(): PlayerCharacter | null {
	return useNullableObservable(useShardConnector()?.player);
}

export function usePlayerState(): AssetFrameworkCharacterState {
	const player = usePlayer();
	const chatRoom = useChatroomRequired();
	AssertNotNullable(player);
	const playerState = useCharacterState(chatRoom, player.id);
	AssertNotNullable(playerState);

	return playerState;
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
