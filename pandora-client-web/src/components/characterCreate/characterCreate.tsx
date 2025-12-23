import { nanoid } from 'nanoid';
import { CharacterInputNameSchema, IsValidCharacterName } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { useCreateCharacter } from '../../character/player.ts';
import { useAsyncEvent } from '../../common/useEvent.ts';
import { TextInput } from '../../common/userInteraction/input/textInput.tsx';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { useGameStateOptional } from '../../services/gameLogic/gameStateHooks.ts';
import { Button } from '../common/button/button.tsx';
import { Form, FormCreateStringValidator, FormError, FormErrorMessage, FormField } from '../common/form/form.tsx';
import { usePlayer, usePlayerData } from '../gameContext/playerContextProvider.tsx';
import './characterCreate.scss';

export function CharacterCreate(): ReactElement | null {
	// React States
	const [characterName, setCharacterName] = useState('');
	const [errorMessage, setErrorMessage] = useState('');

	const navigate = useNavigatePandora();

	const player = usePlayer();
	const playerData = usePlayerData();
	const gameState = useGameStateOptional();
	const createCharacter = useCreateCharacter();

	// On open randomize appearance
	const shouldRandomize = player != null && playerData?.inCreation === true;
	useEffect(() => {
		if (shouldRandomize) {
			gameState?.doImmediateAction({
				type: 'randomize',
				kind: 'full',
				seed: nanoid(),
			}).catch(() => {
				// TODO: this is bad, we shouldn't have a useEffect that calls a shard action like this
			});
		}
	}, [shouldRandomize, gameState]);

	const [handleSubmit, processing] = useAsyncEvent(
		async () => {
			if (!player)
				return null;

			if (!IsValidCharacterName(characterName)) {
				setErrorMessage('Invalid character name format');
				return null;
			}

			return await createCharacter(player, { name: characterName });
		},
		(result) => {

			if (result === 'ok') {
				setErrorMessage('');
				navigate('/', {
					state: {
						message: 'Your character was successfully created.',
					},
				});
				return;
			} else {
				setErrorMessage(`Failed to create character: ${result}`);
			}
		});

	const onSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
		//Prevent page reload
		event.preventDefault();
		handleSubmit();
	}, [handleSubmit]);

	if (!player)
		return null;

	if (playerData && !playerData.inCreation) {
		return <Navigate to='/' />;
	}

	const characterNameError = characterName ? FormCreateStringValidator(CharacterInputNameSchema, 'character name')(characterName) : undefined;

	return (
		<div className='CharacterCreate'>
			<div id='registration-form'>
				<h1 className='title'>Name your character</h1>
				<Form onSubmit={ onSubmit }>
					<FormField className='input-container'>
						<label htmlFor='characterName'>Name</label>
						<TextInput
							autoComplete='off'
							id='characterName'
							value={ characterName }
							onChange={ setCharacterName }
							required
						/>
						<FormError error={ characterNameError } />
					</FormField>
					{ errorMessage && <FormErrorMessage>{ errorMessage }</FormErrorMessage> }
					<Button type='submit' disabled={ processing }>Confirm</Button>
				</Form>
			</div>
		</div>
	);
}
