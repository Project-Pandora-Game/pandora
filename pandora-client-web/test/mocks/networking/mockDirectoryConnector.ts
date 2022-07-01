import {
	IDirectoryAccountInfo,
	IDirectoryClientArgument,
	IDirectoryClientChangeEvents,
	IDirectoryStatus,
} from 'pandora-common';
import { AuthToken, DirectoryConnectionState, DirectoryConnector } from '../../../src/networking/directoryConnector';
import { Observable } from '../../../src/observable';
import { TestEventEmitter } from '../testEventEmitter';

/** Mock directory connector implementation for testing */
export class MockDirectoryConnector implements DirectoryConnector {
	public readonly authToken = new Observable<AuthToken | undefined>(undefined);
	public readonly currentAccount = new Observable<IDirectoryAccountInfo | null>(null);
	public readonly directoryStatus = new Observable<IDirectoryStatus>({ time: 0 });
	public readonly state = new Observable<DirectoryConnectionState>(DirectoryConnectionState.NONE);

	public readonly changeEventEmitter = new TestEventEmitter<Record<IDirectoryClientChangeEvents, true>>();
	public readonly connectionStateEventEmitter = new TestEventEmitter<Pick<IDirectoryClientArgument, 'connectionState'>>();

	public awaitResponse = jest.fn().mockResolvedValue(undefined);

	public connect = jest.fn().mockResolvedValue(undefined);

	public disconnect = jest.fn();

	public login = jest.fn().mockResolvedValue('ok');

	public logout = jest.fn();

	public sendMessage = jest.fn();

	public setShardConnectionInfo = jest.fn();
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
		roles: {},
		settings: {
			visibleRoles: [],
		},
		...overrides,
	};
}
