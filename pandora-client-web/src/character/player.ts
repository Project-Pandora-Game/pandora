import { GetLogger, ICharacterPrivateData, ICharacterRoomData, IClientShardArgument } from 'pandora-common';
import { useCallback } from 'react';
import { useShardConnector } from '../components/gameContext/shardConnectorContextProvider.tsx';
import { Character } from './character.ts';

export type CharacterCreationCallback = (
	character: PlayerCharacter,
	creationData: IClientShardArgument['finishCharacterCreation'],
) => Promise<'ok' | 'failed'>;

export class PlayerCharacter extends Character<ICharacterPrivateData & ICharacterRoomData> {

	constructor(data: ICharacterPrivateData & ICharacterRoomData) {
		super(data, GetLogger('Character', `[Player ${data.id}]`));
	}

	public override isPlayer(): this is PlayerCharacter {
		return true;
	}

	public setCreationComplete(): void {
		const newData = { ...this._data };
		delete newData.inCreation;
		this._data = newData;
		this.emit('update', this._data);
	}
}

export function useCreateCharacter(): CharacterCreationCallback {
	const shardConnector = useShardConnector();
	return useCallback(async (character: PlayerCharacter, creationData: IClientShardArgument['finishCharacterCreation']) => {
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
