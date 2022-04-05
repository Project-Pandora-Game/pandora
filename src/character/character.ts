import type { ICharacterData } from 'pandora-common';
import { TypedEventEmitter } from '../event';

export class Character extends TypedEventEmitter<CharacterEvents> {
	private _data!: ICharacterData;
	public get data(): Readonly<ICharacterData> {
		return this._data;
	}

	public load(data: ICharacterData): void {
		this._data = { ...data };
		this.emit('load', data);
	}

	public update(data: Partial<ICharacterData>): void {
		this._data = { ...this._data, ...data };
		this.emit('update', data);
	}
}

type CharacterEvents = {
	'load': ICharacterData;
	'update': Partial<ICharacterData>;
};
