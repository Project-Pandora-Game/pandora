import { useState, useContext, useEffect } from 'react';
import type { CharacterId, ICharacterData } from 'pandora-common';
import { PlayerCharacter } from '../../character/player';
import { playerContext } from './stateContextProvider';
import { Observable, useObservable } from '../../observable';

export function usePlayer(): PlayerCharacter | null {
	return useObservable(usePlayerContext());
}

export function usePlayerContext(): Observable<PlayerCharacter | null> {
	return useContext(playerContext);
}

export function usePlayerData() {
	const player = usePlayer();
	const [data, setData] = useState<Readonly<ICharacterData> | null>(player ? player.data : null);
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
