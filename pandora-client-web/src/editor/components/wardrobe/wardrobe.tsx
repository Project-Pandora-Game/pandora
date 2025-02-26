import { Immutable } from 'immer';
import {
	AbortActionAttempt,
	ActionSpaceContext,
	AppearanceActionContext,
	AppearanceActionProcessingContext,
	ApplyAction,
	Assert,
	AssetFrameworkGlobalState,
	EMPTY_ARRAY,
	EvalItemPath,
	FinishActionAttempt,
	ItemId,
	StartActionAttempt,
} from 'pandora-common';
import { ReactElement, ReactNode, useEffect, useMemo, useState } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import { Checkbox } from '../../../common/userInteraction/checkbox';
import { Column, Row } from '../../../components/common/container/container';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle/fieldsetToggle';
import { WardrobeItemConfigMenu } from '../../../components/wardrobe/itemDetail/_wardrobeItemDetail';
import { InventoryAssetView } from '../../../components/wardrobe/views/wardrobeAssetView';
import { InventoryItemView } from '../../../components/wardrobe/views/wardrobeItemView';
import '../../../components/wardrobe/wardrobe.scss';
import { WardrobeActionContext, wardrobeActionContext } from '../../../components/wardrobe/wardrobeActionContext';
import { WardrobeActionRandomizeButton } from '../../../components/wardrobe/wardrobeComponents';
import { useWardrobeContext, wardrobeContext } from '../../../components/wardrobe/wardrobeContext';
import { useWardrobeItems } from '../../../components/wardrobe/wardrobeItems';
import { WardrobeContext, WardrobeContextExtraItemActionComponent, WardrobeFocuser, WardrobeHeldItem } from '../../../components/wardrobe/wardrobeTypes';
import { WardrobeFocusesItem } from '../../../components/wardrobe/wardrobeUtils';
import { Observable, useObservable } from '../../../observable';
import { useEditor, useEditorState } from '../../editorContextProvider';
import { useEditorCharacterState } from '../../graphics/character/appearanceEditor';

export const EDITOR_SPACE_CONTEXT = {
	features: [
		'development',
		'allowBodyChanges',
		'allowPronounChanges',
	],
	isAdmin: () => true,
	development: {
		autoAdmin: true,
		disableSafemodeCooldown: true,
	},
} as const satisfies Immutable<ActionSpaceContext>;

export function EditorWardrobeContextProvider({ children }: { children: ReactNode; }): ReactElement {
	const assetManager = useAssetManager();
	const editor = useEditor();
	const globalState = useEditorState();
	const character = editor.character;
	const assetList = assetManager.assetList;

	const focuser = useMemo(() => new WardrobeFocuser(), []);
	const focusedInRoom = useObservable(focuser.inRoom);
	Assert(!focusedInRoom, 'EditorWardrobeContextProvider does not support in-room focus');
	const extraItemActions = useMemo(() => new Observable<readonly WardrobeContextExtraItemActionComponent[]>([]), []);
	const actionPreviewState = useMemo(() => new Observable<AssetFrameworkGlobalState | null>(null), []);
	const [heldItem, setHeldItem] = useState<WardrobeHeldItem>({ type: 'nothing' });
	const [scrollToItem, setScrollToItem] = useState<ItemId | null>(null);

	const actions = useMemo((): AppearanceActionContext => ({
		executionContext: 'clientOnlyVerify',
		player: character.gameLogicCharacter,
		spaceContext: EDITOR_SPACE_CONTEXT,
		getCharacter: (id) => {
			if (id === character.id) {
				return character.gameLogicCharacter;
			}
			return null;
		},
	}), [character]);

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
		doImmediateAction: (action) => {
			// We do direct apply to skip need for attempt in some edge cases.
			const processingContext = new AppearanceActionProcessingContext({
				...actions,
				executionContext: 'act',
			}, editor.globalState.currentState);
			const result = ApplyAction(processingContext, action);

			// Check if result is valid
			if (!result.valid) {
				return {
					result: 'failure',
					problems: result.problems.slice(),
				};
			}

			// Apply the action
			editor.globalState.setState(result.resultState);

			return {
				result: 'success',
				data: result.actionData,
			};
		},
		startActionAttempt: (action) => {
			const result = StartActionAttempt(action, {
				...actions,
				executionContext: 'act',
			}, editor.globalState.currentState, Date.now());

			// Check if result is valid
			if (!result.valid) {
				return {
					result: 'failure',
					problems: result.problems.slice(),
				};
			}

			// Apply the action
			editor.globalState.setState(result.resultState);

			return {
				result: 'success',
				data: result.actionData,
			};
		},
		completeCurrentActionAttempt: () => {
			const result = FinishActionAttempt({
				...actions,
				executionContext: 'act',
			}, editor.globalState.currentState, Date.now());

			// Check if result is valid
			if (!result.valid) {
				return {
					result: 'failure',
					problems: result.problems.slice(),
				};
			}

			// Apply the action
			editor.globalState.setState(result.resultState);

			return {
				result: 'success',
				data: result.actionData,
			};
		},
		abortCurrentActionAttempt: () => {
			const result = AbortActionAttempt({
				...actions,
				executionContext: 'act',
			}, editor.globalState.currentState);

			// Check if result is valid
			if (!result.valid) {
				return {
					result: 'failure',
					problems: result.problems.slice(),
				};
			}

			// Apply the action
			editor.globalState.setState(result.resultState);

			return {
				result: 'success',
				data: result.actionData,
			};
		},
		sendPermissionRequest: (_target, _permissions) => {
			// Editor does not support permission manipulations
			return { result: 'failure' };
		},
	}), [character, globalState, actions, editor]);

	const context = useMemo((): WardrobeContext => ({
		targetSelector: {
			type: 'character',
			characterId: character.id,
		},
		assetList,
		heldItem,
		setHeldItem,
		scrollToItem,
		setScrollToItem,
		focuser,
		extraItemActions,
		actionPreviewState,
		showExtraActionButtons: true,
		showHoverPreview: true,
		itemDisplayNameType: 'custom',
	}), [character, assetList, heldItem, scrollToItem, focuser, extraItemActions, actionPreviewState]);

	return (
		<wardrobeActionContext.Provider value={ actionContext }>
			<wardrobeContext.Provider value={ context }>
				{ children }
			</wardrobeContext.Provider>
		</wardrobeActionContext.Provider>
	);
}

export function EditorWardrobeUI(): ReactElement {
	const { assetList, focuser } = useWardrobeContext();
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
						<WardrobeActionRandomizeButton kind='items' />
						<WardrobeActionRandomizeButton kind='full' />
					</Row>
				</FieldsetToggle>
			</Column>
		</div>
	);
}
