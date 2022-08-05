import { CharacterSize } from 'pandora-common';
import { Graphics, Rectangle } from 'pixi.js';
import { GraphicsScene } from '../../graphics/graphicsScene';
import { Editor } from '../editor';
import { ResultCharacter, SetupCharacter } from './character';

class EditorScene extends GraphicsScene {
	constructor() {
		super();
		this.container
			.drag({ clampWheel: true })
			.wheel({ smooth: 10, percent: 0.1 })
			.bounce({
				ease: 'easeOutQuad',
				friction: 0,
				sides: 'all',
				time: 500,
				underflow: 'center',
				bounceBox: new Rectangle(-20, -20, CharacterSize.WIDTH + 20, CharacterSize.HEIGHT + 20),
			})
			.pinch({ noDrag: false, percent: 2 })
			.decelerate({ friction: 0.7 });

		const border = this.container.addChild(new Graphics());
		border.zIndex = 2;
		border.clear().lineStyle(2, 0x404040).drawRect(0, 0, CharacterSize.WIDTH, CharacterSize.HEIGHT);
	}
}

export class EditorSetupScene extends EditorScene {
	public readonly setupCharacter: SetupCharacter;

	constructor(editor: Editor) {
		super();
		this.setupCharacter = new SetupCharacter(editor);
		this.setupCharacter.useGraphics(editor.getAssetGraphicsById.bind(editor));
		this.add(this.setupCharacter);
	}
}

export class EditorResultScene extends EditorScene {
	public readonly resultCharacter!: ResultCharacter;

	constructor(editor: Editor) {
		super();
		this.resultCharacter = new ResultCharacter(editor);
		this.resultCharacter.useGraphics(editor.getAssetGraphicsById.bind(editor));
		this.add(this.resultCharacter);
	}
}
