import { CharacterSize } from 'pandora-common';
import { Container } from 'pixi.js';
import { Character } from '../../../character/character';
import { GraphicsCharacter } from '../../../graphics/graphicsCharacter';
import { EditorScene } from '../editorScene';
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
		cleanup.push(EditorScene.showBones.subscribe((show) => {
			this.boneLayer.visible = show;
		}));
		this.observableBones.forEach((bone) => {
			bone.onAny(() => {
				this.layerUpdate(new Set([bone.name]));
			});
		});
		const onresize = () => this.onWindowResize();
		window.addEventListener('resize', onresize);
		cleanup.push(() => window.removeEventListener('resize', onresize));
		cleanup.push(EditorScene.on('resize', onresize));
		this.on('destroy', () => cleanup.forEach((c) => c()));
	}

	protected onWindowResize(): void {
		const xscale = (EditorScene.width / 2) / CharacterSize.WIDTH;
		const yscale = EditorScene.height / CharacterSize.HEIGHT;
		const scale = Math.min(xscale, yscale);
		this.scale.set(scale);
		this.y = EditorScene.height / 2 - CharacterSize.HEIGHT * scale / 2;
	}
}
