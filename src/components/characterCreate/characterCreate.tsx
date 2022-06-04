import { IsCharacterName } from 'pandora-common';
import React, { ReactElement, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Player, usePlayerData } from '../../character/player';
import { useObservable } from '../../observable';
import { Button } from '../common/Button/Button';
import './characterCreate.scss';
import { Form, FormErrorMessage, FormField } from '../common/Form/form';

export function CharacterCreate(): ReactElement | null {
	// React States
	const [characterName, setCharacterName] = useState('');
	const [errorMessage, setErrorMessage] = useState('');

	const navigate = useNavigate();

	const player = useObservable(Player);
	const playerData = usePlayerData();

	if (!player)
		return null;

	if (playerData && !playerData.inCreation) {
		return <Navigate to='/pandora_lobby' />;
	}

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		//Prevent page reload
		event.preventDefault();

		// Character name
		if (!IsCharacterName(characterName)) {
			setErrorMessage('Invalid character name format');
			return;
		}

		void (async () => {
			const result = await player.finishCreation(characterName);

			if (result === 'ok') {
				setErrorMessage('');
				navigate('/pandora_lobby', {
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

	return (
		<div className='CharacterCreate'>
			<div id='registration-form'>
				<h1 className='title'>Name your character</h1>
				<Form onSubmit={ handleSubmit }>
					<FormField className='input-container'>
						<label htmlFor='characterName'>Name</label>
						<input autoComplete='off' type='text' id='characterName' name='characterName' value={ characterName }
							onChange={ (event) => setCharacterName(event.target.value) } required />
					</FormField>
					{ errorMessage && <FormErrorMessage>{ errorMessage }</FormErrorMessage> }
					<Button type='submit'>Submit</Button>
				</Form>
			</div>
		</div>
	);
}
