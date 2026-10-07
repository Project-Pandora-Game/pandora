import type { ReactElement, ReactNode } from 'react';
import { ExternalLink, UntrustedLink } from '../../../components/common/link/externalLink.tsx';
import { SpaceInviteEmbed, TryParseSpaceInviteUrl } from '../../screens/spaceJoin/inviteEmbed.tsx';

/**
 * A component for rendering a link and its embed in a profile or chat.
 */
export function RenderedLink({ url, text, textAfter }: {
	url: URL;
	text: string;
	/** Text after the link's text, but before embed */
	textAfter?: ReactNode;
}): ReactElement {
	const invite = TryParseSpaceInviteUrl(url);

	if (invite != null) {
		return (
			<>
				<ExternalLink href={ url.href }>
					{ text }
				</ExternalLink>
				{ textAfter }
				<SpaceInviteEmbed spaceId={ invite.spaceId } invite={ invite.invite } />
			</>
		);
	}

	return (
		<>
			<UntrustedLink href={ url.href }>
				{ text }
			</UntrustedLink>
			{ textAfter }
		</>
	);
}
