import type { ICharacterData } from 'pandora-common';
import { GetLogger } from 'pandora-common/dist/logging';
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

	public async finishCreation(name: string): Promise<'ok' | 'failed'> {
		const connector = ShardConnector.value;
		if (!connector)
			return 'failed';
		return (await connector.awaitResponse('finishCharacterCreation', {
			name,
		})).result;
	}
};
