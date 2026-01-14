import { Assert, GetLogger } from 'pandora-common';
import { ENV } from '../../config.ts';
import { BaseEmailSender } from './baseEmail.ts';
const { EMAIL_WEBHOOK_URL } = ENV;

import type { Transporter } from 'nodemailer';
import type { SentMessageInfo } from 'nodemailer/lib/stream-transport/index.js';

export class WebhookEmail extends BaseEmailSender<SentMessageInfo> {

	constructor() {
		super(GetLogger('WebhookEmail'));
	}

	protected async createTransport(): Promise<Transporter<SentMessageInfo>> {
		Assert(!!EMAIL_WEBHOOK_URL.trim() && URL.canParse(EMAIL_WEBHOOK_URL.trim()));

		const { createTransport } = await import('nodemailer');
		return createTransport({
			streamTransport: true,
			buffer: true,
		});
	}

	protected handleSendResult(result: SentMessageInfo): void {
		Assert(result.message instanceof Buffer);

		if (result.rejected && result.rejected.length > 0) {
			this.logger.error(`Email rejected: ${result.response}`);
			return;
		}

		fetch(new URL(EMAIL_WEBHOOK_URL.trim()), {
			method: 'POST',
			headers: {
				'Content-Type': 'message/rfc822',
			},
			body: result.message,
		})
			.then((res) => {
				if (res.ok) {
					this.logger.debug(`Email sent: ${res.statusText}`);
				} else {
					this.logger.error(`Email rejected by webhook: ${res.statusText}`);
				}
			}, (err) => {
				this.logger.error(`Error passing email to webhook:`, err);
			});

	}
}
