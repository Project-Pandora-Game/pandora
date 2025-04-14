import { AssertNever, ICharacterPrivateData, PRONOUNS, type PronounKey } from 'pandora-common';
import React, { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { useColorInput } from '../../common/useColorInput.ts';
import { FormInput } from '../../common/userInteraction/input/formInput.tsx';
import { TextInput } from '../../common/userInteraction/input/textInput.tsx';
import { Select } from '../../common/userInteraction/select/select.tsx';
import { PrehashPassword } from '../../crypto/helpers.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../persistentToast.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { CharacterPreviewGenerationButton } from '../../ui/screens/room/characterPreviewGeneration.tsx';
import { Button } from '../common/button/button.tsx';
import { ColorInput } from '../common/colorInput/colorInput.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { Form, FormField, FormFieldError } from '../common/form/form.tsx';
import { ModalDialog } from '../dialog/dialog.tsx';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider.tsx';
import { useSpaceFeatures } from '../gameContext/gameStateContextProvider.tsx';
import { usePlayerData } from '../gameContext/playerContextProvider.tsx';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider.tsx';

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
			<LabelColor playerData={ playerData } />
			<Pronouns playerData={ playerData } />
			<Preview />
			<DeleteCharacter playerData={ playerData } />
		</>
	);
}

function LabelColor({ playerData }: { playerData: Readonly<ICharacterPrivateData>; }): ReactElement {
	const shardConnector = useShardConnector();
	const [color, setColor] = useColorInput(playerData.settings.labelColor);

	return (
		<fieldset>
			<legend>Name color</legend>
			<div className='input-row'>
				<label>Color</label>
				<ColorInput initialValue={ color } onChange={ setColor } title='Name' />
				<Button
					className='slim'
					onClick={ () => shardConnector?.sendMessage('updateSettings', { labelColor: color }) }
					disabled={ color === playerData.settings.labelColor?.toUpperCase() }>
					Save
				</Button>
			</div>
		</fieldset>
	);
}

function Pronouns({ playerData }: { playerData: Readonly<ICharacterPrivateData>; }): ReactElement {
	const shardConnector = useShardConnector();
	const [pronoun, setPronoun] = React.useState(playerData.settings.pronoun);
	const features = useSpaceFeatures();
	const allowChange = features == null || features.includes('allowPronounChanges');

	return (
		<fieldset>
			<legend>Pronouns</legend>
			<div className='input-row'>
				<label>Pronoun</label>
				<Select value={ pronoun } onChange={ (ev) => setPronoun(ev.target.value as PronounKey) } disabled={ !allowChange }>
					{ Object.entries(PRONOUNS).map(([key, value]) => (
						<option key={ key } value={ key }>
							{ Object.values(value).join('/') }
						</option>
					)) }
				</Select>
				<Button
					className='slim'
					onClick={ () => shardConnector?.sendMessage('updateSettings', { pronoun }) }
					disabled={ !allowChange || pronoun === playerData.settings.pronoun }>
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

interface CharacterDeleteFormData {
	character: string;
	password: string;
}

function DeleteCharacterDialog({ playerData, stage, setStage }: { playerData: Readonly<ICharacterPrivateData>; stage: number; setStage: (stage: number) => void; }): ReactElement | null {
	const navigate = useNavigatePandora();
	const directoryConnector = useDirectoryConnector();
	const [invalidPassword, setInvalidPassword] = React.useState('');
	const [character, setCharacter] = React.useState('');

	const {
		formState: { errors, submitCount, isSubmitting },
		reset,
		handleSubmit,
		register,
		trigger,
	} = useForm<CharacterDeleteFormData>({ shouldUseNativeValidation: true, progressive: true });

	React.useEffect(() => {
		if (invalidPassword) {
			void trigger();
		}
	}, [invalidPassword, trigger]);

	const onReset = React.useCallback(() => {
		reset();
		setInvalidPassword('');
		setCharacter('');
		setStage(0);
	}, [reset, setStage]);

	const onSubmit = handleSubmit(async ({ password }) => {
		if (character !== playerData.name)
			return;

		const id = playerData.id;
		const passwordSha512 = await PrehashPassword(password);
		const { result } = await directoryConnector.awaitResponse('deleteCharacter', { id, passwordSha512 });

		switch (result) {
			case 'ok':
				toast('Character deleted', TOAST_OPTIONS_SUCCESS);
				onReset();
				navigate('/character/select');
				return;
			case 'invalidPassword':
				setInvalidPassword(password);
				toast('Invalid password', TOAST_OPTIONS_ERROR);
				return;
			case 'failed':
				toast('Failed to delete the character. Please try again later.', TOAST_OPTIONS_ERROR);
				return;
			default:
				AssertNever(result);
		}
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
			<h3>
				Delete character: { playerData.name } ({ playerData.id })?
			</h3>
			<Form dirty={ submitCount > 0 } onSubmit={ onSubmit }>
				<FormField>
					<label htmlFor='password'>Current password</label>
					<FormInput
						type='password'
						id='password'
						autoComplete='current-password'
						register={ register }
						name='password'
						options={ {
							required: 'Password is required',
							validate: (pwd) => (invalidPassword === pwd) ? 'Invalid password' : true,
						} }
					/>
					<FormFieldError error={ errors.password } />
				</FormField>
				<Row>
					<Button onClick={ onReset }>
						Cancel
					</Button>
					<Button theme='danger' type='submit' disabled={ isSubmitting }>
						Delete this character
					</Button>
				</Row>
			</Form>
		</ModalDialog>
	);
}
