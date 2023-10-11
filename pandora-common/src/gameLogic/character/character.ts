import { CharacterId, CharacterRestrictionsManager, ICharacterMinimalData } from '../../character';
import { AccountId } from '../../account';
import { TypedEventEmitter } from '../../event';
import { AssetFrameworkCharacterState, CharacterAppearance } from '../../assets';
import { Assert } from '../../utility';
import { ActionRoomContext } from '../../chatroom';

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

	public getAppearance(state: AssetFrameworkCharacterState): CharacterAppearance {
		Assert(state.id === this.id);
		return new CharacterAppearance(state, this);
	}

	public getRestrictionManager(state: AssetFrameworkCharacterState, roomContext: ActionRoomContext | null): CharacterRestrictionsManager {
		return this.getAppearance(state).getRestrictionManager(roomContext);
	}
}
