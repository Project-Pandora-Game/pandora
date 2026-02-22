import type { Immutable } from 'immer';
import { AssertNever, CHARACTER_SETTINGS_DEFAULT, CompareCharacterIds, GetLogger, KnownObject, SpaceSwitchResolveCharacterStatusToClientStatus, type SpaceSwitchClientStatus, type SpaceSwitchCommand } from 'pandora-common';
import { type ReactElement } from 'react';
import { toast } from 'react-toastify';
import crossIcon from '../../../assets/icons/cross.svg';
import { useCharacterData, useCharacterDataMultiple, type Character } from '../../../character/character.ts';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { Button, IconButton } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { SelectionIndicator } from '../../../components/common/selectionIndicator/selectionIndicator.tsx';
import { DraggableDialog } from '../../../components/dialog/dialog.tsx';
import { useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { usePlayerId } from '../../../components/gameContext/playerContextProvider.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useSpaceCharacters, useSpaceInfoOptional } from '../../../services/gameLogic/gameStateHooks.ts';
import { ColoredName } from '../../components/common/coloredName.tsx';
import { SpaceInviteEmbed } from './inviteEmbed.tsx';
import './spaceSwitchDialog.scss';

export function SpaceSwitchDialogProvider(): ReactElement | null {
	const playerId = usePlayerId();
	const space = useSpaceInfoOptional();
	const characters = useSpaceCharacters();

	if (space == null || playerId == null)
		return null;

	return (
		<>
			{ space.config.spaceSwitchStatus
				.filter((status) => Object.hasOwn(status.characters, playerId))
				.map((status) => {
					const initiatorCharacter = characters.find((c) => c.id === status.initiator);

					if (initiatorCharacter == null)
						return null;

					return (
						<SpaceSwitchDialog
							key={ status.initiator }
							status={ status }
							initiator={ initiatorCharacter }
						/>
					);
				}) }
		</>
	);
}

interface SpaceSwitchDialogProps {
	status: Immutable<SpaceSwitchClientStatus>;
	initiator: Character;
}

function SpaceSwitchDialog({ status, initiator }: SpaceSwitchDialogProps): ReactElement {
	const playerId = usePlayerId();
	const initiatorData = useCharacterData(initiator);
	const characters = useSpaceCharacters();
	const charactersData = useCharacterDataMultiple(characters);
	const directoryConnector = useDirectoryConnector();

	const ownStatus = playerId != null ? (status.characters[playerId] ?? null) : null;

	const [doCommand, commandProcessing] = useAsyncEvent(
		async (command: SpaceSwitchCommand) => {
			return directoryConnector.awaitResponse('spaceSwitchCommand', { command, initiator: status.initiator });
		},
		(resp) => {
			switch (resp.result) {
				case 'ok':
					// Nothing to show
					break;
				case 'failed':
					toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
					break;
				case 'notFound':
					toast('Invitation not found', TOAST_OPTIONS_ERROR);
					break;
				case 'notAllowed':
					toast('You are not allowed to do this action.', TOAST_OPTIONS_ERROR);
					break;
				case 'restricted':
					toast('An item or a character modifier is preventing you from doing this action.', TOAST_OPTIONS_ERROR);
					break;
				default:
					AssertNever(resp.result);
			}
		},
		{
			updateAfterUnmount: true,
			errorHandler: (error) => {
				GetLogger('SpaceSwitchDialog').warning('Error during reject', error);
				toast(`Error processing request:\n${error instanceof Error ? error.message : String(error)}`, TOAST_OPTIONS_ERROR);
			},
		},
	);

	const [doTheSwitch, switchProcessing] = useAsyncEvent(
		async () => {
			return directoryConnector.awaitResponse('spaceSwitchGo', {});
		},
		(resp) => {
			switch (resp.result) {
				case 'ok':
					// Nothing to show
					break;
				case 'failed':
					toast('Error joining the space, try again later', TOAST_OPTIONS_ERROR);
					break;
				case 'notFound':
					toast('Space or invitation not found', TOAST_OPTIONS_ERROR);
					break;
				case 'noAccess':
					toast(<>Cannot join this space, because at least one of the involved characters cannot enter it.<br />To see which character is causing the issue cancel this switch and start it over.</>, TOAST_OPTIONS_ERROR);
					break;
				case 'spaceFull':
					toast('Not all invited characters can fit into the target space.', TOAST_OPTIONS_ERROR);
					break;
				case 'notReady':
					toast('All invited characters must be ready before switching spaces', TOAST_OPTIONS_ERROR);
					break;
				default:
					AssertNever(resp.result);
			}
		},
		{
			updateAfterUnmount: true,
			errorHandler: (error) => {
				GetLogger('SpaceSwitchDialog').warning('Error during reject', error);
				toast(`Error processing request:\n${error instanceof Error ? error.message : String(error)}`, TOAST_OPTIONS_ERROR);
			},
		},
	);

	const processing = commandProcessing || switchProcessing;

	return (
		<DraggableDialog
			className='SpaceSwitchDialog'
			title={ initiator.id === playerId ? (
				<>Space switch status</>
			) : (
				<>Space switch invitation by <ColoredName color={ initiatorData.publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor } title={ `${ initiatorData.name } (${ initiatorData.id })` }>{ initiatorData.name }</ColoredName></>
			) }
			allowShade
			close={ () => {
				if (status.initiator === playerId) {
					doCommand({ command: 'abort' });
				} else {
					doCommand({ command: 'reject' });
				}
			} }
			initialWidth={ Math.min(650, Math.floor(0.8 * window.innerWidth)) }
		>
			<Column>
				{ initiator.id === playerId ? (
					<div>
						You are attempting to switch to space:
					</div>
				) : (
					<div>
						{ initiatorData.name } invited you to space:
					</div>
				) }
				<SpaceInviteEmbed spaceId={ status.targetSpace } invitedBy={ status.initiator } viewOnly />
				<div>Ready status of invited characters:</div>
				<Column padding='medium'>
					<table>
						<colgroup>
							<col style={ { width: '1%' } } />
							<col />
							<col style={ { width: '1%' } } />
						</colgroup>
						<tbody>
							{ KnownObject.entries(status.characters)
								.toSorted((a, b) => (
									((a[0] === status.initiator ? -1 : 0) - (b[0] === status.initiator ? -1 : 0)) ||
									(charactersData.find((c) => c.id === a[0])?.name ?? '[UNKNOWN]').localeCompare(charactersData.find((c) => c.id === b[0])?.name ?? '[UNKNOWN]') ||
									CompareCharacterIds(a[0], b[0])
								))
								.map(([id, characterStatus]) => {
									const resolvedStatus = SpaceSwitchResolveCharacterStatusToClientStatus(characterStatus);
									const character = charactersData.find((c) => c.id === id);

									return (
										<tr key={ id }>
											<td className='align-start'>
												{ character != null ? (
													<ColoredName color={ character.publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor } title={ `${ character.name } (${ character.id })` }>{ character.name }</ColoredName>
												) : (
													<>[UNKNOWN] ({ id })</>
												) }
											</td>
											<td className='align-start'>
												{ resolvedStatus === 'loading' ? <i>Loading...</i> :
													resolvedStatus === 'leaveRestricted' ? '❌ Cannot leave because of a worn item or character modifier' :
													resolvedStatus === 'inRoomDevice' ? '❌ Cannot leave while in a room device' :
													resolvedStatus === 'rejected' ? '❌ Missing permission to invite or the character is in safemode' :
													resolvedStatus === 'wait' ? '⏳ Waiting for confirmation' :
													resolvedStatus === 'ready' ? '✅ Ready' :
													AssertNever(resolvedStatus) }
											</td>
											<td>
												{ status.initiator === playerId && id !== playerId ? (
													<IconButton
														src={ crossIcon }
														className='characterRemoveButton'
														alt='Remove character from invitation list'
														onClick={ () => {
															doCommand({ command: 'removeCharacter', character: id });
														} }
														slim
														disabled={ processing }
													/>
												) : (
													null
												) }
											</td>
										</tr>
									);
								}) }
						</tbody>
					</table>
				</Column>
				{ status.initiator === playerId ? (
					<Row alignX='space-between' padding='small'>
						<Button
							onClick={ () => {
								doCommand({ command: 'abort' });
							} }
							disabled={ processing }
						>
							Cancel
						</Button>
						<Button
							onClick={ () => {
								doTheSwitch();
							} }
							title='All invited characters must be ready'
							disabled={ processing || Object.values(status.characters).some((s) => SpaceSwitchResolveCharacterStatusToClientStatus(s) !== 'ready') }
						>
							Go!
						</Button>
					</Row>
				) : (
					<Row alignX='space-between' padding='small'>
						<Button
							onClick={ () => {
								doCommand({ command: 'reject' });
							} }
							disabled={ processing || ownStatus?.permission === 'accept-enforce' }
						>
							Reject
						</Button>
						<SelectionIndicator padding='tiny' selected={ ownStatus != null && !ownStatus.accepted } active={ ownStatus != null && SpaceSwitchResolveCharacterStatusToClientStatus(ownStatus) !== 'ready' }>
							<Button
								onClick={ () => {
									doCommand({ command: 'setAccepted', accepted: false });
								} }
								disabled={ processing || ownStatus == null || ownStatus.permission === 'accept-enforce' }
							>
								Waiting
							</Button>
						</SelectionIndicator>
						<SelectionIndicator padding='tiny' selected={ ownStatus != null && ownStatus.accepted }>
							<Button
								onClick={ () => {
									doCommand({ command: 'setAccepted', accepted: true });
								} }
								disabled={ processing || ownStatus == null || ownStatus.permission === 'rejected' }
							>
								Ready!
							</Button>
						</SelectionIndicator>
					</Row>
				) }
			</Column>
		</DraggableDialog>
	);
}
