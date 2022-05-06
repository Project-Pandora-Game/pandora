import { ICharacterData, GetLogger } from 'pandora-common';
import { useEffect, useState } from 'react';
import { NODE_ENV } from '../config/Environment';
import { ShardConnector } from '../networking/socketio_shard_connector';
import { Observable, useObservable } from '../observable';
import { Character } from './character';

export const Player = new Observable<PlayerCharacter | null>(null);

export class PlayerCharacter extends Character<ICharacterData> {

	constructor(data: ICharacterData) {
		super(data, GetLogger('Character', `[Player ${data.id}]`));
	}

	public async finishCreation(name: string): Promise<'ok' | 'failed'> {
		const connector = ShardConnector.value;
		if (!connector || !this._data)
			return 'failed';
		const result = (await connector.awaitResponse('finishCharacterCreation', {
			name,
		})).result;
		if (result === 'ok') {
			delete this._data.inCreation;
			this.emit('update', this._data);
		}
		return result;
	}
}

// eslint-disable-next-line @typescript-eslint/naming-convention
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
if (NODE_ENV === 'development') {
	//@ts-expect-error: Development link
	window.Player = Player;
}
