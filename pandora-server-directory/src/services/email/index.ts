import { ServerService } from 'pandora-common';
import { ENV } from '../../config.ts';
import { MockEmailSender } from './mockEmail.ts';
import { SesEmail } from './sesEmail.ts';
import { SmtpEmail } from './smtpEmail.ts';
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
			default:
				emailSender = new MockEmailSender();
				break;
		}
	}
	return emailSender;
}
