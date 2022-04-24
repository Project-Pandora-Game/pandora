import { ICharacterData, GetLogger } from 'pandora-common';
import { ShardConnector } from '../networking/socketio_shard_connector';
import { Character } from './character';

const logger = GetLogger('Player');

export const Player = new class Player extends Character {

	public override load(data: ICharacterData): void {
		super.load(data);
		logger.debug('Loaded player data', data);
	}

	public override update(data: Partial<ICharacterData>): void {
		super.update(data);
		logger.debug('Updated player data', data);
	}

	public unload(): void {
		this._data = undefined;
		this.emit('unload', undefined);
	}

	public async finishCreation(name: string): Promise<'ok' | 'failed'> {
		const connector = ShardConnector.value;
		if (!connector || !this.loaded || !this._data)
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
};
