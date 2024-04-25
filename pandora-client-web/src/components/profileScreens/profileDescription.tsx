import type { ReactElement } from 'react';
import { RenderedLink } from '../../ui/screens/spaceJoin/spaceJoin';
import React from 'react';

export function ProfileDescriptionLine({ line, index }: { line: string; index: number; }): ReactElement {
	if (line.match(/^https?:\/\//)) {
		const url = new URL(line);
		return (
			<RenderedLink key={ index } index={ index } url={ url } />
		);
	}
	if (line.length === 0) {
		// Keep single space for empty lines to preserve line-breaks.
		return (
			<span key={ index }> </span>
		);
	}
	return (
		<span key={ index }>{ line }</span>
	);
}
