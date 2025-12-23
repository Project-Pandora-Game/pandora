import type { Immutable } from 'immer';
import type { IChatSegment } from 'pandora-common';
import type { ReactElement } from 'react';
import { RenderedLink } from './links.tsx';

export function RenderChatPart([type, contents]: Immutable<IChatSegment>, index: number, allowLinkInNormal: boolean): ReactElement {
	if (type === 'normal' && allowLinkInNormal && (/^https?:\/\//.exec(contents)) && URL.canParse(contents)) {
		const url = new URL(contents);
		return (
			<RenderedLink key={ index } index={ index } url={ url } />
		);
	}
	switch (type) {
		case 'normal':
			return <span key={ index }>{ contents }</span>;
		case 'italic':
			return <em key={ index }>{ contents }</em>;
		case 'bold':
			return <strong key={ index }>{ contents }</strong>;
	}
}

export function RenderChatPartToString([type, contents]: Immutable<IChatSegment>, allowLinkInNormal: boolean): string {
	if (type === 'normal' && allowLinkInNormal && (/^https?:\/\//.exec(contents)) && URL.canParse(contents)) {
		const url = new URL(contents);
		return url.href;
	}
	return contents;
}
