import { noop } from 'lodash';
import { CharacterId, EMPTY, ICharacterSelfInfo, IClientDirectoryNormalResult } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { usePlayerData } from '../../character/player';
import { USER_DEBUG } from '../../config/Environment';
import { LastSelectedCharacter } from '../../networking/socketio_shard_connector';
import { useDirectoryChangeListener, useDirectoryConnector } from '../gameContext/gameContextProvider';
import './characterSelect.scss';

/**
 * @todo
 *  - handle character state, do not resume character creation if character is already in use
 *  - handle character deletion
 *  - connect should block UI until connected
 */

interface UseCharacterListResult {
	data: IClientDirectoryNormalResult['listCharacters'] | undefined;
	fetchCharacterList: () => Promise<void>;
}

/** Prevents automatic selection of character if it has been attempted already to prevent loops */
let autoSelectDone = false;

export function CharacterSelect(): ReactElement {
	const [state, setState] = useState('Loading...');
	const directoryConnector = useDirectoryConnector();
	const { data, fetchCharacterList } = useCharacterList();
	const playerData = usePlayerData();

	const connectToCharacter = useCallback(async (id: CharacterId) => {
		await directoryConnector.connectToCharacter(id);
	}, [directoryConnector]);

	const createNewCharacter = useCallback(async () => {
		await directoryConnector.createNewCharacter();
		await fetchCharacterList();
	}, [directoryConnector, fetchCharacterList]);

	useEffect(() => {
		if (!data || autoSelectDone) {
			return;
		}

		const { characters } = data;

		void (async () => {
			if (USER_DEBUG && LastSelectedCharacter.value !== undefined && characters.some((c) => c.id === LastSelectedCharacter.value)) {
				autoSelectDone = true;
				setState('Reconnecting to last character...');
				await connectToCharacter(LastSelectedCharacter.value);
			} else if (characters.length === 0) {
				autoSelectDone = true;
				setState('No characters found. Creating a new one...');
				await createNewCharacter();
			} else if (characters.length === 1 && characters[0].inCreation) {
				autoSelectDone = true;
				setState('Character creation in progress...');
				await connectToCharacter(characters[0].id);
			}
		})();

	}, [data, connectToCharacter, createNewCharacter]);

	if (playerData) {
		if (playerData.inCreation) {
			return <Navigate to='/character_create' />;
		} else {
			return <Navigate to='/pandora_lobby' />;
		}
	}

	return (
		<div className='centerbox'>
			<ul className='character-select'>
				{ !data ? <div className='loading'>{ state }</div> : (
					<>{ data.characters.map((character) => (
						<CharacterListItem
							key={ character.id }
							{ ...character }
							onClick={ () => void connectToCharacter(character.id) }
						/>
					)) }
					</>
				) }
				{ data && data.characters.length < data.limit && !data.characters.some(
					(i) => i.inCreation) && (
					<CharacterListItem
						key='create'
						name={ 'Create new character' }
						onClick={ () => void createNewCharacter() }
					/>
				) }
			</ul>
		</div>
	);
}

type CharacterListItemProps = Partial<ICharacterSelfInfo> & {
	name: string;
	onClick: () => void;
};

function CharacterListItem({ id, name, preview, state, onClick }: CharacterListItemProps): ReactElement {
	return (
		<div className='card'>
			<div className='border' onClick={ onClick }>
				<State state={ state } />
				<div className='title'>{ name }</div>
				<Preview name={ name } preview={ preview } />
				{ id && <p>{ id }</p> }
			</div>
		</div>
	);
}

function State({ state }: { state?: string }): ReactElement | null {
	if (!state)
		return null;

	return (
		<div className='label'>{ state }</div>
	);
}

interface PreviewProps {
	name: string;
	preview?: string;
}

function Preview({ name, preview }: PreviewProps): ReactElement | null {
	if (!preview)
		return null;

	return (
		<div className='character-container'>
			<div className='frame'>
				<img
					className='character-image'
					src={ `data:image/png;base64,${ preview }` }
					alt={ `Preview image for ${ name }` }
				/>
			</div>
		</div>
	);
}

function useCharacterList(): UseCharacterListResult {
	const [data, setData] = useState<IClientDirectoryNormalResult['listCharacters']>();
	const directoryConnector = useDirectoryConnector();

	const fetchCharacterList = useCallback(async () => {
		const result = await directoryConnector.awaitResponse('listCharacters', EMPTY);
		setData(result);
	}, [directoryConnector]);

	useDirectoryChangeListener('characterList', () => {
		fetchCharacterList().catch(noop);
	});

	return { data, fetchCharacterList };
}
