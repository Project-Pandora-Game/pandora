import {
	AppearanceActionProcessingContext,
	AssertNever,
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	CharacterModifierActionCheckAdd,
	CharacterModifierTemplate,
	CloneDeepMutable,
	GetLogger,
	type CharacterModifierId,
	type CharacterModifierType,
	type IClientShardNormalResult,
	type PermissionGroup,
} from 'pandora-common';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAssetManager } from '../../../../assets/assetManager';
import type { ICharacter } from '../../../../character/character';
import { useAsyncEvent } from '../../../../common/useEvent';
import { TOAST_OPTIONS_ERROR } from '../../../../persistentToast';
import { RenderChatPart } from '../../../../ui/components/chat/chatMessages';
import { ChatParser } from '../../../../ui/components/chat/chatParser';
import { Column } from '../../../common/container/container';
import { useCheckAddPermissions } from '../../../gameContext/permissionCheckProvider';
import { useShardConnector } from '../../../gameContext/shardConnectorContextProvider';
import { PermissionSettingEntry } from '../../../settings/permissionsSettings';
import { useWardrobeActionContext, useWardrobePermissionRequestCallback } from '../../wardrobeActionContext';
import { ActionWarningContent, WardrobeActionButtonElement } from '../../wardrobeComponents';
import './characterModifierTypeDetailsView.scss';
import classNames from 'classnames';
import { isEqual } from 'lodash';
import { CharacterModifierImportTemplateDialog } from './characterModifierImport';

export function WardrobeCharacterModifierTypeDetailsView({ type, character, focusModifierInstance }: {
	type: CharacterModifierType;
	character: ICharacter;
	focusModifierInstance: (id: CharacterModifierId) => void;
}): ReactElement | null {
	const typeDefinition = CHARACTER_MODIFIER_TYPE_DEFINITION[type];

	const modifier = useMemo((): CharacterModifierTemplate => ({
		type,
		name: '',
		config: {},
		conditions: [],
	}), [type]);

	return (
		<div className='inventoryView wardrobeModifierTypeDetails'>
			<div className='toolbar'>
				<span>Modifier "{ typeDefinition.visibleName }"</span>
			</div>
			<Column padding='large' gap='large'>
				<WardrobeCharacterModifierTypeDescription type={ type } />
				<WardrobeCharacterModifierAddButton
					character={ character }
					modifier={ modifier }
					onSuccess={ focusModifierInstance }
				/>
				{
					character.isPlayer() ? (
						<fieldset className='modifierPermission'>
							<legend>Permission</legend>
							<PermissionSettingEntry
								visibleName={ `Allow other characters to add or configure "${ typeDefinition.visibleName }" modifiers` }
								icon=''
								permissionGroup='characterModifierType'
								permissionId={ type }
							/>
						</fieldset>
					) : null
				}
				<WardrobeCharacterModifierTypeInbuiltTemplates
					type={ type }
					character={ character }
					focusModifierInstance={ focusModifierInstance }
				/>
			</Column>
		</div>
	);
}

export function WardrobeCharacterModifierAddButton({ character, modifier, onSuccess }: {
	character: ICharacter;
	modifier: CharacterModifierTemplate;
	onSuccess?: (newInstanceId: CharacterModifierId) => void;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const shard = useShardConnector();

	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return CharacterModifierActionCheckAdd(processingContext, character.id, modifier.type);
	}, [actions, globalState, character, modifier]);
	const check = useCheckAddPermissions(checkInitial);

	const [requestPermissions, processingPermissionRequest] = useWardrobePermissionRequestCallback();

	const [execute, processing] = useAsyncEvent(async () => {
		if (shard == null) {
			return null;
		}

		return await shard.awaitResponse('characterModifierAdd', {
			target: character.id,
			modifier,
			enabled: false,
		});
	}, (result: IClientShardNormalResult['characterModifierAdd'] | null) => {
		if (result == null) {
			toast('Request failed, try again later', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'ok') {
			onSuccess?.(result.instanceId);
		} else if (result.result === 'characterNotFound') {
			toast('The target character is no longer in the same space', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'invalidConfiguration') {
			toast('Error in the modifier configuration', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'tooManyModifiers') {
			toast('The target character already has too many modifiers. Remove some before adding a new one.', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'failure') {
			toast(
				<Column>
					<span>Problems performing action:</span>
					<ActionWarningContent problems={ result.problems } prompt={ false } customText='' />
				</Column>,
				TOAST_OPTIONS_ERROR,
			);
		} else {
			AssertNever(result);
		}
	}, {
		errorHandler: (err) => {
			GetLogger('WardrobeCharacterModifierTypeDetailsView').error('Failed to add character modifier:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	const onClick = useCallback(() => {
		const permissions = check.valid ? [] : check.problems
			.filter((p) => p.result === 'restrictionError')
			.map((p) => p.restriction)
			.filter((r) => r.type === 'missingPermission')
			.map((r): [PermissionGroup, string] => ([r.permissionGroup, r.permissionId]));

		if (permissions.length > 0) {
			requestPermissions(character.id, permissions);
		} else {
			execute();
		}
	}, [check, execute, requestPermissions, character]);

	return (
		<WardrobeActionButtonElement
			check={ check }
			onClick={ onClick }
			disabled={ processing || processingPermissionRequest }
		>
			Add this modifier
		</WardrobeActionButtonElement>
	);
}

export function WardrobeCharacterModifierTypeDescription({ type }: {
	type: CharacterModifierType;
}): ReactElement {
	const typeDefinition = CHARACTER_MODIFIER_TYPE_DEFINITION[type];

	const description = useMemo(() => (
		ChatParser.parseStyle(typeDefinition.description)
			.map((c, i) => RenderChatPart(c, i, false))
	), [typeDefinition]);

	return (
		<div className='wardrobeModifierTypeDescription'>
			{ description }
		</div>
	);
}

export function WardrobeCharacterModifierTypeInbuiltTemplates({ type, character, focusModifierInstance }: {
	type: CharacterModifierType;
	character: ICharacter;
	focusModifierInstance: (id: CharacterModifierId) => void;
}): ReactElement | null {
	const [selectedTemplate, setSelectedTemplate] = useState<CharacterModifierTemplate | null>(null);
	const assetManager = useAssetManager();

	const templates = assetManager.characterModifierTemplates[type];

	if (templates == null || templates.length === 0)
		return null;

	return (
		<>
			<fieldset>
				<legend>Preconfigured templates by Pandora</legend>
				<Column>
					{
						templates.map((t, i) => (
							<button
								key={ i }
								className={ classNames(
									'inventoryViewItem',
									'listMode',
									'sidePadding',
									'small',
									isEqual(selectedTemplate, t) ? 'selected' : null,
									'allowed',
								) }
								tabIndex={ 0 }
								onClick={ () => setSelectedTemplate(CloneDeepMutable(t)) }
							>
								<span className='itemName'>{ t.name }</span>
							</button>
						))
					}
				</Column>
			</fieldset>
			{
				selectedTemplate != null ? (
					<CharacterModifierImportTemplateDialog
						character={ character }
						template={ selectedTemplate }
						updateTemplate={ (newTemplate) => setSelectedTemplate(newTemplate) }
						close={ () => setSelectedTemplate(null) }
						focusModifierInstance={ focusModifierInstance }
					/>
				) : null
			}
		</>
	);
}
