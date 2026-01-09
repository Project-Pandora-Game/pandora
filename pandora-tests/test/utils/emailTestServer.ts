import { expect } from '@playwright/test';
import express, { Router } from 'express';
import { simpleParser, type ParsedMail } from 'mailparser';
import { Assert, CreateManuallyResolvedPromise, type ManuallyResolvedPromise } from 'pandora-common';

export const PANDORA_GAME_EMAIL = 'game@project-pandora.com';

export class TestEmailServer {
	public readonly router: Router;

	private _expectingMail: ManuallyResolvedPromise<ParsedMail> | undefined;

	public expectEmail(): Promise<ParsedMail> {
		expect(this._expectingMail).toBeUndefined();

		this._expectingMail = CreateManuallyResolvedPromise();
		return this._expectingMail.promise;
	}

	public async expectEmailFromPandora(): Promise<ParsedMail> {
		const email = await this.expectEmail();

		expect(email.from).toBeDefined();
		Assert(email.from != null);
		expect(email.from.text).toBe(PANDORA_GAME_EMAIL);
		expect(email.from.value).toHaveLength(1);
		expect(email.from.value[0].address).toBe(PANDORA_GAME_EMAIL);

		return email;
	}

	public async expectRegistrationEmail(toAddress: string): Promise<{ username: string; code: string; }> {
		const email = await this.expectEmail();

		const to = Array.isArray(email.to) ? email.to : email.to ? [email.to] : [];
		expect(to).toHaveLength(1);
		expect(to[0].value).toHaveLength(1);
		expect(to[0].value[0].address).toBe(toAddress);

		expect(email.text).toBeDefined();
		Assert(email.text != null);

		const usernameMatch = /Hello ([^\n]+),\n/.exec(email.text);
		Assert(usernameMatch != null, 'Username phrase not found in email');

		const codeMatch = /Please enter the following token to confirm your registration: ([^\n]+)\n/.exec(email.text);
		Assert(codeMatch != null, 'Code phrase not found in email');

		return {
			username: usernameMatch[1],
			code: codeMatch[1],
		};
	}

	constructor() {
		this.router = Router();

		this.router.route('/send_email')
			.post(
				express.raw({ type: 'message/rfc822' }),
				async (req, res) => {
					expect(req.body).toBeInstanceOf(Buffer);
					Assert(req.body instanceof Buffer);

					res.sendStatus(204);

					const email = await simpleParser(req.body);

					const expectation = this._expectingMail;
					this._expectingMail = undefined;

					if (expectation === undefined) {
						// eslint-disable-next-line no-console
						console.error('Received email while not expecting any:', email);
						expect.soft(email).toBeUndefined();
					} else {
						expectation.resolve(email);
					}
				},
			);
	}
}
