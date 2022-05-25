import { GraphicsManager } from '../../assets/graphicsManager';
import { GraphicsScene } from '../../graphics/graphicsScene';
import { Observable } from '../../observable';
import { Editor } from '../editor';
import { ResultCharacter, SetupCharacter } from './character';

export const EditorShowBones = new Observable<boolean>(true);

export class EditorSetupScene extends GraphicsScene {
	public readonly setupCharacter: SetupCharacter;

	constructor(editor: Editor, graphicsManager: GraphicsManager) {
		super();
		this.setupCharacter = new SetupCharacter(editor);
		this.setupCharacter.setManager(graphicsManager);
		this.add(this.setupCharacter);
	}
}

export class EditorResultScene extends GraphicsScene {
	public readonly resultCharacter!: ResultCharacter;

	constructor(editor: Editor, graphicsManager: GraphicsManager) {
		super();
		this.resultCharacter = new ResultCharacter(editor);
		this.resultCharacter.setManager(graphicsManager);
		this.add(this.resultCharacter);
	}
}

