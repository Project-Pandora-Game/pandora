import { IDirectoryAccountInfo } from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useAutoScroll } from '../../common/useAutoScroll';
import { useEvent } from '../../common/useEvent';
import { DirectMessage, DirectMessageChannel } from '../../networking/directMessageManager';
import { useObservable } from '../../observable';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { RenderChatPart } from '../chatroom/chatroomMessages';
import { Scrollbar } from '../common/scrollbar/scrollbar';
import { DirectMessageChannelProvider, useDirectMessageChannel } from '../gameContext/directMessageChannelProvieder';
import { useCurrentAccount } from '../gameContext/directoryConnectorContextProvider';
import './directMessage.scss';

export function DirectMessage({ accountId }: { accountId: number; }): ReactElement {
	return (
		<div className='direct-message'>
			<DirectMessageChannelProvider accountId={ accountId }>
				<DirectMessageList />
				<DirectChannelInput />
			</DirectMessageChannelProvider>
		</div>
	);
}

function DirectMessageList(): ReactElement | null {
	const channel = useDirectMessageChannel();
	const messages = useObservable(channel.messages);
	const account = useCurrentAccount();
	const [ref] = useAutoScroll<HTMLDivElement>([messages]);

	if (!account) {
		return null;
	}

	return (
		<Scrollbar ref={ ref } color='dark' className='direct-message-list'>
			{ messages.map((message) => (
				<DirectMessageElement key={ message.time } message={ message } channel={ channel } account={ account } />
			)) }
		</Scrollbar>
	);
}

function DirectMessageElement({ message, channel, account }: { message: DirectMessage; channel: DirectMessageChannel; account: IDirectoryAccountInfo; }): ReactElement {
	const { color, name } = useMemo(() => {
		if (message.sent) {
			return {
				color: account.settings.labelColor,
				name: account.username,
			};
		} else {
			return {
				color: channel.account.labelColor,
				name: channel.account.name,
			};
		}
	}, [message, account, channel]);
	const time = useMemo(() => new Date(message.time), [message.time]);

	return (
		<div className='direct-message-entry'>
			<span className='direct-message-entry__info'>
				<time>
					{ time.toLocaleDateString() } { time.toLocaleTimeString('en-IE').substring(0, 5) }
				</time>
				{ message.edited ? <span> [edited]</span> : null }
				{ /* Space so copied text looks nicer */ ' ' }
			</span>
			<span style={ { color } } className='direct-message-entry__name'>
				{ name }
			</span>
			{ ': ' }
			<span className='direct-message-entry__content'>
				{...message.message.map((c, i) => RenderChatPart(c, i))}
			</span>
		</div>
	);
}

function DirectChannelInput(): ReactElement {
	const channel = useDirectMessageChannel();

	const onKeyDown = useEvent((ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const textarea = ev.currentTarget;
		if (ev.key === 'Enter' && !ev.shiftKey) {
			ev.preventDefault();
			const value = textarea.value.trim();
			if (value) {
				channel.sendMessage(value)
					.catch((e) => toast(`Failed to send message: ${e as string}`, TOAST_OPTIONS_ERROR));
				textarea.value = '';
			}
		}
	});

	return (
		<textarea onKeyDown={ onKeyDown } />
	);
}
