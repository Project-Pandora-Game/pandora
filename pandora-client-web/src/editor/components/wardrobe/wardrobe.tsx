import {
	AppearanceActionContext,
	Assert,
	AssetFrameworkGlobalState,
	EMPTY_ARRAY,
	EvalItemPath,
	ItemId,
} from 'pandora-common';
import { ReactElement, ReactNode, useEffect, useMemo, useState } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle/fieldsetToggle.tsx';
import { WardrobeItemConfigMenu } from '../../../components/wardrobe/itemDetail/_wardrobeItemDetail.tsx';
import { InventoryAssetView } from '../../../components/wardrobe/views/wardrobeAssetView.tsx';
import { InventoryItemView } from '../../../components/wardrobe/views/wardrobeItemView.tsx';
import '../../../components/wardrobe/wardrobe.scss';
import { WardrobeActionContext, wardrobeActionContext } from '../../../components/wardrobe/wardrobeActionContext.tsx';
import { WardrobeActionRandomizeButton } from '../../../components/wardrobe/wardrobeComponents.tsx';
import { useWardrobeContext, wardrobeContext } from '../../../components/wardrobe/wardrobeContext.tsx';
import { useWardrobeItems } from '../../../components/wardrobe/wardrobeItems.tsx';
import { WardrobeContext, WardrobeContextExtraItemActionComponent, WardrobeFocuser, WardrobeHeldItem } from '../../../components/wardrobe/wardrobeTypes.ts';
import { WardrobeFocusesItem } from '../../../components/wardrobe/wardrobeUtils.ts';
import { Observable, useObservable } from '../../../observable.ts';
import { useEditor, useEditorState } from '../../editorContextProvider.tsx';
import { useEditorCharacterState } from '../../graphics/character/appearanceEditor.ts';

export function EditorWardrobeContextProvider({ children }: { children: ReactNode; }): ReactElement {
	const editor = useEditor();
	const globalState = useEditorState();
	const character = editor.character;

	const focuser = useMemo(() => new WardrobeFocuser(), []);
	const focusedInRoom = useObservable(focuser.inRoom);
	Assert(focusedInRoom == null, 'EditorWardrobeContextProvider does not support in-room focus');
	const extraItemActions = useMemo(() => new Observable<readonly WardrobeContextExtraItemActionComponent[]>([]), []);
	const actionPreviewState = useMemo(() => new Observable<AssetFrameworkGlobalState | null>(null), []);
	const [heldItem, setHeldItem] = useState<WardrobeHeldItem>({ type: 'nothing' });
	const [scrollToItem, setScrollToItem] = useState<ItemId | null>(null);

	const actions = useMemo((): AppearanceActionContext => ({
		executionContext: 'clientOnlyVerify',
		player: character.gameLogicCharacter,
		spaceContext: editor.getCurrentSpaceContext(),
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

	const actionContext = useMemo((): WardrobeActionContext => ({
		player: character,
		globalState,
		actions,
		doImmediateAction: (action) => editor.doImmediateAction(action),
		startActionAttempt: (action) => editor.startActionAttempt(action),
		completeCurrentActionAttempt: () => editor.completeCurrentActionAttempt(),
		abortCurrentActionAttempt: () => editor.abortCurrentActionAttempt(),
		sendPermissionRequest: (_target, _permissions) => {
			// Editor does not support permission manipulations
			return { result: 'failure' };
		},
	}), [character, globalState, actions, editor]);

	const characterState = globalState.getCharacterState(character.id);
	Assert(characterState != null);

	const context = useMemo((): WardrobeContext => ({
		targetSelector: {
			type: 'character',
			characterId: character.id,
		},
		currentRoomSelector: {
			type: 'room',
			roomId: characterState.currentRoom,
		},
		heldItem,
		setHeldItem,
		scrollToItem,
		setScrollToItem,
		focuser,
		extraItemActions,
		actionPreviewState,
	}), [character, characterState.currentRoom, heldItem, scrollToItem, focuser, extraItemActions, actionPreviewState]);

	return (
		<wardrobeActionContext.Provider value={ actionContext }>
			<wardrobeContext.Provider value={ context }>
				{ children }
			</wardrobeContext.Provider>
		</wardrobeActionContext.Provider>
	);
}

export function EditorWardrobeUI(): ReactElement {
	const assetList = useAssetManager().assetList;
	const { focuser } = useWardrobeContext();
	const currentFocus = useObservable(focuser.current);

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
		<div className='Scrollbar editor-wardrobe slim'>
			<Column padding='medium'>
				<div>
					<label htmlFor='unlocked-toggle'>Character Safemode</label>
					<Checkbox
						id='unlocked-toggle'
						checked={ safemode }
						onChange={ (newValue) => {
							character.getAppearance()
								.editorDoAction({
									type: 'restrictionOverrideChange',
									mode: newValue ? 'normal' : 'safemode',
								});
						} }
					/>
				</div>
				<InventoryItemView title='Currently worn items' />
				{
					WardrobeFocusesItem(currentFocus) && (
						<>
							<hr />
							<div className='flex-col flex-1'>
								<WardrobeItemConfigMenu
									key={ currentFocus.itemId }
									item={ currentFocus }
									room={ { type: 'room', roomId: characterState.currentRoom } }
								/>
							</div>
						</>
					)
				}
				<hr className='fill-x' />
				<FieldsetToggle legend='Add Items' className='no-padding' open={ false } persistent='wardrobe-add-items'>
					<InventoryAssetView
						header={ (
							<div className='toolbar'>
								<span>Create and use a new item</span>
							</div>
						) }
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
						<WardrobeActionRandomizeButton kind='items' />
						<WardrobeActionRandomizeButton kind='full' />
					</Row>
				</FieldsetToggle>
			</Column>
		</div>
	);
}
