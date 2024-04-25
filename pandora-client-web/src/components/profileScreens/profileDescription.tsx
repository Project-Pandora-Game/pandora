import type { ReactElement } from 'react';
import { SpaceInviteEmbed } from '../../ui/screens/spaceJoin/spaceJoin';
import { UntrustedLink } from '../common/link/externalLink';
import React from 'react';

export function ProfileDescriptionLine({ line, index }: { line: string; index: number; }): ReactElement {
	if (line.match(/^https?:\/\//)) {
		const url = new URL(line);
		switch (url.hostname) {
			case 'project-pandora.com':
			case 'www.project-pandora.com':
				if (url.pathname.startsWith('/space/join/')) {
					const invite = url.searchParams.get('invite') ?? undefined;
					const spaceId = url.pathname.split('/').pop();
					if (!spaceId)
						break;

					return <SpaceInviteEmbed key={ index } spaceId={ spaceId } invite={ invite } />;
				}
				break;
		}
		return (
			<UntrustedLink key={ index } href={ line }>
				{ line }
			</UntrustedLink>
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
