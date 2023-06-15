import { GetLogger } from 'pandora-common';
import { EMAIL_SMTP_CONFIG, EMAIL_SMTP_PASSWORD } from '../../config';
import { BaseEmailSender } from './baseEmail';

import type { Transporter } from 'nodemailer';
import type { SentMessageInfo } from 'nodemailer/lib/smtp-transport';

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
