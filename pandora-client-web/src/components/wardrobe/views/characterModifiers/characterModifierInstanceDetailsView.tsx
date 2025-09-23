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
	type IClientShardNormalResult,
	type ModifierConfigurationEntryDefinition,
	type PermissionGroup,
} from 'pandora-common';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import type { Promisable } from 'type-fest';
import crossIcon from '../../../../assets/icons/cross.svg';
import deleteIcon from '../../../../assets/icons/delete.svg';
import exportIcon from '../../../../assets/icons/export.svg';
import type { ICharacter } from '../../../../character/character.ts';
import type { ChildrenProps } from '../../../../common/reactTypes.ts';
import { useAsyncEvent } from '../../../../common/useEvent.ts';
import { TextInput } from '../../../../common/userInteraction/input/textInput.tsx';
import { Switch } from '../../../../common/userInteraction/switch.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../../persistentToast.ts';
import { CharacterListInput } from '../../../../ui/components/characterListInput/characterListInput.tsx';
import { Button, IconButton } from '../../../common/button/button.tsx';
import { Column, DivContainer, Row } from '../../../common/container/container.tsx';
import { FieldsetToggle } from '../../../common/fieldsetToggle/index.tsx';
import { FormCreateStringValidator, FormError } from '../../../common/form/form.tsx';
import { ExportDialog } from '../../../exportImport/exportDialog.tsx';
import { useCheckAddPermissions } from '../../../gameContext/permissionCheckProvider.tsx';
import { useShardConnector } from '../../../gameContext/shardConnectorContextProvider.tsx';
import { ContextHelpButton } from '../../../help/contextHelpButton.tsx';
import { useWardrobeActionContext, useWardrobePermissionRequestCallback } from '../../wardrobeActionContext.tsx';
import { ActionWarningContent, WardrobeActionButtonElement } from '../../wardrobeComponents.tsx';
import { WardrobeCharacterModifierLock } from './characterModifierInstanceLock.tsx';
import { WardrobeCharacterModifierTypeDescription } from './characterModifierTypeDetailsView.tsx';
import { CharacterModifierConditionList } from './conditions/characterModifierConditionList.tsx';
import { WardrobeCharacterModifierConfig } from './configuration/_index.tsx';

export interface WardrobeCharacterModifierInstanceDetailsViewProps {
	character: ICharacter;
	instance: GameLogicModifierInstanceClient | null;
	allModifiers: readonly GameLogicModifierInstanceClient[];
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

type ModifierInstanceDetailCheckedProps = WardrobeCharacterModifierInstanceDetailsViewProps & {
	instance: GameLogicModifierInstanceClient;
};
function CheckedInstanceDetails({ character, instance, allModifiers, unfocus }: ModifierInstanceDetailCheckedProps): ReactElement {
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
					enabled={ instance.enabled }
					onChange={ allowModify ? ((newValue) => updateConfig({
						enabled: newValue,
					})) : undefined }
				/>
				<span>
					Modifier "{ typeDefinition.visibleName }"
					<ContextHelpButton>
						<WardrobeCharacterModifierTypeDescription type={ instance.type } />
					</ContextHelpButton>
				</span>
			</Row>
			<Column padding='medium' overflowY='auto'>
				<Row padding='medium' alignX='center'>
					<Row wrap className='itemActions'>
						<ModifierInstanceReorderButton
							character={ character }
							instance={ instance }
							allModifiers={ allModifiers }
							shift={ -1 }
						>
							▲ Increase priority
						</ModifierInstanceReorderButton>
						<ModifierInstanceReorderButton
							character={ character }
							instance={ instance }
							allModifiers={ allModifiers }
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
				</Row>
				<FieldsetToggle legend='Lock' className='characterModifierLock' open={ instance.lock != null }>
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

function ModifierInstanceEnableButton({ enabled, onChange }: {
	enabled: boolean;
	onChange?: (enabled: boolean) => Promisable<void>;
}): ReactElement {
	const [execute, processing] = useAsyncEvent(async (newValue: boolean) => {
		await onChange?.(newValue);
	}, null, {
		errorHandler: (err) => {
			GetLogger('ModifierInstanceEnableButton').error('Failed to configure character modifier:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	return (
		<DivContainer align='center' justify='center' padding='small' className='activationSwitch'>
			<Switch
				checked={ enabled }
				onChange={ execute }
				disabled={ onChange == null || processing }
				label='Enable this modifier'
			/>
		</DivContainer>
	);
}

export function ModifierInstanceNameInput({ modifierTypeVisibleName, value, onChange, instantChange = false }: {
	modifierTypeVisibleName: string;
	value: string;
	onChange?: (newValue: string) => Promisable<void>;
	instantChange?: boolean;
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

	useEffect(() => {
		if (instantChange && onChange != null && changedValue != null && valueError == null && changedValue !== value) {
			(async () => {
				await onChange(value);
			})()
				.catch((err) => {
					GetLogger('ModifierInstanceNameInput').error('Failed to auto-apply character modifier name:', err);
					toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
				});
		}
	}, [instantChange, value, changedValue, onChange, valueError]);

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
						(onChange != null && !instantChange) ? (
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

function ModifierInstanceReorderButton({ character, instance, allModifiers, shift, children }: ChildrenProps & {
	character: ICharacter;
	instance: GameLogicModifierInstanceClient;
	allModifiers: readonly GameLogicModifierInstanceClient[];
	shift: number;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const shard = useShardConnector();

	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return CharacterModifierActionCheckReorder(processingContext, character.id, allModifiers, instance.id, shift);
	}, [actions, globalState, character, allModifiers, instance, shift]);
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
	const exported = MakeCharacterModifierTemplateFromClientData(instance.getClientData());

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
						title={ 'character modifier' + (exported.name ? ` "${ exported.name }"` : '') }
						exportType='CharacterModifier'
						exportVersion={ 1 }
						dataSchema={ CharacterModifierTemplateSchema }
						data={ exported }
						closeDialog={ () => setShowExportDialog(false) }
					/>
				) : null
			}
		</>
	);
}
