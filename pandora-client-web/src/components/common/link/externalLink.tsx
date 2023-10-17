import React, { ReactElement, ReactNode } from 'react';

export function ExternalLink({ href, children }: {
	href: string;
	children: ReactNode;
}): ReactElement {
	return (
		<a href={ href } target='_blank' referrerPolicy='no-referrer' rel='noopener noreferrer'>
			{ children }
		</a>
	);
}
