import React from 'react';
import { IDirectoryDirectMessageInfo } from 'pandora-common';
import { useObservable } from '../../observable';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { DirectMessage } from '../directMessage/directMessage';
import './directMessages.scss';
import { useEvent } from '../../common/useEvent';
import { Button } from '../common/button/button';
import { Scrollbar } from '../common/scrollbar/scrollbar';

export function DirectMessages(): React.ReactElement {
	const directory = useDirectoryConnector();
	const [filter, setFilter] = React.useState('');
	const info = useObservable(directory.directMessageHandler.info);
	const [selected, setSelected] = React.useState<number | null>(null);

	const flt = React.useDeferredValue(filter.toLowerCase().trim());
	const filtered = React.useMemo(() => {
		const arr = flt.split(/\s+/).filter((s) => s.length > 0);
		return info
			.filter(({ account, id }) => {
				const name = `${account} (${id})`.toLowerCase();
				return arr.every((s) => name.includes(s));
			})
			.sort((a, b) => b.time - a.time);
	}, [info, flt]);

	return (
		<div className='direct-messages'>
			<div className='direct-messages__list'>
				<input type='text' value={ filter } onChange={ (e) => setFilter(e.target.value) } placeholder='Filter' />
				<Scrollbar color='dark' tag='ul'>
					{ filtered.map((i) => <DirectMessageInfo key={ i.id } info={ i } show={ setSelected } />) }
				</Scrollbar>
				<OpenConversation show={ setSelected } />
			</div>
			{ selected !== null && <DirectMessage accountId={ selected } key={ selected } /> }
		</div>
	);
}

function DirectMessageInfo({ info, show }: { info: Readonly<IDirectoryDirectMessageInfo>; show: (id: number) => void; }): React.ReactElement {
	const { id, account, hasUnread } = info;
	return (
		<li onClick={ () => show(id) }>
			{ account } ({ id })
			{ hasUnread && <span>!</span> }
		</li>
	);
}

function OpenConversation({ show }: { show: (id: number) => void; }): React.ReactElement {
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
