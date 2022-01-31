import MockEmailSender from './mockEmail';

export interface IEmailSender {
	sendPasswordReset(email: string, username: string, token: string): Promise<void>;
	sendRegistrationConfirmation(email: string, username: string, token: string): Promise<void>;
}

let emailSender: IEmailSender | undefined;

export default function GetEmailSender(): IEmailSender {
	if (!emailSender) {
		emailSender = new MockEmailSender();
	}
	return emailSender;
}
