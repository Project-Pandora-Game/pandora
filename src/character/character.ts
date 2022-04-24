import type { ICharacterData } from 'pandora-common';
import { useEffect, useMemo, useState } from 'react';
import { TypedEventEmitter } from '../event';

export class Character extends TypedEventEmitter<CharacterEvents> {
	protected _data: ICharacterData | undefined;
	public get data(): Readonly<ICharacterData> {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return this._data!;
	}
	public get loaded(): boolean {
		return this._data != null;
	}

	public load(data: ICharacterData): void {
		this._data = { ...data };
		this.emit('load', data);
	}

	public update(data: Partial<ICharacterData>): void {
		this._data = { ...this.data, ...data };
		this.emit('update', data);
	}
}

type CharacterEvents = {
	'load': ICharacterData;
	'update': Partial<ICharacterData>;
	'unload': void;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export function useCharacterData(character: Character): Readonly<ICharacterData> | null {
	const getData = useMemo(() => (() => character.loaded ? character.data : null), [character]);
	const [data, setData] = useState<Readonly<ICharacterData> | null>(getData);
	useEffect(() => {
		setData(getData());
		return character.onAny((ev) => {
			if (ev.load || ev.update || ev.unload) {
				setData(getData());
			}
		});
	}, [character, getData]);
	return data;
}
