import React, { ReactElement, useCallback, useState } from 'react';
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
// TODO: use '../../assets/icons/prompt.svg' as icon for future promptUser permission setting
import { Button } from '../common/button/button';
import { usePlayer } from '../gameContext/playerContextProvider';
import { ASSET_PREFERENCES_PERMISSIONS, AssetPreferenceType, GetLogger, IClientShardNormalResult, IInteractionConfig, INTERACTION_CONFIG, INTERACTION_IDS, InteractionId, KnownObject, MakePermissionConfigFromDefault, PermissionConfig, PermissionGroup } from 'pandora-common';
import { useShardChangeListener, useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ModalDialog } from '../dialog/dialog';
import { Column, Row } from '../common/container/container';
import { noop } from 'lodash';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { SelectionIndicator } from '../common/selectionIndicator/selectionIndicator';
import { HoverElement } from '../hoverElement/hoverElement';

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

function InteractionSettings({ id }: { id: InteractionId; }): ReactElement {
	const [ref, setRef] = useState<HTMLElement | null>(null);
	const config: IInteractionConfig = INTERACTION_CONFIG[id];
	const [showConfig, setShowConfig] = useState(false);
	const permissionData = usePermissionData('interaction', id);
	let effectiveConfig: { allowOthers: boolean; } = { allowOthers: false };
	if (permissionData?.result === 'ok') {
		const {
			permissionSetup,
			permissionConfig,
		} = permissionData;
		effectiveConfig = permissionConfig ?? MakePermissionConfigFromDefault(permissionSetup.defaultConfig);
	}

	return (
		<div className='input-row'>
			<label className='flex-1'>
				<img src={ GetIcon(config.icon) } width='28' height='28' alt='permission icon' />
				&nbsp;&nbsp;
				{ config.visibleName }
			</label>
			<img ref={ setRef } src={ effectiveConfig.allowOthers ? allow : forbid } width='26' height='26' alt='General permission configuration preview' />
			<HoverElement parent={ ref } className='attribute-description'>
				{ effectiveConfig.allowOthers ? 'Everyone is allowed to do this, but exceptions can be set individually.' : 'No one is allowed to do this, but exceptions can be set individually.' }
			</HoverElement>
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
	const [ref, setRef] = useState<HTMLElement | null>(null);
	const config = ASSET_PREFERENCES_PERMISSIONS[group];
	const [showConfig, setShowConfig] = useState(false);
	const permissionData = usePermissionData('assetPreferences', group);
	let effectiveConfig: { allowOthers: boolean; } = { allowOthers: false };
	if (permissionData?.result === 'ok') {
		const {
			permissionSetup,
			permissionConfig,
		} = permissionData;
		effectiveConfig = permissionConfig ?? MakePermissionConfigFromDefault(permissionSetup.defaultConfig);
	}

	if (config == null)
		return null;

	return (
		<div className='input-row flex-1'>
			<label className='flex-1'>
				<img src={ GetIcon(config.icon) } width='28' height='28' alt='permission icon' />
				&nbsp;&nbsp;
				{ config.visibleName }
			</label>
			<img ref={ setRef } src={ effectiveConfig.allowOthers ? allow : forbid } width='26' height='26' alt='General permission configuration preview' />
			<HoverElement parent={ ref } className='attribute-description'>
				{ effectiveConfig.allowOthers ? 'Everyone is allowed to do this, but exceptions can be set individually.' : 'No one is allowed to do this, but exceptions can be set individually.' }
			</HoverElement>
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

	const setConfig = useCallback((newConfig: null | Partial<PermissionConfig>) => {
		if (shardConnector == null || permissionData?.result !== 'ok')
			return;

		shardConnector.awaitResponse('permissionSet', {
			permissionGroup,
			permissionId,
			config: newConfig == null ? null : {
				...(permissionData.permissionConfig ?? MakePermissionConfigFromDefault(permissionData.permissionSetup.defaultConfig)),
				...newConfig,
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
						<SelectionIndicator selected={ !effectiveConfig.allowOthers }>
							<Button slim onClick={ () => setConfig({ allowOthers: false }) }>No</Button>
						</SelectionIndicator>
						<SelectionIndicator selected={ effectiveConfig.allowOthers }>
							<Button slim onClick={ () => setConfig({ allowOthers: true }) }>Yes</Button>
						</SelectionIndicator>
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
