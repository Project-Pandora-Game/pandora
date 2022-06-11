import { GetLogger, ICharacterData, ICharacterDataCreate } from 'pandora-common';
import { useCallback, useEffect, useState } from 'react';
import { useShardConnector } from '../components/gameContext/shardConnectorContextProvider';
import { USER_DEBUG } from '../config/Environment';
import { Observable, useObservable } from '../observable';
import { Character } from './character';

export const Player = new Observable<PlayerCharacter | null>(null);

export type CharacterCreationCallback = (
	character: PlayerCharacter,
	creationData: ICharacterDataCreate,
) => Promise<'ok' | 'failed'>;

export class PlayerCharacter extends Character<ICharacterData> {

	constructor(data: ICharacterData) {
		super(data, GetLogger('Character', `[Player ${ data.id }]`));
	}

	public setCreationComplete(): void {
		delete this._data.inCreation;
		this.emit('update', this._data);
	}
}

export function useCreateCharacter(): CharacterCreationCallback {
	const shardConnector = useShardConnector();
	return useCallback(async (character: PlayerCharacter, creationData: ICharacterDataCreate) => {
		if (!shardConnector || !character.data) {
			return 'failed';
		}
		const result = (await shardConnector.awaitResponse('finishCharacterCreation', creationData)).result;
		if (result === 'ok') {
			character.setCreationComplete();
		}
		return result;
	}, [shardConnector]);
}

export function usePlayerData(): Readonly<ICharacterData> | null {
	const player = useObservable(Player);
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

// Debug helper
if (USER_DEBUG) {
	//@ts-expect-error: Development link
	window.Player = Player;
}
