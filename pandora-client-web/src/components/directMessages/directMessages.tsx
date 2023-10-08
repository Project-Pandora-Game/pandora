import React, { Suspense } from 'react';
import { AccountId, IDirectoryDirectMessageInfo } from 'pandora-common';
import { Observable, useObservable } from '../../observable';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { DirectMessage } from '../directMessage/directMessage';
import './directMessages.scss';
import { useEvent } from '../../common/useEvent';
import { Button } from '../common/button/button';
import { Scrollbar } from '../common/scrollbar/scrollbar';

export const SELECTED_DIRECT_MESSAGE = new Observable<AccountId | null>(null);

export function DirectMessages(): React.ReactElement {
	const directory = useDirectoryConnector();
	const [filter, setFilter] = React.useState('');
	const info = useObservable(directory.directMessageHandler.info);
	const selected = useObservable(SELECTED_DIRECT_MESSAGE);

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
					{ selected == null ? null : (
						<Suspense>
							<DirectMessageTempInfo selected={ selected } filtered={ filtered } />
						</Suspense>
					) }
					{ filtered.map((i) => <DirectMessageInfo key={ i.id } info={ i } selected={ i.id === selected } />) }
				</Scrollbar>
				<OpenConversation />
			</div>
			{ selected !== null && <DirectMessage accountId={ selected } key={ selected } /> }
		</div>
	);
}

function DirectMessageTempInfo({ selected, filtered }: { selected: AccountId; filtered: readonly IDirectoryDirectMessageInfo[]; }) {
	const directoryConnector = useDirectoryConnector();

	if (filtered.some((i) => i.id === selected)) {
		return null;
	}

	const chat = directoryConnector.directMessageHandler.loadChat(selected);

	return (
		<li className='temp'>
			{ chat.account.name } ({ selected })
		</li>
	);
}

function DirectMessageInfo({ info, selected }: { info: Readonly<IDirectoryDirectMessageInfo>; selected: boolean; }): React.ReactElement {
	const { id, account, hasUnread } = info;
	const show = React.useCallback(() => SELECTED_DIRECT_MESSAGE.value = id, [id]);

	return (
		<li onClick={ show } className={ selected ? 'selected' : '' }>
			{ account } ({ id })
			{ hasUnread && <span>!</span> }
		</li>
	);
}

function OpenConversation(): React.ReactElement {
	const accountId = useCurrentAccount()?.id;
	const [id, setId] = React.useState('');
	const onClick = useEvent(() => {
		const parsed = parseInt(id, 10);
		if (Number.isInteger(parsed) && parsed > 0 && parsed !== accountId) {
			SELECTED_DIRECT_MESSAGE.value = parsed;
		}
	});

	return (
		<div className='input-line'>
			<input type='text' inputMode='numeric' pattern='\d*' value={ id } onChange={ (e) => setId(e.target.value) } />
			<Button className='slim' onClick={ onClick }>Open</Button>
		</div>
	);
}
