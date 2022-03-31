import { Container } from 'pixi.js';
import { Character } from '../../../character/character';
import { GraphicsCharacter } from '../../../graphics/graphicsCharacter';
import { EditorScene } from '../editorScene';
import { ObservableBone } from '../observable';

export class EditorCharacter extends GraphicsCharacter {
	protected readonly editor: EditorScene;
	protected readonly boneLayer = new Container;
	public get observableBones(): ObservableBone[] {
		return this.bones as ObservableBone[];
	}

	protected constructor(editor: EditorScene, character: Character) {
		super(character);
		this.editor = editor;
		this.addChild(this.boneLayer).zIndex = 11;
		const cleanup: (() => void)[] = [];
		cleanup.push(editor.showBones.subscribe((show) => {
			this.boneLayer.visible = show;
		}));
		this.observableBones.forEach((bone) => {
			bone.subscribeAll(() => {
				this.layerUpdate(new Set([bone.name]));
			});
		});
		const onresize = () => this.onWindowResize();
		window.addEventListener('resize', onresize);
		cleanup.push(() => window.removeEventListener('resize', onresize));
		cleanup.push(editor.subscribe('resize', onresize));
		this.on('destroy', () => cleanup.forEach((c) => c()));
	}

	protected onWindowResize(): void {
		const xscale = (this.editor.width / 2) / GraphicsCharacter.WIDTH;
		const yscale = this.editor.height / GraphicsCharacter.HEIGHT;
		const scale = Math.min(xscale, yscale);
		this.scale.set(scale);
		this.y = this.editor.height / 2 - GraphicsCharacter.HEIGHT * scale / 2;
	}
}
