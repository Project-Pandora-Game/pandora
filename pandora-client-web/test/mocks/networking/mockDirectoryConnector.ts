import { cloneDeep } from 'lodash';
import {
	ACCOUNT_SETTINGS_DEFAULT,
	CharacterId,
	CreateDefaultDirectoryStatus,
	IDirectoryAccountInfo,
	IDirectoryClientArgument,
	IDirectoryClientChangeEvents,
	IDirectoryStatus,
	TypedEvent,
	TypedEventEmitter,
} from 'pandora-common';
import { DirectMessageManager } from '../../../src/networking/directMessageManager';
import { AuthToken, DirectoryConnectionState, DirectoryConnector } from '../../../src/networking/directoryConnector';
import { Observable } from '../../../src/observable';

/** Event emitter implementation for testing which allows events to be manually emitted */
export class TestEventEmitter<T extends TypedEvent> extends TypedEventEmitter<T> {
	public fireEvent<K extends keyof T>(event: K, value: T[K]): void {
		this.emit(event, value);
	}
}

/** Mock directory connector implementation for testing */
export class MockDirectoryConnector implements DirectoryConnector {
	public readonly authToken = new Observable<AuthToken | undefined>(undefined);
	public readonly lastSelectedCharacter = new Observable<CharacterId | undefined>(undefined);
	public readonly currentAccount = new Observable<IDirectoryAccountInfo | null>(null);
	public readonly directoryStatus = new Observable<IDirectoryStatus>(CreateDefaultDirectoryStatus());
	public readonly state = new Observable<DirectoryConnectionState>(DirectoryConnectionState.NONE);

	public readonly changeEventEmitter = new TestEventEmitter<Record<IDirectoryClientChangeEvents, true>>();
	public readonly connectionStateEventEmitter = new TestEventEmitter<Pick<IDirectoryClientArgument, 'connectionState'>>();
	public readonly directMessageHandler: DirectMessageManager = new DirectMessageManager(this);

	public awaitResponse = jest.fn().mockResolvedValue(undefined);

	public connect = jest.fn().mockResolvedValue(undefined);

	public disconnect = jest.fn();

	public login = jest.fn().mockResolvedValue('ok');

	public logout = jest.fn();

	public sendMessage = jest.fn();

	public setShardConnectionInfo = jest.fn();

	public secondFactorHandler = jest.fn();

	public connectToCharacter(_id: CharacterId): Promise<boolean> {
		return Promise.resolve(true);
	}
	public disconnectFromCharacter = jest.fn();

	public extendAuthToken = jest.fn();
}

export function MockAuthToken(overrides?: Partial<AuthToken>): AuthToken {
	return {
		username: 'test-user',
		expires: 253402300800000,
		value: 'RSCmVflw5oGvnBLvbO6bIq0QIRgDIi7E',
		...overrides,
	};
}

export function MockAccountInfo(overrides?: Partial<IDirectoryAccountInfo>): IDirectoryAccountInfo {
	return {
		id: 1234567890,
		created: 0,
		username: 'test-user',
		displayName: 'Test User',
		roles: {},
		spaceOwnershipLimit: 5,
		settings: cloneDeep(ACCOUNT_SETTINGS_DEFAULT),
		settingsCooldowns: {},
		...overrides,
	};
}
