import classNames from 'classnames';
import { noop } from 'lodash-es';
import { CharacterSelfInfo, EMPTY, GetLogger, IClientDirectoryNormalResult, type CharacterId } from 'pandora-common';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { toast } from 'react-toastify';
import profileIcon from '../../assets/icons/profile.svg';
import { useCreateNewCharacter } from '../../networking/account_manager.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { useService } from '../../services/serviceProvider.tsx';
import { GetDirectoryUrl, useAuthTokenHeader, useDirectoryChangeListener, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider.tsx';
import { usePlayerData } from '../gameContext/playerContextProvider.tsx';
import pandoraLogo from '../../assets/icons/pandora.svg';
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

function CharacterListItem({ id, name, state, onClick }: CharacterListItemProps): ReactElement {
	return (
		<button className='card' onClick={ onClick }>
			<div className='border'>
				<State state={ state } />
				<div className='title'>{ name }</div>
				{
					id != null ? (
						<Preview name={ name } id={ id } />
					) : null
				}
				<div className='id'>{ id && <p>{ 'ID: ' + id }</p> }</div>
				<div className='logo'>
					<img src={ pandoraLogo } alt='Pandora Logo' />
				</div>
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
	id: CharacterId;
}

function Preview({ name, id }: PreviewProps): ReactElement | null {
	const [preview, setPreview] = useState<string | null>(null);
	const auth = useAuthTokenHeader();

	useEffect(() => {
		if (!auth)
			return;

		let valid = true;

		fetch(new URL(`pandora/character/${encodeURIComponent(id)}/preview`, GetDirectoryUrl()), {
			headers: {
				Authorization: auth,
			},
		})
			.then((result) => {
				if (!result.ok) {
					throw new Error(`Request failed: ${result.status} ${result.statusText}`);
				}
				return result;
			})
			.then((result) => result.blob())
			.then((blob) => new Promise<string>((resolve, reject) => {
				const reader = new FileReader();

				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(blob);
			}))
			.then((image) => {
				if (valid) {
					setPreview(image);
				}
			})
			.catch((err) => {
				GetLogger('CharacterListPreview').warning(`Error getting preview for character ${id}:`, err);
			});

		return () => {
			valid = false;
		};
	}, [id, auth]);

	return (
		<div className={ classNames('frame', preview == null ? 'placeholder' : null) }>
			<img
				src={ preview ?? profileIcon }
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
