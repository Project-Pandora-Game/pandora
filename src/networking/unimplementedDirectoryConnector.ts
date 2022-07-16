import {
	ConnectionBase,
	GetLogger,
	IClientDirectoryBase,
	IDirectoryAccountInfo,
	IDirectoryCharacterConnectionInfo,
	IDirectoryClientArgument,
	IDirectoryClientChangeEvents,
	IDirectoryStatus,
} from 'pandora-common';
import { EmitterWithAck } from 'pandora-common/src/networking/socket';
import { NoopEventEmitter, TypedEventEmitter } from '../event';
import { ReadonlyObservable, StaticObservable } from '../observable';
import { AuthToken, DirectoryConnectionState, DirectoryConnector, LoginResponse } from './directoryConnector';

export class UnimplementedDirectoryConnector extends ConnectionBase<EmitterWithAck, IClientDirectoryBase> implements DirectoryConnector {
	public readonly authToken: ReadonlyObservable<AuthToken | undefined> = new StaticObservable(undefined);
	public readonly changeEventEmitter: TypedEventEmitter<Record<IDirectoryClientChangeEvents, true>> = new NoopEventEmitter();
	public readonly connectionStateEventEmitter: TypedEventEmitter<Pick<IDirectoryClientArgument, 'connectionState'>> = new NoopEventEmitter();
	public readonly currentAccount: ReadonlyObservable<IDirectoryAccountInfo | null> = new StaticObservable(null);
	public readonly directoryStatus: ReadonlyObservable<IDirectoryStatus> = new StaticObservable({ time: Date.now() });
	public readonly state: ReadonlyObservable<DirectoryConnectionState> = new StaticObservable(DirectoryConnectionState.NONE);

	public constructor() {
		super({
			emit: () => {
				throw new Error('Not implemented');
			},
			timeout: () => ({
				emit: () => {
					throw new Error('Not implemented');
				},
			}),
		}, GetLogger('UnimplementedDirectoryConnector'));
	}

	public connect(): Promise<this> {
		throw new Error('Method not implemented');
	}

	public disconnect(): void {
		throw new Error('Method not implemented');
	}

	public login(_username: string, _password: string, _verificationToken?: string): Promise<LoginResponse> {
		throw new Error('Method not implemented');
	}

	public logout(): void {
		throw new Error('Method not implemented');
	}

	public setShardConnectionInfo(_info: IDirectoryCharacterConnectionInfo): void {
		throw new Error('Method not implemented');
	}

	protected onMessage(_messageType: string, _message: Record<string, unknown>, _callback?: ((arg: Record<string, unknown>) => void) | undefined): Promise<boolean> {
		throw new Error('Method not implemented');
	}
}
