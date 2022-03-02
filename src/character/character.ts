import type { CharacterId, ICharacterData, ICharacterDataUpdate } from 'pandora-common';
import { DirectoryConnector } from '../networking/socketio_directory_connector';
import CharacterManager from './characterManager';
import { SocketIOConnectionClient } from '../networking/socketio_client_connection';

export const enum CharacterModification {
	NONE = 0,
	MODIFIED = 1,
	PENDING = 2,
}

type ICharacterDataChange = Omit<ICharacterDataUpdate, 'id'>;

export default class Character {
	public readonly data: ICharacterData;

	public state = CharacterModification.NONE;
	public modified: Set<keyof ICharacterDataChange> = new Set();
	public lastModified: number = 0;

	public connection: SocketIOConnectionClient | undefined;

	public get id(): CharacterId {
		return this.data.id;
	}

	constructor(data: ICharacterData) {
		this.data = data;
	}

	public isInUse(): boolean {
		return this.connection !== undefined;
	}

	public async finishCreation(name: string): Promise<boolean> {
		this.setValue('name', name);
		await this.save();

		if (!this.modified.has('name')) {
			const { created } = await DirectoryConnector.awaitResponse('createCharacter', { id: this.data.id });
			this.data.created = created;
			this.data.inCreation = undefined;
			return true;
		}

		return false;
	}

	public invalidate(): void {
		this.state = CharacterModification.NONE;
		this.modified.clear();
		this.connection?.abortConnection();
	}

	public async save(): Promise<void> {
		await CharacterManager.saveCharacter(this);
	}

	private setValue<Key extends keyof ICharacterDataChange>(key: Key, value: ICharacterData[Key]): void {
		if (this.data[key] === value)
			return;

		this.data[key] = value;
		this.modified.add(key);
		this.state = CharacterModification.MODIFIED;
	}
}
