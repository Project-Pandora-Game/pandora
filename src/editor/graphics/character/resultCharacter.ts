import { Editor } from '../../editor';
import { ResultLayer } from '../layer';
import { GraphicsCharacterEditor } from './editorCharacter';

export class ResultCharacter extends GraphicsCharacterEditor {
	constructor(editor: Editor) {
		super(editor);
		this._addBones();
	}

	protected override createLayer = ResultLayer.create;

	private _addBones(): void {
		for (const bone of this.appearanceContainer.appearance.getFullPose()) {
			if (bone.definition.x === 0 && bone.definition.y === 0)
				continue;

			// TODO: implement draggable rotation
		}
	}
}
