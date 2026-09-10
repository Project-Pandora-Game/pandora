import { AssertNever, BotChatMessage, BotChatMessageEnvelope, Result } from 'pandora-common';
import type { BotConnection } from './botConnection.ts';

/**
 * Helper class for sending chat messages into a space.
 */
export class ChatSender {
	private readonly _connection: BotConnection;

	constructor(connection: BotConnection) {
		this._connection = connection;
	}

	/**
	 * Send one or more messages into the space.
	 * @param messages - The messages to send
	 * @returns Result describing whether the send succeeded. On success returns `id` of the message.
	 */
	public async sendMessage(...messages: BotChatMessage[]): Promise<Result<number, Error>> {
		const id = this.generateNextMessageId();
		const envelope: BotChatMessageEnvelope = {
			messages,
			id,
		};

		return (await this.sendRawEnvelope(envelope)).map(() => id);
	}

	/**
	 * Edit previously sent message, replacing it by one or more messages.
	 *
	 * Note, that this produces a _new_ id - to edit edited message, you need to use the id returned by `editMessage`, not the original one.
	 *
	 * @param editId - Id returned by previous `sendMessage`/`editMessage` invocation.
	 * @param messages - The messages to replace the specified message with.
	 * @returns Result describing whether the send succeeded. On success returns `id` of the new message.
	 */
	public async editMessage(editId: number, ...messages: BotChatMessage[]): Promise<Result<number, Error>> {
		const id = this.generateNextMessageId();
		const envelope: BotChatMessageEnvelope = {
			messages,
			id,
			editId,
		};

		return (await this.sendRawEnvelope(envelope)).map(() => id);
	}

	/**
	 * Delete previously sent message.
	 *
	 * This is equivalent to `editMessage` with no replacement messages.
	 *
	 * @param editId - Id returned by previous `sendMessage`/`editMessage` invocation of the message to delete.
	 * @returns Result describing whether the send succeeded.
	 */
	public async deleteMessage(editId: number): Promise<Result<void, Error>> {
		return (await this.editMessage(editId)).map(() => undefined);
	}

	/**
	 * **ADVANCED**: Send one or more raw message envelopes.
	 *
	 * Allows for bundling separately-editable envelopes into a single send.
	 * You are responsible for correctly filling in the envelope `id` - each envelope should receive unique one.
	 * See `generateNextMessageId`
	 *
	 * @param envelopes - The envelopes to send
	 * @returns Result describing whether the send succeeded.
	 */
	public async sendRawEnvelope(...envelopes: BotChatMessageEnvelope[]): Promise<Result<void, Error>> {
		const connection = this._connection.connection;
		if (connection == null) {
			return Result.Err(new Error('Not connected'));
		}
		try {
			const result = await connection.awaitResponse('chatMessage', { messages: envelopes });
			if (result.result === 'ok') {
				return Result.Ok(undefined);
			}
			AssertNever(result.result);
		} catch (err) {
			return Result.Err(new Error('Error sending message', { cause: err }));
		}
	}

	private _lastMessageId: number = 0;
	/** **ADVANCED**: Last generated message Id, or `0` if none yet. */
	public get lastMessageId(): number {
		return this._lastMessageId;
	}

	/** **ADVANCED**: Generates a next message id, guaranteed to be larger than all previously generated ones. */
	public generateNextMessageId(): number {
		const now = Date.now();
		const nextMessageId = now > this._lastMessageId ? now : (this._lastMessageId + 1);
		this._lastMessageId = nextMessageId;
		return nextMessageId;
	}
}
