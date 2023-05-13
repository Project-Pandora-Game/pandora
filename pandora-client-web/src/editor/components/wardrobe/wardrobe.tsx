import { ActionRoomContext, AppearanceActionContext, AssertNever, ChatRoomFeatureSchema, DoAppearanceAction, RoomInventory } from 'pandora-common';
import React, { ReactElement, ReactNode, useMemo } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import { Column } from '../../../components/common/container/container';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle/fieldsetToggle';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { InventoryAssetView, InventoryItemView, useWardrobeContext, useWardrobeItems, WardrobeContext, wardrobeContext, WardrobeContextExtraItemActionComponent, WardrobeFocusesItem, WardrobeItemConfigMenu } from '../../../components/wardrobe/wardrobe';
import { Observable } from '../../../observable';
import { useEditor, useEditorState } from '../../editorContextProvider';
import { useEditorCharacterState } from '../../graphics/character/appearanceEditor';

const ROOM_CONTEXT = {
	features: ChatRoomFeatureSchema.options,
} as const satisfies ActionRoomContext;

export function EditorWardrobeContextProvider({ children }: { children: ReactNode; }): ReactElement {
	const assetManager = useAssetManager();
	const editor = useEditor();
	const globalState = useEditorState();
	const character = editor.character;
	const assetList = assetManager.assetList;

	const extraItemActions = useMemo(() => new Observable<readonly WardrobeContextExtraItemActionComponent[]>([]), []);

	const actions = useMemo<AppearanceActionContext>(() => ({
		player: character.id,
		globalState: editor.globalState,
		getCharacter: (id) => {
			if (id === character.id) {
				return character.getRestrictionManager(undefined, ROOM_CONTEXT);
			}
			return null;
		},
		getTarget: (target) => {
			if (target.type === 'character') {
				if (target.characterId === character.id) {
					return character.getAppearance();
				}

				return null;
			}

			if (target.type === 'roomInventory') {
				const roomState = editor.globalState.currentState.room;
				if (!roomState)
					return null;

				return new RoomInventory(roomState);
			}

			AssertNever(target);
		},
	}), [character, editor]);

	const context = useMemo<WardrobeContext>(() => ({
		target: character,
		targetSelector: {
			type: 'character',
			characterId: character.id,
		},
		globalState,
		player: character,
		assetList,
		extraItemActions,
		actions,
		execute: (action) => DoAppearanceAction(action, actions, assetManager),
	}), [character, globalState, assetList, extraItemActions, actions, assetManager]);

	return (
		<wardrobeContext.Provider value={ context }>
			{ children }
		</wardrobeContext.Provider>
	);
}

export function EditorWardrobeUI(): ReactElement {
	const { assetList } = useWardrobeContext();

	const character = useEditor().character;
	const characterState = useEditorCharacterState();

	const safemode = characterState.safemode != null;

	const { currentFocus, setFocus, containerContentsFilter } = useWardrobeItems();

	const assetManager = useAssetManager();
	const assetFilterAttributes = useMemo<string[]>(() => ([...assetManager.attributes.entries()]
		.filter((a) => a[1].useAsWardrobeFilter)
		.map((a) => a[0])
	), [assetManager]);

	return (
		<Scrollbar color='dark' className='editor-wardrobe slim'>
			<Column>
				<div>
					<label htmlFor='unlocked-toggle'>Character Safemode</label>
					<input
						id='unlocked-toggle'
						type='checkbox'
						checked={ safemode }
						onChange={ (e) => {
							character.getAppearance().produceState((state) => state.produceWithSafemode(e.target.checked ? { allowLeaveAt: 0 } : null));
						} }
					/>
				</div>
				<InventoryItemView
					title='Currently worn items'
					focus={ currentFocus }
					setFocus={ setFocus }
				/>
				{
					WardrobeFocusesItem(currentFocus) && (
						<>
							<hr />
							<div className='flex-col flex-1'>
								<WardrobeItemConfigMenu key={ currentFocus.itemId } item={ currentFocus } setFocus={ setFocus } />
							</div>
						</>
					)
				}
				<hr />
				<FieldsetToggle legend='Add Items' className='no-padding' open={ false } persistent='wardrobe-add-items'>
					<InventoryAssetView
						title='Create and use a new item'
						assets={ assetList.filter((asset) => {
							return containerContentsFilter(asset);
						}) }
						attributesFilterOptions={ assetFilterAttributes }
						container={ currentFocus.container }
					/>
				</FieldsetToggle>
			</Column>
		</Scrollbar>
	);
}
