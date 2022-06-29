import { useState, useMemo, useContext, useEffect } from 'react';
import type { CharacterId, ICharacterData } from 'pandora-common';
import { PlayerCharacter } from '../../character/player';
import { playerContext } from './stateContextProvider';

export function usePlayer(): PlayerCharacter | null {
	return useContext(playerContext).player;
}

export function usePlayerContext(): { value: PlayerCharacter | null } {
	const { player, setPlayer } = useContext(playerContext);
	return useMemo(() => ({
		get value() {
			return player;
		},
		set value(p: PlayerCharacter | null) {
			setPlayer(p);
		},
	}), [player, setPlayer]);
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
