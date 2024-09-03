import { settings as PIXISettings } from 'pixi.js';

// PIXI plugins
import 'pixi.js/lib/unsafe-eval/init';

/**
 * This function applies global Pixi.js settings we need
 */
export function ConfigurePixiSettings(): void {
	// Prevent PIXI from caching remote textures itself (we have our own cache management)
	PIXISettings.STRICT_TEXTURE_CACHE = true;
}
