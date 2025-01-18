import {
	AppearanceActionProcessingContext,
	AssertNever,
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	GetLogger,
	type CharacterId,
	type CharacterModifierId,
	type CharacterModifierType,
	type IClientShardNormalResult,
	type PermissionGroup,
} from 'pandora-common';
import React, { ReactElement, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useAsyncEvent } from '../../../../common/useEvent';
import { TOAST_OPTIONS_ERROR } from '../../../../persistentToast';
import { Column } from '../../../common/container/container';
import { useCheckAddPermissions } from '../../../gameContext/permissionCheckProvider';
import { useShardConnector } from '../../../gameContext/shardConnectorContextProvider';
import { useWardrobeActionContext, useWardrobePermissionRequestCallback } from '../../wardrobeActionContext';
import { ActionWarningContent, WardrobeActionButtonElement } from '../../wardrobeComponents';

export function WardrobeCharacterModifierTypeDetailsView({ type, target, focusModifierInstance }: {
	type: CharacterModifierType;
	target: CharacterId;
	focusModifierInstance: (id: CharacterModifierId) => void;
}): ReactElement | null {
	const { actions, globalState } = useWardrobeActionContext();
	const shard = useShardConnector();

	const typeDefinition = CHARACTER_MODIFIER_TYPE_DEFINITION[type];

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

		return await shard.awaitResponse('characterModifierAdd', {
			target,
			modifier: {
				type,
				enabled: false,
				config: {},
			},
		});
	}, (result: IClientShardNormalResult['characterModifierAdd'] | null) => {
		if (result == null) {
			toast('Request failed, try again later', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'ok') {
			focusModifierInstance(result.instanceId);
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
					<ActionWarningContent problems={ result.problems } prompt={ false } noText />
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
			requestPermissions(target, permissions);
		} else {
			execute();
		}
	}, [check, execute, requestPermissions, target]);

	return (
		<div className='inventoryView wardrobeModifierTypeList'>
			<div className='toolbar'>
				<span>Modifier "{ typeDefinition.visibleName }"</span>
			</div>
			<Column padding='large'>
				<WardrobeActionButtonElement
					check={ check }
					onClick={ onClick }
					disabled={ processing || processingPermissionRequest }
				>
					Add this modifier
				</WardrobeActionButtonElement>
			</Column>
		</div>
	);
}
