import { AssertNever, ServerService } from 'pandora-common';
import { ENV } from '../../config.ts';
import { MockEmailSender } from './mockEmail.ts';
import { SesEmail } from './sesEmail.ts';
import { SmtpEmail } from './smtpEmail.ts';
import { WebhookEmail } from './webhookEmail.ts';
const { EMAIL_SENDER_TYPE } = ENV;

export interface IEmailSender extends ServerService {
	sendPasswordReset(email: string, username: string, token: string): Promise<void>;
	sendRegistrationConfirmation(email: string, username: string, token: string): Promise<void>;
}

let emailSender: IEmailSender | undefined;

export default function GetEmailSender(): IEmailSender {
	if (!emailSender) {
		switch (EMAIL_SENDER_TYPE) {
			case 'ses':
				emailSender = new SesEmail();
				break;
			case 'smtp':
				emailSender = new SmtpEmail();
				break;
			case 'webhook':
				emailSender = new WebhookEmail();
				break;
			case 'mock':
				emailSender = new MockEmailSender();
				break;
			default:
				AssertNever(EMAIL_SENDER_TYPE);
		}
	}
	return emailSender;
}
