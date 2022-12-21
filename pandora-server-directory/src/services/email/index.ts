import type { Service } from 'pandora-common';
import { EMAIL_SENDER_TYPE } from '../../config';
import MockEmailSender from './mockEmail';
import SmtpEmail from './smtpEmail';

export interface IEmailSender extends Service {
	sendPasswordReset(email: string, username: string, token: string): Promise<void>;
	sendRegistrationConfirmation(email: string, username: string, token: string): Promise<void>;
}

let emailSender: IEmailSender | undefined;

export default function GetEmailSender(): IEmailSender {
	if (!emailSender) {
		if (EMAIL_SENDER_TYPE === 'smtp')
			emailSender = new SmtpEmail();
		else
			emailSender = new MockEmailSender();
	}
	return emailSender;
}
