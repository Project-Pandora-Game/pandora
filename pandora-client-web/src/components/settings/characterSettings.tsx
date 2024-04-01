import { AssertNever, ICharacterPrivateData } from 'pandora-common';
import React, { ReactElement } from 'react';
import { Button } from '../common/button/button';
import { usePlayerData } from '../gameContext/playerContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ColorInput } from '../common/colorInput/colorInput';
import { PronounKey, PRONOUNS } from 'pandora-common/dist/character/pronouns';
import { useSpaceFeatures } from '../gameContext/gameStateContextProvider';
import { Select } from '../common/select/select';
import { useColorInput } from '../../common/useColorInput';
import { useNavigate } from 'react-router-dom';
import { ModalDialog } from '../dialog/dialog';
import { Form, FormField, FormFieldError } from '../common/form/form';
import { Column, Row } from '../common/container/container';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { PrehashPassword } from '../../crypto/helpers';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';

export function CharacterSettings(): ReactElement | null {
	const navigate = useNavigate();
	const playerData = usePlayerData();

	if (!playerData)
		return <>No character selected</>;

	return (
		<>
			<Button className='slim' onClick={ () => { // TODO: Integrate better
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
				<ColorInput initialValue={ color } onChange={ setColor } />
				<Button
					className='slim fadeDisabled'
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
					className='slim fadeDisabled'
					onClick={ () => shardConnector?.sendMessage('updateSettings', { pronoun }) }
					disabled={ !allowChange || pronoun === playerData.settings.pronoun }>
					Save
				</Button>
			</div>
		</fieldset>
	);
}

function DeleteCharacter({ playerData }: { playerData: Readonly<ICharacterPrivateData>; }): ReactElement {
	const [stage, setStage] = React.useState(0);

	return (
		<fieldset>
			<legend>Character Deletion</legend>
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
				toast('Character deleted', TOAST_OPTIONS_ERROR);
				onReset();
				return;
			case 'invalidPassword':
				setInvalidPassword(password);
				toast('Invalid password', TOAST_OPTIONS_ERROR);
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
					<input
						id='character'
						name='character'
						type='text' aria-haspopup='false' autoCapitalize='off' autoComplete='off' autoCorrect='off' autoFocus spellCheck='false'
						value={ character }
						onChange={ (ev) => setCharacter(ev.target.value) }
					/>
					<br />
					<Row>
						<Button onClick={ onReset }>
							Cancel
						</Button>
						<Button theme='danger' onClick={ toStage2 }>
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
					<input
						type='password'
						id='password'
						autoComplete='current-password'
						{ ...register('password', {
							required: 'Password is required',
							validate: (pwd) => (invalidPassword === pwd) ? 'Invalid password' : true,
						}) }
					/>
					<FormFieldError error={ errors.password } />
				</FormField>
				<Row>
					<Button onClick={ onReset }>
						Cancel
					</Button>
					<Button className='fadeDisabled' theme='danger' type='submit' disabled={ isSubmitting }>
						Delete this character
					</Button>
				</Row>
			</Form>
		</ModalDialog>
	);
}
