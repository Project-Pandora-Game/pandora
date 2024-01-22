import React, { ReactElement, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
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
import { ASSET_PREFERENCES_PERMISSIONS, AssertNever, AssetPreferenceType, CharacterId, CharacterIdSchema, EMPTY, GameLogicPermissionClient, GetLogger, IClientShardNormalResult, IInteractionConfig, INTERACTION_CONFIG, INTERACTION_IDS, InteractionId, KnownObject, MakePermissionConfigFromDefault, PermissionConfigChangeSelector, PermissionConfigChangeType, PermissionGroup, PermissionSetup, PermissionType } from 'pandora-common';
import { useShardChangeListener, useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ModalDialog } from '../dialog/dialog';
import { Column, Row } from '../common/container/container';
import { capitalize, noop } from 'lodash';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { SelectionIndicator } from '../common/selectionIndicator/selectionIndicator';
import { HoverElement } from '../hoverElement/hoverElement';
import { PermissionPromptData, useGameStateOptional } from '../gameContext/gameStateContextProvider';
import type { Immutable } from 'immer';
import { useFunctionBind } from '../../common/useFunctionBind';

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

function usePermissionConfigSetAny(): (permissionGroup: PermissionGroup, permissionId: string, selector: PermissionConfigChangeSelector, allowOthers: PermissionConfigChangeType) => void {
	const shardConnector = useShardConnector();
	return useCallback((permissionGroup: PermissionGroup, permissionId: string, selector: PermissionConfigChangeSelector, allowOthers: PermissionConfigChangeType) => {
		if (shardConnector == null)
			return;

		shardConnector.awaitResponse('permissionSet', {
			permissionGroup,
			permissionId,
			config: {
				selector,
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
	}, [shardConnector]);
}

function PermissionConfigDialog({ permissionGroup, permissionId, hide }: {
	permissionGroup: PermissionGroup;
	permissionId: string;
	hide: () => void;
}): ReactElement {
	const shardConnector = useShardConnector();
	const permissionData = usePermissionData(permissionGroup, permissionId);

	const setConfig = usePermissionConfigSetAny();
	const setDefault = useFunctionBind(setConfig, permissionGroup, permissionId, 'default');
	const setAny = useFunctionBind(setConfig, permissionGroup, permissionId);

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
						<PermissionAllowOthersSelector type='no' setConfig={ setDefault } effectiveConfig={ effectiveConfig } permissionSetup={ permissionSetup } />
						<PermissionAllowOthersSelector type='yes' setConfig={ setDefault } effectiveConfig={ effectiveConfig } permissionSetup={ permissionSetup } />
						<PermissionAllowOthersSelector type='prompt' setConfig={ setDefault } effectiveConfig={ effectiveConfig } permissionSetup={ permissionSetup } />
					</Row>
				</Row>
			</Column>
			<Row padding='medium' alignX='space-between' alignY='center'>
				<Button slim onClick={ () => setDefault(null) } className='fadeDisabled'>Reset defaults</Button>
				<Button onClick={ hide }>Close</Button>
			</Row>
			<PermissionConfigOverrides overrides={ permissionConfig?.characterOverrides ?? EMPTY } setConfig={ setAny } />
		</ModalDialog>
	);
}

function PermissionConfigOverrides({ overrides, setConfig }: { overrides: Partial<Record<CharacterId, PermissionType>>; setConfig: (selector: PermissionConfigChangeSelector, allowOthers: PermissionConfigChangeType) => void; }): ReactElement | null {
	const values = useMemo(() => {
		const result: { allow: CharacterId[]; deny: CharacterId[]; prompt: CharacterId[]; } = { allow: [], deny: [], prompt: [] };
		for (const [characterId, allowOthers] of KnownObject.entries(overrides)) {
			switch (allowOthers) {
				case 'yes':
					result.allow.push(characterId);
					break;
				case 'no':
					result.deny.push(characterId);
					break;
				case 'prompt':
					result.prompt.push(characterId);
					break;
			}
		}
		return {
			allow: result.allow.sort(),
			deny: result.deny.sort(),
			prompt: result.prompt.sort(),
		};
	}, [overrides]);

	return (
		<Column padding='large'>
			<h4>Character based overrides</h4>
			<br />
			<PermissionConfigOverrideType type='yes' content={ values.allow } setConfig={ setConfig } />
			<br />
			<PermissionConfigOverrideType type='no' content={ values.deny } setConfig={ setConfig } />
			<br />
			<PermissionConfigOverrideType type='prompt' content={ values.prompt } setConfig={ setConfig } />
		</Column>
	);
}

function PermissionConfigOverrideType({ type, content, setConfig }: { type: PermissionType; content: CharacterId[]; setConfig: (selector: PermissionConfigChangeSelector, allowOthers: PermissionType | null) => void; }): ReactElement {
	const [id, setId] = useState('');
	const result = useMemo(() => CharacterIdSchema.safeParse(id), [id]);

	const onAdd = useCallback(() => {
		if (!result.success || content.includes(result.data))
			return;

		setConfig(result.data, type);
	}, [result, content, setConfig, type]);

	const onRemove = useCallback(() => {
		if (!result.success || !content.includes(result.data))
			return;

		setConfig(result.data, null);
	}, [result, content, setConfig]);

	return (
		<>
			<span>{ capitalize(type as string) }:</span>
			<textarea value={ content.join(', ') } readOnly />
			<Row className='input-row'>
				<input type='text' placeholder='Character ID' value={ id } onChange={ (e) => setId(e.target.value.trim()) } />
				<Button slim onClick={ onAdd } disabled={ !result.success || content.includes(result.data) }>Add</Button>
				<Button slim onClick={ onRemove } disabled={ !result.success || !content.includes(result.data) }>Remove</Button>
				<Button slim onClick={ () => setConfig('clearOverridesWith', type) }>Clear All</Button>
			</Row>
		</>
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
			<Button slim className='hideDisabled' onClick={ onClick } disabled={ disabled }>{ type }</Button>
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

export function PermissionPromptHandler(): ReactElement | null {
	const gameState = useGameStateOptional();
	const [prompts, setPrompts] = useState<readonly PermissionPromptData[]>([]);

	useEffect(() => {
		if (!gameState)
			return undefined;

		return gameState.on('permissionPrompt', (request) => {
			setPrompts((requests) => [...requests, request]);
		});
	}, [gameState]);

	const dismissFirst = useCallback(() => {
		setPrompts((requests) => requests.slice(1));
	}, []);

	if (prompts.length === 0)
		return null;

	return <PermissionPromptDialog prompt={ prompts[0] } dismiss={ dismissFirst } />;
}

function PermissionPromptDialog({ prompt: { source, requiredPermissions }, dismiss }: { prompt: PermissionPromptData; dismiss: () => void; }): ReactElement {
	const setFull = usePermissionConfigSetAny();
	const setAnyConfig = useCallback((permissionGroup: PermissionGroup, permissionId: string, allowOthers: PermissionConfigChangeType) => {
		setFull(permissionGroup, permissionId, source.id, allowOthers);
	}, [setFull, source.id]);
	const acceptAll = useCallback(() => {
		for (const [group, permissions] of KnownObject.entries(requiredPermissions)) {
			if (!permissions)
				continue;

			for (const perm of permissions) {
				setAnyConfig(group, perm.id, 'accept');
			}
		}
		dismiss();
	}, [requiredPermissions, dismiss, setAnyConfig]);
	const [allowAccept, disableAccept] = useReducer(() => false, true);

	return (
		<ModalDialog>
			<Row alignX='center'>
				<h2>
					<span style={ { textShadow: `${source.data.settings.labelColor} 1px 2px` } }>
						{ source.name }
					</span>
					{ ' ' }
					({ source.id })
					{ ' ' }
					asks for permission to...
				</h2>
			</Row>
			<Column padding='large'>
				{
					KnownObject.entries(requiredPermissions).map(([group, permissions]) => (
						permissions == null ? null : <PermissionPromptGroup key={ group } permissionGroup={ group } permissions={ permissions } setAnyConfig={ setAnyConfig } disableAccept={ disableAccept } />
					))
				}
			</Column>
			<Row padding='medium' alignX='space-between' alignY='center'>
				<Button onClick={ dismiss }>Dismiss</Button>
				<Button onClick={ acceptAll } disabled={ !allowAccept }>Allow all</Button>
			</Row>
		</ModalDialog>
	);
}

function PermissionPromptGroup({ permissionGroup, permissions, setAnyConfig, disableAccept }: {
	permissionGroup: PermissionGroup;
	permissions: Immutable<GameLogicPermissionClient[]>;
	setAnyConfig: (permissionGroup: PermissionGroup, permissionId: string, allowOthers: PermissionConfigChangeType) => void;
	disableAccept: () => void;
}): ReactElement {
	let header;
	let note;
	let config: Immutable<Record<string, { visibleName: string; icon: string; } | null>>;
	switch (permissionGroup) {
		case 'interaction':
			header = 'Interactions';
			note = 'Allow character to...';
			config = INTERACTION_CONFIG;
			break;
		case 'assetPreferences':
			header = 'Item Limits';
			note = 'Allow character to interact with worn items and to add new items that are marked in the item limits as...';
			config = ASSET_PREFERENCES_PERMISSIONS;
			break;
		default:
			AssertNever(permissionGroup);
	}

	const perms = useMemo(() => {
		const result: Readonly<{ id: string; visibleName: string; icon: string; }>[] = [];
		for (const perm of permissions) {
			const permConfig = config[perm.id];
			if (permConfig == null)
				continue;

			result.push({
				id: perm.id,
				visibleName: permConfig.visibleName,
				icon: permConfig.icon,
			});
		}
		return result;
	}, [permissions, config]);

	return (
		<Column className='permissionPrompt'>
			<h3>{ header }</h3>
			<i>{ note }</i>
			{
				perms.map((perm) => (
					<div className='input-row flex-1' key={ perm.id }>
						<label className='flex-1'>
							<img src={ GetIcon(perm.icon) } width='28' height='28' alt='permission icon' />
							&nbsp;&nbsp;
							<span>{ perm.visibleName }</span>
						</label>
						<Button
							className='slim'
							onClick={ () => {
								setAnyConfig(permissionGroup, perm.id, 'no');
								disableAccept();
							} }
						>
							Deny
						</Button>
					</div>
				))
			}
		</Column>
	);
}
