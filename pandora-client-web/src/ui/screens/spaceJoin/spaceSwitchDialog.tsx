import type { Immutable } from 'immer';
import { AssertNever, CHARACTER_SETTINGS_DEFAULT, GetLogger, KnownObject, type SpaceSwitchClientStatus, type SpaceSwitchCommand } from 'pandora-common';
import { Fragment, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import crossIcon from '../../../assets/icons/cross.svg';
import { useCharacterData, useCharacterDataMultiple, type Character } from '../../../character/character.ts';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { Button, IconButton } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { GridContainer } from '../../../components/common/container/gridContainer.tsx';
import { SelectionIndicator } from '../../../components/common/selectionIndicator/selectionIndicator.tsx';
import { DraggableDialog } from '../../../components/dialog/dialog.tsx';
import { useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { usePlayerId } from '../../../components/gameContext/playerContextProvider.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useSpaceCharacters, useSpaceInfoOptional } from '../../../services/gameLogic/gameStateHooks.ts';
import { ColoredName } from '../../components/common/coloredName.tsx';
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
					toast('Error joining the space, try again later', TOAST_OPTIONS_ERROR);
					break;
				case 'notFound':
					toast('Invitation not found', TOAST_OPTIONS_ERROR);
					break;
				case 'noAccess':
					toast('No access', TOAST_OPTIONS_ERROR);
					break;
				case 'notAllowed':
					toast('No access', TOAST_OPTIONS_ERROR);
					break;
				case 'restricted':
					toast('An item is preventing you from leaving the current space', TOAST_OPTIONS_ERROR);
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
				`Space switch status`
			) : (
				`Space switch invitation by ${ initiatorData.name } (${ initiatorData.id })`
			) }
			allowShade
			close={ () => {
				if (status.initiator === playerId) {
					doCommand({ command: 'abort' });
				} else {
					doCommand({ command: 'reject' });
				}
			} }
		>
			<Column>
				<h1>
					{ initiator.id === playerId ? (
						<>Space switch status</>
					) : (
						<>Space switch invitation by <ColoredName color={ initiatorData.publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor } title={ `${ initiatorData.name } (${ initiatorData.id })` }>{ initiatorData.name }</ColoredName></>
					) }
				</h1>
				{ initiator.id === playerId ? (
					<p>
						You are attempting to switch to space <code>{ status.targetSpace }</code>
					</p>
				) : (
					<p>
						{ initiatorData.name } invited you to space <code>{ status.targetSpace }</code>.
					</p>
				) }
				<div>Ready status of invited characters:</div>
				<GridContainer padding='medium' templateColumns='minmax(max-content, 1fr) minmax(max-content, 1fr) auto' alignItemsX='start' alignItemsY='center'>
					{ KnownObject.entries(status.characters).map(([id, characterStatus]) => {
						const character = charactersData.find((c) => c.id === id);

						return (
							<Fragment key={ id }>
								{ character != null ? (
									<ColoredName color={ character.publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor } title={ `${ character.name } (${ character.id })` }>{ character.name }</ColoredName>
								) : (
									<div>[UNKNOWN] ({ id })</div>
								) }
								<div>
									{ characterStatus === 'loading' ? <i>Loading...</i> :
										characterStatus === 'leaveRestricted' ? '❌ Cannot leave because of a worn item' :
										characterStatus === 'inRoomDevice' ? '❌ Cannot leave while in a room device' :
										characterStatus === 'rejected' ? '❌ Missing permission to invite' :
										characterStatus === 'wait' ? '⏳ Waiting for confirmation' :
										characterStatus === 'ready' ? '✅ Ready' :
										AssertNever(characterStatus) }
								</div>
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
									<div />
								) }
							</Fragment>
						);
					}) }
				</GridContainer>
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
							disabled={ processing || Object.values(status.characters).some((s) => s !== 'ready') }
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
							disabled={ processing }
						>
							Reject
						</Button>
						<SelectionIndicator padding='tiny' selected={ ownStatus === 'wait' } active={ ownStatus != null && ownStatus !== 'ready' }>
							<Button
								onClick={ () => {
									doCommand({ command: 'setAccepted', accepted: false });
								} }
								disabled={ processing }
							>
								Wait
							</Button>
						</SelectionIndicator>
						<SelectionIndicator padding='tiny' selected={ ownStatus === 'ready' }>
							<Button
								onClick={ () => {
									doCommand({ command: 'setAccepted', accepted: true });
								} }
								disabled={ processing }
							>
								Accept
							</Button>
						</SelectionIndicator>
					</Row>
				) }
			</Column>
		</DraggableDialog>
	);
}
