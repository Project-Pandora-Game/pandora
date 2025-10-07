import { freeze } from 'immer';
import { cloneDeep } from 'lodash-es';
import {
	ActionSpaceContext,
	AppearanceAction,
	AppearanceActionProcessingContext,
	ApplyAction,
	AssertNotNullable,
	Asset,
	ASSET_PREFERENCES_DEFAULT,
	AssetFrameworkCharacterState,
	CharacterAppearance,
	CharacterId,
	CharacterRestrictionsManager,
	CharacterView,
	GameLogicCharacter,
	GameLogicCharacterClient,
	GetLogger,
	ICharacterRoomData,
	ItemId,
	TypedEventEmitter,
	type ActionTargetSelector,
	type AssetFrameworkGlobalState,
	type ICharacterPrivateData,
} from 'pandora-common';
import { CharacterEvents } from '../../../character/character.ts';
import type { PlayerCharacter } from '../../../character/player.ts';
import { Editor } from '../../editor.tsx';
import { useEditorState } from '../../editorContextProvider.tsx';

export interface EditorActionContext {
	dryRun?: boolean;
}

export class AppearanceEditor extends CharacterAppearance {
	public readonly editor: Editor;

	constructor(globalState: AssetFrameworkGlobalState, character: GameLogicCharacter, editor: Editor) {
		super(globalState, character);
		this.editor = editor;
	}

	public editorDoAction(
		action: AppearanceAction,
		{ dryRun = false }: EditorActionContext = {},
	): boolean {
		const processingContext = new AppearanceActionProcessingContext(this.editor.getAppearanceActionContext('act'), this.editor.globalState.currentState);
		const result = ApplyAction(processingContext, action);

		if (!result.valid) {
			return false;
		}

		if (!dryRun) {
			this.editor.globalState.setState(result.resultState);
		}
		return true;
	}

	public setPose(bone: string, value: number): boolean {
		if (!Number.isInteger(value))
			throw new Error('Attempt to set non-int pose value');

		const definition = this.assetManager.getBoneByName(bone);
		if (definition == null)
			throw new Error(`Attempt to get pose for unknown bone: ${bone}`);

		return this.editorDoAction({
			type: this.assetManager.getBoneByName(bone).type,
			target: this.id,
			bones: { [bone]: value },
		});
	}

	public addItem(asset: Asset, context: EditorActionContext = {}): boolean {
		return this.editorDoAction({
			type: 'create',
			target: {
				type: 'character',
				characterId: this.id,
			},
			itemTemplate: {
				asset: asset.id,
			},
			container: [],
		}, context);
	}

	public removeItem(id: ItemId, context: EditorActionContext = {}): boolean {
		return this.editorDoAction({
			type: 'delete',
			target: {
				type: 'character',
				characterId: this.id,
			},
			item: {
				container: [],
				itemId: id,
			},
		}, context);
	}

	public moveItem(id: ItemId, shift: number, context: EditorActionContext = {}): boolean {
		return this.editorDoAction({
			type: 'move',
			target: {
				type: 'character',
				characterId: this.id,
			},
			item: {
				container: [],
				itemId: id,
			},
			shift,
		}, context);
	}

	public setView(view: CharacterView, context: EditorActionContext = {}): boolean {
		return this.editorDoAction({
			type: 'pose',
			target: this.id,
			view,
		}, context);
	}
}

export const EDITOR_CHARACTER_ID: CharacterId = 'c1';

export class EditorCharacter extends TypedEventEmitter<CharacterEvents<ICharacterPrivateData & ICharacterRoomData>> implements PlayerCharacter {
	public readonly type = 'character';
	public readonly id = EDITOR_CHARACTER_ID;
	public readonly name = 'Editor character';
	public readonly actionSelector: ActionTargetSelector;

	public readonly editor: Editor;
	protected readonly logger = GetLogger('EditorCharacter');

	public readonly data: ICharacterPrivateData & ICharacterRoomData;
	public readonly gameLogicCharacter: GameLogicCharacterClient;

	constructor(editor: Editor) {
		super();
		this.editor = editor;
		this.actionSelector = freeze<ActionTargetSelector>({ type: 'character', characterId: this.id }, true);
		this.data = {
			id: this.id,
			accountId: 1,
			accountDisplayName: 'Editor Account',
			name: 'Editor Character',
			profileDescription: 'An editor character',
			publicSettings: {},
			onlineStatus: 'online',
			assetPreferences: cloneDeep(ASSET_PREFERENCES_DEFAULT),
			created: editor.created,
			settings: {},
		};
		this.gameLogicCharacter = new GameLogicCharacterClient(() => this.data, this.logger.prefixMessages('[GameLogic]'));
	}

	public isPlayer(): this is PlayerCharacter {
		return true;
	}

	public getAppearance(globalState?: AssetFrameworkGlobalState): AppearanceEditor {
		globalState ??= this.editor.globalState.currentState;
		return new AppearanceEditor(globalState, this.gameLogicCharacter, this.editor);
	}

	public getRestrictionManager(globalState: AssetFrameworkGlobalState | undefined, spaceContext: ActionSpaceContext): CharacterRestrictionsManager {
		return this.getAppearance(globalState).getRestrictionManager(spaceContext);
	}

	public setCreationComplete(): void {
		throw new Error('Character creation inside Editor is not supported');
	}
}

export function useEditorCharacterState(): AssetFrameworkCharacterState {
	const globalState = useEditorState();
	const characterState = globalState.characters.get(EDITOR_CHARACTER_ID);
	AssertNotNullable(characterState);

	return characterState;
}
