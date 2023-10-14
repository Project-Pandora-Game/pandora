import { ICharacterData } from '../../character';
import { Logger } from '../../logging';
import { MakeDefaultInteractionSystemData } from '../interactions/interactionData';
import { InteractionSubsystemServer } from '../interactions/interactionSubsystemServer';
import { GameLogicCharacter } from './character';

export class GameLogicCharacterServer extends GameLogicCharacter {
	public override readonly interactions: InteractionSubsystemServer;

	constructor(data: ICharacterData, logger: Logger) {
		super(data);
		this.interactions = new InteractionSubsystemServer(
			this,
			data.interactionConfig ?? MakeDefaultInteractionSystemData(),
			logger.prefixMessages('[InteractionSubsystem]'),
		);

		this.interactions.on('dataChanged', () => {
			this.emit('dataChanged', 'interactions');
		});
	}
}
