import { CharacterId, ICharacterSelfInfo, EMPTY, IClientDirectoryNormalResult } from 'pandora-common';
import React, { ReactElement, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ChangeEventEmmiter, DirectoryConnector } from '../../networking/socketio_directory_connector';
import { Player } from '../../character/player';
import './characterSelect.scss';
import { useCharacterData } from '../../character/character';

/**
 * @todo
 *  - handle character state, do not resume character creation if character is already in use
 *  - handle character deletion
 *  - connect should block UI until connected
 */

let DoUpdateCharacters: (() => Promise<void>) | null = null;

/** Prevents automatic selection of character if it has been attempted already to prevent loops */
let AutoSelectDone = false;

export function CharacterSelect(): ReactElement {
	const [info, setInfo] = useState<IClientDirectoryNormalResult['listCharacters'] | undefined>(undefined);
	const [state, setState] = useState('Loading...');

	const playerData = useCharacterData(Player);

	useEffect(() => {
		let mounted = true;
		async function awaitCharacters() {
			const result = await DirectoryConnector.awaitResponse('listCharacters', EMPTY);
			if (!mounted) {
				return;
			}
			const { characters } = result;
			if (!AutoSelectDone && characters.length === 0) {
				AutoSelectDone = true;
				setState('No characters found. Creating a new one...');
				if (await ConnectToCharacter(null))
					return;
			} else if (!AutoSelectDone && characters.length === 1 && characters[0].inCreation) {
				AutoSelectDone = true;
				setState('Character creation in progress...');
				if (await ConnectToCharacter(characters[0].id))
					return;
			}
			setInfo(result);
		}
		DoUpdateCharacters = awaitCharacters;
		awaitCharacters().catch(() => { /** NOOP */ });
		const changeEventEmmiterCleanup = ChangeEventEmmiter.on('characterList', () => {
			awaitCharacters().catch(() => { /** NOOP */ });
		});
		return () => {
			mounted = false;
			DoUpdateCharacters = null;
			changeEventEmmiterCleanup();
		};
	});

	if (playerData) {
		if (playerData.inCreation) {
			return <Navigate to='/character_create' />;
		} else {
			return <Navigate to='/pandora_lobby' />;
		}
	}

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
	return (
		<div className='card'>
			<div className='border' onClick={ () => void ConnectToCharacter(id ?? null) }>
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

async function ConnectToCharacter(id: CharacterId | null): Promise<boolean> {
	let connected = false;
	if (id) {
		connected = await DirectoryConnector.connectToCharacter(id);
	} else {
		connected = await DirectoryConnector.createNewCharacter();
		DoUpdateCharacters?.().catch(() => { /* NOOP */ });
	}
	return connected;
}
