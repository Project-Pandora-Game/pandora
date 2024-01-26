import React, { ReactElement, ReactNode } from 'react';
import { z } from 'zod';
import { BrowserStorage } from '../../../browserStorage';
import { ModalDialog } from '../../dialog/dialog';
import { Button } from '../button/button';
import { Column, Row } from '../container/container';

function ExternalLinkImpl({ children, ...props }: Omit<React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>, 'target' | 'referrerPolicy' | 'rel'>, ref: React.ForwardedRef<HTMLAnchorElement>): ReactElement {
	return (
		<a { ...props } ref={ ref } target='_blank' referrerPolicy='no-referrer' rel='external noopener noreferrer nofollow'>
			{ children }
		</a>
	);
}

export const ExternalLink = React.forwardRef(ExternalLinkImpl);

const BASE_TRUSTED_DOMAINS: readonly string[] = ['project-pandora.com'];
const trustedDomains = BrowserStorage.create<string[]>('trustedDomains', [], z.array(z.string()));

function IsTrustedLink(href: string): boolean {
	const domain = new URL(href).hostname;

	for (const trusted of BASE_TRUSTED_DOMAINS) {
		if (domain === trusted || domain.endsWith('.' + trusted))
			return true;
	}

	return trustedDomains.value.includes(domain);
}

export function UntrustedLink({ href, children }: {
	href: string;
	children: ReactNode;
}): ReactElement {
	const [showWarning, setShowWarning] = React.useState(false);

	const onClick = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
		if (IsTrustedLink(href))
			return;

		event.preventDefault();
		event.stopPropagation();
		setShowWarning(true);
	}, [href]);

	return (
		<>
			<ExternalLink href={ href } onClick={ onClick }>
				{ children }
			</ExternalLink>
			{ showWarning && (<PromptUntrustedLink href={ href } setShowWarning={ setShowWarning } />) }
		</>
	);
}

function PromptUntrustedLink({ href, setShowWarning }: {
	href: string;
	setShowWarning: (value: boolean) => void;
}): ReactElement {
	const ref = React.useRef<HTMLAnchorElement>(null);

	const onOpen = () => {
		setShowWarning(false);
		ref.current?.click();
	};

	const onRemember = () => {
		const current = trustedDomains.value;
		if (!IsTrustedLink(href)) {
			trustedDomains.value = [...current, new URL(href).hostname];
		}
		onOpen();
	};

	return (
		<ModalDialog>
			<Column alignX='center'>
				<h1>Untrusted link</h1>
				<p>
					<ExternalLink ref={ ref } href={ href } onClick={ () => setShowWarning(false) }>{ href }</ExternalLink>
				</p>
				<p>
					You are about to open a link to <b>{ new URL(href).hostname }</b> which is not a trusted domain.
				</p>
				<p>
					Are you sure you want to open this link?
				</p>
				<Row>
					<Button onClick={ () => setShowWarning(false) }>Cancel</Button>
					<Button onClick={ onOpen }>Open link</Button>
					<Button onClick={ onRemember }>Open and remember my choice</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}
