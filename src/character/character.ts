import { Appearance, APPEARANCE_BUNDLE_DEFAULT, GetLogger, ICharacterPublicData, Logger } from 'pandora-common';
import { useEffect, useState } from 'react';
import { GetAssetManager } from '../assets/assetManager';
import { TypedEventEmitter } from '../event';

export class Character<T extends ICharacterPublicData = ICharacterPublicData> extends TypedEventEmitter<CharacterEvents<T>> {
	public appearance: Appearance = new Appearance(GetAssetManager());

	protected readonly logger: Logger;

	protected _data: T;
	public get data(): Readonly<T> {
		return this._data;
	}

	constructor(data: T, logger?: Logger) {
		super();
		this.logger = logger ?? GetLogger('Character', `[Character ${data.id}]`);
		this._data = data;
		this.appearance = new Appearance(GetAssetManager());
		this.appearance.importFromBundle(data.appearance ?? APPEARANCE_BUNDLE_DEFAULT, this.logger.prefixMessages('Appearance load:'));
		this.logger.verbose('Loaded');
	}

	public update(data: Partial<T>): void {
		this._data = { ...this.data, ...data };
		if (data.appearance) {
			this.appearance = new Appearance(GetAssetManager());
			this.appearance.importFromBundle(data.appearance ?? APPEARANCE_BUNDLE_DEFAULT, this.logger.prefixMessages('Appearance load:'));
		}
		this.logger.debug('Updated', data);
		this.emit('update', data);
	}
}

type CharacterEvents<T extends ICharacterPublicData> = {
	'update': Partial<T>;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export function useCharacterData<T extends ICharacterPublicData>(character: Character<T>): Readonly<T> {
	const [data, setData] = useState<Readonly<T>>(character.data);
	useEffect(() => {
		setData(character.data);
		return character.onAny((ev) => {
			if (ev.update) {
				setData(character.data);
			}
		});
	}, [character]);
	return data;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function useCharacterAppearance(character: Character): Appearance | null {
	const [data, setData] = useState<Appearance | null>(character.appearance);
	useEffect(() => {
		setData(character.appearance);
		return character.onAny((ev) => {
			if (ev.update) {
				setData(character.appearance);
			}
		});
	}, [character]);
	return data;
}
