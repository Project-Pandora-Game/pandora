import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useDebugExpose } from '../../common/useDebugExpose';
import { Observable, ReadonlyObservable, useObservable } from '../../observable';
import { VersionCheck } from '../versionCheck/versionCheck';
import { useDocumentVisibility } from '../../common/useDocumentVisibility';

type NotificationHeader<T extends ReadonlyObservable<readonly unknown[]> = ReadonlyObservable<readonly unknown[]>> = {
	readonly notifications: T;
};
export type NotificationHeaderKeys = keyof NotificationHeader;

export enum NotificationSource {
	CHAT_MESSAGE = 'CHAT_MESSAGE',
	DIRECT_MESSAGE = 'DIRECT_MESSAGE',
	VERSION_CHANGED = 'VERSION_CHANGED',
	INCOMING_FRIEND_REQUEST = 'INCOMING_FRIEND_REQUEST',
}

export const NOTIFICATION_KEY: Readonly<Record<NotificationSource, NotificationHeaderKeys | null>> = {
	[NotificationSource.CHAT_MESSAGE]: 'notifications',
	[NotificationSource.VERSION_CHANGED]: 'notifications',
	[NotificationSource.DIRECT_MESSAGE]: null,
	[NotificationSource.INCOMING_FRIEND_REQUEST]: null,
};

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface NotificationData {
	//
}

export interface NotificationFullData extends NotificationData {
	source: NotificationSource;
	time: number;
	alert: ReadonlySet<NotificationAlert>;
}

enum NotificationAlert {
	HEADER = 0,
	TITLE = 1,
	FAVICO = 2,
	POPUP = 3,
}

enum NotificationAudio {
	NONE = 0,
	ONCE = 1,
	ALWAYS = 2,
	REPEAT = 3,
}

class NotificationHandlerBase {
	public get header(): NotificationHeader<ReadonlyObservable<readonly NotificationFullData[]>> {
		throw new Error('Not implemented');
	}
	public get title(): ReadonlyObservable<string> {
		throw new Error('Not implemented');
	}
	public readonly suppress = new Set<NotificationSource>();
	public clearHeader() {
		throw new Error('Not implemented');
	}
	public rise(_source: NotificationSource, _data: unknown) {
		throw new Error('Not implemented');
	}
	public clear(_source: NotificationSource) {
		throw new Error('Not implemented');
	}
	public onWindowFocus(): void {
		throw new Error('Not implemented');
	}
	public popupCheckEnabled(_userAction = false): Promise<boolean> {
		throw new Error('Not implemented');
	}
}

const BASE_TITLE = 'Pandora';

class NotificationHandler extends NotificationHandlerBase {

	private readonly _notifications = new Observable<readonly NotificationFullData[]>([]);
	private readonly _header: NotificationHeader<Observable<readonly NotificationFullData[]>> = {
		notifications: new Observable<readonly NotificationFullData[]>([]),
	};
	private readonly _title = new Observable<string>(BASE_TITLE);
	private readonly _favico = new Observable<string>('');

	public override get header(): NotificationHeader<ReadonlyObservable<readonly NotificationFullData[]>> {
		return this._header;
	}

	public override get title(): ReadonlyObservable<string> {
		return this._title;
	}

	public get favico(): ReadonlyObservable<string> {
		return this._favico;
	}

	public override clearHeader() {
		this._notifications.value = [];
		this._updateNotifications();
	}

	public override rise(source: NotificationSource, data: NotificationData) {
		if (this.suppress.has(source) && document.visibilityState === 'visible') {
			return;
		}
		const { alert, audio } = this._getSettings(source);
		const full: NotificationFullData = { source, ...data, time: Date.now(), alert };
		this._notifications.value = [...this._notifications.value, full];
		this._updateNotifications();
		if (alert.has(NotificationAlert.POPUP)) {
			this._risePopup(full, audio);
		}
	}

	public override clear(clearSource: NotificationSource) {
		this._notifications.value = this._notifications.value.filter(({ source }) => source !== clearSource);
		this._updateNotifications();
	}

	public override onWindowFocus(): void {
		// NOOP
	}

	private _getSettings(_source: NotificationSource): { alert: ReadonlySet<NotificationAlert>; audio: NotificationAudio; } {
		if (document.visibilityState === 'visible') {
			return { alert: new Set([NotificationAlert.HEADER]), audio: NotificationAudio.NONE };
		}
		return { alert: new Set([NotificationAlert.HEADER, NotificationAlert.TITLE, NotificationAlert.POPUP]), audio: NotificationAudio.ALWAYS };
	}

	private _updateNotifications() {
		const notifications = this._notifications.value;

		// Header
		this._header.notifications.value = notifications.filter((n) => n.alert.has(NotificationAlert.HEADER) && NOTIFICATION_KEY[n.source] === 'notifications');

		// Title
		const titleNotifications = notifications.filter((n) => n.alert.has(NotificationAlert.TITLE)).length;
		this._title.value = titleNotifications > 0 ? `(${titleNotifications}) ${BASE_TITLE}` : BASE_TITLE;

		// TODO: Favico
		// const favicoNotifications = notifications.filter((n) => n.alert.has(NotificationAlert.FAVICO)).length;

	}

	private _risePopup(data: NotificationFullData, audio: NotificationAudio) {
		// TODO
		const title = 'TEST TITLE';
		const options: NotificationOptions = {
			body: data.source,
			data: data.source,
			icon: '',
			tag: data.source,
			silent: audio === NotificationAudio.NONE,
		};

		this.popupCheckEnabled().then((enabled) => {
			if (enabled) {
				this._showNotification(title, options);
			}
		}).catch(() => { /* ignore */ });
	}

	private _showNotification(title: string, options: NotificationOptions) {
		const notification = new Notification(title, options);
		notification.onclick = () => {
			window.focus();
			notification.close();
			// TODO ...
		};
	}

	public override async popupCheckEnabled(userAction = false): Promise<boolean> {
		if (!Notification) {
			return false;
		}
		if (Notification.permission === 'default' && userAction) {
			if (await Notification.requestPermission() === 'granted') {
				return true;
			}
		}
		return Notification.permission === 'granted';
	}
}

const notificationContext = createContext(new NotificationHandlerBase());

export function NotificationContextProvider({ children }: { children: React.ReactNode; }) {
	const context = useMemo(() => new NotificationHandler(), []);

	useDebugExpose('notificationHandler', context);

	useEffect(() => {
		const listener = () => {
			context.onWindowFocus();
		};
		window.addEventListener('focus', listener);
		return () => window.removeEventListener('focus', listener);
	}, [context]);

	return (
		<notificationContext.Provider value={ context }>
			<VersionCheck />
			<NotificationTitleUpdater />
			{ children }
		</notificationContext.Provider>
	);
}

function NotificationTitleUpdater(): null {
	const { title } = useContext(notificationContext);
	const currentTitle = useObservable(title);

	useEffect(() => {
		window.document.title = currentTitle;
	}, [currentTitle]);

	return null;
}

export function useNotification(source: NotificationSource): (data: NotificationData) => void {
	const context = useContext(notificationContext);
	return useCallback((data) => context.rise(source, data), [context, source]);
}

export function useNotificationSuppressed(source: NotificationSource, suppressNotification = true): void {
	const context = useContext(notificationContext);
	const visible = useDocumentVisibility();
	useEffect(() => {
		if (visible && suppressNotification) {
			context.suppress.add(source);
			context.clear(source);
		}
		return () => {
			context.suppress.delete(source);
		};
	}, [context, source, visible, suppressNotification]);
}

export function useNotificationHeader(type: NotificationHeaderKeys): [readonly NotificationFullData[], () => void] {
	const context = useContext(notificationContext);
	return [
		useObservable(context.header[type]),
		useCallback(() => context.clearHeader(), [context]),
	];
}

export function useNotificationPermissionCheck(): () => void {
	const context = useContext(notificationContext);
	return useCallback(() => {
		context.popupCheckEnabled(true).catch(() => { /** noop */ });
	}, [context]);
}
