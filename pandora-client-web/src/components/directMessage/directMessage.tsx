import { IDirectoryAccountInfo, IDirectoryDirectMessageAccount, LIMIT_DIRECT_MESSAGE_LENGTH } from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useAutoScroll } from '../../common/useAutoScroll';
import { useEvent } from '../../common/useEvent';
import { DirectMessage } from '../../networking/directMessageManager';
import { useObservable } from '../../observable';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { RenderChatPart } from '../../ui/components/chat/chatMessages';
import { Scrollbar } from '../common/scrollbar/scrollbar';
import { DirectMessageChannelProvider, useDirectMessageChannel } from '../gameContext/directMessageChannelProvieder';
import { useCurrentAccount } from '../gameContext/directoryConnectorContextProvider';
import './directMessage.scss';
import { useTextFormattingOnKeyboardEvent } from '../../common/useTextFormattingOnKeyboardEvent';

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
	const channelAccount = channel.account;
	const messages = useObservable(channel.messages);
	const account = useCurrentAccount();
	const [ref] = useAutoScroll<HTMLDivElement>([messages]);

	if (!account || !channelAccount) {
		return null;
	}

	return (
		<Scrollbar ref={ ref } color='dark' className='direct-message-list'>
			{ messages.map((message) => (
				<DirectMessageElement key={ message.time } message={ message } channel={ channelAccount } account={ account } />
			)) }
		</Scrollbar>
	);
}

function DirectMessageElement({ message, channel, account }: { message: DirectMessage; channel: Readonly<IDirectoryDirectMessageAccount>; account: IDirectoryAccountInfo; }): ReactElement {
	const displayNameElement = useMemo(() => {
		const { labelColor, displayName } = !message.sent ? channel : {
			labelColor: account.settings.labelColor,
			displayName: account.displayName,
		};

		return (
			<span style={ { color: labelColor } } className='direct-message-entry__name'>
				{ displayName }
			</span>
		);
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
			{ displayNameElement }
			{ ': ' }
			<span className='direct-message-entry__content'>
				{ ...message.message.map((c, i) => RenderChatPart(c, i, true)) }
			</span>
		</div>
	);
}

function DirectChannelInput(): ReactElement | null {
	const channel = useDirectMessageChannel();
	const ref = React.useRef<HTMLTextAreaElement>(null);

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

	React.useEffect(() => {
		ref.current?.focus();
	}, [channel.account]);

	const actualRef = useTextFormattingOnKeyboardEvent(ref);

	if (!channel.account) {
		return null;
	}

	return (
		<textarea
			ref={ actualRef }
			onKeyDown={ onKeyDown }
			maxLength={ LIMIT_DIRECT_MESSAGE_LENGTH }
			placeholder={ `Send message to ${channel.account.displayName} (${channel.account.id})` }
		/>
	);
}
