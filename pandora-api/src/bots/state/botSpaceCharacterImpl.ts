import { freeze } from 'immer';
import { CharacterAppearance, GameLogicCharacterClient, GetLogger, TypedEventEmitter, type ActionTargetSelector, type AssetFrameworkGlobalState, type CharacterId, type Logger } from 'pandora-common';
import type { BotSpaceCharacter, BotSpaceCharacterData, BotSpaceCharacterEvents } from './botSpaceCharacter.ts';

export class BotSpaceCharacterImpl extends TypedEventEmitter<BotSpaceCharacterEvents> implements BotSpaceCharacter {
	protected readonly logger: Logger;

	public get id(): CharacterId {
		return this.data.id;
	}

	public get name(): string {
		return this.data.name;
	}

	public readonly actionSelector: ActionTargetSelector;

	protected _data: BotSpaceCharacterData;
	public get data(): Readonly<BotSpaceCharacterData> {
		return this._data;
	}

	public readonly gameLogicCharacter: GameLogicCharacterClient;

	constructor(data: BotSpaceCharacterData) {
		super();
		this.logger = GetLogger('Character', `[Character ${data.id}]`);
		this._data = data;
		this.actionSelector = freeze<ActionTargetSelector>({ type: 'character', characterId: data.id }, true);

		this.gameLogicCharacter = new GameLogicCharacterClient(() => this._data, this.logger.prefixMessages('[GameLogic]'));

		this.logger.debug('Loaded');
	}

	public update(data: Partial<BotSpaceCharacterData>): void {
		this._data = { ...this.data, ...data };
		this.logger.debug('Updated', data);
		this.emit('update', data);
	}

	public getAppearance(globalState: AssetFrameworkGlobalState): CharacterAppearance {
		return new CharacterAppearance(globalState, this.gameLogicCharacter);
	}
}
