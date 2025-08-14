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
import React, { ReactElement, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import deleteIcon from '../../../assets/icons/delete.svg';
import filterIcon from '../../../assets/icons/filter.svg';
import gridIcon from '../../../assets/icons/grid.svg';
import listIcon from '../../../assets/icons/list.svg';
import { BrowserStorage } from '../../../browserStorage.ts';
import { useCharacterDataOptional, type Character } from '../../../character/character.ts';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { useInputAutofocus } from '../../../common/userInteraction/inputAutofocus.ts';
import { useObservable } from '../../../observable.ts';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useIsNarrowScreen } from '../../../styles/mediaQueries.ts';
import { Button, IconButton } from '../../common/button/button.tsx';
import { Column } from '../../common/container/container.tsx';
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

const WardrobeAssetListViewMode = BrowserStorage.create('wardrobe.asset_list.view', 'list', z.enum(['list', 'grid']));

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
	const viewMode = useObservable(WardrobeAssetListViewMode);
	const [filter, setFilter] = useState('');
	/** Null = nothing selected, '' = show everything, attribute name = filter to that attribute */
	const [attribute, setAttribute] = useState<null | '' | string>(null);

	// If there is at most one attribute or all assets match it, do not display filters
	const finalAttributeFilterOptions = useMemo(() => (
		(attributesFilterOptions == null ||
		attributesFilterOptions.length < 1 ||
		attributesFilterOptions.length === 1 && assets.every((a) => a.staticAttributes.has(attributesFilterOptions[0]))) ? undefined : attributesFilterOptions
	), [attributesFilterOptions, assets]);

	const flt = filter.toLowerCase().trim().split(/\s+/);
	const filteredAssets = useMemo(() => (
		assets
			// Some assets cannot be manually spawned, so ignore those
			.filter((asset) => asset.canBeSpawned())
			.filter((asset) => {
				if (attribute == null || attribute === '' || !finalAttributeFilterOptions?.includes(attribute))
					return true;

				const attributeDefinition = assetManager.getAttributeDefinition(attribute);
				return (
					asset.staticAttributes.has(attribute) &&
					!attributeDefinition?.useAsWardrobeFilter?.excludeAttributes
						?.some((a) => asset.staticAttributes.has(a))
				);
			})
			.filter((asset) => flt.every((f) => (
				asset.definition.name.toLowerCase().includes(f)
			)))
	), [assetManager, assets, flt, finalAttributeFilterOptions, attribute]);

	const sortedAssets = useOrderedAssets(filteredAssets, itemSortIgnorePreferenceOrdering);

	useEffect(() => {
		if (attribute != null && attribute !== '' && !finalAttributeFilterOptions?.includes(attribute)) {
			setAttribute(null);
		}
	}, [attribute, finalAttributeFilterOptions]);

	const filterInput = useRef<TextInput>(null);
	useInputAutofocus(filterInput);

	// Clear filter when looking from different focus
	useEffect(() => {
		setFilter('');
		setAttribute(null);
	}, [container, setFilter]);

	const showFilterSelect = attribute == null && finalAttributeFilterOptions != null && !filter.trim();

	return (
		<div className='inventoryView wardrobeAssetList'>
			{ header }
			<div className='toolbar'>
				{
					<IconButton
						theme={ (attribute != null && attribute !== '') ? 'defaultActive' : 'default' }
						src={ filterIcon }
						alt='Reset filters'
						disabled={ attribute == null && !filter }
						onClick={ () => {
							setAttribute(null);
							setFilter('');
						} }
					/>
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
					listMode={ viewMode === 'list' }
					setListMode={ (listMode) => {
						WardrobeAssetListViewMode.value = listMode ? 'list' : 'grid';
					} }
					disabled={ showFilterSelect }
				/>
			</div>
			{ children }
			<div className='listContainer'>
				{
					overlay != null ? (
						<div className='overlay center-flex'>
							{ overlay }
						</div>
					) : null
				}

				{
					showFilterSelect ? (
						<Column className='flex-1' alignX='center' alignY='center' padding='medium' overflowY='auto'>
							<div className='initialAttributeList'>
								{ finalAttributeFilterOptions.map((a) => (
									<AttributeButton
										key={ a }
										attribute={ a }
										theme='default'
										className='align-start IconButton'
										onClick={ () => setAttribute(a) }
										long
									/>
								)) }
							</div>
							<Button
								className='align-start'
								onClick={ () => {
									setAttribute('');
								} }
							>
								View all assets
							</Button>
						</Column>
					) : (
						<Column className='flex-1' overflowX='clip' overflowY='auto'>
							<div className={ viewMode === 'list' ? 'list' : 'grid' }>
								{
									sortedAssets.map((a) => (
										<ListItemComponent
											key={ a.id }
											asset={ a }
											container={ container }
											listMode={ viewMode === 'list' }
										/>
									))
								}
							</div>
						</Column>
					)
				}
			</div>
		</div>
	);
}

function ListViewToggle({ listMode, setListMode, disabled }: {
	listMode: boolean;
	setListMode: (newValue: boolean) => void;
	disabled: boolean;
}): ReactElement {
	const isNarrowScreen = useIsNarrowScreen();

	// On narrow screens only show the other button
	if (isNarrowScreen) {
		if (listMode) {
			return (
				<IconButton
					onClick={ () => setListMode(false) }
					theme='default'
					className='hideDisabled'
					disabled={ disabled }
					src={ gridIcon }
					alt='Grid view mode'
				/>
			);
		} else {
			return (
				<IconButton
					onClick={ () => setListMode(true) }
					theme='default'
					className='hideDisabled'
					disabled={ disabled }
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
				className='hideDisabled'
				disabled={ disabled }
				src={ gridIcon }
				alt='Grid view mode'
			/>
			<IconButton
				onClick={ () => setListMode(true) }
				theme={ listMode ? 'defaultActive' : 'default' }
				className='hideDisabled'
				disabled={ disabled }
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
