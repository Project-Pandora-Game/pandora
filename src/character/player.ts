import type { ICharacterData } from 'pandora-common';
import { GetLogger } from 'pandora-common/dist/logging';

const logger = GetLogger('Player');

export default new class Player extends EventTarget {
	private _data!: ICharacterData;
	public get data(): Readonly<ICharacterData> {
		return this._data;
	}

	public load(data: ICharacterData): void {
		this._data = data;
		logger.debug('Loaded player data', data);
		this.dispatchEvent(new CustomEvent('load', { detail: data }));
	}

	public update(data: Partial<ICharacterData>): void {
		this._data = { ...this._data, ...data };
		logger.debug('Updated player data', data);
		this.dispatchEvent(new CustomEvent('update', { detail: data }));
	}
};
