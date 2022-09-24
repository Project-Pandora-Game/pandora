import { CharacterSize } from 'pandora-common';
import { Graphics } from 'pixi.js';
import { GraphicsScene } from '../../graphics/graphicsScene';
import { Editor } from '../editor';
import { ResultCharacter, SetupCharacter } from './character';
import { GraphicsCharacterEditor } from './character/editorCharacter';
import { ImageExporter } from './export/imageExporter';

export abstract class EditorScene extends GraphicsScene {
	public readonly abstract character: GraphicsCharacterEditor;

	constructor(editor: Editor) {
		super();
		this.container
			.drag({ clampWheel: true })
			.wheel({ smooth: 10, percent: 0.1 })
			.pinch({ noDrag: false, percent: 2 })
			.decelerate({ friction: 0.7 });

		const border = this.container.addChild(new Graphics());
		border.zIndex = 2;
		border.clear().lineStyle(2, 0x404040).drawRect(0, 0, CharacterSize.WIDTH, CharacterSize.HEIGHT);

		this.cleanupCalls.push(editor.backgroundColor.subscribe((value) => {
			this.setBackground(`#${value.toString(16)}`);
		}));
		this.setBackground(`#${editor.backgroundColor.value.toString(16)}`);

		const getCenter = () => this.container.center;

		const setAstarget = () => {
			editor.getCenter.value = getCenter;
		};
		this.cleanupCalls.push(() => {
			if (editor.getCenter.value === getCenter) {
				const { x, y } = this.container.center;
				editor.getCenter.value = () => ({ x, y });
			}
		});

		this.container.on('mousedown', setAstarget);
		this.cleanupCalls.push(() => this.container.off('mousedown', setAstarget));
	}

	public exportImage(): void {
		const exporter = new ImageExporter();
		const result = exporter.characterCut(this.character, {
			x: 0,
			y: 0,
			height: CharacterSize.HEIGHT,
			width: CharacterSize.WIDTH,
		}, 'png');

		const link = document.createElement('a');
		link.href = result;
		link.download = `export.png`;
		link.style.display = 'none';
		document.body.appendChild(link);
		link.click();
		link.remove();
	}
}

export class EditorSetupScene extends EditorScene {
	public readonly character: SetupCharacter;

	constructor(editor: Editor) {
		super(editor);
		this.character = new SetupCharacter(editor, this.renderer);
		this.character.useGraphics(editor.getAssetGraphicsById.bind(editor));
		this.add(this.character);
	}
}

export class EditorResultScene extends EditorScene {
	public readonly character: ResultCharacter;

	constructor(editor: Editor) {
		super(editor);
		this.character = new ResultCharacter(editor, this.renderer);
		this.character.useGraphics(editor.getAssetGraphicsById.bind(editor));
		this.add(this.character);
	}
}
