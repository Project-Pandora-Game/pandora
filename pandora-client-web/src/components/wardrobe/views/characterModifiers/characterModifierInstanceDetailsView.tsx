import {
	AppearanceActionProcessingContext,
	AssertNever,
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	CharacterModifierActionCheckModify,
	CharacterModifierActionCheckReorder,
	CharacterModifierTemplateSchema,
	GetLogger,
	MakeCharacterModifierTemplateFromClientData,
	type CharacterModifierConfigurationChange,
	type CharacterModifierInstanceClientData,
	type IClientShardNormalResult,
	type ModifierConfigurationEntryDefinition,
	type PermissionGroup,
} from 'pandora-common';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import type { Promisable } from 'type-fest';
import crossIcon from '../../../../assets/icons/cross.svg';
import deleteIcon from '../../../../assets/icons/delete.svg';
import exportIcon from '../../../../assets/icons/export.svg';
import type { ICharacter } from '../../../../character/character';
import type { ChildrenProps } from '../../../../common/reactTypes';
import { useAsyncEvent } from '../../../../common/useEvent';
import { Switch } from '../../../../common/userInteraction/switch';
import { TOAST_OPTIONS_ERROR } from '../../../../persistentToast';
import { IconButton } from '../../../common/button/button';
import { Column, DivContainer, Row } from '../../../common/container/container';
import { ExportDialog } from '../../../exportImport/exportDialog';
import { useCheckAddPermissions } from '../../../gameContext/permissionCheckProvider';
import { useShardConnector } from '../../../gameContext/shardConnectorContextProvider';
import { useWardrobeActionContext, useWardrobePermissionRequestCallback } from '../../wardrobeActionContext';
import { ActionWarningContent, WardrobeActionButtonElement } from '../../wardrobeComponents';
import { CharacterModifierConditionList } from './conditions/characterModifierConditionList';
import { WardrobeCharacterModifierConfig } from './configuration/_index';

interface WardrobeCharacterModifierInstanceDetailsViewProps {
	character: ICharacter;
	instance: CharacterModifierInstanceClientData | null;
	unfocus: () => void;
}

export function WardrobeCharacterModifierInstanceDetailsView({ instance, unfocus, ...props }: WardrobeCharacterModifierInstanceDetailsViewProps): ReactElement {
	if (instance == null) {
		return (
			<div className='inventoryView wardrobeModifierInstanceDetails'>
				<div className='toolbar'>
					<span>Modifier: [ ERROR: MODIFIER NOT FOUND ]</span>
					<IconButton
						onClick={ unfocus }
						theme='default'
						src={ crossIcon }
						alt='Close item details'
					/>
				</div>
			</div>
		);
	}

	return (
		<CheckedInstanceDetails
			{ ...props }
			instance={ instance }
			unfocus={ unfocus }
		/>
	);
}

function CheckedInstanceDetails({ character, instance, unfocus }: WardrobeCharacterModifierInstanceDetailsViewProps & {
	instance: CharacterModifierInstanceClientData;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const shard = useShardConnector();
	const typeDefinition = CHARACTER_MODIFIER_TYPE_DEFINITION[instance.type];

	// Do an early check on if we are allowed to do modifications

	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return CharacterModifierActionCheckModify(processingContext, character.id, instance.type);
	}, [actions, globalState, character, instance.type]);
	const check = useCheckAddPermissions(checkInitial);

	const [requestPermissions, processingPermissionRequest] = useWardrobePermissionRequestCallback();

	const updateConfig = useCallback(async (config: CharacterModifierConfigurationChange): Promise<void> => {
		if (shard == null) {
			toast('Request failed, try again later', TOAST_OPTIONS_ERROR);
			return;
		}

		const result = await shard.awaitResponse('characterModifierConfigure', {
			target: character.id,
			modifier: instance.id,
			config,
		}).catch((err) => {
			GetLogger('CheckedInstanceDetails').error('Failed to configure character modifier:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
			return undefined;
		});

		if (result == null) {
			return;
		} else if (result.result === 'ok') {
			// Nothing to do here
			return;
		} else if (result.result === 'characterNotFound') {
			toast('The target character is no longer in the same space', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'invalidConfiguration') {
			toast('Error in the modifier configuration', TOAST_OPTIONS_ERROR);
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
	}, [instance.id, shard, character]);

	const allowModify = check != null && check.valid;

	return (
		<div className='inventoryView wardrobeModifierInstanceDetails'>
			<Row className='toolbar'>
				<ModifierInstanceEnableButton
					character={ character }
					enabled={ instance.enabled }
					onChange={ allowModify ? ((newValue) => updateConfig({
						enabled: newValue,
					})) : undefined }
				/>
				<span>Modifier "{ typeDefinition.visibleName }"</span>
			</Row>
			<Column padding='medium' overflowX='hidden' overflowY='auto'>
				<Row padding='medium' wrap alignX='space-evenly' className='itemActions'>
					<ModifierInstanceReorderButton
						character={ character }
						instance={ instance }
						shift={ -1 }
					>
						▲ Increase priority
					</ModifierInstanceReorderButton>
					<ModifierInstanceReorderButton
						character={ character }
						instance={ instance }
						shift={ 1 }
					>
						▼ Decrease priority
					</ModifierInstanceReorderButton>
					<ModifierInstanceDeleteButton
						character={ character }
						instance={ instance }
						unfocus={ unfocus }
					/>
					<ModifierInstanceExportButton instance={ instance } />
				</Row>
				{
					check != null && !check.valid ? (
						<fieldset className={ check.prompt != null ? 'modifyCheckProblem promptRequired' : 'modifyCheckProblem blocked' }>
							<Column>
								<ActionWarningContent
									problems={ check.problems }
									prompt={ check.prompt != null }
									customText={
										check.prompt != null ? 'To configure this modifier you need the following permissions:' :
											"Configuring this modifier isn't possible, because:"
									}
								/>
								{
									check.prompt != null ? (
										<button
											className='wardrobeActionButton promptRequired'
											onClick={ () => {
												const permissions = check.valid ? [] : check.problems
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
									) : null
								}
							</Column>
						</fieldset>
					) : null
				}
				{
					Array.from(Object.entries(typeDefinition.configDefinition))
						.map(([option, optionDefinition]: [string, ModifierConfigurationEntryDefinition]) => (
							<WardrobeCharacterModifierConfig
								key={ option }
								definition={ optionDefinition }
								value={ instance.config[option] }
								onChange={ allowModify ? ((newValue) => updateConfig({
									config: {
										[option]: newValue,
									},
								})) : undefined }
							/>
						))
				}
				<CharacterModifierConditionList
					character={ character }
					conditions={ instance.conditions }
					onChange={ allowModify ? ((newValue) => updateConfig({
						conditions: newValue,
					})) : undefined }
				/>
			</Column>
		</div>
	);
}

function ModifierInstanceEnableButton({ character, enabled, onChange }: {
	character: ICharacter;
	enabled: boolean;
	onChange?: (enabled: boolean) => Promisable<void>;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();

	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return processingContext.finalize();
	}, [actions, globalState]);
	const check = useCheckAddPermissions(checkInitial);

	const [requestPermissions, processingPermissionRequest] = useWardrobePermissionRequestCallback();

	const [execute, processing] = useAsyncEvent(async (newValue: boolean) => {
		await onChange?.(newValue);
	}, null, {
		errorHandler: (err) => {
			GetLogger('ModifierInstanceEnableButton').error('Failed to configure character modifier:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	const onValueChange = useCallback((newValue: boolean) => {
		const permissions = check.valid ? [] : check.problems
			.filter((p) => p.result === 'restrictionError')
			.map((p) => p.restriction)
			.filter((r) => r.type === 'missingPermission')
			.map((r): [PermissionGroup, string] => ([r.permissionGroup, r.permissionId]));

		if (permissions.length > 0) {
			requestPermissions(character.id, permissions);
		} else {
			execute(newValue);
		}
	}, [check, execute, requestPermissions, character]);

	return (
		<DivContainer align='center' justify='center' padding='small' className='activationSwitch'>
			<Switch
				checked={ enabled }
				onChange={ onValueChange }
				disabled={ processing || processingPermissionRequest }
				label='Enable this modifier'
			/>
		</DivContainer>
	);
}

function ModifierInstanceReorderButton({ character, instance, shift, children }: ChildrenProps & {
	character: ICharacter;
	instance: CharacterModifierInstanceClientData;
	shift: number;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const shard = useShardConnector();

	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return CharacterModifierActionCheckReorder(processingContext, character.id);
	}, [actions, globalState, character]);
	const check = useCheckAddPermissions(checkInitial);

	const [requestPermissions, processingPermissionRequest] = useWardrobePermissionRequestCallback();

	const [execute, processing] = useAsyncEvent(async () => {
		if (shard == null) {
			return null;
		}

		return await shard.awaitResponse('characterModifierReorder', {
			target: character.id,
			modifier: instance.id,
			shift,
		});
	}, (result: IClientShardNormalResult['characterModifierReorder'] | null) => {
		if (result == null) {
			toast('Request failed, try again later', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'ok') {
			// Nothing to do here
			return;
		} else if (result.result === 'characterNotFound') {
			toast('The target character is no longer in the same space', TOAST_OPTIONS_ERROR);
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
			GetLogger('ModifierInstanceReorderButton').error('Failed to reorder character modifier:', err);
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
			{ children }
		</WardrobeActionButtonElement>
	);
}

function ModifierInstanceDeleteButton({ character, instance, unfocus }: {
	character: ICharacter;
	instance: CharacterModifierInstanceClientData;
	unfocus: () => void;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const shard = useShardConnector();

	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return CharacterModifierActionCheckModify(processingContext, character.id, instance.type);
	}, [actions, globalState, character, instance.type]);
	const check = useCheckAddPermissions(checkInitial);

	const [requestPermissions, processingPermissionRequest] = useWardrobePermissionRequestCallback();

	const [execute, processing] = useAsyncEvent(async () => {
		if (shard == null) {
			return null;
		}

		return await shard.awaitResponse('characterModifierDelete', {
			target: character.id,
			modifier: instance.id,
		});
	}, (result: IClientShardNormalResult['characterModifierDelete'] | null) => {
		if (result == null) {
			toast('Request failed, try again later', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'ok') {
			unfocus();
			return;
		} else if (result.result === 'characterNotFound') {
			toast('The target character is no longer in the same space', TOAST_OPTIONS_ERROR);
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
			GetLogger('ModifierInstanceDeleteButton').error('Failed to delete character modifier:', err);
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
			<img src={ deleteIcon } alt='Delete action' /> Remove
		</WardrobeActionButtonElement>
	);
}

function ModifierInstanceExportButton({ instance }: {
	instance: CharacterModifierInstanceClientData;
}): ReactElement {
	const [showExportDialog, setShowExportDialog] = useState(false);

	return (
		<>
			<button
				className='wardrobeActionButton allowed'
				onClick={ () => {
					setShowExportDialog(true);
				} }
			>
				<img src={ exportIcon } alt='Export action' />&nbsp;Export
			</button>
			{
				showExportDialog ? (
					<ExportDialog
						exportType='CharacterModifier'
						exportVersion={ 1 }
						dataSchema={ CharacterModifierTemplateSchema }
						data={ MakeCharacterModifierTemplateFromClientData(instance) }
						closeDialog={ () => setShowExportDialog(false) }
					/>
				) : null
			}
		</>
	);
}
