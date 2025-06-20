import { SpaceIdSchema } from 'pandora-common';
import type { ReactElement } from 'react';
import { ExternalLink, UntrustedLink } from '../../../components/common/link/externalLink.tsx';
import { SpaceInviteEmbed } from '../../screens/spaceJoin/inviteEmbed.tsx';

const INVITE_PREFIX = '/space/join/';
/**
 * A component for rendering a link and its embed in a profile or chat.
 */
export function RenderedLink({ url, index }: { url: URL; index: number; }): ReactElement {
	switch (url.hostname) {
		case 'project-pandora.com':
		case 'www.project-pandora.com':
			if (url.pathname.startsWith(INVITE_PREFIX)) {
				const invite = url.searchParams.get('invite') ?? undefined;
				let spaceId: string | undefined;
				try {
					spaceId = decodeURIComponent(url.pathname.slice(INVITE_PREFIX.length));
				} catch (_error) {
					// Ignore decoding errors silently
					spaceId = undefined;
				}
				if (spaceId && !spaceId.startsWith('s/')) {
					spaceId = 's/' + spaceId;
				}
				const parsedSpaceId = SpaceIdSchema.safeParse(spaceId);
				if (!parsedSpaceId.success)
					break;

				return (
					<>
						<ExternalLink href={ url.href }>
							{ url.href }
						</ExternalLink>
						<SpaceInviteEmbed key={ index } spaceId={ parsedSpaceId.data } invite={ invite } />
					</>
				);
			}
			break;
	}
	return (
		<UntrustedLink key={ index } href={ url.href }>
			{ url.href }
		</UntrustedLink>
	);
}
