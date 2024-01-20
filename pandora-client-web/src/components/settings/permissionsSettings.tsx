import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import onOff from '../../assets/icons/on-off.svg';
import body from '../../assets/icons/body.svg';
import color from '../../assets/icons/color.svg';
import lock from '../../assets/icons/lock.svg';
import storage from '../../assets/icons/storage.svg';
import toggle from '../../assets/icons/toggle.svg';
import star from '../../assets/icons/star.svg';
import arrowRight from '../../assets/icons/arrow-right.svg';
import questionmark from '../../assets/icons/questionmark.svg';
import forbid from '../../assets/icons/forbidden.svg';
import allow from '../../assets/icons/public.svg';
import prompt from '../../assets/icons/prompt.svg';
import { Button } from '../common/button/button';
import { usePlayer } from '../gameContext/playerContextProvider';
import { ASSET_PREFERENCES_PERMISSIONS, AssetPreferenceType, GetLogger, IClientShardNormalResult, IInteractionConfig, INTERACTION_CONFIG, INTERACTION_IDS, InteractionId, KnownObject, MakePermissionConfigFromDefault, PermissionGroup, PermissionSetup, PermissionType } from 'pandora-common';
import { useShardChangeListener, useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ModalDialog } from '../dialog/dialog';
import { Column, Row } from '../common/container/container';
import { noop } from 'lodash';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { SelectionIndicator } from '../common/selectionIndicator/selectionIndicator';
import { HoverElement } from '../hoverElement/hoverElement';
import type { Immutable } from 'immer';

export function PermissionsSettings(): ReactElement | null {
	const player = usePlayer();

	if (!player)
		return <>No character selected</>;

	return (
		<>
			<InteractionPermissions />
			<ItemLimitsPermissions />
		</>
	);
}

function InteractionPermissions(): ReactElement {
	return (
		<fieldset>
			<legend>Interaction permissions</legend>
			<i>Allow other characters to...</i>
			{
				INTERACTION_IDS.map((id) => (
					<InteractionSettings key={ id } id={ id } />
				))
			}
		</fieldset>
	);
}

function GetIcon(icon: string): string {
	switch (icon) {
		case 'star':
			return star;
		case 'arrow-right':
			return arrowRight;
		case 'questionmark':
			return questionmark;
		case 'body':
			return body;
		case 'color':
			return color;
		case 'lock':
			return lock;
		case 'on-off':
			return onOff;
		case 'storage':
			return storage;
		case 'toggle':
			return toggle;
		default:
			return forbid;
	}
}

function useEffectiveAllowOthers(permissionGroup: PermissionGroup, permissionId: string): PermissionType {
	const permissionData = usePermissionData(permissionGroup, permissionId);
	if (permissionData?.result !== 'ok')
		return 'no';

	const {
		permissionSetup,
		permissionConfig,
	} = permissionData;

	if (permissionConfig != null)
		return permissionConfig.allowOthers;

	return MakePermissionConfigFromDefault(permissionSetup.defaultConfig).allowOthers;
}

function ShowEffectiveAllowOthers({ permissionGroup, permissionId }: { permissionGroup: PermissionGroup; permissionId: string; }): ReactElement {
	const effectiveConfig = useEffectiveAllowOthers(permissionGroup, permissionId);
	const [ref, setRef] = useState<HTMLElement | null>(null);

	const { src, alt, description } = useMemo(() => {
		switch (effectiveConfig) {
			case 'yes':
				return {
					src: allow,
					alt: 'General permission configuration preview',
					description: 'Everyone is allowed to do this, but exceptions can be set individually.',
				};
			case 'no':
				return {
					src: forbid,
					alt: 'General permission configuration preview',
					description: 'No one is allowed to do this, but exceptions can be set individually.',
				};
			case 'prompt':
				return {
					src: prompt,
					alt: 'General permission configuration preview',
					description: 'Trying to use this permission opens a popup that lets the targeted user decide if they want to give or deny the requester this permission. Exceptions can be set individually.',
				};
		}
	}, [effectiveConfig]);

	return (
		<>
			<img ref={ setRef } src={ src } width='26' height='26' alt={ alt } />
			<HoverElement parent={ ref } className='attribute-description'>
				{ description }
			</HoverElement>
		</>
	);
}

function InteractionSettings({ id }: { id: InteractionId; }): ReactElement {
	const config: Immutable<IInteractionConfig> = INTERACTION_CONFIG[id];
	const [showConfig, setShowConfig] = useState(false);

	return (
		<div className='input-row'>
			<label className='flex-1'>
				<img src={ GetIcon(config.icon) } width='28' height='28' alt='permission icon' />
				&nbsp;&nbsp;
				{ config.visibleName }
			</label>
			<ShowEffectiveAllowOthers permissionGroup='interaction' permissionId={ id } />
			<Button
				className='slim'
				onClick={ () => setShowConfig(true) }
			>
				Edit
			</Button>
			{ showConfig && (
				<PermissionConfigDialog
					hide={ () => setShowConfig(false) }
					permissionGroup='interaction'
					permissionId={ id }
				/>
			) }
		</div>
	);
}

function ItemLimitsPermissions(): ReactElement {
	return (
		<fieldset>
			<legend>Item Limits</legend>
			<i>Allow other characters to interact with worn items and to add new items that are marked in the item limits as...</i>
			{
				KnownObject.keys(ASSET_PREFERENCES_PERMISSIONS).map((group) => (
					<ItemLimitsSettings key={ group } group={ group } />
				))
			}
		</fieldset>
	);
}

function ItemLimitsSettings({ group }: { group: AssetPreferenceType; }): ReactElement | null {
	const config = ASSET_PREFERENCES_PERMISSIONS[group];
	const [showConfig, setShowConfig] = useState(false);

	if (config == null)
		return null;

	return (
		<div className='input-row flex-1'>
			<label className='flex-1'>
				<img src={ GetIcon(config.icon) } width='28' height='28' alt='permission icon' />
				&nbsp;&nbsp;
				{ config.visibleName }
			</label>
			<ShowEffectiveAllowOthers permissionGroup='assetPreferences' permissionId={ group } />
			<Button
				className='slim'
				onClick={ () => setShowConfig(true) }
			>
				Edit
			</Button>
			{ showConfig && (
				<PermissionConfigDialog
					hide={ () => setShowConfig(false) }
					permissionGroup='assetPreferences'
					permissionId={ group }
				/>
			) }
		</div>
	);
}

function PermissionConfigDialog({ permissionGroup, permissionId, hide }: {
	permissionGroup: PermissionGroup;
	permissionId: string;
	hide: () => void;
}): ReactElement {
	const shardConnector = useShardConnector();
	const permissionData = usePermissionData(permissionGroup, permissionId);

	const setConfig = useCallback((allowOthers: PermissionType | null) => {
		if (shardConnector == null || permissionData?.result !== 'ok')
			return;

		shardConnector.awaitResponse('permissionSet', {
			permissionGroup,
			permissionId,
			config: {
				selector: 'default',
				allowOthers,
			},
		})
			.then((result) => {
				if (result.result !== 'ok') {
					GetLogger('permissionSet').error('Error updating permission:', result);
					toast(`Error updating permission:\n${result.result}`, TOAST_OPTIONS_ERROR);
				}
			})
			.catch((err) => {
				GetLogger('permissionSet').error('Error updating permission:', err);
				toast(`Error updating permission`, TOAST_OPTIONS_ERROR);
			});
	}, [shardConnector, permissionGroup, permissionId, permissionData]);

	if (shardConnector == null || permissionData == null) {
		return (
			<Row className='flex-1' alignX='center' alignY='center'>
				Loading...
			</Row>
		);
	}

	if (permissionData.result !== 'ok') {
		return (
			<Row className='flex-1' alignX='center' alignY='center'>
				Error loading permission: { permissionData.result }
			</Row>
		);
	}

	const {
		permissionSetup,
		permissionConfig,
	} = permissionData;

	const effectiveConfig = permissionConfig ?? MakePermissionConfigFromDefault(permissionSetup.defaultConfig);

	return (
		<ModalDialog>
			<Row alignX='center'>
				<h2>Editing permission</h2>
			</Row>
			<span>
				Allow other characters to <b>{ permissionSetup.displayName }</b>
			</span>
			<Column padding='large'>
				<Row alignX='space-between' alignY='center'>
					<span>Allow others:</span>
					<Row>
						<PermissionAllowOthersSelector type='no' setConfig={ setConfig } effectiveConfig={ effectiveConfig } permissionSetup={ permissionSetup } />
						<PermissionAllowOthersSelector type='yes' setConfig={ setConfig } effectiveConfig={ effectiveConfig } permissionSetup={ permissionSetup } />
						<PermissionAllowOthersSelector type='prompt' setConfig={ setConfig } effectiveConfig={ effectiveConfig } permissionSetup={ permissionSetup } />
					</Row>
				</Row>
			</Column>
			<Row padding='medium' alignX='space-between' alignY='center'>
				<Button slim onClick={ () => setConfig(null) } className='fadeDisabled' disabled={ permissionConfig == null }>Reset defaults</Button>
				<Button onClick={ hide }>Close</Button>
			</Row>
		</ModalDialog>
	);
}

function PermissionAllowOthersSelector({ type, setConfig, effectiveConfig, permissionSetup }: {
	type: PermissionType;
	setConfig: (allowOthers: PermissionType) => void;
	effectiveConfig: { allowOthers: PermissionType; };
	permissionSetup: PermissionSetup;
}): ReactElement {
	const disabled = permissionSetup.forbidDefaultAllowOthers ? permissionSetup.forbidDefaultAllowOthers.includes(type) : false;
	const onClick = useCallback(() => {
		if (disabled)
			return;

		setConfig(type);
	}, [disabled, setConfig, type]);

	return (
		<SelectionIndicator selected={ effectiveConfig.allowOthers === type }>
			<Button slim onClick={ onClick } disabled={ disabled }>{ type }</Button>
		</SelectionIndicator>
	);
}

export function usePermissionData(permissionGroup: PermissionGroup, permissionId: string): IClientShardNormalResult['permissionGet'] | undefined {
	const [permissionConfig, setPermissionConfig] = useState<IClientShardNormalResult['permissionGet']>();
	const shardConnector = useShardConnector();

	const fetchPermissionConfig = useCallback(async () => {
		if (shardConnector == null) {
			setPermissionConfig(undefined);
			return;
		}

		const result = await shardConnector.awaitResponse('permissionGet', {
			permissionGroup,
			permissionId,
		}).catch(() => undefined);
		setPermissionConfig(result);
	}, [shardConnector, permissionGroup, permissionId]);

	useShardChangeListener('permissions', () => {
		fetchPermissionConfig().catch(noop);
	});

	return permissionConfig;
}
