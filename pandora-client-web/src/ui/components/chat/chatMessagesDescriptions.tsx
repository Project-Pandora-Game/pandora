import type { Immutable } from 'immer';
import { isEqual } from 'lodash';
import { AssertNever, type ActionTargetSelector, type AppearanceActionType, type AppearanceAction, type AssetFrameworkGlobalState, type CharacterId, type Item, type ItemContainerPath } from 'pandora-common';
import { EvalItemPath, SplitContainerPath } from 'pandora-common/src/assets/appearanceHelpers';
import React, { ReactElement } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import { useCharacterDataOptional } from '../../../character/character';
import { useSpaceCharacters } from '../../../components/gameContext/gameStateContextProvider';
import { ResolveItemDisplayNameType } from '../../../components/wardrobe/itemDetail/wardrobeItemName';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks';
import { DescribeAsset } from './chatMessages';

interface DescribeGameLogicActionProps<TAction extends AppearanceActionType = AppearanceActionType> {
	action: Immutable<AppearanceAction<TAction>>;
	globalState: AssetFrameworkGlobalState;
}

export function DescribeGameLogicAction({ action, ...props }: DescribeGameLogicActionProps): ReactElement {
	switch (action.type) {
		case 'create':
			return <>[TODO] Create an item</>;
		case 'delete':
			return <>[TODO] Delete an item</>;
		case 'transfer':
			return <DescribeGameLogicActionTransfer action={ action } { ...props } />;
		case 'pose':
			return <>[TODO] Pose a character</>;
		case 'body':
			return <>[TODO] Modify body sizes</>;
		case 'move':
			return <>[TODO] Reorder items</>;
		case 'color':
			return <>[TODO] Change item's color</>;
		case 'customize':
			return <>[TODO] Customize an item</>;
		case 'moduleAction':
			return <>[TODO] Interact with item's module in some way</>;
		case 'restrictionOverrideChange':
			return <>[TODO] Enter or leave safemode/timeout mode</>;
		case 'randomize':
			return <>[TODO] Randomize own appearance</>;
		case 'roomDeviceDeploy':
			return <>[TODO] Deploy or move a room device</>;
		case 'roomDeviceEnter':
			return <>[TODO] Put character into a room device</>;
		case 'roomDeviceLeave':
			return <>[TODO] Remove character from a room device</>;
		case 'actionAttemptInterrupt':
			return <>[TODO] Interrupt someone's attempted action</>;
	}

	AssertNever(action);
}

function DescribeGameLogicActionTransfer({ action, globalState }: DescribeGameLogicActionProps<'transfer'>): ReactElement {
// If the source and target container are the same, the action is only a reorder
	const isReorder = isEqual(action.source, action.target) && isEqual(action.item.container, action.container);
	const item = EvalItemPath(globalState.getItems(action.source) ?? [], action.item) ?? null;

	let isSourcePhysicallyEquipped = action.source.type === 'character';
	const sourceUpperPath = SplitContainerPath(action.item.container);
	if (sourceUpperPath) {
		const containingModule = EvalItemPath(globalState.getItems(action.source) ?? [], sourceUpperPath.itemPath)?.getModules().get(sourceUpperPath.module);
		if (containingModule) {
			isSourcePhysicallyEquipped = containingModule.contentsPhysicallyEquipped;
		}
	}

	let isTargetPhysicallyEquipped = action.target.type === 'character';
	const targetUpperPath = SplitContainerPath(action.container);
	if (targetUpperPath) {
		const containingModule = EvalItemPath(globalState.getItems(action.target) ?? [], targetUpperPath.itemPath)?.getModules().get(targetUpperPath.module);
		if (containingModule) {
			isTargetPhysicallyEquipped = containingModule.contentsPhysicallyEquipped;
		}
	}

	if (isReorder) {
		return <>Reorder items { isSourcePhysicallyEquipped ? 'on' : 'in' } <DescribeContainer target={ action.source } container={ action.item.container } globalState={ globalState } />.</>;
	}

	return (
		<>
			{ isTargetPhysicallyEquipped ? 'Equip' : isSourcePhysicallyEquipped ? 'Unequip' : 'Move' } <DescribeItem item={ item } />
			{ ' from' } <DescribeContainer target={ action.source } container={ action.item.container } globalState={ globalState } />
			{ isTargetPhysicallyEquipped ? ' onto' : ' into' } <DescribeContainer target={ action.target } container={ action.container } globalState={ globalState } />.
		</>
	);
}

export function DescribeItem({ item }: {
	item: Item | null;
}): ReactElement {
	const assetManager = useAssetManager();
	const { interfaceChatroomItemDisplayNameType } = useAccountSettings();

	if (item == null)
		return <>[UNKNOWN]</>;

	return <>{ ResolveItemDisplayNameType(DescribeAsset(assetManager, item.asset.id), item.name, interfaceChatroomItemDisplayNameType) }</>;
}

export function DescribeContainer({ target, container, globalState }: {
	target: ActionTargetSelector;
	container: ItemContainerPath;
	globalState: AssetFrameworkGlobalState;
}): ReactElement {
	if (container.length === 0) {
		if (target.type === 'roomInventory') {
			return <>the room inventory</>;
		} else {
			return <DescribeSpaceCharacter id={ target.characterId } />;
		}
	} else if (container.length === 1) {
		const item = <DescribeItem item={ EvalItemPath(globalState.getItems(target) ?? [], { container: [], itemId: container[0].item }) ?? null } />;

		if (target.type === 'roomInventory') {
			return <>{ item } in the room inventory</>;
		} else {
			return <><DescribeSpaceCharacter id={ target.characterId } form='possessive' /> { item }</>;
		}
	} else {
		const itemFirst = <DescribeItem item={ EvalItemPath(globalState.getItems(target) ?? [], { container: [], itemId: container[0].item }) ?? null } />;
		const itemLast = (
			<DescribeItem item={ EvalItemPath(globalState.getItems(target) ?? [], {
				container: container.slice(0, -1),
				itemId: container[container.length - 1].item,
			}) ?? null } />
		);

		if (target.type === 'roomInventory') {
			return <>the { itemLast } in { itemFirst } in the room inventory</>;
		} else {
			return <>the { itemLast } in <DescribeSpaceCharacter id={ target.characterId } form='possessive' /> { itemFirst }</>;
		}
	}

	return <>[TODO]</>;
}

export function DescribeSpaceCharacter({ id, form = 'normal' }: {
	id: CharacterId;
	form?: 'normal' | 'possessive';
}): ReactElement {
	const characters = useSpaceCharacters();
	const character = characters.find((c) => c.id === id) ?? null;
	const name = useCharacterDataOptional(character)?.name ?? '???';

	switch (form) {
		case 'normal':
			return <>{ name } ({ id })</>;
		case 'possessive':
			return <>{ name }'s ({ id })</>;
	}

	AssertNever(form);
}
