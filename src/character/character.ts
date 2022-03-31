import type { ICharacterData } from 'pandora-common';
import { ObservableSet } from '../observable';

export class Character extends ObservableSet<CharacterEvents> {
	private _data!: ICharacterData;
	public get data(): Readonly<ICharacterData> {
		return this._data;
	}

	public load(data: ICharacterData): void {
		this._data = { ...data };
		this.dispatch('load', data);
	}

	public update(data: Partial<ICharacterData>): void {
		this._data = { ...this._data, ...data };
		this.dispatch('update', data);
	}
}

type CharacterEvents = {
	'load': ICharacterData;
	'update': Partial<ICharacterData>;
};
