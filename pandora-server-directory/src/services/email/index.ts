import { EMAIL_SENDER_TYPE } from '../../config';
import { MockEmailSender } from './mockEmail';
import { SmtpEmail } from './smtpEmail';
import { SesEmail } from './sesEmail';

export interface IEmailSender {
	init(): Promise<void>;
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
