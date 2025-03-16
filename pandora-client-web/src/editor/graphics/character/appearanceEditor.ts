import { cloneDeep } from 'lodash-es';
import {
	ActionSpaceContext,
	AppearanceAction,
	AppearanceActionContext,
	AppearanceActionProcessingContext,
	ApplyAction,
	AssertNotNullable,
	Asset,
	ASSET_PREFERENCES_DEFAULT,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalStateContainer,
	CHARACTER_DEFAULT_PUBLIC_SETTINGS,
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
	type AssetFrameworkGlobalState,
} from 'pandora-common';
import { CharacterEvents, ICharacter } from '../../../character/character.ts';
import { EDITOR_SPACE_CONTEXT } from '../../components/wardrobe/wardrobe.tsx';
import { Editor } from '../../editor.tsx';
import { useEditorState } from '../../editorContextProvider.tsx';

export interface EditorActionContext {
	dryRun?: boolean;
}

export class AppearanceEditor extends CharacterAppearance {
	public readonly globalStateContainer: AssetFrameworkGlobalStateContainer;

	constructor(globalState: AssetFrameworkGlobalState, character: GameLogicCharacter, globalStateContainer: AssetFrameworkGlobalStateContainer) {
		super(globalState, character);
		this.globalStateContainer = globalStateContainer;
	}

	protected _makeActionContext(): AppearanceActionContext {
		return {
			executionContext: 'act',
			player: this.character,
			spaceContext: EDITOR_SPACE_CONTEXT,
			getCharacter: (id) => {
				if (id === this.id) {
					return this.character;
				}
				return null;
			},
		};
	}

	public editorDoAction(
		action: AppearanceAction,
		{ dryRun = false }: EditorActionContext = {},
	): boolean {
		const processingContext = new AppearanceActionProcessingContext(this._makeActionContext(), this.globalStateContainer.currentState);
		const result = ApplyAction(processingContext, action);

		if (!result.valid) {
			return false;
		}

		if (!dryRun) {
			this.globalStateContainer.setState(result.resultState);
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

export const EDITOR_CHARACTER_ID: CharacterId = 'c0';

export class EditorCharacter extends TypedEventEmitter<CharacterEvents<ICharacterRoomData>> implements ICharacter<ICharacterRoomData> {
	public readonly type = 'character';
	public readonly id = EDITOR_CHARACTER_ID;
	public readonly name = 'Editor character';

	public readonly editor: Editor;
	protected readonly logger = GetLogger('EditorCharacter');

	public readonly data: ICharacterRoomData;
	public readonly gameLogicCharacter: GameLogicCharacterClient;

	constructor(editor: Editor) {
		super();
		this.editor = editor;
		this.data = {
			id: this.id,
			accountId: 0,
			name: 'EditorCharacter',
			profileDescription: 'An editor character',
			settings: cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
			position: [0, 0, 0],
			isOnline: true,
			assetPreferences: cloneDeep(ASSET_PREFERENCES_DEFAULT),
		};
		this.gameLogicCharacter = new GameLogicCharacterClient(() => this.data, this.logger.prefixMessages('[GameLogic]'));
	}

	public isPlayer(): boolean {
		return true;
	}

	public getAppearance(globalState?: AssetFrameworkGlobalState): AppearanceEditor {
		globalState ??= this.editor.globalState.currentState;
		return new AppearanceEditor(globalState, this.gameLogicCharacter, this.editor.globalState);
	}

	public getRestrictionManager(globalState: AssetFrameworkGlobalState | undefined, spaceContext: ActionSpaceContext): CharacterRestrictionsManager {
		return this.getAppearance(globalState).getRestrictionManager(spaceContext);
	}
}

export function useEditorCharacterState(): AssetFrameworkCharacterState {
	const globalState = useEditorState();
	const characterState = globalState.characters.get(EDITOR_CHARACTER_ID);
	AssertNotNullable(characterState);

	return characterState;
}
