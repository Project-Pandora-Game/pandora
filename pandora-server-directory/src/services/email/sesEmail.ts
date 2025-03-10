import { GetLogger } from 'pandora-common';
import { BaseEmailSender } from './baseEmail.ts';

import type { Transporter } from 'nodemailer';
import type { SentMessageInfo } from 'nodemailer/lib/ses-transport/index.js';

export class SesEmail extends BaseEmailSender<SentMessageInfo> {

	constructor() {
		super(GetLogger('SesEmail'));
	}

	public async createTransport(): Promise<Transporter<SentMessageInfo>> {
		const aws = await import('@aws-sdk/client-ses');
		const { defaultProvider } = await import('@aws-sdk/credential-provider-node');
		const { createTransport } = await import('nodemailer');
		const ses = new aws.SES({
			region: 'eu-north-1',
			credentials: defaultProvider({ timeout: 1000 }),
		});
		return createTransport({
			SES: { ses, aws },
			sendingRate: 1,
		});
	}

	protected handleSendResult(result: SentMessageInfo): void {
		if (result.envelope.to.length !== 1) {
			this.logger.error('Email sanity check failed: envelope.to.length !== 1');
		} else {
			this.logger.debug(`Email sent: ${result.messageId}`);
		}
	}
}
