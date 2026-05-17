import { ComponentType } from 'react';
import { WikiCharacters } from './pages/characters.tsx';
import { WikiChat } from './pages/chat.tsx';
import { WikiContact } from './pages/contact.tsx';
import { WikiHistory } from './pages/history.tsx';
import { WikiIntroduction } from './pages/intro.tsx';
import { WikiItems } from './pages/items.tsx';
import { WikiNew } from './pages/new.tsx';
import { WikiSafety } from './pages/safety.tsx';
import { WikiSpaces } from './pages/spaces.tsx';

export interface WikiPageEntry {
	pageName: string;
	urlChunk: string;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	Component: ComponentType;
}

export const WIKI_PAGES: WikiPageEntry[] = [
	{ pageName: 'Introduction', urlChunk: 'introduction', Component: WikiIntroduction },
	{ pageName: 'New User Guide', urlChunk: 'new', Component: WikiNew },
	{ pageName: 'Chat', urlChunk: 'chat', Component: WikiChat },
	{ pageName: 'Spaces', urlChunk: 'spaces', Component: WikiSpaces },
	{ pageName: 'Items', urlChunk: 'items', Component: WikiItems },
	{ pageName: 'Characters', urlChunk: 'characters', Component: WikiCharacters },
	{ pageName: 'Safety', urlChunk: 'safety', Component: WikiSafety },
	{ pageName: 'Pandora History', urlChunk: 'history', Component: WikiHistory },
	{ pageName: 'Contact', urlChunk: 'contact', Component: WikiContact },
];
