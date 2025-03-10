import { GetLogger } from 'pandora-common';
import { ENV } from '../../config.ts';
import { BaseEmailSender } from './baseEmail.ts';
const { EMAIL_SMTP_CONFIG, EMAIL_SMTP_PASSWORD } = ENV;

import type { Transporter } from 'nodemailer';
import type { SentMessageInfo } from 'nodemailer/lib/smtp-transport/index.js';

export class SmtpEmail extends BaseEmailSender<SentMessageInfo> {

	constructor() {
		super(GetLogger('SmtpEmail'));
	}

	protected async createTransport(): Promise<Transporter<SentMessageInfo>> {
		const { createTransport } = await import('nodemailer');
		const [service, host, user] = EMAIL_SMTP_CONFIG.split(' ');
		return createTransport({
			service,
			host,
			port: 465,
			secure: true,
			auth: {
				user,
				pass: EMAIL_SMTP_PASSWORD,
			},
		});
	}

	protected handleSendResult(result: SentMessageInfo): void {
		if (result.rejected.length > 0)
			this.logger.error(`Email rejected: ${result.response}`);
		else
			this.logger.debug(`Email sent: ${result.response}`);
	}
}
