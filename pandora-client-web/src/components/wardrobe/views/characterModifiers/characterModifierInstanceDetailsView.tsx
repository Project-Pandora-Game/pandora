import {
	AppearanceActionProcessingContext,
	AssertNever,
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	CharacterModifierTemplateSchema,
	GetLogger,
	MakeCharacterModifierTemplateFromClientData,
	type CharacterId,
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
import { WardrobeCharacterModifierConfig } from './configuration/_index';

interface WardrobeCharacterModifierInstanceDetailsViewProps {
	target: CharacterId;
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

function CheckedInstanceDetails({ target, instance, unfocus }: WardrobeCharacterModifierInstanceDetailsViewProps & {
	instance: CharacterModifierInstanceClientData;
}): ReactElement {
	const shard = useShardConnector();
	const typeDefinition = CHARACTER_MODIFIER_TYPE_DEFINITION[instance.type];

	const updateConfig = useCallback(async (config: CharacterModifierConfigurationChange): Promise<void> => {
		if (shard == null) {
			toast('Request failed, try again later', TOAST_OPTIONS_ERROR);
			return;
		}

		const result = await shard.awaitResponse('characterModifierConfigure', {
			target,
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
					<ActionWarningContent problems={ result.problems } prompt={ false } noText />
				</Column>,
				TOAST_OPTIONS_ERROR,
			);
		} else {
			AssertNever(result);
		}
	}, [instance.id, shard, target]);

	return (
		<div className='inventoryView wardrobeModifierInstanceDetails'>
			<Row className='toolbar'>
				<ModifierInstanceEnableButton
					target={ target }
					enabled={ instance.enabled }
					onChange={ (newValue) => updateConfig({
						enabled: newValue,
					}) }
				/>
				<span>Modifier "{ typeDefinition.visibleName }"</span>
			</Row>
			<Column padding='medium' overflowX='hidden' overflowY='auto'>
				<Row padding='medium' wrap alignX='space-evenly' className='itemActions'>
					<ModifierInstanceReorderButton
						target={ target }
						instance={ instance }
						shift={ -1 }
					>
						▲ Increase priority
					</ModifierInstanceReorderButton>
					<ModifierInstanceReorderButton
						target={ target }
						instance={ instance }
						shift={ 1 }
					>
						▼ Decrease priority
					</ModifierInstanceReorderButton>
					<ModifierInstanceDeleteButton
						target={ target }
						instance={ instance }
						unfocus={ unfocus }
					/>
					<ModifierInstanceExportButton instance={ instance } />
				</Row>
				{
					Array.from(Object.entries(typeDefinition.configDefinition))
						.map(([option, optionDefinition]: [string, ModifierConfigurationEntryDefinition]) => (
							<WardrobeCharacterModifierConfig
								key={ option }
								definition={ optionDefinition }
								value={ instance.config[option] }
								onChange={ (newValue) => updateConfig({
									config: {
										[option]: newValue,
									},
								}) }
							/>
						))
				}
			</Column>
		</div>
	);
}

function ModifierInstanceEnableButton({ target, enabled, onChange }: {
	target: CharacterId;
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
			requestPermissions(target, permissions);
		} else {
			execute(newValue);
		}
	}, [check, execute, requestPermissions, target]);

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

function ModifierInstanceReorderButton({ target, instance, shift, children }: ChildrenProps & {
	target: CharacterId;
	instance: CharacterModifierInstanceClientData;
	shift: number;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const shard = useShardConnector();

	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return processingContext.finalize();
	}, [actions, globalState]);
	const check = useCheckAddPermissions(checkInitial);

	const [requestPermissions, processingPermissionRequest] = useWardrobePermissionRequestCallback();

	const [execute, processing] = useAsyncEvent(async () => {
		if (shard == null) {
			return null;
		}

		return await shard.awaitResponse('characterModifierReorder', {
			target,
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
					<ActionWarningContent problems={ result.problems } prompt={ false } noText />
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
			requestPermissions(target, permissions);
		} else {
			execute();
		}
	}, [check, execute, requestPermissions, target]);

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

function ModifierInstanceDeleteButton({ target, instance, unfocus }: {
	target: CharacterId;
	instance: CharacterModifierInstanceClientData;
	unfocus: () => void;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const shard = useShardConnector();

	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return processingContext.finalize();
	}, [actions, globalState]);
	const check = useCheckAddPermissions(checkInitial);

	const [requestPermissions, processingPermissionRequest] = useWardrobePermissionRequestCallback();

	const [execute, processing] = useAsyncEvent(async () => {
		if (shard == null) {
			return null;
		}

		return await shard.awaitResponse('characterModifierDelete', {
			target,
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
					<ActionWarningContent problems={ result.problems } prompt={ false } noText />
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
			requestPermissions(target, permissions);
		} else {
			execute();
		}
	}, [check, execute, requestPermissions, target]);

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
