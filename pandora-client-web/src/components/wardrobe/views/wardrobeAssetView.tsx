import classNames from 'classnames';
import { Immutable } from 'immer';
import {
	ASSET_PREFERENCES_DEFAULT,
	AppearanceAction,
	AssertNever,
	Asset,
	AssetPreferenceType,
	AssetPreferenceTypeSchema,
	AssetPreferencesPublic,
	ItemContainerPath,
	ResolveAssetPreference,
	type ICharacterRoomData,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import deleteIcon from '../../../assets/icons/delete.svg';
import filterIcon from '../../../assets/icons/filter.svg';
import gridIcon from '../../../assets/icons/grid.svg';
import listIcon from '../../../assets/icons/list.svg';
import { useCharacterDataOptional, type Character } from '../../../character/character.ts';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { useInputAutofocus } from '../../../common/userInteraction/inputAutofocus.ts';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useIsNarrowScreen } from '../../../styles/mediaQueries.ts';
import { IconButton } from '../../common/button/button.tsx';
import { useSpaceCharacters } from '../../gameContext/gameStateContextProvider.tsx';
import { useWardrobeActionContext, useWardrobeExecuteChecked } from '../wardrobeActionContext.tsx';
import { useStaggeredAppearanceActionResult } from '../wardrobeCheckQueue.ts';
import { ActionWarning, AttributeButton, CheckResultToClassName, InventoryAssetPreview, WardrobeActionButton } from '../wardrobeComponents.tsx';
import { useWardrobeContext } from '../wardrobeContext.tsx';
import { WardrobeContextExtraItemActionComponent } from '../wardrobeTypes.ts';

export function InventoryAssetView({ header, children, assets, container, attributesFilterOptions, spawnStyle }: {
	header?: ReactNode;
	children?: ReactNode;
	assets: readonly Asset[];
	container: ItemContainerPath;
	attributesFilterOptions?: readonly string[];
	spawnStyle: 'spawn' | 'pickup';
}): ReactElement | null {
	const { targetSelector, extraItemActions, heldItem } = useWardrobeContext();
	const { wardrobeExtraActionButtons } = useAccountSettings();

	const extraItemAction = useCallback<WardrobeContextExtraItemActionComponent>(({ item }) => {
		return (wardrobeExtraActionButtons || spawnStyle === 'spawn') ? (
			<WardrobeActionButton action={ {
				type: 'delete',
				target: targetSelector,
				item,
			} }>
				<img src={ deleteIcon } alt='Delete action' />
			</WardrobeActionButton>
		) : null;
	}, [targetSelector, spawnStyle, wardrobeExtraActionButtons]);
	useEffect(() => {
		extraItemActions.value = extraItemActions.value.concat([extraItemAction]);
		return () => {
			extraItemActions.value = extraItemActions.value.filter((a) => a !== extraItemAction);
		};
	}, [extraItemAction, extraItemActions]);

	return (
		<WardrobeAssetList
			header={ header }
			overlay={
				heldItem.type !== 'nothing' ? (
					<InventoryAssetDropArea />
				) : null
			}
			assets={ assets }
			container={ container }
			attributesFilterOptions={ attributesFilterOptions }
			ListItemComponent={ spawnStyle === 'spawn' ? InventoryAssetViewListSpawn : InventoryAssetViewListPickup }
		>
			{ children }
		</WardrobeAssetList>
	);
}

export interface WardrobeAssetListItemProps {
	asset: Asset;
	container: ItemContainerPath;
	listMode: boolean;
}

export function WardrobeAssetList({ header, children, overlay, assets, container, attributesFilterOptions, ListItemComponent, itemSortIgnorePreferenceOrdering = false }: {
	header?: ReactNode;
	children?: ReactNode;
	overlay?: ReactNode;
	assets: readonly Asset[];
	container: ItemContainerPath;
	attributesFilterOptions?: readonly string[];
	itemSortIgnorePreferenceOrdering?: boolean;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	ListItemComponent: React.ComponentType<WardrobeAssetListItemProps>;
}): ReactElement | null {
	const assetManager = useAssetManager();
	const [listMode, setListMode] = useState(true);
	const [filter, setFilter] = useState('');
	const [showAttributeFilters, setShowAttributeFilters] = useState(false);
	const [attribute, setAttribute] = useReducer((old: string, wantToSet: string) => {
		return wantToSet === old ? '' : wantToSet;
	}, '');

	const flt = filter.toLowerCase().trim().split(/\s+/);
	const filteredAssets = useMemo(() => (
		assets
			// Some assets cannot be manually spawned, so ignore those
			.filter((asset) => asset.canBeSpawned())
			.filter((asset) => flt.every((f) => {
				const attributeDefinition = attribute ? assetManager.getAttributeDefinition(attribute) : undefined;
				return asset.definition.name.toLowerCase().includes(f) &&
					((attribute !== '' && attributesFilterOptions?.includes(attribute)) ?
						(
							asset.staticAttributes.has(attribute) &&
							!attributeDefinition?.useAsWardrobeFilter?.excludeAttributes
								?.some((a) => asset.staticAttributes.has(a))
						) : true
					);
			}))
	), [assetManager, assets, flt, attributesFilterOptions, attribute]);

	const sortedAssets = useOrderedAssets(filteredAssets, itemSortIgnorePreferenceOrdering);

	useEffect(() => {
		if (attribute !== '' && !attributesFilterOptions?.includes(attribute)) {
			setAttribute('');
		}
	}, [attribute, attributesFilterOptions]);

	const filterInput = useRef<TextInput>(null);
	useInputAutofocus(filterInput);

	// Clear filter when looking from different focus
	useEffect(() => {
		setFilter('');
		setAttribute('');
		setShowAttributeFilters(false);
	}, [container, setFilter]);

	return (
		<div className='inventoryView wardrobeAssetList'>
			{ header }
			<div className='toolbar'>
				{
					attributesFilterOptions != null ? (
						<IconButton
							theme={ attribute !== '' ? 'defaultActive' : 'default' }
							src={ filterIcon }
							alt='Filter based on attributes'
							onClick={ () => {
								setShowAttributeFilters((v) => !v);
							} }
						/>
					) : null
				}
				<div className='filter'>
					<TextInput ref={ filterInput }
						placeholder='Filter by name'
						value={ filter }
						onChange={ setFilter }
					/>
				</div>
				<div className='flex-1' />
				<ListViewToggle
					listMode={ listMode }
					setListMode={ setListMode }
				/>
			</div>
			{ (attributesFilterOptions == null || !showAttributeFilters) ? null : (
				<div className='toolbar wrap attributeFilter'>
					{ attributesFilterOptions.map((a) => (
						<AttributeButton
							key={ a }
							attribute={ a }
							theme={ attribute === a ? 'defaultActive' : 'default' }
							onClick={ () => setAttribute(a) }
							slim
						/>
					)) }
				</div>
			) }
			{ children }
			<div className='listContainer'>
				{
					overlay != null ? (
						<div className='overlay center-flex'>
							{ overlay }
						</div>
					) : null
				}
				<div className='Scrollbar'>
					<div className={ listMode ? 'list' : 'grid' }>
						{
							sortedAssets.map((a) => (
								<ListItemComponent
									key={ a.id }
									asset={ a }
									container={ container }
									listMode={ listMode }
								/>
							))
						}
					</div>
				</div>
			</div>
		</div>
	);
}

function ListViewToggle({ listMode, setListMode }: {
	listMode: boolean;
	setListMode: (newValue: boolean) => void;
}): ReactElement {
	const isNarrowScreen = useIsNarrowScreen();

	// On narrow screens only show the other button
	if (isNarrowScreen) {
		if (listMode) {
			return (
				<IconButton
					onClick={ () => setListMode(false) }
					theme='default'
					src={ gridIcon }
					alt='Grid view mode'
				/>
			);
		} else {
			return (
				<IconButton
					onClick={ () => setListMode(true) }
					theme='default'
					src={ listIcon }
					alt='List view mode'
				/>
			);
		}
	}

	return (
		<>
			<IconButton
				onClick={ () => setListMode(false) }
				theme={ listMode ? 'default' : 'defaultActive' }
				src={ gridIcon }
				alt='Grid view mode'
			/>
			<IconButton
				onClick={ () => setListMode(true) }
				theme={ listMode ? 'defaultActive' : 'default' }
				src={ listIcon }
				alt='List view mode'
			/>
		</>
	);
}

function InventoryAssetViewListPickup({ asset, listMode }: {
	asset: Asset;
	listMode: boolean;
}): ReactElement {
	const { wardrobeItemRequireFreeHandsToUseDefault } = useAccountSettings();
	const { setHeldItem } = useWardrobeContext();
	const preference = useAssetPreference(asset);

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				listMode ? 'listMode' : 'gridMode',
				'small',
				'allowed',
				`pref-${preference}`,
			) }
			tabIndex={ 0 }
			onClick={ () => {
				setHeldItem({
					type: 'template',
					template: {
						asset: asset.id,
						requireFreeHandsToUse: (asset.isType('personal') || asset.isType('roomDevice')) ? (
							wardrobeItemRequireFreeHandsToUseDefault === 'useAssetValue' ? (asset.definition.requireFreeHandsToUseDefault ?? false) :
							wardrobeItemRequireFreeHandsToUseDefault === 'true' ? true :
							wardrobeItemRequireFreeHandsToUseDefault === 'false' ? false :
							AssertNever(wardrobeItemRequireFreeHandsToUseDefault)
						) : undefined,
					},
				});
			} }>
			<InventoryAssetPreview asset={ asset } small={ listMode } />
			<span className='itemName'>{ asset.definition.name }</span>
		</div>
	);
}

function InventoryAssetViewListSpawn({ asset, container, listMode }: {
	asset: Asset;
	container: ItemContainerPath;
	listMode: boolean;
}): ReactElement {
	const { targetSelector, actionPreviewState } = useWardrobeContext();
	const { wardrobeHoverPreview } = useAccountSettings();
	const [ref, setRef] = useState<HTMLDivElement | null>(null);
	const [isHovering, setIsHovering] = useState(false);
	const preference = useAssetPreference(asset);

	const action = useMemo((): AppearanceAction => ({
		type: 'create',
		target: targetSelector,
		itemTemplate: {
			asset: asset.id,
		},
		container,
	}), [targetSelector, asset, container]);

	const check = useStaggeredAppearanceActionResult(action, { lowPriority: true });
	const { execute, currentAttempt } = useWardrobeExecuteChecked(action, check);

	useEffect(() => {
		if (!isHovering || !wardrobeHoverPreview || check == null || !check.valid)
			return;

		const previewState = check.resultState;

		actionPreviewState.value = previewState;

		return () => {
			if (actionPreviewState.value === previewState) {
				actionPreviewState.value = null;
			}
		};
	}, [isHovering, wardrobeHoverPreview, actionPreviewState, check]);

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				listMode ? 'listMode' : 'gridMode',
				'small',
				`pref-${preference}`,
				CheckResultToClassName(check, currentAttempt != null),
			) }
			tabIndex={ 0 }
			ref={ setRef }
			onClick={ execute }
			onMouseEnter={ () => {
				setIsHovering(true);
			} }
			onMouseLeave={ () => {
				setIsHovering(false);
			} }
		>
			{
				check != null ? (
					<ActionWarning checkResult={ check } actionInProgress={ currentAttempt != null } parent={ ref } />
				) : null
			}
			<InventoryAssetPreview asset={ asset } small={ listMode } />
			<span className='itemName'>{ asset.definition.name }</span>
		</div>
	);
}

function InventoryAssetDropArea(): ReactElement | null {
	const { heldItem, setHeldItem } = useWardrobeContext();

	const action = useMemo<AppearanceAction | null>(() => {
		if (heldItem.type === 'nothing' || heldItem.type === 'template')
			return null;

		if (heldItem.type === 'item') {
			return {
				type: 'delete',
				target: heldItem.target,
				item: heldItem.path,
			};
		}

		AssertNever(heldItem);
	}, [heldItem]);

	const text = useMemo<string | null>(() => {
		if (heldItem.type === 'nothing' || heldItem.type === 'template')
			return null;

		if (heldItem.type === 'item') {
			return 'Delete the item';
		}

		AssertNever(heldItem);
	}, [heldItem]);

	if (heldItem.type === 'template') {
		return (
			<button
				className='wardrobeActionButton overlayDrop centerButton allowed'
				onClick={ () => {
					setHeldItem({ type: 'nothing' });
				} }
			>
				Cancel
			</button>
		);
	}

	if (action == null || text == null) {
		return null;
	}

	return (
		<WardrobeActionButton
			className='overlayDrop centerButton'
			action={ action }
			onExecute={ () => {
				setHeldItem({ type: 'nothing' });
			} }
		>
			{ text }
		</WardrobeActionButton>
	);
}

export function useAssetPreferences(): Immutable<AssetPreferencesPublic> {
	const { targetSelector } = useWardrobeContext();
	const characters = useSpaceCharacters();

	const character = useMemo((): Character<ICharacterRoomData> | null => {
		if (targetSelector.type !== 'character')
			return null;
		return characters?.find((c) => c.data.id === targetSelector.characterId) ?? null;
	}, [characters, targetSelector]);

	const characterPreferences = useCharacterDataOptional(character)?.assetPreferences;

	const preferences = characterPreferences ?? ASSET_PREFERENCES_DEFAULT;

	return preferences;
}

export function useAssetPreferenceResolver(): (asset: Asset) => AssetPreferenceType {
	const { player } = useWardrobeActionContext();
	const preferences = useAssetPreferences();

	return React.useCallback((asset) => {
		const pref = ResolveAssetPreference(preferences, asset, player.id).preference;

		return pref;
	}, [preferences, player.id]);
}

export function useAssetPreference(asset: Asset): AssetPreferenceType {
	const resolvePreference = useAssetPreferenceResolver();
	return useMemo(() => resolvePreference(asset), [asset, resolvePreference]);
}

export function useOrderedAssets(assets: readonly Asset[], ignorePreference: boolean): readonly Asset[] {
	const resolvePreference = useAssetPreferenceResolver();

	return useMemo(() => (
		ignorePreference
			? assets
			: assets.slice().sort((a, b) => {
				const aP = AssetPreferenceTypeSchema.options.indexOf(resolvePreference(a));
				const bP = AssetPreferenceTypeSchema.options.indexOf(resolvePreference(b));
				return aP - bP;
			})
	), [ignorePreference, assets, resolvePreference]);
}
