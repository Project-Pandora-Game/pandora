import { ICharacterData } from 'pandora-common';
import { Character } from '../../character/character';
import { GraphicsScene } from '../../graphics/graphicsScene';
import { Observable } from '../../observable';
import { ResultCharacter, SetupCharacter } from './character';

export const EditorScene = new class EditorScene extends GraphicsScene {
	private _setupCharacter!: SetupCharacter;
	private _resultCharacter!: ResultCharacter;
	readonly showBones = new Observable<boolean>(true);

	get setupCharacter(): SetupCharacter {
		return this._setupCharacter;
	}

	get resultCharacter(): ResultCharacter {
		return this._resultCharacter;
	}

	init() {
		this._setupCharacter = new SetupCharacter(EditorCharacter);
		this.add(this._setupCharacter);
		this._resultCharacter = new ResultCharacter(EditorCharacter);
		this.add(this._resultCharacter);

		EditorCharacter.update({
			assets: [{ id: 'a/base/body' }],
		});
	}
};

export const EditorCharacter = new Character<ICharacterData>({
	inCreation: true,
	id: 'c1',
	accountId: 1,
	name: 'Editor',
	created: -1,
	accessId: '------',
	bones: [
		['arm_r', 75],
		['arm_l', -75],
		['elbow_r', 100],
		['elbow_l', -10],
	],
	assets: [],
});
