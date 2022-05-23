import { Container } from 'pixi.js';
import { Character } from '../../../character/character';
import { GraphicsCharacter } from '../../../graphics/graphicsCharacter';
import { EditorShowBones } from '../editorScene';
import { ObservableBone } from '../observable';

export class EditorCharacter extends GraphicsCharacter {
	protected readonly boneLayer = new Container;
	public get observableBones(): ObservableBone[] {
		return this.bones as ObservableBone[];
	}

	protected constructor(character: Character) {
		super(character);
		this.addChild(this.boneLayer).zIndex = 11;
		const cleanup: (() => void)[] = [];
		cleanup.push(EditorShowBones.subscribe((show) => {
			this.boneLayer.visible = show;
		}));
		this.observableBones.forEach((bone) => {
			bone.onAny(() => {
				this.layerUpdate(new Set([bone.name]));
			});
		});
		this.on('destroy', () => cleanup.forEach((c) => c()));
	}
}
