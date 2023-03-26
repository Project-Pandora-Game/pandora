import { ActionRoomContext, AppearanceActionContext, ChatRoomFeatureSchema, DoAppearanceAction } from 'pandora-common';
import React, { ReactElement, ReactNode, useMemo } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import { useCharacterSafemode } from '../../../character/character';
import { Column } from '../../../components/common/container/container';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle/fieldsetToggle';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { InventoryAssetView, InventoryItemView, useWardrobeContext, useWardrobeItems, WardrobeContext, wardrobeContext, WardrobeContextExtraItemActionComponent, WardrobeFocusesItem, WardrobeItemConfigMenu } from '../../../components/wardrobe/wardrobe';
import { Observable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';

const ROOM_CONTEXT = {
	features: ChatRoomFeatureSchema.options,
} as const satisfies ActionRoomContext;

export function EditorWardrobeContextProvider({ children }: { children: ReactNode; }): ReactElement {
	const assetManager = useAssetManager();
	const editor = useEditor();
	const character = editor.character;
	const assetList = assetManager.assetList;

	const extraItemActions = useMemo(() => new Observable<readonly WardrobeContextExtraItemActionComponent[]>([]), []);

	const actions = useMemo<AppearanceActionContext>(() => ({
		player: character.id,
		getCharacter: (id) => {
			if (id === character.id) {
				return character.appearance.getRestrictionManager(ROOM_CONTEXT);
			}
			return null;
		},
		getTarget: (target) => {
			if (target.type === 'character' && target.characterId === character.id) {
				return character.appearance;
			}
			return null;
		},
	}), [character]);

	const context = useMemo<WardrobeContext>(() => ({
		character,
		player: character,
		room: null,
		target: {
			type: 'character',
			characterId: character.id,
		},
		assetList,
		extraItemActions,
		actions,
		execute: (action) => DoAppearanceAction(action, actions, assetManager),
	}), [character, assetList, actions, extraItemActions, assetManager]);

	return (
		<wardrobeContext.Provider value={ context }>
			{ children }
		</wardrobeContext.Provider>
	);
}

export function EditorWardrobeUI(): ReactElement {
	const { assetList } = useWardrobeContext();

	const character = useEditor().character;
	const safemode = !!useCharacterSafemode(character);

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
							character.appearance.setSafemode(e.target.checked ? { allowLeaveAt: 0 } : null, {});
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
