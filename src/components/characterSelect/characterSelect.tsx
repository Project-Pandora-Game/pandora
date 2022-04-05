import type { CharacterId, ICharacterSelfInfo } from 'pandora-common/dist/character';
import { EMPTY, IClientDirectoryNormalResult } from 'pandora-common/dist/networking';
import React, { ReactElement, useEffect, useState } from 'react';
import { NavigateFunction, useNavigate } from 'react-router-dom';
import { DirectoryConnector } from '../../networking/socketio_directory_connector';
import { Player } from '../../character/player';
import './characterSelect.scss';

/**
 * @todo
 *  - handle character state, do not resume character creation if character is already in use
 *  - handle character deletion
 *  - connect should block UI until connected
 */

let DoUpdateCharacters: (() => Promise<void>) | null = null;

/** Prevents automatic selection of character if it failed last time */
let AutoSelectErrored = false;

export function CharacterSelect(): ReactElement {
	const [info, setInfo] = useState<IClientDirectoryNormalResult['listCharacters'] | undefined>(undefined);
	const [state, setState] = useState('Loading...');
	const navigate = useNavigate();

	useEffect(() => {
		let mounted = true;
		async function awaitCharacters() {
			const result = await DirectoryConnector.awaitResponse('listCharacters', EMPTY);
			if (!mounted) {
				return;
			}
			const { characters } = result;
			if (!AutoSelectErrored && characters.length === 0) {
				setState('No characters found. Creating a new one...');
				if (await ConnectToCharacter(navigate, undefined))
					return;
				AutoSelectErrored = true;
			} else if (!AutoSelectErrored && characters.length === 1 && characters[0].inCreation) {
				setState('Character creation in progress...');
				if (await ConnectToCharacter(navigate, characters[0].id))
					return;
				AutoSelectErrored = true;
			}
			setInfo(result);
		}
		DoUpdateCharacters = awaitCharacters;
		awaitCharacters().catch(() => { /** NOOP */ });
		return () => {
			mounted = false;
			DoUpdateCharacters = null;
		};
	}, [navigate]);

	return (
		<div className='centerbox'>
			<div className='character-select'>
				{ info === undefined ? <div className='loading'>{ state }</div> : (
					<>{ info.characters.map((character) => <Character key={ character.id } { ...character } />) }</>
				) }
				{ info !== undefined && info.characters.length < info.limit && !info.characters.some((i) => i.inCreation) && (
					<Character key='create' name={ 'Create new character' } />
				) }
			</div>
		</div>
	);
}

function Character({ id, name, preview, state }: ICharacterSelfInfo | (Partial<ICharacterSelfInfo> & { name: string })): ReactElement {
	const navigate = useNavigate();

	return (
		<div className='card'>
			<div className='border' onClick={ () => void ConnectToCharacter(navigate, id) }>
				<State state={ state } />
				<div className='title'>{ name }</div>
				<Preview preview={ preview } />
				{ id && <p>{id}</p> }
			</div>
		</div>
	);
}

function State({ state }: { state?: string }): ReactElement | null {
	if (!state)
		return null;

	return (
		<div className='label'>{state}</div>
	);
}

function Preview({ preview }: { preview?: string }): ReactElement | null {
	if (!preview)
		return null;

	return (
		<div className='character-container'>
			<div className='frame'>
				<img className='character-image' src={ `data:image/png;base64,${preview}` } />
			</div>
		</div>
	);
}

async function ConnectToCharacter(navigate: NavigateFunction, id?: CharacterId): Promise<boolean> {
	let connected = false;
	const cleanup = Player.on('load', () => {
		if (Player.data.inCreation) {
			navigate('/character_create');
		} else {
			navigate('/pandora_lobby');
		}
	});
	if (id) {
		connected = await DirectoryConnector.connectToCharacter(id);
	} else {
		connected = await DirectoryConnector.createNewCharacter();
		DoUpdateCharacters?.().catch(() => { /* NOOP */ });
	}
	cleanup();
	return connected;
}
