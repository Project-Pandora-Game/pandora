import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useDebugExpose } from '../../common/useDebugExpose';
import { Observable, ReadonlyObservable, useObservable } from '../../observable';
import { VersionCheck } from '../versionCheck/versionCheck';

export enum NotificationSource {
	CHAT_MESSAGE = 'CHAT_MESSAGE',
	DIRECT_MESSAGE = 'DIRECT_MESSAGE',
	VERSION_CHANGED = 'VERSION_CHANGED',
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface NotificationData {
	//
}

export interface NotificationFullData extends NotificationData {
	source: NotificationSource;
	time: number;
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
	public get header(): ReadonlyObservable<readonly NotificationFullData[]> {
		throw new Error('Not implemented');
	}
	public readonly supress = new Set<NotificationSource>();
	public clearHeader() {
		throw new Error('Not implemented');
	}
	public rise(_source: NotificationSource, _data: unknown) {
		throw new Error('Not implemented');
	}
	public clear(_source: NotificationSource) {
		throw new Error('Not implemented');
	}
	public onWindowFocus: (() => void) = () => {
		throw new Error('Not implemented');
	};
	public popupCheckEnabled(_userAction = false): Promise<boolean> {
		throw new Error('Not implemented');
	}
}

class NotificationHandler extends NotificationHandlerBase {

	private readonly _header = new Observable<readonly NotificationFullData[]>([]);
	private readonly _title = new Observable<string>('');
	private readonly _favico = new Observable<string>('');

	constructor() {
		super();
		this.onWindowFocus = () => {
			this._title.value = '';
			this._favico.value = '';
		};
	}

	public override get header(): ReadonlyObservable<readonly NotificationFullData[]> {
		return this._header;
	}

	public get title(): ReadonlyObservable<string> {
		return this._title;
	}

	public get favico(): ReadonlyObservable<string> {
		return this._favico;
	}

	public override clearHeader() {
		this._header.value = [];
	}

	public override rise(source: NotificationSource, data: NotificationData) {
		if (this.supress.has(source) && document.visibilityState === 'visible') {
			return;
		}
		const { alert, audio } = this._getSettings(source);
		const full: NotificationFullData = { source, ...data, time: Date.now() };
		if (alert.has(NotificationAlert.HEADER)) {
			this._riseHeader(full);
		}
		if (alert.has(NotificationAlert.TITLE)) {
			this._riseTitle(full);
		}
		if (alert.has(NotificationAlert.FAVICO)) {
			this._riseFavico(full);
		}
		if (alert.has(NotificationAlert.POPUP)) {
			this._risePopup(full, audio);
		}
	}

	public override clear(clearSource: NotificationSource) {
		this._header.value = this._header.value.filter(({ source }) => source !== clearSource);
	}

	private _getSettings(_source: NotificationSource): { alert: ReadonlySet<NotificationAlert>, audio: NotificationAudio } {
		if (document.visibilityState === 'visible') {
			return { alert: new Set([NotificationAlert.HEADER]), audio: NotificationAudio.NONE };
		}
		return { alert: new Set([NotificationAlert.HEADER, NotificationAlert.POPUP]), audio: NotificationAudio.ALWAYS };
	}

	private _riseHeader(data: NotificationFullData) {
		this._header.value = [...this._header.value, data];
	}

	private _riseTitle(_data: NotificationFullData) {
		// TODO
	}

	private _riseFavico(_data: NotificationFullData) {
		// TODO
	}

	private _risePopup(data: NotificationFullData, audio: NotificationAudio) {
		// TODO
		const title = 'TEST TITLE';
		const options: NotificationOptions = {
			body: data.source,
			data: data.source,
			icon: '',
			tag: data.source,
			renotify: true,
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

export function NotificationContextProvider({ children }: { children: React.ReactNode }) {
	const context = useMemo(() => new NotificationHandler(), []);

	useDebugExpose('notificationHandler', context);

	useEffect(() => {
		window.addEventListener('focus', context.onWindowFocus);
		return () => window.removeEventListener('focus', context.onWindowFocus);
	}, [context.onWindowFocus]);

	return (
		<notificationContext.Provider value={ context }>
			<VersionCheck />
			{children}
		</notificationContext.Provider>
	);
}

export function useNotification(source: NotificationSource): {
	notify: (data: NotificationData) => void;
	clear: () => void;
	supress: () => void
	unsupress: () => void;
} {
	const context = useContext(notificationContext);
	return useMemo(() => ({
		notify: (data: NotificationData) => context.rise(source, data),
		clear: () => context.clear(source),
		supress: () => context.supress.add(source),
		unsupress: () => context.supress.delete(source),
	}), [context, source]);
}

export function useNotificationHeader(): [readonly NotificationFullData[], () => void] {
	const context = useContext(notificationContext);
	return [
		useObservable(context.header),
		useCallback(() => context.clearHeader(), [context]),
	];
}

export function useNotificationPermissionCheck(): () => void {
	const context = useContext(notificationContext);
	return useCallback(() => {
		context.popupCheckEnabled(true).catch(() => { /** noop */ });
	}, [context]);
}
