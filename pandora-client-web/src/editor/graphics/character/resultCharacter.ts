import { AppearanceChangeType, Item } from 'pandora-common';
import { AbstractRenderer } from 'pixi.js';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { GetAssetManager } from '../../../assets/assetManager';
import { GraphicsLayer } from '../../../graphics/graphicsLayer';
import { Editor } from '../../editor';
import { DraggableBone } from '../draggable';
import { ResultLayer } from '../layer';
import { GraphicsCharacterEditor } from './editorCharacter';

export class ResultCharacter extends GraphicsCharacterEditor {
	constructor(editor: Editor, renderer: AbstractRenderer) {
		super(editor, renderer);
		this._addBones();
	}

	protected override createLayer(layer: AssetGraphicsLayer, item: Item | null): GraphicsLayer {
		return new ResultLayer(layer, this, item);
	}

	protected override update(changes: AppearanceChangeType[]): void {
		super.update(changes);
		if (changes.includes('pose')) {
			for (const bone of this._draggableBones) {
				bone.setRotation(this.getBoneLikeValue(bone.definition.name));
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
