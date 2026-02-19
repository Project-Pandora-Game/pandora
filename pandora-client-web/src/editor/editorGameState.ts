import type { Immutable } from 'immer';
import { CloneDeepMutable, EMPTY_ARRAY, TypedEventEmitter, type ActionSpaceContext, type AppearanceAction, type AppearanceActionContext, type AssetFrameworkGlobalStateContainer, type CharacterId, type ChatCharacterStatus, type CurrentSpaceInfo, type ICharacterRoomData, type IClientShardPromiseResult, type SpaceCharacterModifierEffectData } from 'pandora-common';
import type { Character } from '../character/character.ts';
import type { PlayerCharacter } from '../character/player.ts';
import { ChatSendError, type GameState, type GameStateEvents, type ISavedMessage } from '../components/gameContext/gameStateContextProvider.tsx';
import { StaticObservable, type ReadonlyObservable } from '../observable.ts';
import type { ChatMessagePreprocessed } from '../ui/components/chat/chatMessageTypes.ts';
import type { Editor } from './editor.tsx';

export class EditorGameStateProxy extends TypedEventEmitter<GameStateEvents> implements GameState {
	public readonly editor: Editor;

	constructor(editor: Editor) {
		super();
		this.editor = editor;

		this.globalState = editor.globalState;
		this.player = editor.character;
		this.characters = new StaticObservable([editor.character]);

		const editorSpaceContext = editor.getCurrentSpaceContext();

		this.currentSpace = new StaticObservable<CurrentSpaceInfo>({
			id: null,
			config: {
				name: `Editor test space`,
				entryText: '',
				description: '',
				public: 'private',
				maxUsers: 1,
				features: CloneDeepMutable(editorSpaceContext.features),
				development: CloneDeepMutable(editorSpaceContext.development),
				banned: [],
				admin: [],
				allow: [],
				ghostManagement: null,
				owners: [editor.character.data.accountId],
				ownerInvites: [],
				spaceSwitchStatus: [],
			},
		});

		this.editor.on('globalStateChange', () => {
			this.emit('globalStateChange', true);
		});
	}

	//#region Game state

	public readonly globalState: AssetFrameworkGlobalStateContainer;

	public readonly player: PlayerCharacter;
	public readonly characters: ReadonlyObservable<readonly Character<ICharacterRoomData>[]>;

	public readonly currentSpace: ReadonlyObservable<CurrentSpaceInfo>;
	public readonly characterModifierEffects = new StaticObservable<Immutable<SpaceCharacterModifierEffectData>>({});

	public doImmediateAction(action: Immutable<AppearanceAction>): IClientShardPromiseResult['gameLogicAction'] {
		return Promise.resolve(this.editor.doImmediateAction(action));
	}

	public startActionAttempt(action: Immutable<AppearanceAction>): IClientShardPromiseResult['gameLogicAction'] {
		return Promise.resolve(this.editor.startActionAttempt(action));
	}

	public completeCurrentActionAttempt(): IClientShardPromiseResult['gameLogicAction'] {
		return Promise.resolve(this.editor.completeCurrentActionAttempt());
	}

	public abortCurrentActionAttempt(): IClientShardPromiseResult['gameLogicAction'] {
		return Promise.resolve(this.editor.abortCurrentActionAttempt());
	}

	public getCurrentSpaceContext(): ActionSpaceContext {
		return this.editor.getCurrentSpaceContext();
	}

	public getCurrentAppearanceActionContext(executionContext: AppearanceActionContext['executionContext']): AppearanceActionContext {
		return {
			executionContext,
			player: this.player.gameLogicCharacter,
			spaceContext: this.getCurrentSpaceContext(),
			getCharacter: (id) => {
				const state = this.globalState.currentState.getCharacterState(id);
				const character = this.characters.value.find((c) => c.id === id);
				if (!state || !character)
					return null;

				return character.gameLogicCharacter;
			},
		};
	}

	//#endregion

	//#region Chat

	public readonly messages = new StaticObservable<readonly ChatMessagePreprocessed[]>(EMPTY_ARRAY);
	public readonly status = new StaticObservable<ReadonlyMap<CharacterId, ChatCharacterStatus>>(new Map());

	public sendMessage(): void {
		throw new ChatSendError('Sending messages inside Editor is not supported');
	}

	public deleteMessage(): void {
		throw new ChatSendError('Editing messages inside Editor is not supported');
	}

	public getMessageEditTimeout(): number | undefined {
		return undefined;
	}

	public getMessageEdit(): ISavedMessage | undefined {
		return undefined;
	}

	public getLastMessageEdit(): number | undefined {
		return undefined;
	}

	public setPlayerStatus(): void {
		// NOOP
	}

	//#endregion
}
