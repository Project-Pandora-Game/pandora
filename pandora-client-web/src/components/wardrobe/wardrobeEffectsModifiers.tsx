import classNames from 'classnames';
import {
	AssertNever,
	GetLogger,
	type AssetFrameworkGlobalState,
	type CharacterId,
	type CharacterModifierEffectData,
	type CharacterModifierId,
	type CharacterModifierType,
	type IClientShardNormalResult,
	type IShardClientChangeEvents,
	type PermissionGroup,
} from 'pandora-common';
import { ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import { ICharacter, useCharacterRestrictionManager } from '../../character/character';
import { Column } from '../common/container/container';
import { Tab, TabContainer, type TabContainerRef } from '../common/tabs/tabs';
import { useShardChangeListener, useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { WardrobeCharacterModifierEffectDetailsView } from './views/characterModifiers/characterModifierEffectDetailsView';
import { WardrobeCharacterModifierInstanceDetailsView } from './views/characterModifiers/characterModifierInstanceDetailsView';
import { WardrobeCharacterModifierEffectiveInstanceView, WardrobeCharacterModifierFullInstanceView } from './views/characterModifiers/characterModifierInstanceView';
import { WardrobeCharacterModifierTypeDetailsView } from './views/characterModifiers/characterModifierTypeDetailsView';
import { WardrobeCharacterModifierTypeView } from './views/characterModifiers/characterModifierTypeView';
import { useWardrobeActionContext, useWardrobePermissionRequestCallback } from './wardrobeActionContext';
import { ActionWarningContent } from './wardrobeComponents';

export type ModifierFocus = {
	type: 'instance';
	id: CharacterModifierId;
} | {
	type: 'effectiveInstance';
	id: CharacterModifierId;
} | {
	type: 'type';
	typeId: CharacterModifierType;
};

export function WardrobeEffectsModifiers({ className, character, globalState }: {
	className?: string;
	character: ICharacter;
	globalState: AssetFrameworkGlobalState;
}): ReactElement {
	const [currentFocus, setCurrentFocus] = useState<ModifierFocus | null>(null);
	const { actions: { spaceContext } } = useWardrobeActionContext();

	const fullInstanceList = useCharacterModifierInstanceList(character.id);
	const characterRestrictionManager = useCharacterRestrictionManager(character, globalState, spaceContext);
	const characterModifierEffects = useMemo(() => characterRestrictionManager.getModifierEffects(), [characterRestrictionManager]);

	const tabListRef = useRef<TabContainerRef>(null);

	return (
		<div className={ classNames('wardrobe-ui', className) }>
			<TabContainer className='flex-1' ref={ tabListRef }>
				<Tab name='Active modifiers'>
					<WardrobeCharacterModifierEffectiveInstanceView
						modifierEffects={ characterModifierEffects }
						currentlyFocusedEffect={ currentFocus?.type === 'effectiveInstance' ? currentFocus.id : null }
						focusModifierEffect={ (id) => {
							setCurrentFocus(id == null ? null : {
								type: 'effectiveInstance',
								id,
							});
						} }
					/>
				</Tab>
				<Tab name='Current modifiers'>
					<WardrobeEffectsFullList
						character={ character }
						data={ fullInstanceList }
						modifierEffects={ characterModifierEffects }
						currentlyFocusedModifier={ currentFocus?.type === 'instance' ? currentFocus.id : null }
						focusModifierInstance={ (id) => {
							setCurrentFocus(id == null ? null : {
								type: 'instance',
								id,
							});
						} }
					/>
				</Tab>
				<Tab name='Possible modifiers'>
					<WardrobeCharacterModifierTypeView
						title='Add a new modifier'
						currentlyFocusedModifier={ currentFocus?.type === 'type' ? currentFocus.typeId : null }
						focusModifier={ (typeId) => {
							setCurrentFocus(typeId == null ? null : {
								type: 'type',
								typeId,
							});
						} }
					/>
				</Tab>
			</TabContainer>
			{
				currentFocus == null ? (
					<div className='inventoryView'>
						<div className='center-flex flex-1 padding-large'>
							<span>
								Select a current modifier to view or change its settings or a possible modifier to add it to this character
							</span>
						</div>
					</div>
				) : currentFocus.type === 'type' ? (
					<WardrobeCharacterModifierTypeDetailsView
						key={ currentFocus.typeId }
						type={ currentFocus.typeId }
						character={ character }
						focusModifierInstance={ (id) => {
							tabListRef.current?.setTabByName('Current modifiers');
							setCurrentFocus({
								type: 'instance',
								id,
							});
						} }
					/>
				) : currentFocus.type === 'effectiveInstance' ? (
					<WardrobeCharacterModifierEffectDetailsView
						key={ currentFocus.id }
						target={ character.id }
						effect={ characterModifierEffects.find((m) => m.id === currentFocus.id) ?? null }
						unfocus={ () => {
							setCurrentFocus(null);
						} }
					/>
				) : currentFocus.type === 'instance' ? (
					<WardrobeCharacterModifierInstanceDetailsView
						key={ currentFocus.id }
						character={ character }
						instance={ fullInstanceList?.result === 'ok' ? (fullInstanceList.modifiers.find((m) => m.id === currentFocus.id) ?? null) : null }
						unfocus={ () => {
							setCurrentFocus(null);
						} }
					/>
				) : (
					AssertNever(currentFocus)
				)
			}
		</div>
	);
}

function WardrobeEffectsFullList({ data, character, modifierEffects, currentlyFocusedModifier, focusModifierInstance }: {
	data: IClientShardNormalResult['characterModifiersGet'] | undefined;
	character: ICharacter;
	modifierEffects: readonly CharacterModifierEffectData[];
	currentlyFocusedModifier: CharacterModifierId | null;
	focusModifierInstance: (id: CharacterModifierId | null) => void;
}): ReactElement {
	const [requestPermissions, processingPermissionRequest] = useWardrobePermissionRequestCallback();

	return (
		data == null ? (
			<div className='inventoryView'>
				<span>Loading...</span>
			</div>
		) : data.result === 'ok' ? (
			<WardrobeCharacterModifierFullInstanceView
				modifiers={ data.modifiers }
				modifierEffects={ modifierEffects }
				currentlyFocusedModifier={ currentlyFocusedModifier }
				focusModifierInstance={ focusModifierInstance }
			/>
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
