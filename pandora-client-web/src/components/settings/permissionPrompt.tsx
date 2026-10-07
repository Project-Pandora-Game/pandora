import {
	AssertNever,
	CHARACTER_SETTINGS_DEFAULT,
	CharacterId,
	KnownObject,
	PermissionConfigChangeType,
	PermissionGroup,
	PermissionType,
} from 'pandora-common';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useGameStateOptional, useGlobalState } from '../../services/gameLogic/gameStateHooks.ts';
import { DescribeGameLogicAction } from '../../ui/components/chat/chatMessagesDescriptions.tsx';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { SelectionIndicator } from '../common/selectionIndicator/selectionIndicator.tsx';
import { DraggableDialog } from '../dialog/dialog.tsx';
import type { GameState, PermissionPromptData } from '../gameContext/gameStateContextProvider.tsx';
import './permissionPrompt.scss';
import { GetPermissionIcon, usePermissionConfigSetAny } from './permissionsSettings.tsx';

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
			{ Array.from(prompts.entries()).map(([characterId, characterPrompt]) => (
				<PermissionPromptDialog
					key={ characterId }
					prompt={ characterPrompt }
					dismiss={ () => dismiss(characterId) }
					gameState={ gameState }
				/>
			)) }
		</>
	);
}

const PROMPT_SAFETY_COOLDOWN = 2_000;

type PromptPermissionEntry = Readonly<{
	key: string;
	group: PermissionGroup;
	id: string;
	visibleName: string;
	icon?: string;
	/** State for this requester at the time the prompt was created */
	initial: PermissionType;
}>;

type PromptDecisions = Readonly<Partial<Record<string, PermissionType>>>;
const NO_DECISIONS: PromptDecisions = {};

function GetPermissionGroupName(group: PermissionGroup): string {
	switch (group) {
		case 'interaction':
			return 'Interaction';
		case 'assetPreferences':
			return 'Item limit';
		case 'characterModifierType':
			return 'Character modifier';
		default:
			AssertNever(group);
	}
}

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

	// Flatten all required permissions, each with its current state for this requester
	const entries = useMemo(() => {
		const result: PromptPermissionEntry[] = [];
		for (const [group, permissions] of KnownObject.entries(requiredPermissions)) {
			if (permissions == null)
				continue;

			for (const [setup, cfg] of permissions) {
				result.push({
					key: `${group}:${setup.id}`,
					group,
					id: setup.id,
					visibleName: setup.displayName,
					icon: setup.icon,
					initial: cfg.characterOverrides[source.id] ?? cfg.allowOthers,
				});
			}
		}
		return result;
	}, [requiredPermissions, source.id]);

	// Decisions made in this dialog; bound to the prompt, so a refreshed prompt starts clean
	const [decisionState, setDecisionState] = useState<{ prompt: PermissionPromptData; decisions: PromptDecisions; }>({ prompt, decisions: NO_DECISIONS });
	const decisions = decisionState.prompt === prompt ? decisionState.decisions : NO_DECISIONS;

	const getState = useCallback((entry: PromptPermissionEntry): PermissionType => decisions[entry.key] ?? entry.initial, [decisions]);

	const decide = useCallback((entry: PromptPermissionEntry, value: PermissionType) => {
		setAnyConfig(entry.group, entry.id, value);
		setDecisionState((old) => {
			const result: Partial<Record<string, PermissionType>> = { ...(old.prompt === prompt ? old.decisions : NO_DECISIONS) };
			result[entry.key] = value;
			return { prompt, decisions: result };
		});
	}, [setAnyConfig, prompt]);

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

	// Sections are based on the initial state, so rows don't jump around while deciding
	const newEntries = entries.filter((e) => e.initial === 'prompt');
	const allowedEntries = entries.filter((e) => e.initial !== 'prompt');

	return (
		<DraggableDialog title='Permission Prompt' close={ dismiss } hiddenClose highlight={ !isSafe }>
			<Column className='PermissionPromptDialog' alignY='space-between' gap='large'>
				<Column gap='large'>
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
					{ actions.length > 0 ? (
						<Column alignX='center' padding='large'>
							{ actions.map((action, i) => (
								<div key={ i }>
									<DescribeGameLogicAction
										action={ action }
										actionOriginator={ source }
										globalState={ globalState }
									/>
								</div>
							)) }
						</Column>
					) : null }

					<PermissionPromptSection
						tone='prompt'
						title='New - needs your decision'
						entries={ newEntries }
						getState={ getState }
						onDecide={ decide }
						isSafe={ isSafe }
					/>
					<PermissionPromptSection
						tone='yes'
						title='Already allowed'
						entries={ allowedEntries }
						getState={ getState }
						onDecide={ decide }
						isSafe={ isSafe }
						collapsible
						defaultOpen={ newEntries.length === 0 }
					/>
				</Column>

				<Column gap='large'>
					<div className='text-dim hint'>
						ⓘ Decisions are saved and you won't be asked again for interactions with this character.
					</div>

					<Row padding='medium' alignX='end' alignY='center'>
						<Button onClick={ dismiss }>
							{ entries.some((it) => getState(it) === 'no') ? 'Deny' :
								entries.every((it) => getState(it) === 'yes') ? 'Done' :
								'Close without deciding' }
						</Button>
					</Row>
				</Column>
			</Column>
		</DraggableDialog>
	);
}

function PermissionPromptSection({ tone, title, entries, getState, onDecide, isSafe, collapsible, defaultOpen }: {
	tone: PermissionType;
	title: string;
	entries: readonly PromptPermissionEntry[];
	getState: (entry: PromptPermissionEntry) => PermissionType;
	onDecide: (entry: PromptPermissionEntry, value: PermissionType) => void;
	isSafe: boolean;
	collapsible?: boolean;
	defaultOpen?: boolean;
}): ReactElement | null {
	const groups = useMemo(() => {
		const result: { group: PermissionGroup; entries: PromptPermissionEntry[]; }[] = [];
		for (const entry of entries) {
			const group = result.find((it) => it.group === entry.group);
			if (group != null) {
				group.entries.push(entry);
			} else {
				result.push({
					group: entry.group,
					entries: [entry],
				});
			}
		}
		return result;
	}, [entries]);

	if (entries.length === 0)
		return null;

	const heading = (
		<b>{ title } ({ entries.length })</b>
	);

	const rows = (
		<Column gap='medium'>
			{ groups.map(({ entries: groupEntries, group }) => (
				<Column gap='tiny' key={ group }>
					<div>{ GetPermissionGroupName(group) }</div>
					{ groupEntries.map((entry) => (
						<PermissionPromptRow key={ entry.id }
							entry={ entry }
							state={ getState(entry) }
							onDecide={ onDecide }
							isSafe={ isSafe }
						/>
					)) }
				</Column>
			)) }
		</Column>
	);

	if (collapsible) {
		return (
			<details className={ `permission-prompt-section ${tone}` } open={ defaultOpen }>
				<summary>{ heading }</summary>
				{ rows }
			</details>
		);
	}

	return (
		<section className={ `permission-prompt-section ${tone}` }>
			<div className='section-heading'>{ heading }</div>
			{ rows }
		</section>
	);
}

function PermissionPromptRow({ entry, state, onDecide, isSafe }: {
	entry: PromptPermissionEntry;
	state: PermissionType;
	onDecide: (entry: PromptPermissionEntry, value: PermissionType) => void;
	isSafe: boolean;
}): ReactElement {
	return (
		<div className={ `permission-prompt-row ${state}` }>
			{ entry.icon ? <img src={ GetPermissionIcon(entry.icon) } alt='' /> : null }
			<div className='name'>
				<span>{ entry.visibleName }</span>
			</div>
			<SelectionIndicator padding='tiny' selected={ state === 'no' }>
				<Button
					slim
					onClick={ () => {
						onDecide(entry, 'no');
					} }
				>
					Deny
				</Button>
			</SelectionIndicator>
			<SelectionIndicator padding='tiny' selected={ state === 'yes' }>
				<Button
					slim
					onClick={ () => {
						onDecide(entry, 'yes');
					} }
					disabled={ !isSafe }
				>
					Allow
				</Button>
			</SelectionIndicator>
		</div>
	);
}
