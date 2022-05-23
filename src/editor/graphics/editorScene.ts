import { ICharacterData } from 'pandora-common';
import { Character } from '../../character/character';
import { GraphicsScene } from '../../graphics/graphicsScene';
import { Observable } from '../../observable';
import { ResultCharacter, SetupCharacter } from './character';

export const EditorShowBones = new Observable<boolean>(true);

export class EditorSetupScene extends GraphicsScene {
	public readonly setupCharacter: SetupCharacter;

	constructor() {
		super();
		this.setupCharacter = new SetupCharacter(EditorCharacter);
		this.add(this.setupCharacter);
	}
}

export class EditorResultScene extends GraphicsScene {
	public readonly resultCharacter!: ResultCharacter;

	constructor() {
		super();
		this.resultCharacter = new ResultCharacter(EditorCharacter);
		this.add(this.resultCharacter);
	}
}

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
