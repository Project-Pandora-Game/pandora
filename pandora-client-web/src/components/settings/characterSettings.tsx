import { AssertNever, ICharacterPrivateData, PronounKeySchema, PRONOUNS } from 'pandora-common';
import React, { ReactElement } from 'react';
import { toast } from 'react-toastify';
import { useColorInput } from '../../common/useColorInput.ts';
import { useAsyncEvent } from '../../common/useEvent.ts';
import { TextInput } from '../../common/userInteraction/input/textInput.tsx';
import { Select } from '../../common/userInteraction/select/select.tsx';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../persistentToast.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { CharacterPreviewGenerationButton } from '../../ui/screens/room/characterPreviewGeneration.tsx';
import { Button } from '../common/button/button.tsx';
import { ColorInput } from '../common/colorInput/colorInput.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { ModalDialog } from '../dialog/dialog.tsx';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider.tsx';
import { usePlayerData } from '../gameContext/playerContextProvider.tsx';
import { useCharacterSettingDriver } from './helpers/characterSettings.tsx';
import { SudoModeButton, useSudoMode } from './sudoMode.tsx';

export function CharacterSettings(): ReactElement | null {
	const navigate = useNavigatePandora();
	const playerData = usePlayerData();

	if (!playerData)
		return <>No character selected</>;

	return (
		<>
			<Button onClick={ () => { // TODO: Integrate better
				navigate(`/profiles/character/${playerData.id}`, {
					state: {
						back: location.pathname,
					},
				});
			} }>
				Edit your character profile
			</Button>
			<LabelColor />
			<Pronouns />
			<Preview />
			<DeleteCharacter playerData={ playerData } />
		</>
	);
}

function LabelColor(): ReactElement {
	const settingDriver = useCharacterSettingDriver('labelColor');
	const currentEffectiveValue = settingDriver.currentValue ?? settingDriver.defaultValue;
	const [color, setColor] = useColorInput(currentEffectiveValue);

	return (
		<fieldset>
			<legend>Name color</legend>
			<div className='input-row'>
				<label>Color</label>
				<ColorInput initialValue={ color } onChange={ setColor } title='Name' />
				<Button
					className='slim'
					onClick={ () => settingDriver.onChange(color) }
					disabled={ color === currentEffectiveValue.toUpperCase() }>
					Save
				</Button>
			</div>
		</fieldset>
	);
}

function Pronouns(): ReactElement {
	const settingDriver = useCharacterSettingDriver('pronoun');
	const currentEffectiveValue = settingDriver.currentValue ?? settingDriver.defaultValue;
	const [pronoun, setPronoun] = React.useState(currentEffectiveValue);

	return (
		<fieldset>
			<legend>Pronouns</legend>
			<div className='input-row'>
				<label>Pronoun</label>
				<Select value={ pronoun } onChange={ (ev) => setPronoun(PronounKeySchema.parse(ev.target.value)) }>
					{ Object.entries(PRONOUNS).map(([key, value]) => (
						<option key={ key } value={ key }>
							{ Object.values(value).join('/') }
						</option>
					)) }
				</Select>
				<Button
					className='slim'
					onClick={ () => settingDriver.onChange(pronoun) }
					disabled={ pronoun === currentEffectiveValue }>
					Save
				</Button>
			</div>
		</fieldset>
	);
}

function Preview(): ReactElement {
	return (
		<fieldset>
			<legend>Preview Icon</legend>
			<div className='input-row'>
				<CharacterPreviewGenerationButton />
			</div>
		</fieldset>
	);
}

function DeleteCharacter({ playerData }: { playerData: Readonly<ICharacterPrivateData>; }): ReactElement {
	const [stage, setStage] = React.useState(0);

	return (
		<fieldset>
			<legend>Character deletion</legend>
			<Column>
				<label>This action is irreversible, there is no going back. Please be certain.</label>
				<Button theme='danger' onClick={ () => setStage(1) }>
					Delete this character
				</Button>
				<DeleteCharacterDialog playerData={ playerData } stage={ stage } setStage={ setStage } />
			</Column>
		</fieldset>
	);
}

function DeleteCharacterDialog({ playerData, stage, setStage }: { playerData: Readonly<ICharacterPrivateData>; stage: number; setStage: (stage: number) => void; }): ReactElement | null {
	const navigate = useNavigatePandora();
	const directoryConnector = useDirectoryConnector();
	const { sudoActive, clearSudoMode } = useSudoMode();
	const [character, setCharacter] = React.useState('');

	const onReset = React.useCallback(() => {
		setCharacter('');
		setStage(0);
	}, [setStage]);

	const [deleteCharacter, isDeleting] = useAsyncEvent(async () => {
		if (character !== playerData.name)
			return null;

		const id = playerData.id;
		return await directoryConnector.awaitResponse('deleteCharacter', { id });
	}, (response) => {
		if (response == null)
			return;

		switch (response.result) {
			case 'ok':
				toast('Character deleted', TOAST_OPTIONS_SUCCESS);
				onReset();
				navigate('/character/select');
				return;
			case 'sudoRequired':
				clearSudoMode();
				toast('Please confirm your identity again.', TOAST_OPTIONS_ERROR);
				return;
			case 'failed':
				toast('Failed to delete the character. Please try again later.', TOAST_OPTIONS_ERROR);
				return;
			default:
				AssertNever(response.result);
		}
	}, {
		errorHandler: (error) => {
			const detail = error instanceof Error ? error.message : String(error);
			toast(`Failed to delete the character:\n${detail}`, TOAST_OPTIONS_ERROR);
		},
	});

	const toStage2 = React.useCallback(() => {
		if (character !== playerData.name) {
			toast('Invalid character name', TOAST_OPTIONS_ERROR);
			return;
		}
		setStage(2);
	}, [character, playerData.name, setStage]);

	if (stage < 1)
		return null;

	if (stage < 2) {
		return (
			<ModalDialog>
				<Column>
					<h3>
						Delete character: { playerData.name } ({ playerData.id })?
					</h3>
					<span>
						This will permanently delete the character and all associated data.
					</span>
					<span>
						This action is irreversible, there is no going back.
					</span>
					<br />
					<label htmlFor='character'>Enter your character name:</label>
					<TextInput
						id='character'
						aria-haspopup='false' autoCapitalize='off' autoComplete='off' autoCorrect='off' autoFocus spellCheck='false'
						value={ character }
						onChange={ setCharacter }
					/>
					<br />
					<Row>
						<Button onClick={ onReset }>
							Cancel
						</Button>
						<Button
							theme='danger'
							onClick={ toStage2 }
							disabled={ character !== playerData.name }
						>
							I have read and understood these effects
						</Button>
					</Row>
				</Column>
			</ModalDialog>
		);
	}

	return (
		<ModalDialog>
			<Column>
				<h3>
					Delete character: { playerData.name } ({ playerData.id })?
				</h3>
				{
					sudoActive ? (
						<span>
							Deleting this character cannot be undone.
						</span>
					) : (
						<span>
							One more security check is required before deleting this character.
						</span>
					)
				}
				<Row>
					<Button onClick={ onReset }>
						Cancel
					</Button>
					{
						sudoActive ? (
							<Button
								theme='danger'
								onClick={ () => {
									deleteCharacter();
								} }
								disabled={ isDeleting }
							>
								Delete this character
							</Button>
						) : (
							<SudoModeButton theme='danger'>
								Continue deleting character
							</SudoModeButton>
						)
					}
				</Row>
			</Column>
		</ModalDialog>
	);
}
