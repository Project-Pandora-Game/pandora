import { ActionRoomContext, AppearanceActionContext, AssetFrameworkGlobalState, ChatRoomFeatureSchema, DoAppearanceAction, EMPTY_ARRAY } from 'pandora-common';
import React, { ReactElement, ReactNode, useEffect, useMemo, useState } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import { Column, Row } from '../../../components/common/container/container';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle/fieldsetToggle';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { InventoryAssetView } from '../../../components/wardrobe/views/wardrobeAssetView';
import { InventoryItemView } from '../../../components/wardrobe/views/wardrobeItemView';
import { useWardrobeContext, wardrobeContext } from '../../../components/wardrobe/wardrobeContext';
import { useWardrobeItems } from '../../../components/wardrobe/wardrobeItems';
import { WardrobeContext, WardrobeContextExtraItemActionComponent, WardrobeFocus, WardrobeHeldItem } from '../../../components/wardrobe/wardrobeTypes';
import { WardrobeFocusesItem } from '../../../components/wardrobe/wardrobeUtils';
import { WardrobeItemConfigMenu } from '../../../components/wardrobe/itemDetail/_wardrobeItemDetail';
import { Observable, useObservable } from '../../../observable';
import { useEditor, useEditorState } from '../../editorContextProvider';
import { useEditorCharacterState } from '../../graphics/character/appearanceEditor';
import { EvalItemPath } from 'pandora-common/dist/assets/appearanceHelpers';
import '../../../components/wardrobe/wardrobe.scss';
import { WardrobeActionButton } from '../../../components/wardrobe/wardrobeComponents';
import { Immutable } from 'immer';

export const EDITOR_ROOM_CONTEXT = {
	features: ChatRoomFeatureSchema.options,
	isAdmin: () => true,
} as const satisfies ActionRoomContext;

export function EditorWardrobeContextProvider({ children }: { children: ReactNode; }): ReactElement {
	const assetManager = useAssetManager();
	const editor = useEditor();
	const globalState = useEditorState();
	const character = editor.character;
	const assetList = assetManager.assetList;

	const focus = useMemo(() => new Observable<Immutable<WardrobeFocus>>({ container: [], itemId: null }), []);
	const extraItemActions = useMemo(() => new Observable<readonly WardrobeContextExtraItemActionComponent[]>([]), []);
	const actionPreviewState = useMemo(() => new Observable<AssetFrameworkGlobalState | null>(null), []);
	const [heldItem, setHeldItem] = useState<WardrobeHeldItem>({ type: 'nothing' });

	const actions = useMemo<AppearanceActionContext>(() => ({
		player: character.gameLogicCharacter,
		globalState: editor.globalState,
		roomContext: EDITOR_ROOM_CONTEXT,
		getCharacter: (id) => {
			if (id === character.id) {
				return character.gameLogicCharacter;
			}
			return null;
		},
	}), [character, editor]);

	useEffect(() => {
		if (heldItem.type === 'item') {
			const rootItems = globalState.getItems(heldItem.target);
			const item = EvalItemPath(rootItems ?? EMPTY_ARRAY, heldItem.path);
			if (!item) {
				setHeldItem({ type: 'nothing' });
			}
		}
	}, [heldItem, globalState]);

	const context = useMemo<WardrobeContext>(() => ({
		target: character,
		targetSelector: {
			type: 'character',
			characterId: character.id,
		},
		globalState,
		player: character,
		assetList,
		heldItem,
		setHeldItem,
		focus,
		extraItemActions,
		actions,
		actionPreviewState,
		execute: (action) => {
			const result = DoAppearanceAction(action, actions, assetManager);

			// Check if result is valid
			if (!result.valid || result.problems.length > 0) {
				return {
					result: 'failure',
					problems: result.problems.slice(),
				};
			}

			// Apply the action
			editor.globalState.setState(result.resultState);

			return {
				result: 'success',
			};
		},
		showExtraActionButtons: true,
		showHoverPreview: true,
	}), [character, globalState, assetList, heldItem, focus, extraItemActions, actions, actionPreviewState, assetManager, editor]);

	return (
		<wardrobeContext.Provider value={ context }>
			{ children }
		</wardrobeContext.Provider>
	);
}

export function EditorWardrobeUI(): ReactElement {
	const { assetList, focus } = useWardrobeContext();
	const currentFocus = useObservable(focus);

	const character = useEditor().character;
	const characterState = useEditorCharacterState();

	const safemode = characterState.restrictionOverride?.type === 'safemode';

	const { containerContentsFilter } = useWardrobeItems(currentFocus);

	const assetManager = useAssetManager();
	const assetFilterAttributes = useMemo<string[]>(() => ([...assetManager.attributes.entries()]
		.filter((a) => a[1].useAsWardrobeFilter)
		.map((a) => a[0])
	), [assetManager]);

	return (
		<Scrollbar color='dark' className='editor-wardrobe slim'>
			<Column padding='medium'>
				<div>
					<label htmlFor='unlocked-toggle'>Character Safemode</label>
					<input
						id='unlocked-toggle'
						type='checkbox'
						checked={ safemode }
						onChange={ (e) => {
							character.getAppearance()
								.editorDoAction({
									type: 'safemode',
									action: e.target.checked ? 'enter' : 'exit',
								});
						} }
					/>
				</div>
				<InventoryItemView
					title='Currently worn items'
					focus={ currentFocus }
					setFocus={ (newFocus) => focus.value = newFocus }
				/>
				{
					WardrobeFocusesItem(currentFocus) && (
						<>
							<hr />
							<div className='flex-col flex-1'>
								<WardrobeItemConfigMenu
									key={ currentFocus.itemId }
									item={ currentFocus }
									setFocus={ (newFocus) => focus.value = newFocus }
								/>
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
						spawnStyle='spawn'
					/>
				</FieldsetToggle>
				<FieldsetToggle legend='Randomization' className='no-padding' open={ false } persistent='wardrobe-randomization'>
					<Row padding='medium'>
						<WardrobeActionButton action={ {
							type: 'randomize',
							kind: 'items',
						} }>
							Randomize clothes
						</WardrobeActionButton>
						<WardrobeActionButton action={ {
							type: 'randomize',
							kind: 'full',
						} }>
							Randomize everything
						</WardrobeActionButton>
					</Row>
				</FieldsetToggle>
			</Column>
		</Scrollbar>
	);
}
