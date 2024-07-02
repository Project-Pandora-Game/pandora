import type {
	CharacterId,
	IClientDirectory,
	IConnectionBase,
	IDirectoryAccountInfo,
	IDirectoryCharacterConnectionInfo,
	IDirectoryClientArgument,
	IDirectoryClientChangeEvents,
	IDirectoryStatus,
	SecondFactorData,
	SecondFactorResponse,
	TypedEventEmitter,
} from 'pandora-common';
import type { ReadonlyObservable } from '../observable';
import type { DirectMessageManager } from '../services/accountLogic/directMessages/directMessageManager';

export type LoginResponse = 'ok' | 'verificationRequired' | 'invalidToken' | 'unknownCredentials' | 'invalidSecondFactor';

/** State of connection to Directory */
export enum DirectoryConnectionState {
	/** The connection has not been attempted yet */
	NONE,
	/** Attempting to connect to Directory for the first time */
	INITIAL_CONNECTION_PENDING,
	/** Connection to Directory is currently established */
	CONNECTED,
	/** Connection to Directory lost, attempting to reconnect */
	CONNECTION_LOST,
	/** Connection intentionally closed, cannot be established again */
	DISCONNECTED,
}

export interface AuthToken {
	value: string;
	expires: number;
	username: string;
}

export interface DirectoryConnector extends IConnectionBase<IClientDirectory> {
	/** Current state of the connection */
	readonly state: ReadonlyObservable<DirectoryConnectionState>;

	/** Directory status data */
	readonly directoryStatus: ReadonlyObservable<IDirectoryStatus>;

	/** Currently logged in account data or null if not logged in */
	readonly currentAccount: ReadonlyObservable<IDirectoryAccountInfo | null>;

	/** Current auth token or undefined if not logged in */
	readonly authToken: ReadonlyObservable<AuthToken | undefined>;

	/** The Id of the last selected character for this session. On reconnect this character will be re-selected. */
	readonly lastSelectedCharacter: ReadonlyObservable<CharacterId | undefined>;

	/** Event emitter for directory change events */
	readonly changeEventEmitter: TypedEventEmitter<Record<IDirectoryClientChangeEvents, true>>;

	/** Event emitter for directory connection state change events */
	readonly connectionStateEventEmitter: TypedEventEmitter<Pick<IDirectoryClientArgument, 'connectionState'>>;

	readonly directMessageHandler: DirectMessageManager;

	/** Handler for second factor authentication */
	secondFactorHandler: ((response: SecondFactorResponse) => Promise<SecondFactorData | null>) | null;

	connect(): Promise<this>;

	disconnect(): void;

	/**
	 * Attempt to login to Directory and handle response
	 * @param username - The username to use for login
	 * @param password - The plaintext password to use for login
	 * @param verificationToken - Verification token to verify email
	 * @returns Promise of response from Directory
	 */
	login(username: string, password: string, verificationToken?: string): Promise<LoginResponse>;

	logout(): void;

	setShardConnectionInfo(info: IDirectoryCharacterConnectionInfo): void;

	connectToCharacter(id: CharacterId): Promise<boolean>;
	disconnectFromCharacter(): void;
}
