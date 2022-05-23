import { Character } from '../../../character/character';
import { ResultLayer } from '../layer';
import { EditorCharacter } from './editorCharacter';

export class ResultCharacter extends EditorCharacter {
	constructor(character: Character) {
		super(character);
		this._addBones();
	}

	protected override createLayer = ResultLayer.create;

	private _addBones(): void {
		for (const bone of this.observableBones) {
			if (bone.x === 0 && bone.y === 0)
				continue;

			// TODO: implement draggable rotation
		}
	}
}
