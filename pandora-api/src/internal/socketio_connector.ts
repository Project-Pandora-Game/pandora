import {
	ConnectionBase,
	type IConnectionBase,
	type IMessageHandler,
	type Logger,
} from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse, type SocketInterfaceDefinition } from 'pandora-common/networking/helpers';
import { Socket, connect } from 'socket.io-client';

export interface Connector<OutboundT extends SocketInterfaceDefinition> extends IConnectionBase<OutboundT> {
	connect(): void;
	disconnect(): void;
}

export type SocketIOConnectorFactory<OutboundT extends SocketInterfaceDefinition, IncomingT extends SocketInterfaceDefinition, TAuthData extends (object | undefined) = undefined> =
	new (props: SocketIOConnectorProps<OutboundT, IncomingT, TAuthData>) => Connector<OutboundT>;

export interface SocketIOConnectorProps<OutboundT extends SocketInterfaceDefinition, IncomingT extends SocketInterfaceDefinition, TAuthData extends (object | undefined) = undefined> {
	uri: string;
	getAuthData?: () => TAuthData;
	schema: [OutboundT, IncomingT] | 'DO_NOT_VALIDATE_DATA';
	messageHandler: IMessageHandler<IncomingT>;
	onConnect: () => void;
	onDisconnect: (reason: Socket.DisconnectReason) => void;
	onConnectError: (err: Error) => void;
	logger: Logger;
}

type SocketAuthCallback = (data?: object) => void;

export const URL_PATH_REGEX = /^((?:(https?|wss?):\/)?\/?([^:/\s]+)(?::(\d+))?)(\/[^#\s]+)?$/;

export function GetSocketIoUrl(uri: string): {
	origin: string;
	path: string;
} {
	const matched = URL_PATH_REGEX.exec(uri);
	if (matched == null) {
		throw new Error(`Failed to parse URL ${uri}`);
	}
	return {
		origin: matched[1],
		path: matched[5],
	};
}

/** Class housing connection from Shard to Directory */
export class SocketIOConnector<OutboundT extends SocketInterfaceDefinition, IncomingT extends SocketInterfaceDefinition, TAuthData extends (object | undefined)> extends ConnectionBase<OutboundT, IncomingT, Socket> implements Connector<OutboundT> {
	private readonly _messageHandler: IMessageHandler<IncomingT>;

	constructor(props: SocketIOConnectorProps<OutboundT, IncomingT, TAuthData>) {
		// Create the connection without connecting
		const { origin, path } = GetSocketIoUrl(props.uri);
		const getAuthData = props.getAuthData;
		const socket = connect(origin, {
			path,
			autoConnect: false,
			withCredentials: true,
			auth: getAuthData ? ((callback: SocketAuthCallback) => callback(getAuthData())) : undefined,
		});

		super(socket, props.schema, props.logger);

		// Setup event handlers
		this.socket.on('connect', props.onConnect);
		this.socket.on('disconnect', props.onDisconnect);
		this.socket.on('connect_error', props.onConnectError);

		// Setup message handler
		this._messageHandler = props.messageHandler;
		this.socket.onAny(this.handleMessage.bind(this));
	}

	protected onMessage<K extends (keyof IncomingT & string)>(
		messageType: K,
		message: SocketInterfaceRequest<IncomingT>[K],
	): Promise<SocketInterfaceResponse<IncomingT>[K]> {
		return this._messageHandler.onMessage(messageType, message, undefined);
	}

	/**
	 * Attempt a connection
	 */
	public connect(): void {
		this.socket.connect();
	}

	/** Disconnect from Directory */
	public disconnect(): void {
		this.socket.close();
	}
}
