import { IsCharacterName } from 'pandora-common';
import React, { ReactElement, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCharacterData } from '../../character/character';
import { Player } from '../../character/player';
import { Button } from '../common/Button/Button';

export function CharacterCreate(): ReactElement {
	// React States
	const [characterName, setCharacterName] = useState('');
	const [errorMessage, setErrorMessage] = useState('');

	const navigate = useNavigate();

	const playerData = useCharacterData(Player);

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
			const result = await Player.finishCreation(characterName);

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
		<div className='registration'>
			<div id='registration-form' className='auth-form'>
				<h1 className='title'>Name your character</h1>
				<div className='form'>
					<form onSubmit={ handleSubmit }>
						<div className='input-container'>
							<label htmlFor='characterName'>Name</label>
							<input autoComplete='off' type='text' id='characterName' name='characterName' value={ characterName }
								onChange={ (event) => setCharacterName(event.target.value) } required />
						</div>
						{ errorMessage && <div className='error'>{ errorMessage }</div> }
						<Button type='submit'>Submit</Button>
					</form>
				</div>
			</div>
		</div>
	);
}
