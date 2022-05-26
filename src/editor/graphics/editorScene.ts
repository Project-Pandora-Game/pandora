import { GraphicsScene } from '../../graphics/graphicsScene';
import { Editor } from '../editor';
import { ResultCharacter, SetupCharacter } from './character';

export class EditorSetupScene extends GraphicsScene {
	public readonly setupCharacter: SetupCharacter;

	constructor(editor: Editor) {
		super();
		this.setupCharacter = new SetupCharacter(editor);
		this.setupCharacter.useGraphics(editor.getAssetGraphicsById.bind(editor));
		this.add(this.setupCharacter);
	}
}

export class EditorResultScene extends GraphicsScene {
	public readonly resultCharacter!: ResultCharacter;

	constructor(editor: Editor) {
		super();
		this.resultCharacter = new ResultCharacter(editor);
		this.resultCharacter.useGraphics(editor.getAssetGraphicsById.bind(editor));
		this.add(this.resultCharacter);
	}
}

