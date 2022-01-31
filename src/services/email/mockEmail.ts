import { GetLogger } from 'pandora-common';
import type { IEmailSender } from '.';

const logger = GetLogger('MockEmailSender');

export default class MockEmailSender implements IEmailSender {

	public async sendPasswordReset(email: string, username: string, token: string): Promise<void> {
		logger.info(`SendPasswordReset:\n\temail: '${email}'\n\t username: '${username}'\n\t token: '${token}'`);
		return Promise.resolve();
	}

	public async sendRegistrationConfirmation(email: string, username: string, token: string): Promise<void> {
		logger.info(`SendRegistrationConfirmation:\n\temail: '${email}'\n\t username: '${username}'\n\t token: '${token}'`);
		return Promise.resolve();
	}

}
