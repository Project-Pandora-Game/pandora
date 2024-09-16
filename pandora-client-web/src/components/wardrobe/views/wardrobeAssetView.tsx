import classNames from 'classnames';
import { Immutable } from 'immer';
import {
	ASSET_PREFERENCES_DEFAULT,
	AppearanceAction,
	AppearanceActionProblem,
	AssertNever,
	Asset,
	AssetPreferenceType,
	AssetPreferenceTypeSchema,
	AssetPreferencesPublic,
	EMPTY_ARRAY,
	ItemContainerPath,
	ResolveAssetPreference,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import deleteIcon from '../../../assets/icons/delete.svg';
import gridIcon from '../../../assets/icons/grid.svg';
import listIcon from '../../../assets/icons/list.svg';
import { useCharacterDataOptional } from '../../../character/character';
import { TextInput } from '../../../common/userInteraction/input/textInput';
import { useInputAutofocus } from '../../../common/userInteraction/inputAutofocus';
import { IconButton } from '../../common/button/button';
import { Scrollbar } from '../../common/scrollbar/scrollbar';
import { useWardrobeActionContext, useWardrobeExecuteChecked } from '../wardrobeActionContext';
import { useStaggeredAppearanceActionResult } from '../wardrobeCheckQueue';
import { ActionWarning, AttributeButton, InventoryAssetPreview, WardrobeActionButton } from '../wardrobeComponents';
import { useWardrobeContext } from '../wardrobeContext';
import { WardrobeContextExtraItemActionComponent } from '../wardrobeTypes';

export function InventoryAssetView({ className, title, children, assets, container, attributesFilterOptions, spawnStyle }: {
	className?: string;
	title: string;
	children?: ReactNode;
	assets: readonly Asset[];
	container: ItemContainerPath;
	attributesFilterOptions?: readonly string[];
	spawnStyle: 'spawn' | 'pickup';
}): ReactElement | null {
	const { targetSelector, extraItemActions, heldItem, showExtraActionButtons } = useWardrobeContext();

	const extraItemAction = useCallback<WardrobeContextExtraItemActionComponent>(({ item }) => {
		return (showExtraActionButtons || spawnStyle === 'spawn') ? (
			<WardrobeActionButton action={ {
				type: 'delete',
				target: targetSelector,
				item,
			} }>
				<img src={ deleteIcon } alt='Delete action' />
			</WardrobeActionButton>
		) : null;
	}, [targetSelector, spawnStyle, showExtraActionButtons]);
	useEffect(() => {
		extraItemActions.value = extraItemActions.value.concat([extraItemAction]);
		return () => {
			extraItemActions.value = extraItemActions.value.filter((a) => a !== extraItemAction);
		};
	}, [extraItemAction, extraItemActions]);

	return (
		<WardrobeAssetList
			className={ className }
			title={ title }
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

export function WardrobeAssetList({ className, title, children, overlay, assets, container, attributesFilterOptions, ListItemComponent, itemSortIgnorePreferenceOrdering = false }: {
	className?: string;
	title: string;
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
	}, [container, setFilter]);

	return (
		<div className={ classNames('inventoryView', className) }>
			<div className='toolbar'>
				<span>{ title }</span>
				<TextInput ref={ filterInput }
					placeholder='Filter by name'
					value={ filter }
					onChange={ setFilter }
				/>
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
			</div>
			{ attributesFilterOptions == null ? null : (
				<div className='toolbar'>
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
				<Scrollbar color='dark'>
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
				</Scrollbar>
			</div>
		</div>
	);
}

function InventoryAssetViewListPickup({ asset, listMode }: {
	asset: Asset;
	listMode: boolean;
}): ReactElement {
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
	const { targetSelector, actionPreviewState, showHoverPreview } = useWardrobeContext();
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
	const [execute] = useWardrobeExecuteChecked(action, check);

	const finalProblems: readonly AppearanceActionProblem[] = check?.problems ?? EMPTY_ARRAY;

	useEffect(() => {
		if (!isHovering || !showHoverPreview || check == null || !check.valid || finalProblems.length > 0)
			return;

		const previewState = check.resultState;

		actionPreviewState.value = previewState;

		return () => {
			if (actionPreviewState.value === previewState) {
				actionPreviewState.value = null;
			}
		};
	}, [isHovering, showHoverPreview, actionPreviewState, check, finalProblems]);

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				listMode ? 'listMode' : 'gridMode',
				'small',
				`pref-${preference}`,
				check === null ? 'pending' : finalProblems.length === 0 ? 'allowed' : 'blocked',
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
					<ActionWarning problems={ finalProblems } prompt={ !check.valid && check.prompt != null } parent={ ref } />
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
	const { target } = useWardrobeContext();
	const characterPreferences = useCharacterDataOptional(target.type === 'character' ? target : null)?.assetPreferences;

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
