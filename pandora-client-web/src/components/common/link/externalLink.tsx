import React, { ReactElement, ReactNode } from 'react';

export function ExternalLink({ href, children }: {
	href: string;
	children: ReactNode;
}): ReactElement {
	return (
		<a href={ href } target='_blank' referrerPolicy='no-referrer' rel='external noopener noreferrer nofollow'>
			{ children }
		</a>
	);
}
