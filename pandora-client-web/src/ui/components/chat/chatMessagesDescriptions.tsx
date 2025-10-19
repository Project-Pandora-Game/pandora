import type { Immutable } from 'immer';
import { isEqual } from 'lodash-es';
import {
	AssertNever,
	EvalItemPath,
	IsNotNullable,
	NaturalListJoin,
	SplitContainerPath,
	type ActionTargetSelector,
	type AppearanceAction,
	type AppearanceActionType,
	type AssetFrameworkGlobalState,
	type CharacterId,
	type Item,
	type ItemContainerPath,
	type ItemId,
} from 'pandora-common';
import { ReactElement } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { useCharacterDataOptional } from '../../../character/character.ts';
import { FindItemById, useSpaceCharacters } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { ResolveItemDisplayNameType } from '../../../components/wardrobe/itemDetail/wardrobeItemName.tsx';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { DescribeAsset } from './chatMessages.tsx';

interface DescribeGameLogicActionProps<TAction extends AppearanceActionType = AppearanceActionType> {
	action: Immutable<AppearanceAction<TAction>>;
	actionOriginator: {
		readonly id: CharacterId;
		readonly name: string;
	};
	globalState: AssetFrameworkGlobalState;
}

export function DescribeGameLogicAction({ action, ...props }: DescribeGameLogicActionProps): ReactElement {
	switch (action.type) {
		case 'create':
			return <DescribeGameLogicActionCreate action={ action } { ...props } />;
		case 'delete':
			return <DescribeGameLogicActionDelete action={ action } { ...props } />;
		case 'transfer':
			return <DescribeGameLogicActionTransfer action={ action } { ...props } />;
		case 'moveCharacter':
			return <DescribeGameLogicActionMoveCharacter action={ action } { ...props } />;
		case 'pose':
			return <DescribeGameLogicActionPose action={ action } { ...props } />;
		case 'body':
			return <DescribeGameLogicActionBody action={ action } { ...props } />;
		case 'move':
			return <DescribeGameLogicActionMove action={ action } { ...props } />;
		case 'color':
			return <DescribeGameLogicActionColor action={ action } { ...props } />;
		case 'customize':
			return <DescribeGameLogicActionCustomize action={ action } { ...props } />;
		case 'moduleAction':
			return <DescribeGameLogicActionModuleAction action={ action } { ...props } />;
		case 'restrictionOverrideChange':
			return <DescribeGameLogicActionRestrictionOverrideChange action={ action } { ...props } />;
		case 'randomize':
			return <DescribeGameLogicActionRandomize action={ action } { ...props } />;
		case 'roomDeviceDeploy':
			return <DescribeGameLogicActionRoomDeviceDeploy action={ action } { ...props } />;
		case 'roomDeviceEnter':
			return <DescribeGameLogicActionRoomDeviceEnter action={ action } { ...props } />;
		case 'roomDeviceLeave':
			return <DescribeGameLogicActionRoomDeviceLeave action={ action } { ...props } />;
		case 'roomConfigure':
			return <DescribeGameLogicActionRoomConfigure action={ action } { ...props } />;
		case 'spaceConfigure':
			return <DescribeGameLogicActionSpaceConfigure action={ action } { ...props } />;
		case 'spaceRoomLayout':
			return <DescribeGameLogicActionSpaceRoomLayout action={ action } { ...props } />;
		case 'actionAttemptInterrupt':
			return <DescribeGameLogicActionInterrupt action={ action } { ...props } />;
	}

	AssertNever(action);
}

function DescribeGameLogicActionCreate({ action, globalState, actionOriginator }: DescribeGameLogicActionProps<'create'>): ReactElement {
	const item = globalState?.assetManager.createItemFromTemplate(action.itemTemplate, actionOriginator) ?? null;

	const isPhysicallyEquipped = ContainerPhysicallyEquips(globalState, action.target, action.container);

	return (
		<>
			{ isPhysicallyEquipped ? 'Create and equip' : 'Create and store' } <DescribeItem item={ item } globalState={ globalState } />
			{ isPhysicallyEquipped ? ' onto' : ' into' } <DescribeContainer target={ action.target } container={ action.container } globalState={ globalState } />.
		</>
	);
}

function DescribeGameLogicActionDelete({ action, globalState }: DescribeGameLogicActionProps<'delete'>): ReactElement {
	const item = EvalItemPath(globalState.getItems(action.target) ?? [], action.item) ?? action.item.itemId;

	const isPhysicallyEquipped = ContainerPhysicallyEquips(globalState, action.target, action.item.container);

	return (
		<>
			{ isPhysicallyEquipped ? 'Unequip and delete' : 'Delete' } <DescribeItem item={ item } globalState={ globalState } />
			{ ' from' } <DescribeContainer target={ action.target } container={ action.item.container } globalState={ globalState } />.
		</>
	);
}

function DescribeGameLogicActionTransfer({ action, globalState }: DescribeGameLogicActionProps<'transfer'>): ReactElement {
	// If the source and target container are the same, the action is only a reorder
	const isReorder = isEqual(action.source, action.target) && isEqual(action.item.container, action.container);
	const item = EvalItemPath(globalState.getItems(action.source) ?? [], action.item) ?? action.item.itemId;

	const isSourcePhysicallyEquipped = ContainerPhysicallyEquips(globalState, action.source, action.item.container);
	const isTargetPhysicallyEquipped = ContainerPhysicallyEquips(globalState, action.target, action.container);

	if (isReorder) {
		return <>Reorder items { isSourcePhysicallyEquipped ? 'on' : 'in' } <DescribeContainer target={ action.source } container={ action.item.container } globalState={ globalState } />.</>;
	}

	return (
		<>
			{ isTargetPhysicallyEquipped ? 'Equip' : isSourcePhysicallyEquipped ? 'Unequip' : 'Move' } <DescribeItem item={ item } globalState={ globalState } />
			{ ' from' } <DescribeContainer target={ action.source } container={ action.item.container } globalState={ globalState } />
			{ isTargetPhysicallyEquipped ? ' onto' : ' into' } <DescribeContainer target={ action.target } container={ action.container } globalState={ globalState } />.
		</>
	);
}

function DescribeGameLogicActionMoveCharacter({ action }: DescribeGameLogicActionProps<'moveCharacter'>): ReactElement {
	return <>Move <DescribeSpaceCharacter id={ action.target.characterId } form='normal' />.</>;
}

function DescribeGameLogicActionPose({ action }: DescribeGameLogicActionProps<'pose'>): ReactElement {
	return <>Change <DescribeSpaceCharacter id={ action.target } form='possessive' /> pose.</>;
}

function DescribeGameLogicActionBody({ action }: DescribeGameLogicActionProps<'body'>): ReactElement {
	return <>Modify <DescribeSpaceCharacter id={ action.target } form='possessive' /> body sizes.</>;
}

function DescribeGameLogicActionMove({ action, globalState }: DescribeGameLogicActionProps<'move'>): ReactElement {
	const isPhysicallyEquipped = ContainerPhysicallyEquips(globalState, action.target, action.item.container);

	return <>Reorder items { isPhysicallyEquipped ? 'on' : 'in' } <DescribeContainer target={ action.target } container={ action.item.container } globalState={ globalState } />.</>;
}

function DescribeGameLogicActionColor({ action, globalState }: DescribeGameLogicActionProps<'color'>): ReactElement {
	const isPhysicallyEquipped = ContainerPhysicallyEquips(globalState, action.target, action.item.container);
	const item = EvalItemPath(globalState.getItems(action.target) ?? [], action.item) ?? action.item.itemId;

	return (
		<>
			Change the color of <DescribeItem item={ item } globalState={ globalState } />
			{ isPhysicallyEquipped ? ' on' : ' in' } <DescribeContainer target={ action.target } container={ action.item.container } globalState={ globalState } />.
		</>
	);
}

function DescribeGameLogicActionCustomize({ action, globalState }: DescribeGameLogicActionProps<'customize'>): ReactElement {
	const isPhysicallyEquipped = ContainerPhysicallyEquips(globalState, action.target, action.item.container);
	const item = EvalItemPath(globalState.getItems(action.target) ?? [], action.item) ?? action.item.itemId;

	const changes = NaturalListJoin([
		(action.name != null) ? 'name' : null,
		(action.description != null) ? 'description' : null,
		(action.requireFreeHandsToUse != null) ? 'bound usage' : null,
	].filter(IsNotNullable));

	return (
		<>
			Change the { changes } of <DescribeItem item={ item } globalState={ globalState } />
			{ isPhysicallyEquipped ? ' on' : ' in' } <DescribeContainer target={ action.target } container={ action.item.container } globalState={ globalState } />.
		</>
	);
}

function DescribeGameLogicActionModuleAction({ action, globalState }: DescribeGameLogicActionProps<'moduleAction'>): ReactElement {
	const isPhysicallyEquipped = ContainerPhysicallyEquips(globalState, action.target, action.item.container);
	const item = EvalItemPath(globalState.getItems(action.target) ?? [], action.item) ?? action.item.itemId;

	const moduleName = (item && typeof item !== 'string' ? item : null)?.getModules().get(action.module)?.config.name ?? null;

	let actionDescription: ReactElement;
	switch (action.action.moduleType) {
		case 'typed':
			actionDescription = <>Change the selected variant of the "{ moduleName ?? <code>{ action.module }</code> }" module</>;
			break;
		case 'storage':
			// Nothing possible here
			actionDescription = <>[ERROR]</>;
			break;
		case 'lockSlot':
			switch (action.action.lockAction.action) {
				case 'lock':
					actionDescription = <>Lock the lock in the "{ moduleName?.replace(/lock slot\s*(:\s*)?/i, '') ?? <code>{ action.module }</code> }" lock slot</>;
					break;
				case 'unlock':
					actionDescription = <>Unlock the lock in the "{ moduleName?.replace(/lock slot\s*(:\s*)?/i, '') ?? <code>{ action.module }</code> }" lock slot</>;
					break;
				case 'showPassword':
					actionDescription = <>Remember the password of the lock in the "{ moduleName?.replace(/lock slot\s*(:\s*)?/i, '') ?? <code>{ action.module }</code> }" lock slot</>;
					break;
				case 'updateFingerprint':
					actionDescription = <>Update the registered fingerprints of the lock in the "{ moduleName?.replace(/lock slot\s*(:\s*)?/i, '') ?? <code>{ action.module }</code> }" lock slot</>;
					break;
				default:
					AssertNever(action.action.lockAction);
			}
			break;
		case 'text':
			actionDescription = <>Change text of the "{ moduleName ?? <code>{ action.module }</code> }" module</>;
			break;
		default:
			AssertNever(action.action);
	}

	return (
		<>
			{ actionDescription } of <DescribeItem item={ item } globalState={ globalState } />
			{ isPhysicallyEquipped ? ' on' : ' in' } <DescribeContainer target={ action.target } container={ action.item.container } globalState={ globalState } />.
		</>
	);
}

function DescribeGameLogicActionRestrictionOverrideChange({ action }: DescribeGameLogicActionProps<'restrictionOverrideChange'>): ReactElement {
	switch (action.mode) {
		case 'normal':
			return <>Leave the safemode.</>;
		case 'safemode':
			return <>Enter safemode.</>;
		case 'timeout':
			return <>Enter timeout.</>;
	}

	AssertNever(action.mode);
}

function DescribeGameLogicActionRandomize({ action }: DescribeGameLogicActionProps<'randomize'>): ReactElement {
	switch (action.kind) {
		case 'items':
			return <>Randomize their clothing.</>;
		case 'full':
			return <>Randomize their appearance.</>;
	}

	AssertNever(action.kind);
}

function DescribeGameLogicActionRoomDeviceDeploy({ action, globalState }: DescribeGameLogicActionProps<'roomDeviceDeploy'>): ReactElement {
	const item = EvalItemPath(globalState.getItems(action.target) ?? [], action.item) ?? action.item.itemId;

	if (typeof item === 'string') {
		return <>Change the deployment or position of the room device <DescribeItem item={ item } globalState={ globalState } />.</>;
	}

	if (!action.deployment.deployed) {
		return <>Store the <DescribeItem item={ item } globalState={ globalState } /> into the room inventory.</>;
	}

	if (item?.isType('roomDevice') && item.isDeployed()) {
		return <>Reposition the <DescribeItem item={ item } globalState={ globalState } />.</>;
	}

	return <>Deploy the <DescribeItem item={ item } globalState={ globalState } /> from the room inventory.</>;
}

function DescribeGameLogicActionRoomDeviceEnter({ action, actionOriginator, globalState }: DescribeGameLogicActionProps<'roomDeviceEnter'>): ReactElement {
	const item = EvalItemPath(globalState.getItems(action.target) ?? [], action.item) ?? action.item.itemId;
	const slot = (item != null && typeof item !== 'string' && item.isType('roomDevice')) ? (item.asset.definition.slots[action.slot]) : undefined;

	const slotName = slot?.name ?? null;

	return (
		<>
			{ action.character.characterId === actionOriginator.id ? 'Enter' : (<>Put <DescribeSpaceCharacter id={ action.character.characterId } /></>) }
			{ ' into' } the "{ slotName ?? <code>{ action.slot }</code> }" slot of the <DescribeItem item={ item } globalState={ globalState } />.
		</>
	);
}

function DescribeGameLogicActionRoomDeviceLeave({ action, actionOriginator, globalState }: DescribeGameLogicActionProps<'roomDeviceLeave'>): ReactElement {
	const item = EvalItemPath(globalState.getItems(action.target) ?? [], action.item) ?? action.item.itemId;
	const slot = (item != null && typeof item !== 'string' && item.isType('roomDevice')) ? (item.asset.definition.slots[action.slot]) : undefined;
	const slotName = slot?.name ?? null;

	const currentCharacter = (item != null && typeof item !== 'string' && item.isType('roomDevice')) ? (item.slotOccupancy.get(action.slot)) : undefined;
	const characterPresent = currentCharacter != null && globalState.getCharacterState(currentCharacter) != null;

	if (!characterPresent) {
		return (
			<>
				Clear the "{ slotName ?? <code>{ action.slot }</code> }" slot of the <DescribeItem item={ item } globalState={ globalState } />.
			</>
		);
	}

	return (
		<>
			{ currentCharacter === actionOriginator.id ? 'Leave' : (<>Remove <DescribeSpaceCharacter id={ currentCharacter ?? null } /></>) }
			{ ' from' } the "{ slotName ?? <code>{ action.slot }</code> }" slot of the <DescribeItem item={ item } globalState={ globalState } />.
		</>
	);
}

function DescribeGameLogicActionRoomConfigure(_props: DescribeGameLogicActionProps<'roomConfigure'>): ReactElement {
	return <>Update the room's configuration.</>;
}

function DescribeGameLogicActionSpaceConfigure(_props: DescribeGameLogicActionProps<'spaceConfigure'>): ReactElement {
	return <>Update the space's configuration.</>;
}

function DescribeGameLogicActionSpaceRoomLayout(_props: DescribeGameLogicActionProps<'spaceRoomLayout'>): ReactElement {
	return <>Update the space's layout.</>;
}

function DescribeGameLogicActionInterrupt({ action }: DescribeGameLogicActionProps<'actionAttemptInterrupt'>): ReactElement {
	return <>Interrupt <DescribeSpaceCharacter id={ action.target.characterId } form='possessive' /> attempted action.</>;
}

//#region Utilities

export function DescribeItem({ item, globalState }: {
	item: Item | ItemId | null;
	globalState: AssetFrameworkGlobalState;
}): ReactElement {
	const assetManager = useAssetManager();
	const { interfaceChatroomItemDisplayNameType } = useAccountSettings();

	if (item == null)
		return <>[UNKNOWN]</>;

	if (typeof item === 'string') {
		const relocatedItem = FindItemById(globalState, item);
		if (relocatedItem.length === 1) {
			item = relocatedItem[0].item;
		} else {
			return <>[Item <code>{ item }</code>]</>;
		}
	}

	return <>{ ResolveItemDisplayNameType(DescribeAsset(assetManager, item.asset.id), item.name, interfaceChatroomItemDisplayNameType) }</>;
}

export function DescribeContainer({ target, container, globalState }: {
	target: ActionTargetSelector;
	container: ItemContainerPath;
	globalState: AssetFrameworkGlobalState;
}): ReactElement {
	if (container.length === 0) {
		if (target.type === 'room') {
			// TODO: Should this now include name of the room?
			return <>the room inventory</>;
		} else {
			return <DescribeSpaceCharacter id={ target.characterId } />;
		}
	} else if (container.length === 1) {
		const item = <DescribeItem item={ EvalItemPath(globalState.getItems(target) ?? [], { container: [], itemId: container[0].item }) ?? container[0].item } globalState={ globalState } />;

		if (target.type === 'room') {
			// TODO: Should this now include name of the room?
			return <>{ item } in the room inventory</>;
		} else {
			return <><DescribeSpaceCharacter id={ target.characterId } form='possessive' /> { item }</>;
		}
	} else {
		const itemFirst = <DescribeItem item={ EvalItemPath(globalState.getItems(target) ?? [], { container: [], itemId: container[0].item }) ?? container[0].item } globalState={ globalState } />;
		const itemLast = (
			<DescribeItem item={ EvalItemPath(globalState.getItems(target) ?? [], {
				container: container.slice(0, -1),
				itemId: container[container.length - 1].item,
			}) ?? container[container.length - 1].item } globalState={ globalState } />
		);

		if (target.type === 'room') {
			// TODO: Should this now include name of the room?
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

function ContainerPhysicallyEquips(globalState: AssetFrameworkGlobalState, target: ActionTargetSelector, container: ItemContainerPath): boolean {
	let isPhysicallyEquipped = target.type === 'character';
	const upperPath = SplitContainerPath(container);
	if (upperPath) {
		const containingModule = EvalItemPath(globalState.getItems(target) ?? [], upperPath.itemPath)?.getModules().get(upperPath.module);
		if (containingModule) {
			isPhysicallyEquipped = containingModule.contentsPhysicallyEquipped;
		}
	}
	return isPhysicallyEquipped;
}

//#endregion
