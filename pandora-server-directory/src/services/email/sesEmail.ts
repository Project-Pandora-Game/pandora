import { GetLogger } from 'pandora-common';
import { BaseEmailSender } from './baseEmail.ts';

import type { Transporter } from 'nodemailer';
import type { SESSentMessageInfo } from 'nodemailer/lib/ses-transport/index.js';

export class SesEmail extends BaseEmailSender<SESSentMessageInfo> {

	constructor() {
		super(GetLogger('SesEmail'));
	}

	public async createTransport(): Promise<Transporter<SESSentMessageInfo>> {
		const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2');
		const { defaultProvider } = await import('@aws-sdk/credential-provider-node');
		const { createTransport } = await import('nodemailer');
		const sesClient = new SESv2Client({
			region: 'eu-north-1',
			credentials: defaultProvider({ timeout: 1000 }),
		});
		return createTransport({
			SES: { sesClient, SendEmailCommand },
		});
	}

	protected handleSendResult(result: SESSentMessageInfo): void {
		if (result.envelope.to.length !== 1) {
			this.logger.error('Email sanity check failed: envelope.to.length !== 1');
		} else {
			this.logger.debug(`Email sent: ${result.messageId}`);
		}
	}
}
