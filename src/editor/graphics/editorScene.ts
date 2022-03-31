import { GraphicsScene } from '../../graphics/graphicsScene';
import { Observable } from '../../observable';

export class EditorScene extends GraphicsScene {
	readonly showBones = new Observable<boolean>(true);
}
