import type { Immutable } from 'immer';
import { capitalize, noop } from 'lodash-es';
import { ASSET_PREFERENCES_PERMISSIONS, AssertNever, AssetPreferenceType, CHARACTER_MODIFIER_TYPE_DEFINITION, CHARACTER_SETTINGS_DEFAULT, CharacterId, CharacterIdSchema, EMPTY, GetLogger, IClientShardNormalResult, IInteractionConfig, INTERACTION_CONFIG, INTERACTION_IDS, InteractionId, KnownObject, MakePermissionConfigFromDefault, PERMISSION_MAX_CHARACTER_OVERRIDES, PermissionConfig, PermissionConfigChangeSelector, PermissionConfigChangeType, PermissionGroup, PermissionSetup, PermissionType, PermissionTypeSchema } from 'pandora-common';
import { ReactElement, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'react-toastify';
import arrowRight from '../../assets/icons/arrow-right.svg';
import body from '../../assets/icons/body.svg';
import color from '../../assets/icons/color.svg';
import deviceSvg from '../../assets/icons/device.svg';
import editIcon from '../../assets/icons/edit.svg';
import forbid from '../../assets/icons/forbidden.svg';
import lock from '../../assets/icons/lock.svg';
import modificationEdit from '../../assets/icons/modification-edit.svg';
import modificationLock from '../../assets/icons/modification-lock.svg';
import modificationView from '../../assets/icons/modification-view.svg';
import movement from '../../assets/icons/movement.svg';
import onOff from '../../assets/icons/on-off.svg';
import promptIcon from '../../assets/icons/prompt.svg';
import allow from '../../assets/icons/public.svg';
import questionmark from '../../assets/icons/questionmark.svg';
import settingIcon from '../../assets/icons/setting.svg';
import star from '../../assets/icons/star.svg';
import storage from '../../assets/icons/storage.svg';
import toggle from '../../assets/icons/toggle.svg';
import wikiIcon from '../../assets/icons/wiki.svg';
import { useFunctionBind } from '../../common/useFunctionBind.ts';
import { useKeyDownEvent } from '../../common/useKeyDownEvent.ts';
import { TextInput } from '../../common/userInteraction/input/textInput.tsx';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { useGameStateOptional, useGlobalState, useResolveCharacterName, useSpaceCharacters } from '../../services/gameLogic/gameStateHooks.ts';
import { CharacterListInputActions } from '../../ui/components/characterListInput/characterListInput.tsx';
import { DescribeGameLogicAction } from '../../ui/components/chat/chatMessagesDescriptions.tsx';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { GridContainer } from '../common/container/gridContainer.tsx';
import { FieldsetToggle } from '../common/fieldsetToggle/fieldsetToggle.tsx';
import { SelectionIndicator } from '../common/selectionIndicator/selectionIndicator.tsx';
import { UsageMeter } from '../common/usageMeter/usageMeter.tsx';
import { ButtonConfirm, DialogHeader, DraggableDialog, ModalDialog } from '../dialog/dialog.tsx';
import type { GameState, PermissionPromptData } from '../gameContext/gameStateContextProvider.tsx';
import { usePlayer } from '../gameContext/playerContextProvider.tsx';
import { useShardChangeListener, useShardConnector } from '../gameContext/shardConnectorContextProvider.tsx';
import { HoverElement } from '../hoverElement/hoverElement.tsx';
import './settings.scss';

export function PermissionsSettings(): ReactElement | null {
	const player = usePlayer();

	if (!player)
		return <>No character selected</>;

	return (
		<>
			<InteractionPermissions />
			<ItemLimitsPermissions />
			<PerCharacterPermissionsSection />
		</>
	);
}

function InteractionPermissions(): ReactElement {

	return (
		<fieldset>
			<legend>Interaction permissions</legend>
			<Row alignX='space-between' alignY='center' className='flex-1'>
				<i>Allow other characters to...</i>
				<Link title='Get help in the wiki' to='/wiki/characters#CH_Character_permissions'>
					<img className='help-image' src={ wikiIcon } width='26' height='26' alt='Wiki' />
				</Link>
			</Row>
			<Column gap='none' className='permission-list'>
				{
					INTERACTION_IDS.map((id) => (
						<InteractionSettings key={ id } id={ id } />
					))
				}
			</Column>
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
		case 'text':
			return editIcon;
		case 'on-off':
			return onOff;
		case 'setting':
			return settingIcon;
		case 'storage':
			return storage;
		case 'toggle':
			return toggle;
		case 'device':
			return deviceSvg;
		case 'movement':
			return movement;
		case 'modification-edit':
			return modificationEdit;
		case 'modification-lock':
			return modificationLock;
		case 'modification-view':
			return modificationView;
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

export function ShowEffectiveAllowOthers({ permissionGroup, permissionId }: { permissionGroup: PermissionGroup; permissionId: string; }): ReactElement {
	const effectiveConfig = useEffectiveAllowOthers(permissionGroup, permissionId);
	return (
		<ShowAllowOthers config={ effectiveConfig } />
	);
}

function ShowAllowOthers({ config }: { config: PermissionType; }): ReactElement {
	const [ref, setRef] = useState<HTMLElement | null>(null);

	const { src, alt, description } = useMemo(() => {
		switch (config) {
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
					src: promptIcon,
					alt: 'General permission configuration preview',
					description: 'Trying to use this permission opens a popup that lets the targeted user decide if they want to give or deny the requester this permission. Exceptions can be set individually.',
				};
		}
	}, [config]);

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

	return (
		<PermissionSettingEntry
			visibleName={ config.visibleName }
			icon={ config.icon }
			permissionGroup='interaction'
			permissionId={ id }
		/>
	);
}

function ItemLimitsPermissions(): ReactElement {
	return (
		<fieldset>
			<legend>Item limits</legend>
			<i>Allow other characters to interact with worn items and to add new items that are marked in the item limits as...</i>
			<Column gap='none' className='permission-list'>
				{
					KnownObject.keys(ASSET_PREFERENCES_PERMISSIONS).map((group) => (
						<ItemLimitsSettings key={ group } group={ group } />
					))
				}
			</Column>
		</fieldset>
	);
}

function ItemLimitsSettings({ group }: { group: AssetPreferenceType; }): ReactElement | null {
	const config = ASSET_PREFERENCES_PERMISSIONS[group];

	if (config == null)
		return null;

	return (
		<PermissionSettingEntry
			visibleName={ config.visibleName }
			icon={ config.icon }
			permissionGroup='assetPreferences'
			permissionId={ group }
		/>
	);
}

function usePermissionConfigSetAny(): (permissionGroup: PermissionGroup, permissionId: string, selector: PermissionConfigChangeSelector, allowOthers: PermissionConfigChangeType) => void {
	const shardConnector = useShardConnector();
	return useCallback((permissionGroup: PermissionGroup, permissionId: string, selector: PermissionConfigChangeSelector, allowOthers: PermissionConfigChangeType) => {
		if (shardConnector == null) {
			toast(`Error updating permission:\nNot connected`, TOAST_OPTIONS_ERROR);
			return;
		}

		shardConnector.awaitResponse('permissionSet', {
			permissionGroup,
			permissionId,
			config: {
				selector,
				allowOthers,
			},
		})
			.then((result) => {
				if (result.result === 'tooManyOverrides') {
					toast(`Too many character overrides`, TOAST_OPTIONS_ERROR);
				} else if (result.result !== 'ok') {
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

function PermissionConfigDialogEscaper({ hide }: { hide: () => void; }): null {
	useKeyDownEvent(useCallback(() => {
		hide();
		return true;
	}, [hide]), 'Escape');

	return null;
}

export function PermissionSettingEntry({ visibleName, icon, permissionGroup, permissionId }: {
	visibleName: string;
	icon: string;
	permissionGroup: PermissionGroup;
	permissionId: string;
}): ReactElement {
	const [showConfig, setShowConfig] = useState(false);

	return (
		<Row alignY='center' padding='small'>
			{
				icon ? (
					<img src={ GetIcon(icon) } width='28' height='28' alt='permission icon' />
				) : null
			}
			<label className='flex-1'>
				{ visibleName }
			</label>
			<ShowEffectiveAllowOthers permissionGroup={ permissionGroup } permissionId={ permissionId } />
			<Button
				className='slim'
				onClick={ () => setShowConfig(true) }
			>
				Edit
			</Button>
			{ showConfig && (
				<PermissionConfigDialog
					hide={ () => setShowConfig(false) }
					permissionGroup={ permissionGroup }
					permissionId={ permissionId }
				/>
			) }
		</Row>
	);
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

	if (shardConnector == null) {
		return (
			<Row className='flex-1' alignX='center' alignY='center'>
				Error: Not connected
			</Row>
		);
	}
	if (permissionData == null) {
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
			<PermissionConfigDialogEscaper hide={ hide } />
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
				<Button slim onClick={ () => setDefault(null) }>Reset defaults</Button>
				<Button onClick={ hide }>Close</Button>
			</Row>
			<PermissionConfigOverrides
				overrides={ permissionConfig?.characterOverrides ?? EMPTY }
				limit={ permissionSetup.maxCharacterOverrides ?? PERMISSION_MAX_CHARACTER_OVERRIDES }
				setConfig={ setAny }
			/>
		</ModalDialog>
	);
}

function PermissionConfigOverrides({ overrides, limit, setConfig }: { overrides: Partial<Record<CharacterId, PermissionType>>; limit: number; setConfig: (selector: PermissionConfigChangeSelector, allowOthers: PermissionConfigChangeType) => void; }): ReactElement | null {
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
			<UsageMeter title='Used' used={ Object.keys(overrides).length } limit={ limit } />
			<br />
			<PermissionConfigOverrideType type='yes' content={ values.allow } setConfig={ setConfig } />
			<br />
			<PermissionConfigOverrideType type='no' content={ values.deny } setConfig={ setConfig } />
			<br />
			<PermissionConfigOverrideType type='prompt' content={ values.prompt } setConfig={ setConfig } />
		</Column>
	);
}

function PermissionConfigOverrideType({ type, content, setConfig }: {
	type: PermissionType;
	content: CharacterId[];
	setConfig: (selector: PermissionConfigChangeSelector, allowOthers: PermissionType | null) => void;
}): ReactElement {
	const onAdd = useCallback((c: CharacterId) => {
		setConfig(c, type);
	}, [setConfig, type]);

	const onRemove = useCallback((c: CharacterId) => {
		setConfig(c, null);
	}, [setConfig]);

	return (
		<>
			<Row>
				<span className='flex-1'>{ capitalize(type as string) }:</span>
				<ButtonConfirm slim onClick={ () => setConfig('clearOverridesWith', type) }
					title='Clear all overrides'
					content={ `Are you sure you want to clear all overrides with ${type}?` }
				>
					Clear All
				</ButtonConfirm>
			</Row>
			<CharacterListInputActions
				value={ content }
				onAdd={ onAdd }
				onRemove={ onRemove }
				noLimitHeight
				allowSelf='otherCharacter'
			/>
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
		<SelectionIndicator padding='tiny' selected={ effectiveConfig.allowOthers === type }>
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
	const [prompts, setPrompts] = useState<ReadonlyMap<CharacterId, PermissionPromptData>>(new Map());

	useEffect(() => {
		if (!gameState)
			return undefined;

		return gameState.on('permissionPrompt', (request) => {
			setPrompts((requests) => {
				const result = new Map(requests);
				const id = request.source.id;
				// We intentionally only keep the last prompt
				result.set(id, request);
				return result;
			});
		});
	}, [gameState]);

	const dismiss = useCallback((id: CharacterId) => {
		setPrompts((requests) => {
			const result = new Map(requests);
			result.delete(id);
			return result;
		});
	}, []);

	if (gameState == null || prompts.size === 0)
		return null;

	return (
		<>
			{
				Array.from(prompts.entries()).map(([characterId, characterPrompt]) => (
					<PermissionPromptDialog
						key={ characterId }
						prompt={ characterPrompt }
						dismiss={ () => dismiss(characterId) }
						gameState={ gameState }
					/>
				))
			}
		</>
	);
}

const PROMPT_SAFETY_COOLDOWN = 2_000;
function PermissionPromptDialog({ prompt, dismiss, gameState }: {
	prompt: PermissionPromptData;
	dismiss: () => void;
	gameState: GameState;
}): ReactElement {
	const globalState = useGlobalState(gameState);

	const { source, requiredPermissions, actions } = prompt;

	const setFull = usePermissionConfigSetAny();
	const setAnyConfig = useCallback((permissionGroup: PermissionGroup, permissionId: string, allowOthers: PermissionConfigChangeType) => {
		setFull(permissionGroup, permissionId, source.id, allowOthers);
	}, [setFull, source.id]);
	const acceptAll = useCallback(() => {
		for (const [group, permissions] of KnownObject.entries(requiredPermissions)) {
			if (!permissions)
				continue;

			for (const [setup] of permissions) {
				setAnyConfig(group, setup.id, 'accept');
			}
		}
		dismiss();
	}, [requiredPermissions, dismiss, setAnyConfig]);
	const [allowAccept, disableAccept] = useReducer(() => false, true);

	// Prevent the user from confirming the prompt by accident if it just changed by introducing confirm cooldown
	const [safePrompt, setSafePrompt] = useState<PermissionPromptData | null>(null);
	useEffect(() => {
		const id = setTimeout(() => {
			setSafePrompt(prompt);
		}, PROMPT_SAFETY_COOLDOWN);
		return () => {
			clearTimeout(id);
		};
	}, [prompt]);
	const isSafe = prompt === safePrompt;

	return (
		<DraggableDialog title='Permission Prompt' close={ dismiss } hiddenClose highlight={ !isSafe }>
			<Row alignX='center'>
				<h2>
					<span style={ { textShadow: `${source.data.publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor} 1px 2px` } }>
						{ source.name }
					</span>
					{ ' ' }
					({ source.id })
					{ ' ' }
					asks for permission to...
				</h2>
			</Row>
			{
				actions.length > 0 ? (
					<Column alignX='center'>
						<span>Requested actions:</span>
						{
							actions.map((action, i) => (
								<DescribeGameLogicAction
									key={ i }
									action={ action }
									actionOriginator={ source }
									globalState={ globalState }
								/>
							))
						}
					</Column>
				) : null
			}
			<Row padding='large' alignX='center'>
				<p className='text-dim'>
					<span>ⓘ </span>
					<i>
						All following permissions are required to do the actions above. The requester is missing one ore more of<br />
						them - those where both buttons are active and lit up. Please review each and either permanently grant it, or<br />
						block the character from asking again by always denying it. If taking no decision, they can ask again any time.
					</i>
				</p>
			</Row>
			<Column>
				{
					KnownObject.entries(requiredPermissions).map(([group, permissions]) => (
						permissions == null ? null : <PermissionPromptGroup key={ group } sourceId={ source.id } permissionGroup={ group } permissions={ permissions } setAnyConfig={ setAnyConfig } disableAccept={ disableAccept } />
					))
				}
			</Column>
			<Row padding='large' alignX='space-between' alignY='center'>
				<Button onClick={ dismiss }>Close with no further decisions</Button>
				<Button onClick={ acceptAll } disabled={ !allowAccept || !isSafe }>Allow all above always</Button>
			</Row>
		</DraggableDialog>
	);
}

function PermissionPromptGroup({ sourceId, permissionGroup, permissions, setAnyConfig, disableAccept }: {
	sourceId: CharacterId;
	permissionGroup: PermissionGroup;
	permissions: Immutable<[PermissionSetup, PermissionConfig][]>;
	setAnyConfig: (permissionGroup: PermissionGroup, permissionId: string, allowOthers: PermissionConfigChangeType) => void;
	disableAccept: () => void;
}): ReactElement {
	let header;
	switch (permissionGroup) {
		case 'interaction':
			header = 'Interactions';
			break;
		case 'assetPreferences':
			header = 'Item Limits';
			break;
		case 'characterModifierType':
			header = 'Character modifiers';
			break;
		default:
			AssertNever(permissionGroup);
	}

	const perms = useMemo(() => {
		const result: Readonly<{ id: string; visibleName: string; icon?: string; allowOthers: PermissionType; isAllowed: boolean; }>[] = [];
		for (const [setup, cfg] of permissions) {

			result.push({
				id: setup.id,
				visibleName: setup.displayName,
				icon: setup.icon,
				allowOthers: cfg.allowOthers,
				isAllowed: (cfg.characterOverrides[sourceId] ?? cfg.allowOthers) === 'yes',
			});
		}
		return result;
	}, [permissions, sourceId]);

	return (
		<Column className='permissionPrompt'>
			<h3>{ header }</h3>
			{
				perms.map((perm) => (
					<div className='input-row flex-1' key={ perm.id }>
						<label className='flex-1'>
							{
								perm.icon ? (
									<img src={ GetIcon(perm.icon) } width='28' height='28' alt='permission icon' />
								) : null
							}
							&nbsp;&nbsp;
							<span>{ perm.visibleName }</span>
						</label>
						<ShowAllowOthers config={ perm.allowOthers } />
						<PermissionPromptButton
							isAllowed={ perm.isAllowed }
							setYes={ () => setAnyConfig(permissionGroup, perm.id, 'yes') }
							setNo={ () => {
								setAnyConfig(permissionGroup, perm.id, 'no');
								disableAccept();
							} }
						/>
					</div>
				))
			}
		</Column>
	);
}

function PermissionPromptButton({ setYes, setNo, isAllowed }: { setYes: () => void; setNo: () => void; isAllowed: boolean; }): ReactElement {
	const [state, setState] = useState<'yes' | 'no' | null>(isAllowed ? 'yes' : null);

	return (
		<>
			<Button
				className='slim'
				disabled={ state === 'yes' }
				onClick={ () => {
					if (state !== 'yes') {
						setYes();
						setState('yes');
					}
				} }
			>
				Allow always
			</Button>
			<Button
				className='slim'
				onClick={ () => {
					if (state !== 'no') {
						setNo();
						setState('no');
					}
				} }
			>
				Deny always
			</Button>
		</>
	);
}

function ResolvedNamePreview({ characterId }: { characterId: CharacterId | null; }): ReactElement {
	const resolvedName = useResolveCharacterName(characterId ?? 'c0');

	return <span>{ characterId == null ? '...' : (resolvedName ?? '[unknown]') }</span>;
}

function PerCharacterPermissionsSection(): ReactElement {
	const [selectedCharacter, setSelectedCharacter] = useState<CharacterId | null>(null);

	const rawCharacters = useSpaceCharacters();
	const spaceCharacters = useMemo(() =>
		rawCharacters.slice().sort((a, b) => {
			if (a.isPlayer() !== b.isPlayer()) return a.isPlayer() ? -1 : 1;
			return a.name.localeCompare(b.name);
		}),
	[rawCharacters]);

	const [inputValue, setInputValue] = useState('');
	const parsedInput = useMemo(() => {
		const r = CharacterIdSchema.safeParse(/^[0-9]+$/.test(inputValue) ? `c${inputValue}` : inputValue);
		return r.success ? r.data : null;
	}, [inputValue]);

	return (
		<fieldset>
			<legend>Permission overview for a specific character</legend>
			<span><i>Check and adjust every permission for the character selected by their ID below:</i></span>
			<Column padding='small' gap='large'>
				<Column alignX='start'>
					<GridContainer templateColumns='auto auto' templateRows='auto auto' alignItemsY='center'>
						<label>Name:</label>
						<ResolvedNamePreview characterId={ parsedInput } />
						<label>Character ID:</label>
						<Row alignY='center'>
							<TextInput
								value={ inputValue }
								onChange={ setInputValue }
							/>
							<Button
								slim
								disabled={ parsedInput == null }
								onClick={ () => {
									if (parsedInput != null) {
										setSelectedCharacter(parsedInput);
										setInputValue('');
									}
								} }
							>
								Select
							</Button>
						</Row>
					</GridContainer>
				</Column>
				<fieldset>
					<legend>Quick selection</legend>
					<Column alignX='start'>
						{ spaceCharacters
							.filter((c) => !c.isPlayer())
							.map((c) => (
								<Button
									key={ c.id }
									slim
									onClick={ () => {
										setInputValue('');
										setSelectedCharacter(c.id);
									} }
								>
									{ c.name } ({ c.id })
								</Button>
							))
						}
					</Column>
				</fieldset>
			</Column>
			{ selectedCharacter != null && (
				<PerCharacterPermissionsDialog
					characterId={ selectedCharacter }
					hide={ () => setSelectedCharacter(null) }
				/>
			) }
		</fieldset>
	);
}

function PerCharacterPermissionsDialog({
	characterId,
	hide,
}: {
	characterId: CharacterId;
	hide: () => void;
}): ReactElement {
	const resolvedName = useResolveCharacterName(characterId);
	const setConfig = usePermissionConfigSetAny();

	// Set non-default value for a single permission
	const setOverride = useCallback(
		(group: PermissionGroup, id: string, value: PermissionType | null) => {
			setConfig(group, id, characterId, value as PermissionConfigChangeType);
		},
		[setConfig, characterId],
	);

	// Reset all permissions for this character
	const resetAll = useCallback(() => {
		for (const id of INTERACTION_IDS) {
			setConfig('interaction', id, characterId, null);
		}
		for (const group of KnownObject.keys(ASSET_PREFERENCES_PERMISSIONS)) {
			setConfig('assetPreferences', group, characterId, null);
		}
		for (const typeId of KnownObject.keys(CHARACTER_MODIFIER_TYPE_DEFINITION)) {
			setConfig('characterModifierType', typeId, characterId, null);
		}
	}, [setConfig, characterId]);

	return (
		<ModalDialog rawContent>
			<DialogHeader
				title={ `Permissions for ${ resolvedName ?? '[unknown]' } (${ characterId })` }
				close={ hide }
			/>
			<div className='dialog-content overflow-auto' >
				<Column alignX='start' padding='medium'>
					<ButtonConfirm
						theme='danger'
						onClick={ resetAll }
						title='Reset all to default'
						content={ `Reset every permission granted to ${resolvedName ?? characterId} to the default value?` }
					>
						Reset all to default
					</ButtonConfirm>
				</Column>

				<PermissionConfigDialogEscaper hide={ hide } />
				<Column padding='medium' gap='large'>

					<FieldsetToggle legend='Interaction permissions'>
						<Column gap='none' className='permission-list'>
							{ INTERACTION_IDS.map((id) => (
								<PerCharacterPermissionRow
									key={ id }
									visibleName={ INTERACTION_CONFIG[id].visibleName }
									icon={ INTERACTION_CONFIG[id].icon }
									permissionGroup='interaction'
									permissionId={ id }
									characterId={ characterId }
									setOverride={ setOverride }
								/>
							)) }
						</Column>
					</FieldsetToggle>

					<FieldsetToggle legend='Item limits'>
						<Column gap='none' className='permission-list'>
							{ KnownObject.keys(ASSET_PREFERENCES_PERMISSIONS).map((group) => {
								const config = ASSET_PREFERENCES_PERMISSIONS[group];
								if (config == null) return null;
								return (
									<PerCharacterPermissionRow
										key={ group }
										visibleName={ config.visibleName }
										icon={ config.icon }
										permissionGroup='assetPreferences'
										permissionId={ group }
										characterId={ characterId }
										setOverride={ setOverride }
									/>
								);
							}) }
						</Column>
					</FieldsetToggle>

					<FieldsetToggle legend='Character modifier permissions'>
						<Column gap='none' className='permission-list'>
							{ KnownObject.keys(CHARACTER_MODIFIER_TYPE_DEFINITION).map((typeId) => (
								<PerCharacterPermissionRow
									key={ typeId }
									visibleName={ CHARACTER_MODIFIER_TYPE_DEFINITION[typeId].visibleName }
									icon=''
									permissionGroup='characterModifierType'
									permissionId={ typeId }
									characterId={ characterId }
									setOverride={ setOverride }
								/>
							)) }
						</Column>
					</FieldsetToggle>
				</Column>
			</div>
		</ModalDialog>
	);
}

function PerCharacterPermissionRow({
	visibleName,
	icon,
	permissionGroup,
	permissionId,
	characterId,
	setOverride,
}: {
	visibleName: string;
	icon: string;
	permissionGroup: PermissionGroup;
	permissionId: string;
	characterId: CharacterId;
	setOverride: (group: PermissionGroup, id: string, value: PermissionType | null) => void;
}): ReactElement {
	const permissionData = usePermissionData(permissionGroup, permissionId);

	if (permissionData == null) {
		return (
			<Row alignY='center' padding='small'>
				{ icon ? <img src={ GetIcon(icon) } width='28' height='28' alt='permission icon' /> : null }
				<span className='flex-1'>{ visibleName }</span>
				<span>Loading…</span>
			</Row>
		);
	}

	if (permissionData.result !== 'ok') {
		return (
			<Row alignY='center' padding='small'>
				{ icon ? <img src={ GetIcon(icon) } width='28' height='28' alt='permission icon' /> : null }
				<span className='flex-1'>{ visibleName }</span>
				<span>Error: { permissionData.result }</span>
			</Row>
		);
	}

	const { permissionSetup, permissionConfig } = permissionData;
	const defaultConfig = MakePermissionConfigFromDefault(permissionSetup.defaultConfig);
	const defaultPermission: PermissionType = permissionConfig?.allowOthers ?? defaultConfig.allowOthers;
	const characterOverride: PermissionType | undefined = permissionConfig?.characterOverrides[characterId];

	return (
		<Row alignY='center' padding='small' gap='small'>
			{ icon ? <img src={ GetIcon(icon) } width='28' height='28' alt='permission icon' /> : null }

			<span className='flex-1'>{ visibleName } </span>

			{ PermissionTypeSchema.options.map((type) => {
				const isBase = type === defaultPermission;
				return (
					<SelectionIndicator key={ type } padding='tiny' selected={ characterOverride === type } active={ characterOverride == null && isBase }>
						<Button
							slim
							className={ isBase ? 'permission-base-highlight' : undefined }
							onClick={ () => {
								if (type === defaultPermission) {
									setOverride(permissionGroup, permissionId, null);
								} else {
									setOverride(permissionGroup, permissionId, type);
								}
							} }
						>
							{ type }
						</Button>
					</SelectionIndicator>
				);
			}) }

			<Button
				slim
				style={ characterOverride != null ? undefined : { visibility: 'hidden' } }
				title={ `Remove non-default permission and change it back to '${defaultPermission}'` }
				onClick={ () => setOverride(permissionGroup, permissionId, null) }
			>
				↩ reset
			</Button>
		</Row>
	);
}
