import { IClientMessage } from 'pandora-common';
import { BrowserStorage } from '../../browserStorage';
import { Room } from '../../character/room';
import { USER_DEBUG } from '../../config/Environment';
import { ShardConnector } from '../../networking/shardConnector';
import { observable, ObservableClass } from '../../observable';

const MESSAGE_EDIT_TIMOUT = 1000 * 60 * 10; // 10 minutes

class SentMessagesClass extends ObservableClass<{ editing: number | undefined; }> {
	private readonly _storate = BrowserStorage.createSession<[number, { text: string; time: number; }][]>('sentMessages', []);
	private readonly _sent: Map<number, { text: string; time: number; }>;

	@observable
	public editing: number | undefined;

	constructor() {
		super();
		this._sent = new Map<number, { text: string; time: number; }>(this._storate.value);
		setInterval(() => {
			this._cleanup();
		}, MESSAGE_EDIT_TIMOUT / 2);
		this._cleanup();
	}

	send(shardConnector: ShardConnector | null, message: string, parsed: IClientMessage[]): boolean {
		if (!shardConnector || parsed.length === 0)
			return false;

		const editing = this.editing;
		if (editing && !this._has(editing)) {
			this.editing = undefined;
			return false;
		}

		const id = Room.getNextMessageId();

		shardConnector.sendMessage('chatRoomMessage', {
			messages: parsed,
			editId: editing,
			id,
		});

		this._sent.set(id, { text: message, time: Date.now() });
		this._updateStorate();

		return true;
	}

	delete(shardConnector: ShardConnector | null, id: number): boolean {
		if (!shardConnector)
			return false;

		if (!this._has(id))
			return false;

		shardConnector.sendMessage('chatRoomMessage', {
			messages: [],
			editId: id,
			id: Room.getNextMessageId(),
		});

		return true;
	}

	getEditTimeout(id: number): number | undefined {
		const sent = this._sent.get(id);
		if (!sent)
			return undefined;

		return sent.time + MESSAGE_EDIT_TIMOUT - Date.now();
	}

	getMessageForEdit(id: number): string | undefined {
		const sent = this._sent.get(id);
		if (!sent)
			return undefined;

		const now = Date.now();
		const { time } = sent;
		if (now - time > MESSAGE_EDIT_TIMOUT) {
			this._sent.delete(id);
			this._updateStorate();
			return undefined;
		}

		this.editing = id;
		return sent.text;
	}

	private _has(id: number): boolean {
		const sent = this._sent.get(id);
		if (!sent)
			return false;

		this._sent.delete(id);
		this._updateStorate();

		const now = Date.now();
		const { time } = sent;
		return now - time < MESSAGE_EDIT_TIMOUT;
	}

	private _updateStorate() {
		this._storate.value = Array.from(this._sent.entries());
	}

	private _cleanup() {
		const now = Date.now();
		for (const [id, sent] of this._sent) {
			if (now - sent.time > MESSAGE_EDIT_TIMOUT) {
				this._sent.delete(id);
				if (this.editing === id)
					this.editing = undefined;
			}
		}
		this._updateStorate();
	}
}

export const SentMessages = new SentMessagesClass;

// Debug helper
if (USER_DEBUG) {
	//@ts-expect-error: Development link
	window.SentMessages = SentMessages;
}
