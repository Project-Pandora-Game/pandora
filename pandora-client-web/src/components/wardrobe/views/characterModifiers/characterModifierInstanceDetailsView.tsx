import {
	AppearanceActionProcessingContext,
	AssertNever,
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	CharacterModifierActionCheckModify,
	CharacterModifierActionCheckReorder,
	CharacterModifierNameSchema,
	CharacterModifierTemplateSchema,
	CloneDeepMutable,
	GameLogicModifierInstanceClient,
	GetLogger,
	LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT,
	LIMIT_CHARACTER_MODIFIER_NAME_LENGTH,
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
import { TextInput } from '../../../../common/userInteraction/input/textInput';
import { Switch } from '../../../../common/userInteraction/switch';
import { TOAST_OPTIONS_ERROR } from '../../../../persistentToast';
import { Button, IconButton } from '../../../common/button/button';
import { CharacterListInput } from '../../../common/characterListInput/characterListInput';
import { Column, DivContainer, Row } from '../../../common/container/container';
import { FieldsetToggle } from '../../../common/fieldsetToggle';
import { FormCreateStringValidator, FormError } from '../../../common/form/form';
import { ExportDialog } from '../../../exportImport/exportDialog';
import { useCheckAddPermissions } from '../../../gameContext/permissionCheckProvider';
import { useShardConnector } from '../../../gameContext/shardConnectorContextProvider';
import { useWardrobeActionContext, useWardrobePermissionRequestCallback } from '../../wardrobeActionContext';
import { ActionWarningContent, WardrobeActionButtonElement } from '../../wardrobeComponents';
import { WardrobeCharacterModifierLock } from './characterModifierInstanceLock';
import { CharacterModifierConditionList } from './conditions/characterModifierConditionList';
import { WardrobeCharacterModifierConfig } from './configuration/_index';
import { ContextHelpButton } from '../../../help/contextHelpButton';

export interface WardrobeCharacterModifierInstanceDetailsViewProps {
	character: ICharacter;
	instance: CharacterModifierInstanceClientData | null;
	unfocus: () => void;
}

export function WardrobeCharacterModifierInstanceDetailsView({ instance, unfocus, ...props }: WardrobeCharacterModifierInstanceDetailsViewProps): ReactElement {
	const loadedInstance = useMemo((): GameLogicModifierInstanceClient | null => (
		instance != null ? (new GameLogicModifierInstanceClient(instance)) : null
	), [instance]);

	if (loadedInstance == null) {
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
			instance={ loadedInstance }
			unfocus={ unfocus }
		/>
	);
}

type ModifierInstanceDetailCheckedProps = Omit<WardrobeCharacterModifierInstanceDetailsViewProps, 'instance'> & {
	instance: GameLogicModifierInstanceClient;
};
function CheckedInstanceDetails({ character, instance, unfocus }: ModifierInstanceDetailCheckedProps): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const shard = useShardConnector();
	const typeDefinition = CHARACTER_MODIFIER_TYPE_DEFINITION[instance.type];

	// Do an early check on if we are allowed to do modifications

	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return CharacterModifierActionCheckModify(processingContext, character.id, instance);
	}, [actions, globalState, character, instance]);
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
				<FieldsetToggle legend='Lock' open={ instance.lock != null }>
					<WardrobeCharacterModifierLock
						character={ character }
						instance={ instance }
					/>
					<FieldsetToggle
						legend={
							<>
								Lock exceptions
								<ContextHelpButton>
									<p>
										Characters in this list will ignore any lock placed on this modifier, even if it is locked.
									</p>
									<p>
										These characters will not be able to unlock or remove the lock, but they will still be allowed to<br />
										change any modifier settings (including this one), enable/disable the modifier, or even delete the modifier altogether.
									</p>
								</ContextHelpButton>
							</>
						}
					>
						<CharacterListInput
							max={ LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT }
							value={ instance.lockExceptions }
							onChange={ allowModify ? ((newValue) => updateConfig({
								lockExceptions: CloneDeepMutable(newValue),
							})) : undefined }
						/>
					</FieldsetToggle>
				</FieldsetToggle>
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
				<ModifierInstanceNameInput
					modifierTypeVisibleName={ typeDefinition.visibleName }
					value={ instance.name }
					onChange={ allowModify ? ((newValue) => updateConfig({
						name: newValue,
					})) : undefined }
				/>
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
				disabled={ onChange == null || processing || processingPermissionRequest }
				label='Enable this modifier'
			/>
		</DivContainer>
	);
}

function ModifierInstanceNameInput({ modifierTypeVisibleName, value, onChange }: {
	modifierTypeVisibleName: string;
	value: string;
	onChange?: (newValue: string) => Promisable<void>;
}): ReactElement {
	const [changedValue, setChangedValue] = useState<string | null>(null);
	const valueError = changedValue != null ? FormCreateStringValidator(CharacterModifierNameSchema, 'value')(changedValue) : undefined;

	const [execute, processing] = useAsyncEvent(async () => {
		if (onChange == null)
			throw new Error('Changing value not supported');
		if (changedValue == null || valueError != null)
			return value;

		await onChange(changedValue);
		return changedValue;
	}, (result: string) => {
		setChangedValue((currentValue) => (currentValue == null || currentValue === result) ? null : currentValue);
	}, {
		errorHandler: (err) => {
			GetLogger('ModifierInstanceNameInput').error('Failed to set character modifier name:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	return (
		<FieldsetToggle legend='Custom name'>
			<Column>
				<Row>
					<TextInput
						className='flex-1'
						value={ changedValue ?? value }
						placeholder={ modifierTypeVisibleName }
						onChange={ (newValue) => setChangedValue(newValue.trim()) }
						maxLength={ LIMIT_CHARACTER_MODIFIER_NAME_LENGTH }
						disabled={ onChange == null || processing }
					/>
					{
						onChange != null ? (
							<Button
								slim
								disabled={ changedValue == null || valueError != null }
								onClick={ execute }
							>
								Save
							</Button>
						) : null
					}
				</Row>
				{
					valueError ? (
						<FormError error={ valueError } />
					) : null
				}
			</Column>
		</FieldsetToggle>
	);
}

function ModifierInstanceReorderButton({ character, instance, shift, children }: ChildrenProps & {
	character: ICharacter;
	instance: GameLogicModifierInstanceClient;
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
	instance: GameLogicModifierInstanceClient;
	unfocus: () => void;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const shard = useShardConnector();

	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return CharacterModifierActionCheckModify(processingContext, character.id, instance);
	}, [actions, globalState, character, instance]);
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
	instance: GameLogicModifierInstanceClient;
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
						data={ MakeCharacterModifierTemplateFromClientData(instance.getClientData()) }
						closeDialog={ () => setShowExportDialog(false) }
					/>
				) : null
			}
		</>
	);
}
