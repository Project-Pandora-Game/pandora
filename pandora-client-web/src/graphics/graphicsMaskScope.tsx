import { createContext } from 'react';

/** Exact raster sharing stays within a character's live masks. */
export const GraphicsMaskScopeContext = createContext<object | undefined>(undefined);
