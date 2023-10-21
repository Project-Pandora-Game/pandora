import classNames from 'classnames';
import {
	AppearanceAction,
	AppearanceActionProblem,
	AssertNever,
	Asset,
	ItemContainerPath,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import { IconButton } from '../../common/button/button';
import listIcon from '../../../assets/icons/list.svg';
import gridIcon from '../../../assets/icons/grid.svg';
import { Scrollbar } from '../../common/scrollbar/scrollbar';
import { useWardrobeContext, useWardrobeExecuteChecked } from '../wardrobeContext';
import { WardrobeContextExtraItemActionComponent } from '../wardrobeTypes';
import { ActionWarning, AttributeButton, InventoryAssetPreview, WardrobeActionButton } from '../wardrobeComponents';
import { GenerateRandomItemId } from '../wardrobeUtils';
import { useStaggeredAppearanceActionResult } from '../wardrobeCheckQueue';
import { usePermissionCheck } from '../../gameContext/permissionCheckProvider';

export function InventoryAssetView({ className, title, children, assets, container, attributesFilterOptions, spawnStyle }: {
	className?: string;
	title: string;
	children?: ReactNode;
	assets: readonly Asset[];
	container: ItemContainerPath;
	attributesFilterOptions?: string[];
	spawnStyle: 'spawn' | 'pickup';
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
				➖
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
					<div className={ listMode ? 'list' : 'grid' }>
						{
							filteredAssets.map((a) => spawnStyle === 'spawn' ? (
								<InventoryAssetViewListSpawn key={ a.id }
									asset={ a }
									container={ container }
									listMode={ listMode }
								/>
							) : (
								<InventoryAssetViewListPickup key={ a.id }
									asset={ a }
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

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				listMode ? 'listMode' : 'gridMode',
				'small',
				'allowed',
			) }
			tabIndex={ 0 }
			onClick={ () => {
				setHeldItem({
					type: 'asset',
					asset: asset.id,
				});
			} }>
			<InventoryAssetPreview asset={ asset } />
			<span className='itemName'>{ asset.definition.name }</span>
		</div>
	);
}

function InventoryAssetViewListSpawn({ asset, container, listMode }: {
	asset: Asset;
	container: ItemContainerPath;
	listMode: boolean;
}): ReactElement {
	const { targetSelector } = useWardrobeContext();
	const [newItemId, refreshNewItemId] = useReducer(GenerateRandomItemId, undefined, GenerateRandomItemId);

	const action: AppearanceAction = useMemo(() => ({
		type: 'create',
		target: targetSelector,
		itemId: newItemId,
		asset: asset.id,
		container,
	}), [targetSelector, newItemId, asset, container]);

	const check = useStaggeredAppearanceActionResult(action, { lowPriority: true });
	const [execute] = useWardrobeExecuteChecked(action, check, {
		onSuccess: () => refreshNewItemId(),
	});

	const permissionProblems = usePermissionCheck(check?.requiredPermissions);

	const finalProblems = useMemo<readonly AppearanceActionProblem[]>(() => check != null ? [
		...check.problems,
		...permissionProblems,
	] : [], [check, permissionProblems]);

	const [ref, setRef] = useState<HTMLDivElement | null>(null);
	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				listMode ? 'listMode' : 'gridMode',
				'small',
				check === null ? 'pending' : finalProblems.length === 0 ? 'allowed' : 'blocked',
			) }
			tabIndex={ 0 }
			ref={ setRef }
			onClick={ execute }>
			{
				check != null ? (
					<ActionWarning problems={ finalProblems } parent={ ref } />
				) : null
			}
			<InventoryAssetPreview asset={ asset } />
			<span className='itemName'>{ asset.definition.name }</span>
		</div>
	);
}

function InventoryAssetDropArea(): ReactElement | null {
	const { heldItem, setHeldItem } = useWardrobeContext();

	const action = useMemo<AppearanceAction | null>(() => {
		if (heldItem.type === 'nothing' || heldItem.type === 'asset')
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
		if (heldItem.type === 'nothing' || heldItem.type === 'asset')
			return null;

		if (heldItem.type === 'item') {
			return 'Delete the item';
		}

		AssertNever(heldItem);
	}, [heldItem]);

	if (heldItem.type === 'asset') {
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
