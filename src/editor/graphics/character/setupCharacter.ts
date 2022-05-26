import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { GraphicsLayer } from '../../../graphics/graphicsLayer';
import { Editor } from '../../editor';
import { Draggable } from '../draggable';
import { SetupLayer } from '../layer';
import { GraphicsCharacterEditor } from './editorCharacter';

export class SetupCharacter extends GraphicsCharacterEditor {
	constructor(editor: Editor) {
		super(editor);
		this._addBones();
	}

	protected override createLayer(layer: AssetGraphicsLayer): GraphicsLayer {
		return new SetupLayer(layer, this);
	}

	private _addBones(): void {
		for (const bone of this.appearanceContainer.appearance.getFullPose()) {
			if (bone.definition.x === 0 && bone.definition.y === 0)
				continue;

			const draggable = new Draggable({
				setPos: (sprite, x, y) => {
					sprite.x = bone.definition.x = x;
					sprite.y = bone.definition.y = y;
				},
			});

			draggable.x = bone.definition.x;
			draggable.y = bone.definition.y;
			this.boneLayer.addChild(draggable);
		}
	}
}
