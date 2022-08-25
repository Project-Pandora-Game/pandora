import { GetLogger, ICharacterData, ICharacterDataCreate, ICharacterRoomData } from 'pandora-common';
import { useCallback } from 'react';
import { useShardConnector } from '../components/gameContext/shardConnectorContextProvider';
import { Character } from './character';

export type CharacterCreationCallback = (
	character: PlayerCharacter,
	creationData: ICharacterDataCreate,
) => Promise<'ok' | 'failed'>;

export class PlayerCharacter extends Character<ICharacterData & ICharacterRoomData> {

	constructor(data: ICharacterData) {
		super({
			...data,
			position: [0, 0],
		}, GetLogger('Character', `[Player ${data.id}]`));
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

