import { cloneDeep } from 'lodash-es';
import {
	ACCOUNT_SETTINGS_DEFAULT,
	IDirectoryAccountInfo,
	TypedEvent,
	TypedEventEmitter,
} from 'pandora-common';
import { AuthToken } from '../../../src/networking/directoryConnector.ts';

/** Event emitter implementation for testing which allows events to be manually emitted */
export class TestEventEmitter<T extends TypedEvent> extends TypedEventEmitter<T> {
	public fireEvent<K extends keyof T>(event: K, value: T[K]): void {
		this.emit(event, value);
	}
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
