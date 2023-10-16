import { ENV } from '../../config';
const { EMAIL_SENDER_TYPE } = ENV;
import { MockEmailSender } from './mockEmail';
import { SmtpEmail } from './smtpEmail';
import { SesEmail } from './sesEmail';
import { Service } from 'pandora-common';

export interface IEmailSender extends Service {
	init(): Promise<IEmailSender>;
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
