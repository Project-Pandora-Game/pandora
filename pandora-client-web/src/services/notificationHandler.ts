import { Service, type AccountSettings, type Satisfies, type ServiceConfigBase, type ServiceProviderDefinition } from 'pandora-common';
import { useCallback, useEffect } from 'react';
import { useDocumentVisibility } from '../common/useDocumentVisibility.ts';
import { Observable, ReadonlyObservable } from '../observable.ts';
import { GetAccountSettings } from './accountLogic/accountManagerHooks.ts';
import type { ClientServices } from './clientServices.ts';
import { useService } from './serviceProvider.tsx';

/* The audio files that can be played */
import audioAlert from '../audio/alert.mp3';
import audioBell from '../audio/bell.mp3';
import audioBing from '../audio/bing.mp3';
import audioDingDing from '../audio/ding-ding.mp3';

type NotificationHeader<T extends ReadonlyObservable<readonly unknown[]> = ReadonlyObservable<readonly unknown[]>> = {
	readonly notifications: T;
};
export type NotificationHeaderKeys = keyof NotificationHeader;

export enum NotificationSource {
	CHAT_MESSAGE = 'CHAT_MESSAGE',
	DIRECT_MESSAGE = 'DIRECT_MESSAGE',
	VERSION_CHANGED = 'VERSION_CHANGED',
	INCOMING_FRIEND_REQUEST = 'INCOMING_FRIEND_REQUEST',
	ROOM_ENTRY = 'ROOM_ENTRY',
}

export const NOTIFICATION_AUDIO_VOLUME: Readonly<Record<AccountSettings['notificationVolume'], string>> = {
	'0': '0%',
	'25': '25%',
	'50': '50%',
	'75': '75%',
	'100': '100%',
};

export const NOTIFICATION_AUDIO_NAMES: Readonly<Record<AccountSettings['notificationRoomEntrySound'], string>> = {
	'': '<None>',
	'alert': 'Alert',
	'bell': 'Bell',
	'bing': 'Bing',
	'dingding': 'Ding-Ding',
};

export const NOTIFICATION_AUDIO_SOUNDS: Readonly<Record<AccountSettings['notificationRoomEntrySound'], string | null>> = {
	'': null,
	'alert': audioAlert,
	'bell': audioBell,
	'bing': audioBing,
	'dingding': audioDingDing,
};

export const NOTIFICATION_KEY: Readonly<Record<NotificationSource, NotificationHeaderKeys | null>> = {
	[NotificationSource.CHAT_MESSAGE]: 'notifications',
	[NotificationSource.VERSION_CHANGED]: 'notifications',
	[NotificationSource.DIRECT_MESSAGE]: null,
	[NotificationSource.INCOMING_FRIEND_REQUEST]: null,
	[NotificationSource.ROOM_ENTRY]: 'notifications',
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
	AUDIO = 4,
}

enum NotificationAudio {
	NONE = 0,
	ONCE = 1,
	ALWAYS = 2,
	REPEAT = 3,
}

const BASE_TITLE = 'Pandora';

type NotificationHandlerServiceConfig = Satisfies<{
	dependencies: Pick<ClientServices, 'accountManager'>;
	events: false;
}, ServiceConfigBase>;

export class NotificationHandler extends Service<NotificationHandlerServiceConfig> {
	private readonly _notifications = new Observable<readonly NotificationFullData[]>([]);
	private readonly _header: NotificationHeader<Observable<readonly NotificationFullData[]>> = {
		notifications: new Observable<readonly NotificationFullData[]>([]),
	};
	private readonly _title = new Observable<string>(BASE_TITLE);
	private readonly _favico = new Observable<string>('');
	public readonly suppress = new Set<NotificationSource>();

	public get header(): NotificationHeader<ReadonlyObservable<readonly NotificationFullData[]>> {
		return this._header;
	}

	public get title(): ReadonlyObservable<string> {
		return this._title;
	}

	public get favico(): ReadonlyObservable<string> {
		return this._favico;
	}

	public clearHeader() {
		this._notifications.value = [];
		this._updateNotifications();
	}

	public rise(source: NotificationSource, data: NotificationData) {
		const { accountManager } = this.serviceDeps;

		if (this.suppress.has(source) && document.visibilityState === 'visible') {
			return;
		}
		const { alert, audio } = this._getSettings(source);
		const full: NotificationFullData = { source, ...data, time: Date.now(), alert };
		this._notifications.value = [...this._notifications.value, full];
		this._updateNotifications();
		if (alert.has(NotificationAlert.POPUP)) {
			this._risePopup(full, audio);
		} else if (alert.has(NotificationAlert.AUDIO)) {
			const notificationRoomEntrySound = GetAccountSettings(accountManager).notificationRoomEntrySound;
			const sound = NOTIFICATION_AUDIO_SOUNDS[notificationRoomEntrySound];
			if (sound != null) {
				const playAudio = new Audio(sound);
				// Calculate the volume percentage
				playAudio.volume = Number(GetAccountSettings(accountManager).notificationVolume) / 100;
				// Play the selected audio file
				playAudio.play().catch(() => { /* ignore */ });
			}
		}
	}

	public clear(clearSource: NotificationSource) {
		this._notifications.value = this._notifications.value.filter(({ source }) => source !== clearSource);
		this._updateNotifications();
	}

	public onWindowFocus(): void {
		// NOOP
	}

	private _getSettings(source: NotificationSource): { alert: ReadonlySet<NotificationAlert>; audio: NotificationAudio; } {
		if (source === NotificationSource.ROOM_ENTRY) {
			return { alert: new Set([NotificationAlert.AUDIO]), audio: NotificationAudio.ALWAYS };
		} if (document.visibilityState === 'visible') {
			return { alert: new Set([NotificationAlert.HEADER]), audio: NotificationAudio.NONE };
		} else {
			return { alert: new Set([NotificationAlert.HEADER, NotificationAlert.TITLE/*, NotificationAlert.POPUP*/]), audio: NotificationAudio.ALWAYS };
		}
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

	public async popupCheckEnabled(userAction = false): Promise<boolean> {
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

export const NotificationHandlerServiceProvider: ServiceProviderDefinition<ClientServices, 'notificationHandler', NotificationHandlerServiceConfig> = {
	name: 'notificationHandler',
	ctor: NotificationHandler,
	dependencies: {
		accountManager: true,
	},
};

export function useNotification(source: NotificationSource): (data: NotificationData) => void {
	const notificationHandler = useService('notificationHandler');
	return useCallback((data) => notificationHandler.rise(source, data), [notificationHandler, source]);
}

export function useNotificationSuppressed(source: NotificationSource, suppressNotification = true): void {
	const notificationHandler = useService('notificationHandler');
	const visible = useDocumentVisibility();
	useEffect(() => {
		if (visible && suppressNotification) {
			notificationHandler.suppress.add(source);
			notificationHandler.clear(source);
		}
		return () => {
			notificationHandler.suppress.delete(source);
		};
	}, [notificationHandler, source, visible, suppressNotification]);
}
