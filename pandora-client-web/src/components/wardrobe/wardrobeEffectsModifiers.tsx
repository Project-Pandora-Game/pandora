import classNames from 'classnames';
import {
	AssertNever,
	AssetFrameworkCharacterState,
	EMPTY_ARRAY,
	GetLogger,
	type CharacterId,
	type CharacterModifierId,
	type CharacterModifierType,
	type IClientShardNormalResult,
	type IShardClientChangeEvents,
	type PermissionGroup,
} from 'pandora-common';
import React, { ReactElement, useCallback, useState } from 'react';
import { ICharacter } from '../../character/character';
import { Column } from '../common/container/container';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { useShardChangeListener, useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { WardrobeCharacterModifierEffectiveInstanceView, WardrobeCharacterModifierFullInstanceView } from './views/characterModifiers/characterModifierInstanceView';
import { WardrobeCharacterModifierTypeView } from './views/characterModifiers/characterModifierTypeView';
import { useWardrobePermissionRequestCallback } from './wardrobeActionContext';
import { ActionWarningContent } from './wardrobeComponents';

export type ModifierFocus = {
	type: 'instance' | 'effectiveInstance';
	id: CharacterModifierId;
} | {
	type: 'type';
	typeId: CharacterModifierType;
};

export function WardrobeEffectsModifiers({ className, character, characterState }: {
	className?: string;
	character: ICharacter;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const [currentFocus, setCurrentFocus] = useState<ModifierFocus | null>(null);
	const fullInstanceList = useCharacterModifierInstanceList(character.id);

	return (
		<div className={ classNames('wardrobe-ui', className) }>
			<TabContainer className='flex-1'>
				<Tab name='Active modifiers'>
					<WardrobeCharacterModifierEffectiveInstanceView effectiveInstances={ EMPTY_ARRAY } />
				</Tab>
				<Tab name='Current modifiers'>
					<WardrobeEffectsFullList character={ character } data={ fullInstanceList } />
				</Tab>
				<Tab name='Possible modifiers'>
					<WardrobeCharacterModifierTypeView title='Possible modifiers' />
				</Tab>
			</TabContainer>
			{ /* {
				WardrobeFocusesItem(currentFocus) &&
				<div className='flex-col flex-1'>
					<WardrobeItemConfigMenu key={ currentFocus.itemId } item={ currentFocus } />
				</div>
			} */ }
		</div>
	);
}

function WardrobeEffectsFullList({ data, character }: {
	data: IClientShardNormalResult['characterModifiersGet'] | undefined;
	character: ICharacter;
}): ReactElement {
	const [requestPermissions, processingPermissionRequest] = useWardrobePermissionRequestCallback();

	return (
		data == null ? (
			<div className='inventoryView'>
				<span>Loading...</span>
			</div>
		) : data.result === 'ok' ? (
			<WardrobeCharacterModifierFullInstanceView modifiers={ data.modifiers } />
		) : data.result === 'failure' ? (
			<div className='inventoryView'>
				<Column padding='medium'>
					<span>You cannot see the full modifier list of this character.</span>
					<ActionWarningContent problems={ data.problems } prompt={ false } />
					<button
						className={ classNames(
							'wardrobeActionButton',
							(data.canPrompt && data.problems.some((p) => p.result === 'restrictionError' && p.restriction.type === 'missingPermission')) ? 'promptRequired' : 'blocked',
						) }
						onClick={ () => {
							const permissions = data.problems
								.filter((p) => p.result === 'restrictionError')
								.map((p) => p.restriction)
								.filter((r) => r.type === 'missingPermission')
								.map((r): [PermissionGroup, string] => ([r.permissionGroup, r.permissionId]));

							requestPermissions(character.id, permissions);
						} }
						disabled={ processingPermissionRequest }
					>
						Request access
					</button>
				</Column>
			</div>
		) : data.result === 'notFound' ? (
			<div className='inventoryView'>
				<span>Error getting modifier data: Character not found.</span>
			</div>
		) : (
			AssertNever(data)
		)
	);
}

const LISTEN_EVENTS: readonly IShardClientChangeEvents[] = ['permissions', 'characterModifiers'];
function useCharacterModifierInstanceList(target: CharacterId): IClientShardNormalResult['characterModifiersGet'] | undefined {
	const [data, setData] = useState<IClientShardNormalResult['characterModifiersGet']>();

	const shardConnector = useShardConnector();

	const fetchData = useCallback(() => {
		if (shardConnector == null) {
			setData(undefined);
			return;
		}

		shardConnector.awaitResponse('characterModifiersGet', { target })
			.then((result) => {
				setData(result);
			}, (error) => {
				GetLogger('useCharacterModifierInstanceList').warning(`Error getting character modifiers for character ${target}:`, error);
			});
	}, [shardConnector, target]);

	useShardChangeListener(LISTEN_EVENTS, fetchData);

	return data;
}
