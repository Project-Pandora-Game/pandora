import React, { ReactElement, useState } from 'react';
import { useBrowserStorage } from '../../browserStorage';
import { ChildrenProps } from '../../common/reactTypes';
import { GAME_NAME } from '../../config/Environment';
import { Button } from '../common/button/button';
import { Column, Row } from '../common/container/container';
import pandoraLogo from '../../assets/icons/pandora.svg';
import { ModalDialog } from '../dialog/dialog';
import './eula.scss';
import { z } from 'zod';
import { ZodMatcher } from 'pandora-common';
import { Scrollbar } from '../common/scrollbar/scrollbar';

// ********************************
// Update both of these variables whenever you make any changes to EULA and/or Privacy Policy!
// ********************************
const EULA_VERSION = 1;
const EULA_LAST_UPDATED = 'March 04, 2023';

/**
 * Display the end user license agreement, with the option to accept it.
 */
export function Eula({ accept }: EulaProps): ReactElement {

	const [show, setShow] = useState(false);

	return (
		<div className='eula'>
			<Column padding='none' className='fill-y'>
				<div className='flex-1' />
				<div className='eula-header'>
					<img src={ pandoraLogo } alt='Pandora Logo' />
				</div>
				<div className='eula-text'>
					<p>
						Welcome to { GAME_NAME }! This game is intended for use by adults only.
					</p>
					<p>
						By playing this game, you agree to the following:
					</p>
					<ul>
						<li>
							I am at least 18 years old and I have the legal right to possess adult material in my local community, state and/or country.
						</li>
						<li>
							I will not permit any minors to have access to any of the materials from this site.
						</li>
						<li>
							I have read { GAME_NAME }'s <a onClick={ () => setShow(true) } >privacy policy</a> and accept it. (Last updated on: { EULA_LAST_UPDATED })
						</li>
						<li>
							I have carefully read the above and agree to all of them.
						</li>
					</ul>
				</div>
				<Row padding='normal' className='eula-buttons' alignX='space-evenly'>
					<Button onClick={ EulaDisagree }>Disagree</Button>
					<Button onClick={ accept }>Agree ‣‣</Button>
				</Row>
				<div className='flex-2' />
			</Column>
			{ show && <PolicyDialog
				hide={ () => setShow(false) }
			/> }
		</div>
	);
}

function PolicyDialog({ hide }: {
	hide: () => void;
}): ReactElement {
	return (
		<ModalDialog>
			<Scrollbar color='dark' className='policyDetails'>
				<h1>Privacy Policy</h1>
				<p>Last updated: { EULA_LAST_UPDATED }</p>
				<p>
					Upon your request and expression of consent,
					We collect the following data for the purpose of providing the Pandora Game Service to You.
					Your data is not used for purposes other than the ones mentioned in this policy and it is not shared with third parties.
					It is removed upon Your withdrawal of consent or Your request to terminate this Service.
				</p>
				<h2>Collecting and Using Your Personal Data</h2>
				<h3>What data do We collect?</h3>
				<h4>Personal Data</h4>
				<p>
					We only collect minimal personal data that enable Us to run Pandora. These are:
				</p>
				<ul>
					<li>
						Email Address: We store Your email address hashed (pseudonymized), so we are not able to see it and use it to contact you.
					</li>
					<li>
						Usage Data
					</li>
				</ul>
				<h4>Usage Data</h4>
				<p>Usage Data is collected automatically when using the Service.</p>
				<p>
					Usage Data may include information such as Your Device's Internet Protocol address (e.g. IP address), browser type, browser version,
					the pages of our Service that You visit, the time and date of Your visit, the time spent on those pages,
					unique device identifiers and other diagnostic data.
				</p>
				<p>
					It also includes data stored for certain features of Pandora, such as:
				</p>
				<ul>
					<li>
						Friendlist: We store the Pandora accounts You have friended and share Your online status in Pandora with them, when You consent to it.
					</li>
					<li>
						Direct/Private Messaging: We store the history of the direct messages You exchanged with other Pandora Accounts, but We store this data encrypted and are not able to see the contents of these messages.
					</li>
					<li>
						Profile & Settings: We store any Pandora related settings You set in Your account, such as room or item information, or profile information You saved such as relationships with other pandora characters or Your personal profile description / biography.
					</li>
				</ul>
				<h3>What do We use this data for?</h3>
				<p>We may use Personal Data for the following purposes:</p>
				<ul>
					<li>
						<strong>To provide and maintain Our Service</strong>, including to monitor the general usage of Our Service, mainly for security reasons.
					</li>
					<li>
						<strong>To manage Your Account:</strong> to manage Your registration as a user of the Service.
						The Personal Data You provide can give You access to different functionalities of the Service that are available to You as a registered user.
					</li>
					<li>
						<strong>To manage Your requests:</strong> To attend and manage Your requests to Us, e.g. submitting a forgotten password request.
					</li>
					<li>
						<strong>For other purposes</strong>: We may use Your information in an anonymized way for other purposes,
						such as data analysis, identifying usage trends, and to evaluate and improve our Service.
					</li>
				</ul>
				<p>We do not share Your personal information with third parties.</p>
				<h3>How do we store the data?</h3>
				<p>We will retain the aforementioned data potentially indefinitely so we can fulfill the purposes described in this Privacy Policy; typically for the lifetime of Your Pandora account.</p>
				<p>The server that stores the data is inside the European Union.</p>
				<h3>Cookies</h3>
				<p>When You visit our website, We may collect information from You automatically through cookies or similar technology.</p>
				<p>Cookies can be &quot;Persistent&quot; or &quot;Session&quot; Cookies. Persistent Cookies remain on Your personal computer or mobile device when You go offline, while Session Cookies are deleted as soon as You close Your web browser. We use both Session and Persistent Cookies for the purposes set out below:</p>
				<ul>
					<li>
						<p>
							<strong>Necessary / Essential Cookies</strong><br />
							Type: <i>Session Cookies</i>
						</p>
						<p>Purpose: These Cookies are essential to provide You with services available through the Website and to enable You to use some of its features. They help to authenticate users and prevent fraudulent use of user accounts.</p>
					</li>
					<li>
						<p>
							<strong>Acceptance Cookies</strong><br />
							Type: <i>Persistent Cookies</i>
						</p>
						<p>Purpose: These Cookies identify if You have accepted this Privacy Policy.</p>
					</li>
					<li>
						<p>
							<strong>Functionality Cookies</strong><br />
							Type: <i>Persistent Cookies</i>
						</p>
						<p>Purpose: These Cookies allow us to remember choices You make when You use the Website, such as remembering your login details. The purpose of these Cookies is to avoid You having to re-enter your preferences every time You use the Website.</p>
					</li>
				</ul>
				<h3>What are your data protection rights?</h3>
				<p>Our Service gives You the ability to delete your Account from within the Service, as well as self-manage most other data. Additionally, You are entitled to the following, unless this proves impossible (e.g. unclear identification) or involves disproportionate effort:</p>
				<ul>
					<li>
						<strong>The right to access</strong><br />
						You have the right to request from Us a digital copy of your Personal Data.
					</li>
					<li>
						<strong>The right to rectification</strong><br />
						You have the right to request that We correct any information You believe is inaccurate.
					</li>
					<li>
						<strong>The right to erasure</strong><br />
						You have the right to request that We erase Your Personal Data.
					</li>
					<li>
						<strong>The right to restrict processing</strong><br />
						You have the right to request that We restrict the processing of Your Personal Data.
					</li>
					<li>
						<strong>The right to object to processing</strong><br />
						You have the right to object to Our processing of Your Personal Data.
					</li>
					<li>
						<strong>The right to data portability</strong><br />
						You have the right to request that We transfer the data that we have collected to You, provided that Your request does not adversely affect the rights and freedoms of others.
					</li>
				</ul>
				<p>
					If You make a request, We have one month to respond to You.
					If You would like to exercise any of these rights, please contact Us (see further below).
				</p>
				<h3>Security of Your Personal Data</h3>
				<p>
					The security of Your Personal Data is important to Us,
					but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure.
					While We strive to use commercially acceptable means to protect Your Personal Data, We cannot guarantee its absolute security.
				</p>
				<h2>Links to Other Websites</h2>
				<p>
					Our Service may contain links to other websites that are not operated by Us.
					If You click on a third party link, You will be directed to that third party's site.
					Our privacy policy applies only to Our website, so if You click on a link to another website, You should read their privacy policy.
				</p>
				<p>
					We have no control over and assume no responsibility for the content, privacy policies or practices of any third party sites or services.
				</p>
				<h2>Changes to this Privacy Policy</h2>
				<p>
					We keep our privacy policy under regular review and place any updates on this web page.
				</p>
				<h2>Contact Us</h2>
				<p>
					You can contact us by any of the following methods:
				</p>
				<ul>
					<li>Using our Discord server: <a href='https://discord.gg/SHJMjEh9VH' rel='external nofollow noopener noreferrer' target='_blank'>https://discord.gg/SHJMjEh9VH</a></li>
					<li>Using the email address: <a href='mailto:support@project-pandora.com'>support@project-pandora.com</a></li>
				</ul>
			</Scrollbar>
			<Row padding='normal' className='policyDetails-button' alignX='center'>
				<Button onClick={ hide }>Close</Button>
			</Row>
		</ModalDialog>
	);
}

export function EulaGate({ children }: ChildrenProps): ReactElement {
	const [eula, setEula] = useBrowserStorage<number | undefined>('accepted-eula-version', undefined, ZodMatcher(z.number().optional()));

	if (!eula || eula < EULA_VERSION) {
		return (
			<div className='main'>
				<Eula accept={ () => setEula(EULA_VERSION) } />
			</div>
		);
	}

	return (
		<>
			{ children }
		</>
	);
}

type EulaProps = {
	accept: () => void;
};

function EulaDisagree() {
	history.back();
	setTimeout(() => {
		window.location.href = 'about:blank';
	}, 100);
}
