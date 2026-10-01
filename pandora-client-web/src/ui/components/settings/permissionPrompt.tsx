import type { Immutable } from 'immer';
import {
	AssertNever,
	CHARACTER_SETTINGS_DEFAULT,
	CharacterId,
	KnownObject,
	PermissionConfig,
	PermissionConfigChangeType,
	PermissionGroup,
	PermissionSetup,
	PermissionType,
} from 'pandora-common';
import { ReactElement, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { DraggableDialog } from '../../../components/dialog/dialog.tsx';
import type { GameState, PermissionPromptData } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { useGameStateOptional, useGlobalState } from '../../../services/gameLogic/gameStateHooks.ts';
import { usePermissionConfigDriverSetter } from '../../../services/gameLogic/permissionSettingsDriver.ts';
import { DescribeGameLogicAction } from '../chat/chatMessagesDescriptions.tsx';
import { PermissionAllowOthersIcon } from './permissionAllowOthers.tsx';
import { GetPermissionIcon } from './permissionIcons.tsx';

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

	const setFull = usePermissionConfigDriverSetter();
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
									<img src={ GetPermissionIcon(perm.icon) } width='28' height='28' alt='permission icon' />
								) : null
							}
							&nbsp;&nbsp;
							<span>{ perm.visibleName }</span>
						</label>
						<PermissionAllowOthersIcon config={ perm.allowOthers } />
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
