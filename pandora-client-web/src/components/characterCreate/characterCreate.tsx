import { CharacterInputNameSchema, IsValidCharacterName } from 'pandora-common';
import React, { ReactElement, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCreateCharacter } from '../../character/player';
import { usePlayer, usePlayerData } from '../gameContext/playerContextProvider';
import { Button } from '../common/button/button';
import './characterCreate.scss';
import { Form, FormCreateStringValidator, FormError, FormErrorMessage, FormField } from '../common/form/form';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { nanoid } from 'nanoid';

export function CharacterCreate(): ReactElement | null {
	// React States
	const [characterName, setCharacterName] = useState('');
	const [errorMessage, setErrorMessage] = useState('');

	const navigate = useNavigate();

	const player = usePlayer();
	const playerData = usePlayerData();
	const shardConnector = useShardConnector();
	const createCharacter = useCreateCharacter();

	// On open randomize appearance
	const shouldRandomize = player != null && playerData?.inCreation === true;
	useEffect(() => {
		if (shouldRandomize) {
			shardConnector?.awaitResponse('appearanceAction', {
				type: 'randomize',
				kind: 'full',
				seed: nanoid(),
			}).catch(() => {
				// TODO: this is bad, ww shouldn't have a useEffect that calls a shard action like this
			});
		}
	}, [shouldRandomize, shardConnector]);

	if (!player)
		return null;

	if (playerData && !playerData.inCreation) {
		return <Navigate to='/' />;
	}

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		//Prevent page reload
		event.preventDefault();

		// Character name
		if (!IsValidCharacterName(characterName)) {
			setErrorMessage('Invalid character name format');
			return;
		}

		void (async () => {
			const result = await createCharacter(player, { name: characterName });

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
		})();
	};

	const characterNameError = characterName ? FormCreateStringValidator(CharacterInputNameSchema, 'character name')(characterName) : undefined;

	return (
		<div className='CharacterCreate'>
			<div id='registration-form'>
				<h1 className='title'>Name your character</h1>
				<Form onSubmit={ handleSubmit }>
					<FormField className='input-container'>
						<label htmlFor='characterName'>Name</label>
						<input
							type='text'
							autoComplete='off'
							id='characterName'
							name='characterName'
							value={ characterName }
							onChange={ (event) => setCharacterName(event.target.value) }
							required
						/>
						<FormError error={ characterNameError } />
					</FormField>
					{ errorMessage && <FormErrorMessage>{ errorMessage }</FormErrorMessage> }
					<Button type='submit'>Submit</Button>
				</Form>
			</div>
		</div>
	);
}
