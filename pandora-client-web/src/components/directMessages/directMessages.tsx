import React from 'react';
import { IDirectoryDirectMessageInfo } from 'pandora-common';
import { useObservable } from '../../observable';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { DirectMessage } from '../directMessage/directMessage';
import './directMessages.scss';
import { useEvent } from '../../common/useEvent';
import { Button } from '../common/Button/Button';

export function DirectMessages(): React.ReactElement {
	const directory = useDirectoryConnector();
	const info = useObservable(directory.directMessageHandler.info);
	const [selected, setSelected] = React.useState<number | null>(null);

	return (
		<div className='direct-messages'>
			<div className='direct-messages__list'>
				<ul>
					{info.map((i) => <DirectMessageInfo key={ i.id } info={ i } show={ setSelected } />)}
				</ul>
				<OpenConversation show={ setSelected } />
			</div>
			{selected !== null && <DirectMessage accountId={ selected } />}
		</div>
	);
}

function DirectMessageInfo({ info, show }: { info: Readonly<IDirectoryDirectMessageInfo>, show: (id: number) => void }): React.ReactElement {
	const { id, account, hasUnread } = info;
	return (
		<li onClick={ () => show(id) }>
			{account} ({id})
			{!hasUnread && <span>!</span>}
		</li>
	);
}

function OpenConversation({ show }: { show: (id: number) => void }): React.ReactElement {
	const accountId = useCurrentAccount()?.id;
	const [id, setId] = React.useState('');
	const onClick = useEvent(() => {
		const parsed = parseInt(id, 10);
		if (Number.isInteger(parsed) && parsed > 0 && parsed !== accountId) {
			show(parsed);
		}
	});

	return (
		<div className='input-line'>
			<input type='text' inputMode='numeric' pattern='\d*' value={ id } onChange={ (e) => setId(e.target.value) } />
			<Button className='slim' onClick={ onClick }>Open</Button>
		</div>
	);
}
