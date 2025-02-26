import classNames from 'classnames';
import { isEqual } from 'lodash';
import {
	ActionTargetSelector,
	AppearanceAction,
	AppearanceActionProcessingContext,
	AppearanceItems,
	AppearanceItemsCalculateTotalCount,
	AssertNever,
	CloneDeepMutable,
	EMPTY_ARRAY,
	EvalContainerPath,
	Item,
	ITEM_LIMIT_CHARACTER_WORN,
	ITEM_LIMIT_ROOM_INVENTORY,
	ItemContainerPath,
	ItemId,
	ItemInteractionType,
	ItemPath,
	SplitContainerPath,
} from 'pandora-common';
import { IItemModule } from 'pandora-common/dist/assets/modules/common';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import React, { ReactElement, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import arrowAllIcon from '../../../assets/icons/arrow_all.svg';
import { useItemColorRibbon } from '../../../graphics/graphicsLayer';
import { useObservable } from '../../../observable';
import { Button } from '../../common/button/button';
import { useCheckAddPermissions } from '../../gameContext/permissionCheckProvider';
import { ResolveItemDisplayName, WardrobeItemName } from '../itemDetail/wardrobeItemName';
import { useWardrobeActionContext } from '../wardrobeActionContext';
import { InventoryAssetPreview, StorageUsageMeter, WardrobeActionButton, WardrobeColorRibbon } from '../wardrobeComponents';
import { useWardrobeContext } from '../wardrobeContext';
import { WardrobeHeldItem } from '../wardrobeTypes';
import { useWardrobeTargetItem, useWardrobeTargetItems } from '../wardrobeUtils';

export function InventoryItemView({
	className,
	title,
	filter,
}: {
	className?: string;
	title: string;
	filter?: (item: Item) => boolean;
}): ReactElement | null {
	const { actions, globalState } = useWardrobeActionContext();
	const { targetSelector, heldItem, focuser, itemDisplayNameType } = useWardrobeContext();
	const focus = useObservable(focuser.current);
	const appearance = useWardrobeTargetItems(targetSelector);
	const itemCount = useMemo(() => AppearanceItemsCalculateTotalCount(appearance), [appearance]);
	const navigate = useNavigate();

	const containerAccessCheckInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		const actionTarget = processingContext.getTarget(targetSelector);
		if (actionTarget == null)
			return processingContext.invalid();

		const containerPath = SplitContainerPath(focus.container);
		if (containerPath != null) {
			processingContext.checkCanUseItemModule(actionTarget, containerPath.itemPath, containerPath.module, ItemInteractionType.MODIFY);
		}

		return processingContext.finalize();
	}, [actions, globalState, targetSelector, focus]);

	const containerAccessCheck = useCheckAddPermissions(containerAccessCheckInitial);

	const [displayedItems, containerModule, containerSteps] = useMemo<[AppearanceItems, IItemModule | undefined, readonly string[]]>(() => {
		let items: AppearanceItems = filter ? appearance.filter(filter) : appearance;
		let container: IItemModule | undefined;
		const steps: string[] = [];
		for (const step of focus.container) {
			const item = items.find((it) => it.id === step.item);
			const module = item?.getModules().get(step.module);
			if (!item || !module)
				return [[], undefined, []];
			steps.push(`${ResolveItemDisplayName(item, itemDisplayNameType)} (${module.config.name})`);
			container = module;
			items = item.getModuleItems(step.module);
		}
		return [items, container, steps];
	}, [appearance, filter, focus, itemDisplayNameType]);

	const singleItemContainer = containerModule != null && containerModule instanceof ItemModuleLockSlot;
	useEffect(() => {
		// If we don't have access, then force de-select of an item, if there is one selected
		if (!containerAccessCheck.valid) {
			focuser.focusItemId(null);
			return;
		}

		// Locks have special GUI on higher level, so be friendly and focus on that when there is a lock
		if (containerModule?.type === 'lockSlot' && displayedItems.length === 1) {
			focuser.focusPrevious();
			return;
		}

		if (!singleItemContainer)
			return;

		if (displayedItems.length === 1 && focus.itemId == null) {
			focuser.focusItemId(displayedItems[0].id);
		} else if (displayedItems.length === 0) {
			focuser.focusItemId(null);
		}
	}, [focus, focuser, containerModule, singleItemContainer, displayedItems, containerAccessCheck]);

	return (
		<div className={ classNames('inventoryView', className) }>
			<div className='toolbar'>
				{
					focus.container.length > 0 ? (
						<>
							<Button onClick={ () => focuser?.previous() } >
								Close
							</Button>
							<div className='center-flex'>
								Viewing contents of: <br />
								{ containerSteps.join(' > ') }
							</div>
						</>
					) : (
						<StorageUsageMeter
							title={ title }
							used={ itemCount }
							limit={ targetSelector.type === 'character' ? ITEM_LIMIT_CHARACTER_WORN : ITEM_LIMIT_ROOM_INVENTORY }
						/>
					)
				}
				<div className='flex-1' />
				{ targetSelector.type === 'roomInventory' ?
					<Button className='slim' onClick={ () => {
						focuser.reset();
						navigate('/wardrobe');
					} } >
						Switch to your wardrobe
					</Button>
					: '' }
			</div>
			{
				containerAccessCheck.valid ? (
					<div className='Scrollbar'>
						<div className='list reverse withDropButtons'>
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
					</div>
				) : (
					<div className='flex-1 center-flex'>
						<strong className='wardrobeProblemMessage'>You are not allowed to view the contents of this container.</strong>
					</div>
				)
			}
		</div>
	);
}

export function InventoryItemViewDropArea({ target, container, insertBefore }: {
	target: ActionTargetSelector;
	container: ItemContainerPath;
	insertBefore?: ItemId;
}): ReactElement | null {
	const { globalState } = useWardrobeActionContext();
	const { heldItem, setHeldItem } = useWardrobeContext();

	// Check if we are not trying to do NOOP
	const identicalContainer = heldItem.type === 'item' &&
		isEqual(target, heldItem.target) &&
		isEqual(container, heldItem.path.container);
	const targetIsSource = identicalContainer && insertBefore === heldItem.path.itemId;

	const action = useMemo((): AppearanceAction | null => {
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

		if (heldItem.type === 'template') {
			return {
				type: 'create',
				target,
				itemTemplate: CloneDeepMutable(heldItem.template),
				container,
				insertBefore,
			};
		}

		AssertNever(heldItem);
	}, [heldItem, target, container, targetIsSource, identicalContainer, globalState, insertBefore]);

	const text = useMemo<string | null>(() => {
		if (heldItem.type === 'nothing')
			return null;

		if (heldItem.type === 'item') {
			return 'Move item here';
		}

		if (heldItem.type === 'template') {
			return 'Create item here';
		}

		AssertNever(heldItem);
	}, [heldItem]);

	if (action == null || text == null) {
		return null;
	}

	return (
		<WardrobeActionButton
			Element='div'
			className='slim overlayDrop'
			action={ action }
			onExecute={ () => {
				setHeldItem({ type: 'nothing' });
			} }
		>
			{ text }
		</WardrobeActionButton>
	);
}

function InventoryItemViewList({ item, selected = false, singleItemContainer = false }: {
	item: ItemPath;
	selected?: boolean;
	singleItemContainer?: boolean;
}): ReactElement {
	const { targetSelector, extraItemActions, heldItem, focuser, setHeldItem, scrollToItem, setScrollToItem } = useWardrobeContext();
	const wornItem = useWardrobeTargetItem(targetSelector, item);
	const extraActions = useObservable(extraItemActions);

	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (scrollToItem === item.itemId) {
			ref.current?.scrollIntoView({ behavior: 'smooth' });
			setScrollToItem(null);
		}
	}, [item.itemId, scrollToItem, setScrollToItem]);

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
		<div ref={ ref } tabIndex={ 0 } className={ classNames('inventoryViewItem', 'listMode', selected && 'selected', singleItemContainer ? 'static' : 'allowed') } onClick={ () => {
			if (singleItemContainer)
				return;

			focuser.focus({
				container: item.container,
				itemId: selected ? null : item.itemId,
			}, targetSelector);
		} }>
			{
				ribbonColor ? <WardrobeColorRibbon ribbonColor={ ribbonColor } /> : null
			}
			<InventoryAssetPreview asset={ asset } small={ true } />
			<WardrobeItemName item={ wornItem } />
			<div className='quickActions'>
				{
					singleItemContainer ? null : (
						asset.isType('bodypart') ? (
							<>
								<WardrobeActionButton action={ {
									type: 'move',
									target: targetSelector,
									item,
									shift: 1,
								} } autohide hideReserveSpace>
									▲
								</WardrobeActionButton>
								<WardrobeActionButton action={ {
									type: 'move',
									target: targetSelector,
									item,
									shift: -1,
								} } autohide hideReserveSpace>
									▼
								</WardrobeActionButton>
							</>
						) : null
					)
				}
				{ extraActions.map((Action, i) => <Action key={ i } target={ targetSelector } item={ item } />) }
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
