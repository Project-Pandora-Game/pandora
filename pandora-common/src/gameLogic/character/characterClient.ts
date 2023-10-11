import { ICharacterPublicData } from '../../character';
import { Logger } from '../../logging';
import { GameLogicCharacter } from './character';

export class GameLogicCharacterClient extends GameLogicCharacter {
	constructor(data: ICharacterPublicData, _logger: Logger) {
		super(data);
	}
}
