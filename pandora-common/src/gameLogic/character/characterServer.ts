import { ICharacterData } from '../../character';
import { Logger } from '../../logging';
import { GameLogicCharacter } from './character';

export class GameLogicCharacterServer extends GameLogicCharacter {
	constructor(data: ICharacterData, _logger: Logger) {
		super(data);
	}
}
