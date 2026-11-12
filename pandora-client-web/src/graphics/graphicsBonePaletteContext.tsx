import type { CharacterPoseTransforms } from 'pandora-common';
import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import { GraphicsBonePalette } from './graphicsBonePalette.ts';
import { GraphicsMaskScopeContext } from './graphicsMaskScope.tsx';

const BonePaletteContext = createContext<{ evaluator: CharacterPoseTransforms; palette: GraphicsBonePalette; } | null>(null);

export function GraphicsBonePaletteProvider({ evaluator, children }: { evaluator: CharacterPoseTransforms; children: ReactNode; }): ReactElement {
	// Shaders retain/release the buffer. The provider holds only this stable owner,
	// so interrupted renders and React effect replay do not acquire GPU resources.
	const palette = useMemo(() => new GraphicsBonePalette(), []);
	const value = useMemo(() => ({ evaluator, palette }), [evaluator, palette]);
	return (
		<BonePaletteContext.Provider value={ value }>
			<GraphicsMaskScopeContext.Provider value={ palette }>{ children }</GraphicsMaskScopeContext.Provider>
		</BonePaletteContext.Provider>
	);
}

export function useGraphicsBonePalette(evaluator: CharacterPoseTransforms): GraphicsBonePalette | undefined {
	const shared = useContext(BonePaletteContext);
	// UV-pose previews or nested renderers can use a different evaluator; they
	// require their own palette rather than overwriting the character's pose.
	return shared?.evaluator === evaluator ? shared.palette : undefined;
}
