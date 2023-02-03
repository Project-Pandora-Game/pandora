import { ActionRoomContext, AppearanceActionContext, ChatRoomFeatureSchema } from 'pandora-common';
import React, { ReactElement, ReactNode, useMemo } from 'react';
import { GetAssetManager } from '../../../assets/assetManager';
import { Column } from '../../../components/common/container/container';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { InventoryAssetView, InventoryItemView, useWardrobeContext, useWardrobeItems, WardrobeContext, wardrobeContext, WardrobeFocus, WardrobeFocusesItem, WardrobeItemConfigMenu } from '../../../components/wardrobe/wardrobe';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';

const ROOM_CONTEXT = {
	features: ChatRoomFeatureSchema.options,
} as const satisfies ActionRoomContext;

export function EditorWardrobeContextProvider({ children }: { children: ReactNode; }): ReactElement {
	const editor = useEditor();
	const character = editor.character;
	const assetList = useObservable(GetAssetManager().assetList);

	const actions = useMemo<AppearanceActionContext>(() => ({
		player: character.data.id,
		getCharacter: (id) => {
			if (id === character.data.id) {
				return character.appearance.getRestrictionManager(ROOM_CONTEXT);
			}
			return null;
		},
		getTarget: (target) => {
			if (target.type === 'character' && target.characterId === character.data.id) {
				return character.appearance;
			}
			return null;
		},
	}), [character]);

	const context = useMemo<WardrobeContext>(() => ({
		character,
		player: character,
		target: {
			type: 'character',
			characterId: character.data.id,
		},
		assetList,
		actions,
		useShard: false,
	}), [character]);

	return (
		<wardrobeContext.Provider value={ context }>
			{ children }
		</wardrobeContext.Provider>
	);
}

export function EditorWardrobeUI(): ReactElement {
	const { assetList } = useWardrobeContext();
	const { currentFocus, setFocus, preFilter, containerContentsFilter, assetFilterAttributes } = useWardrobeItems();

	return (
		<Scrollbar color='dark' className='editor-wardrobe slim'>
			<Column>
				<InventoryItemView
					title='Currently worn items'
					filter={ preFilter }
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
				<InventoryAssetView
					title='Create and use a new item'
					assets={ assetList.filter((asset) => {
						return preFilter(asset) && containerContentsFilter(asset);
					}) }
					attributesFilterOptions={ assetFilterAttributes }
					container={ currentFocus.container }
				/>
			</Column>
		</Scrollbar>
	);
}
