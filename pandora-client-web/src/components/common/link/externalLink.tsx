import React, { ReactElement, ReactNode } from 'react';
import * as z from 'zod';
import { BrowserStorage } from '../../../browserStorage.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { ModalDialog } from '../../dialog/dialog.tsx';
import { Button } from '../button/button.tsx';
import { Column, Row } from '../container/container.tsx';

export type ExternalLinkProps = Omit<React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>, 'target' | 'referrerPolicy' | 'rel'> & {
	/**
	 * Whether to send referrer
	 * @default false
	 */
	sendReferrer?: boolean;
};

function ExternalLinkImpl({ children, sendReferrer = false, ...props }: ExternalLinkProps, ref: React.ForwardedRef<HTMLAnchorElement>): ReactElement {
	return (
		<a
			{ ...props }
			ref={ ref }
			target='_blank'
			referrerPolicy={ sendReferrer ? 'origin' : 'no-referrer' }
			rel={ sendReferrer ? 'external noopener nofollow' : 'external noopener noreferrer nofollow' }
		>
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
			{ showWarning && (<PromptUntrustedLink href={ href } close={ () => setShowWarning(false) } />) }
		</>
	);
}

function PromptUntrustedLink({ href, close }: {
	href: string;
	close: () => void;
}): ReactElement {
	const ref = React.useRef<HTMLAnchorElement>(null);
	const [remember, setRemember] = React.useState(false);

	const parsedLink = new URL(href);

	const onOpen = () => {
		ref.current?.click();
		if (remember && !IsTrustedLink(href)) {
			trustedDomains.produceImmer((v) => {
				v.push(parsedLink.hostname);
			});
		}
		close();
	};

	return (
		<ModalDialog>
			<Column alignX='center'>
				<h1>Untrusted link</h1>
				<ExternalLink ref={ ref } href={ href } style={ { display: 'none' } }>{ href }</ExternalLink>
				<p>
					You are about to open a link to <b>{ parsedLink.hostname }</b>.
				</p>
				<textarea
					value={ href }
					readOnly
					className='fill-x'
					rows={ 5 }
					style={ { resize: 'none', wordBreak: 'break-all' } }
				/>
				<p>
					Are you sure you want to open this link?
				</p>
				<p>
					<label>
						<Checkbox
							checked={ remember }
							onChange={ setRemember }
						/>
						Trust links to <b>{ parsedLink.hostname }</b> in the future
					</label>
				</p>
				<Row alignX='space-between' className='fill-x'>
					<Button onClick={ close }>Cancel</Button>
					<Button onClick={ onOpen }>Open link</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}
