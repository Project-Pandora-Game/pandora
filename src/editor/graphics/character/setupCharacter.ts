import { Character } from '../../../character/character';
import { Draggable } from '../draggable';
import { SetupLayer } from '../layer';
import { EditorCharacter } from './editorCharacter';

export class SetupCharacter extends EditorCharacter {
	constructor(character: Character) {
		super(character);
		this._addBones();
	}

	protected override createLayer = SetupLayer.create;

	private _addBones(): void {
		for (const bone of this.observableBones) {
			if (bone.x === 0 && bone.y === 0)
				continue;

			const draggable = new Draggable({
				setPos: (sprite, x, y) => {
					sprite.x = bone.x = x;
					sprite.y = bone.y = y;
				},
			});

			draggable.x = bone.x;
			draggable.y = bone.y;
			this.boneLayer.addChild(draggable);
		}
	}
}
