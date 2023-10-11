import { CharacterId, ICharacterMinimalData } from '../../character';
import { AccountId } from '../../account';
import { TypedEventEmitter } from '../../event';

export type GameLogicCharacterEvents = {
	dataChanged: void;
};

export abstract class GameLogicCharacter extends TypedEventEmitter<GameLogicCharacterEvents> {
	public readonly id: CharacterId;
	public readonly accountId: AccountId;
	public readonly name: string;

	constructor(minimalData: ICharacterMinimalData) {
		super();
		this.id = minimalData.id;
		this.accountId = minimalData.accountId;
		this.name = minimalData.name;
	}
}
