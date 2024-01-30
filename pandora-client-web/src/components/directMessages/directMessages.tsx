import React, { Suspense } from 'react';
import { AccountId, IDirectoryDirectMessageInfo } from 'pandora-common';
import { useObservable } from '../../observable';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { DirectMessage } from '../directMessage/directMessage';
import './directMessages.scss';
import { Button } from '../common/button/button';
import { Scrollbar } from '../common/scrollbar/scrollbar';

export function DirectMessages(): React.ReactElement {
	const directory = useDirectoryConnector();
	const [filter, setFilter] = React.useState('');
	const info = useObservable(directory.directMessageHandler.info);
	const selected = useObservable(directory.directMessageHandler.selected);

	const flt = React.useDeferredValue(filter.toLowerCase().trim());
	const filtered = React.useMemo(() => {
		const arr = flt.split(/\s+/).filter((s) => s.length > 0);
		return info
			.filter(({ displayName, id }) => {
				const name = `${displayName} (${id})`.toLowerCase();
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
			{ selected != null && <DirectMessage accountId={ selected } key={ selected } /> }
		</div>
	);
}

function DirectMessageTempInfo({ selected, filtered }: { selected: AccountId; filtered: readonly IDirectoryDirectMessageInfo[]; }) {
	const directoryConnector = useDirectoryConnector();

	if (filtered.some((i) => i.id === selected)) {
		return null;
	}

	const chat = directoryConnector.directMessageHandler.loadChat(selected);

	if (!chat.account) {
		return null;
	}

	return (
		<li className='temp'>
			{ chat.account.displayName } ({ selected })
		</li>
	);
}

function DirectMessageInfo({ info, selected }: { info: Readonly<IDirectoryDirectMessageInfo>; selected: boolean; }): React.ReactElement {
	const directory = useDirectoryConnector();
	const { id, displayName, hasUnread } = info;
	const show = React.useCallback(() => directory.directMessageHandler.setSelected(id), [directory.directMessageHandler, id]);

	return (
		<li onClick={ show } className={ selected ? 'selected' : '' }>
			{ displayName } ({ id })
			{ hasUnread && <span>!</span> }
		</li>
	);
}

function OpenConversation(): React.ReactElement {
	const directory = useDirectoryConnector();
	const accountId = useCurrentAccount()?.id;
	const ref = React.useRef<HTMLInputElement>(null);
	const onClick = React.useCallback(() => {
		if (!ref.current)
			return;

		const parsed = parseInt(ref.current.value, 10);
		if (Number.isInteger(parsed) && parsed > 0 && parsed !== accountId) {
			directory.directMessageHandler.setSelected(parsed);
		}
	}, [directory.directMessageHandler, accountId]);
	const onKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			onClick();
		}
	}, [onClick]);

	return (
		<div className='input-line'>
			<input type='text' inputMode='numeric' pattern='\d*' ref={ ref } onKeyDown={ onKeyDown } placeholder='Account ID' />
			<Button className='slim' onClick={ onClick }>Add</Button>
		</div>
	);
}
