import classNames from 'classnames';
import {
	ASSET_PREFERENCES_DEFAULT,
	AppearanceAction,
	AppearanceActionProblem,
	AssertNever,
	Asset,
	AssetPreferenceType,
	AssetPreferenceTypeSchema,
	AssetPreferences,
	ItemContainerPath,
	KnownObject,
	ResolveAssetPreference,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import { IconButton } from '../../common/button/button';
import listIcon from '../../../assets/icons/list.svg';
import gridIcon from '../../../assets/icons/grid.svg';
import deleteIcon from '../../../assets/icons/delete.svg';
import { Scrollbar } from '../../common/scrollbar/scrollbar';
import { useWardrobeContext, useWardrobeExecuteChecked } from '../wardrobeContext';
import { WardrobeContextExtraItemActionComponent } from '../wardrobeTypes';
import { ActionWarning, AttributeButton, InventoryAssetPreview, WardrobeActionButton } from '../wardrobeComponents';
import { useStaggeredAppearanceActionResult } from '../wardrobeCheckQueue';
import { usePermissionCheck } from '../../gameContext/permissionCheckProvider';
import { useCharacterDataOptional } from '../../../character/character';
import { useShardConnector } from '../../gameContext/shardConnectorContextProvider';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { Immutable } from 'immer';

type AssetViewSpawnStyle = 'spawn' | 'pickup' | 'preference';

export function InventoryAssetView({ className, title, children, assets, container, attributesFilterOptions, spawnStyle }: {
	className?: string;
	title: string;
	children?: ReactNode;
	assets: readonly Asset[];
	container: ItemContainerPath;
	attributesFilterOptions?: string[];
	spawnStyle: AssetViewSpawnStyle;
}): ReactElement | null {
	const { targetSelector, extraItemActions, heldItem, showExtraActionButtons } = useWardrobeContext();

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

	const sortedAssets = useOrderedAssets(filteredAssets, spawnStyle === 'preference');

	useEffect(() => {
		if (attribute !== '' && !attributesFilterOptions?.includes(attribute)) {
			setAttribute('');
		}
	}, [attribute, attributesFilterOptions]);

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

	const filterInput = useRef<HTMLInputElement>(null);

	useEffect(() => {
		// Handler to autofocus search
		const keyPressHandler = (ev: KeyboardEvent) => {
			if (
				filterInput.current &&
				// Only if no other input is selected
				(!document.activeElement || !(document.activeElement instanceof HTMLInputElement)) &&
				// Only if this isn't a special key or key combo
				!ev.ctrlKey &&
				!ev.metaKey &&
				!ev.altKey &&
				ev.key.length === 1
			) {
				filterInput.current.focus();
			}
		};
		window.addEventListener('keypress', keyPressHandler);
		return () => {
			window.removeEventListener('keypress', keyPressHandler);
		};
	}, []);

	// Clear filter when looking from different focus
	useEffect(() => {
		setFilter('');
	}, [container, setFilter]);

	return (
		<div className={ classNames('inventoryView', className) }>
			<div className='toolbar'>
				<span>{ title }</span>
				<input ref={ filterInput }
					type='text'
					placeholder='Filter by name'
					value={ filter }
					onChange={ (e) => setFilter(e.target.value) }
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
					heldItem.type !== 'nothing' ? (
						<div className='overlay center-flex'>
							<InventoryAssetDropArea />
						</div>
					) : null
				}
				<Scrollbar color='dark'>
					<div className={ classNames(listMode ? 'list' : 'grid', `spawn-style-${spawnStyle}`) }>
						{
							sortedAssets.map((a) => (
								<InventoryAssetViewListTemplate
									key={ a.id }
									asset={ a }
									container={ container }
									listMode={ listMode }
									spawnStyle={ spawnStyle }
								/>
							))
						}
					</div>
				</Scrollbar>
			</div>
		</div>
	);
}

function InventoryAssetViewListTemplate({ asset, container, listMode, spawnStyle }: {
	asset: Asset;
	container: ItemContainerPath;
	listMode: boolean;
	spawnStyle: AssetViewSpawnStyle;
}): ReactElement {
	switch (spawnStyle) {
		case 'spawn':
			return (
				<InventoryAssetViewListSpawn
					asset={ asset }
					container={ container }
					listMode={ listMode }
				/>
			);
		case 'pickup':
			return (
				<InventoryAssetViewListPickup
					asset={ asset }
					listMode={ listMode }
				/>
			);
		case 'preference':
			return (
				<InventoryAssetViewListPreference
					asset={ asset }
					listMode={ listMode }
				/>
			);
	}
	AssertNever(spawnStyle);
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

	const permissionProblems = usePermissionCheck(check?.requiredPermissions);

	const finalProblems = useMemo<readonly AppearanceActionProblem[]>(() => check != null ? [
		...check.problems,
		...permissionProblems,
	] : [], [check, permissionProblems]);

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
					<ActionWarning problems={ finalProblems } parent={ ref } />
				) : null
			}
			<InventoryAssetPreview asset={ asset } small={ listMode } />
			<span className='itemName'>{ asset.definition.name }</span>
		</div>
	);
}

const ASSET_PREFERENCE_DESCRIPTIONS = {
	favorite: {
		name: 'Favorite',
		description: 'Show this item at the top of the list.',
	},
	normal: {
		name: 'Normal',
		description: 'Normal priority.',
	},
	maybe: {
		name: 'Maybe',
		description: 'Show this item at the bottom of the list.',
	},
	prevent: {
		name: 'Prevent',
		description: 'Prevent this item from being used.',
	},
	doNotRender: {
		name: 'Do not render',
		description: 'Do not render this item.',
	},
} as const satisfies Readonly<Record<AssetPreferenceType, Readonly<{ name: string; description: string; }>>>;

function InventoryAssetViewListPreference({ asset, listMode }: {
	asset: Asset;
	listMode: boolean;
}): ReactElement {
	const shardConnector = useShardConnector();
	const current = useAssetPreference(asset);

	const onChange = useCallback((ev: React.ChangeEvent<HTMLSelectElement>) => {
		const value = ev.target.value as AssetPreferenceType;
		if (value === current)
			return;

		shardConnector?.awaitResponse('updateAssetPreferences', {
			assets: {
				[asset.id]: { base: value },
			},
		}).then(({ result }) => {
			if (result !== 'ok')
				toast('Asset not be worn before setting "do not render"', TOAST_OPTIONS_ERROR);
		}).catch((err) => {
			if (err instanceof Error)
				toast(`Failed to update asset preference: ${err.message}`, TOAST_OPTIONS_ERROR);
		});
	}, [asset, current, shardConnector]);

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				listMode ? 'listMode' : 'gridMode',
				'small',
				'allowed',
				`pref-${current}`,
			) }
			tabIndex={ 0 }
		>
			<InventoryAssetPreview asset={ asset } small={ listMode } />
			<span className='itemName'>{ asset.definition.name }</span>
			<select onChange={ onChange } value={ current }>
				{
					KnownObject.entries(ASSET_PREFERENCE_DESCRIPTIONS).map(([key, { name, description }]) => (
						<option key={ key } value={ key } title={ description }>
							{ name }
						</option>
					))
				}
			</select>
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

export function useAssetPreferences(): Immutable<AssetPreferences> {
	const { target } = useWardrobeContext();
	const characterPreferences = useCharacterDataOptional(target.type === 'character' ? target : null)?.assetPreferences;

	const preferences = characterPreferences ?? ASSET_PREFERENCES_DEFAULT;

	return preferences;
}

export function useAssetPreferenceResolver(): (asset: Asset) => AssetPreferenceType {
	const { player, target } = useWardrobeContext();
	const preferences = useAssetPreferences();
	const selfPreference = useCharacterDataOptional((target.type === 'room' || target.id !== player.id) ? player : null)?.assetPreferences;

	return React.useCallback((asset) => {
		const pref = ResolveAssetPreference(preferences, asset, player.id);
		if (selfPreference == null || pref === 'doNotRender')
			return pref;

		if (ResolveAssetPreference(selfPreference, asset, player.id) === 'doNotRender')
			return 'doNotRender';

		return pref;
	}, [preferences, selfPreference, player.id]);
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
