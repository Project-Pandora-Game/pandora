import classNames from 'classnames';
import {
	AppearanceAction,
	AppearanceItems,
	AssertNever,
	EMPTY_ARRAY,
	Item,
	ItemContainerPath,
	ItemId,
	ItemPath,
	RoomTargetSelector,
} from 'pandora-common';
import React, { ReactElement, useEffect, useMemo, useReducer, useState } from 'react';
import { useObservable } from '../../../observable';
import { isEqual } from 'lodash';
import { IItemModule } from 'pandora-common/dist/assets/modules/common';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import { EvalContainerPath, SplitContainerPath } from 'pandora-common/dist/assets/appearanceHelpers';
import arrowAllIcon from '../../../assets/icons/arrow_all.svg';
import { useItemColorRibbon } from '../../../graphics/graphicsLayer';
import { Scrollbar } from '../../common/scrollbar/scrollbar';
import { WardrobeFocus, WardrobeHeldItem } from '../wardrobeTypes';
import { useWardrobeContext } from '../wardrobeContext';
import { GenerateRandomItemId, useWardrobeTargetItem, useWardrobeTargetItems } from '../wardrobeUtils';
import { useStaggeredAppearanceActionResult } from '../wardrobeCheckQueue';
import { ActionWarning, InventoryAssetPreview, WardrobeActionButton } from '../wardrobeComponents';

export function InventoryItemView({
	className,
	title,
	filter,
	focus = { container: [], itemId: null },
	setFocus,
}: {
	className?: string;
	title: string;
	filter?: (item: Item) => boolean;
	focus?: WardrobeFocus;
	setFocus?: (newFocus: WardrobeFocus) => void;
}): ReactElement | null {
	const { target, targetSelector, heldItem } = useWardrobeContext();
	const appearance = useWardrobeTargetItems(target);

	const [displayedItems, containerModule, containerSteps] = useMemo<[AppearanceItems, IItemModule | undefined, readonly string[]]>(() => {
		let items: AppearanceItems = filter ? appearance.filter(filter) : appearance;
		let container: IItemModule | undefined;
		const steps: string[] = [];
		for (const step of focus.container) {
			const item = items.find((it) => it.id === step.item);
			const module = item?.modules.get(step.module);
			if (!item || !module)
				return [[], undefined, []];
			steps.push(`${item.asset.definition.name} (${module.config.name})`);
			container = module;
			items = item.getModuleItems(step.module);
		}
		return [items, container, steps];
	}, [appearance, filter, focus]);

	const singleItemContainer = containerModule != null && containerModule instanceof ItemModuleLockSlot;
	useEffect(() => {
		// Locks have special GUI on higher level, so be friendly and focus on that when there is a lock
		if (containerModule?.type === 'lockSlot' && displayedItems.length === 1) {
			const prev = SplitContainerPath(focus.container)?.itemPath;
			if (prev) {
				setFocus?.(prev);
				return;
			}
		}

		if (!singleItemContainer)
			return;

		if (displayedItems.length === 1 && focus.itemId == null) {
			setFocus?.({ ...focus, itemId: displayedItems[0].id });
		} else if (displayedItems.length === 0 && focus.itemId != null) {
			setFocus?.({ ...focus, itemId: null });
		}
	}, [focus, setFocus, containerModule, singleItemContainer, displayedItems]);

	return (
		<div className={ classNames('inventoryView', className) }>
			<div className='toolbar'>
				{
					focus.container.length > 0 ? (
						<>
							<button className='modeButton' onClick={ () => {
								const prev = SplitContainerPath(focus.container)?.itemPath;
								setFocus?.(prev ?? { container: [], itemId: null });
							} } >
								Close
							</button>
							<div className='center-flex'>
								Viewing contents of: <br />
								{ containerSteps.join(' > ') }
							</div>
						</>
					) :
						<span>{ title }</span>
				}
			</div>
			<Scrollbar color='dark'>
				<div className='list withDropButtons'>
					{
						heldItem.type !== 'nothing' ? (
							<div className='overlay' />
						) : null
					}
					{
						displayedItems.map((i) => (
							<React.Fragment key={ i.id }>
								<div className='overlayDropContainer'>
									{
										heldItem.type !== 'nothing' ? (
											<InventoryItemViewDropArea
												target={ targetSelector }
												container={ focus.container }
												insertBefore={ i.id }
											/>
										) : null
									}
								</div>
								<InventoryItemViewList
									item={ { container: focus.container, itemId: i.id } }
									selected={ i.id === focus.itemId }
									setFocus={ setFocus }
									singleItemContainer={ singleItemContainer }
								/>
							</React.Fragment>
						))
					}
					<div className='overlayDropContainer'>
						{
							heldItem.type !== 'nothing' ? (
								<InventoryItemViewDropArea
									target={ targetSelector }
									container={ focus.container }
								/>
							) : null
						}
					</div>
				</div>
			</Scrollbar>
		</div>
	);
}

export function InventoryItemViewDropArea({ target, container, insertBefore }: {
	target: RoomTargetSelector;
	container: ItemContainerPath;
	insertBefore?: ItemId;
}): ReactElement | null {
	const { execute, heldItem, setHeldItem, globalState } = useWardrobeContext();

	const [ref, setRef] = useState<HTMLDivElement | null>(null);
	const [newItemId, refreshNewItemId] = useReducer(GenerateRandomItemId, undefined, GenerateRandomItemId);

	// Check if we are not trying to do NOOP
	const identicalContainer = heldItem.type === 'item' &&
		isEqual(target, heldItem.target) &&
		isEqual(container, heldItem.path.container);
	const targetIsSource = identicalContainer && insertBefore === heldItem.path.itemId;

	const action = useMemo<AppearanceAction | null>(() => {
		if (heldItem.type === 'nothing' || targetIsSource)
			return null;

		if (heldItem.type === 'item') {
			// Check whether this should be omitted, because it leads to same position (we are moving in front of the item behind this one)
			if (identicalContainer) {
				const items = EvalContainerPath(
					globalState.getItems(target) ?? EMPTY_ARRAY,
					container,
				) ?? EMPTY_ARRAY;

				const originalPosition = items.findIndex((it) => it.id === heldItem.path.itemId);
				const targetPosition = insertBefore ? items.findIndex((it) => it.id === insertBefore) : items.length;
				if (originalPosition >= 0 && targetPosition >= 0 && targetPosition === originalPosition + 1)
					return null;
			}

			return {
				type: 'transfer',
				source: heldItem.target,
				item: heldItem.path,
				target,
				container,
				insertBefore,
			};
		}

		if (heldItem.type === 'asset') {
			return {
				type: 'create',
				target,
				itemId: newItemId,
				asset: heldItem.asset,
				container,
				insertBefore,
			};
		}

		AssertNever(heldItem);
	}, [heldItem, target, container, targetIsSource, identicalContainer, globalState, newItemId, insertBefore]);

	const text = useMemo<string | null>(() => {
		if (heldItem.type === 'nothing')
			return null;

		if (heldItem.type === 'item') {
			return 'Move item here';
		}

		if (heldItem.type === 'asset') {
			return 'Create item here';
		}

		AssertNever(heldItem);
	}, [heldItem]);

	const check = useStaggeredAppearanceActionResult(action);

	if (action == null || text == null) {
		return null;
	}

	return (
		<div
			className={ classNames('overlayDrop', 'inventoryViewItem', check === null ? 'pending' : check.result === 'success' ? 'allowed' : 'blocked') }
			tabIndex={ 0 }
			ref={ setRef }
			onClick={ () => {
				if (check?.result === 'success') {
					execute(action);
					setHeldItem({ type: 'nothing' });
					refreshNewItemId();
				}
			} }
		>
			{
				check != null ? (
					<ActionWarning check={ check } parent={ ref } />
				) : null
			}
			{ text }
		</div>
	);
}

function InventoryItemViewList({ item, selected = false, setFocus, singleItemContainer = false }: {
	item: ItemPath;
	selected?: boolean;
	setFocus?: (newFocus: WardrobeFocus) => void;
	singleItemContainer?: boolean;
}): ReactElement {
	const { targetSelector, target, extraItemActions, heldItem, setHeldItem } = useWardrobeContext();
	const wornItem = useWardrobeTargetItem(target, item);
	const extraActions = useObservable(extraItemActions);

	const ribbonColor = useItemColorRibbon([], wornItem ?? null);

	const heldItemSelector: WardrobeHeldItem = {
		type: 'item',
		target: targetSelector,
		path: item,
	};

	// Check if this item is held
	const isHeld = isEqual(heldItem, heldItemSelector);

	if (!wornItem) {
		return <div className='inventoryViewItem listMode blocked'>[ ERROR: ITEM NOT FOUND ]</div>;
	}

	const asset = wornItem.asset;

	return (
		<div tabIndex={ 0 } className={ classNames('inventoryViewItem', 'listMode', selected && 'selected', singleItemContainer ? 'static' : 'allowed') } onClick={ () => {
			if (singleItemContainer)
				return;
			setFocus?.({
				container: item.container,
				itemId: selected ? null : item.itemId,
			});
		} }>
			{
				ribbonColor ?
					<span
						className='colorRibbon'
						style={ {
							backgroundColor: ribbonColor,
						} }
					/> : null
			}
			<InventoryAssetPreview asset={ asset } />
			<span className='itemName'>{ asset.definition.name }</span>
			<div className='quickActions'>
				{
					singleItemContainer ? null : (
						asset.isType('personal') && asset.definition.bodypart != null ? (
							<>
								<WardrobeActionButton action={ {
									type: 'move',
									target: targetSelector,
									item,
									shift: 1,
								} } autohide hideReserveSpace>
									▼
								</WardrobeActionButton>
								<WardrobeActionButton action={ {
									type: 'move',
									target: targetSelector,
									item,
									shift: -1,
								} } autohide hideReserveSpace>
									▲
								</WardrobeActionButton>
							</>
						) : null
					)
				}
				{ extraActions.map((Action, i) => <Action key={ i } item={ item } />) }
				{
					singleItemContainer ? null : (
						<button
							className='wardrobeActionButton allowed'
							onClick={ (ev) => {
								ev.stopPropagation();
								setHeldItem(heldItemSelector);
							} }
						>
							<img src={ arrowAllIcon } alt='Quick-action mode' />
						</button>
					)
				}
			</div>
			{
				isHeld ? (
					<div
						className='overlayDrop inventoryViewItem allowed'
						tabIndex={ 0 }
						onClick={ (ev) => {
							ev.preventDefault();
							ev.stopPropagation();
							setHeldItem({ type: 'nothing' });
						} }
					>
						Cancel
					</div>
				) : null
			}
		</div>
	);
}
