import { noop } from 'lodash';
import { CharacterSelfInfo, EMPTY, GetLogger, IClientDirectoryNormalResult } from 'pandora-common';
import { ReactElement, useCallback, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useCreateNewCharacter } from '../../networking/account_manager';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { useService } from '../../services/serviceProvider';
import { useDirectoryChangeListener, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { usePlayerData } from '../gameContext/playerContextProvider';
import './characterSelect.scss';

/**
 * @todo
 *  - handle character deletion
 *  - connect should block UI until connected
 */

interface UseCharacterListResult {
	data: Extract<IClientDirectoryNormalResult['listCharacters'], { result: 'ok'; }> | undefined;
	fetchCharacterList: () => Promise<void>;
}

export function CharacterSelect(): ReactElement {
	const { data, fetchCharacterList } = useCharacterList();
	const playerData = usePlayerData();
	const createNewCharacter = useCreateNewCharacter();
	const accountManager = useService('accountManager');

	const createNewCharacterAndRefreshList = useCallback(async () => {
		await createNewCharacter();
		await fetchCharacterList();
	}, [createNewCharacter, fetchCharacterList]);

	if (playerData) {
		if (playerData.inCreation) {
			return <Navigate to='/character/create' />;
		} else {
			return <Navigate to='/' />;
		}
	}

	return (
		<ul className='character-select'>
			{ !data ? <div className='loading'>Loading...</div> : (
				<>{ data.characters.map((character) => (
					<CharacterListItem
						key={ character.id }
						{ ...character }
						onClick={ () => {
							accountManager.connectToCharacter(character.id).catch((err) => {
								GetLogger('connectToCharacter').error('Error connecting to character:', err);
								toast(`Error connecting to character`, TOAST_OPTIONS_ERROR);
							});
						} }
					/>
				)) }
				</>
			) }
			{ data && data.characters.length < data.limit && !data.characters.some((i) => i.inCreation) && (
				<CharacterListItem
					key='create'
					name={ 'Create new character' }
					onClick={ () => {
						createNewCharacterAndRefreshList().catch((err) => {
							GetLogger('createNewCharacter').error('Error creating new character:', err);
							toast(`Error creating new character`, TOAST_OPTIONS_ERROR);
						});
					} }
				/>
			) }
		</ul>
	);
}

type CharacterListItemProps = Partial<CharacterSelfInfo> & {
	name: string;
	onClick: () => void;
};

function CharacterListItem({ id, name, preview, state, onClick }: CharacterListItemProps): ReactElement {
	return (
		<button className='card' onClick={ onClick }>
			<div className='border'>
				<State state={ state } />
				<div className='title'>{ name }</div>
				<Preview name={ name } preview={ preview } />
				{ id && <p>{ id }</p> }
			</div>
		</button>
	);
}

function State({ state }: { state?: string; }): ReactElement | null {
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

const DEBUG_PREVIEW_PREVIEW = false;
function Preview({ name, preview }: PreviewProps): ReactElement | null {
	if (!preview) {
		if (DEBUG_PREVIEW_PREVIEW && preview != null) {
			return <div className='frame' />;
		}
		return null;
	}

	return (
		<div className='frame'>
			<img
				src={ `data:image/png;base64,${preview}` }
				alt={ `Preview image for ${name}` }
			/>
		</div>
	);
}

function useCharacterList(): UseCharacterListResult {
	const [data, setData] = useState<Extract<IClientDirectoryNormalResult['listCharacters'], { result: 'ok'; } >>();
	const directoryConnector = useDirectoryConnector();
	const accountManager = useService('accountManager');

	const fetchCharacterList = useCallback(async () => {
		if (accountManager.currentAccount.value) {
			const result = await directoryConnector.awaitResponse('listCharacters', EMPTY);
			if (result.result === 'ok') {
				setData(result);
			} else {
				GetLogger('useCharacterList').warning('Failed to list characters:', result);
			}
		}
	}, [accountManager, directoryConnector]);

	useDirectoryChangeListener('characterList', () => {
		fetchCharacterList().catch(noop);
	});

	return { data, fetchCharacterList };
}
