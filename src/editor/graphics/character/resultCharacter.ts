import { AppearanceChangeType } from 'pandora-common';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { GetAssetManager } from '../../../assets/assetManager';
import { GraphicsLayer } from '../../../graphics/graphicsLayer';
import { Editor } from '../../editor';
import { DraggableBone } from '../draggable';
import { ResultLayer } from '../layer';
import { GraphicsCharacterEditor } from './editorCharacter';

export class ResultCharacter extends GraphicsCharacterEditor {
	constructor(editor: Editor) {
		super(editor);
		this._addBones();
	}

	protected override createLayer(layer: AssetGraphicsLayer): GraphicsLayer {
		return new ResultLayer(layer, this);
	}

	protected override update(changes: AppearanceChangeType[]): void {
		super.update(changes);
		if (changes.includes('pose')) {
			for (const bone of this._draggableBones) {
				bone.setRotation(this.getBone(bone.definition.name).rotation);
			}
		}
	}

	private _draggableBones: DraggableBone[] = [];
	private _addBones(): void {
		for (const bone of GetAssetManager().getAllBones()) {
			if (bone.x === 0 || bone.y === 0)
				continue;

			const draggableBone = new DraggableBone(this, bone, true);
			this._draggableBones.push(draggableBone);
			this.boneLayer.addChild(draggableBone.draggable);
		}
	}
}
