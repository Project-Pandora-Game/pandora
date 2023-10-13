import { ICharacterPublicData } from '../../character';
import { Logger } from '../../logging';
import { InteractionSubsystemClient } from '../interactions/interactionSubsystemClient';
import { GameLogicCharacter } from './character';

export class GameLogicCharacterClient extends GameLogicCharacter {
	public override readonly interactions: InteractionSubsystemClient;

	constructor(data: ICharacterPublicData, _logger: Logger) {
		super(data);
		this.interactions = new InteractionSubsystemClient(
			this,
		);
	}
}
