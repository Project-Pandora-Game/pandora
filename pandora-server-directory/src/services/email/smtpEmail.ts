import { GetLogger } from 'pandora-common';
import { EMAIL_SMTP_CONFIG, EMAIL_SMTP_PASSWORD } from '../../config';
import type { IEmailSender } from '.';

import { Transporter, createTransport } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

const logger = GetLogger('SmtpEmail');

export default class SmtpEmail implements IEmailSender {
	private readonly _transporter: Transporter<SMTPTransport.SentMessageInfo>;

	constructor() {
		const [service, host, user] = EMAIL_SMTP_CONFIG.split(' ');
		this._transporter = createTransport({
			service,
			host,
			auth: {
				user,
				pass: EMAIL_SMTP_PASSWORD,
			},
		});
	}

	public async init(): Promise<SmtpEmail> {
		try {
			await this._transporter.verify();
			logger.info('Email transporter is ready');
		} catch (err) {
			logger.error(err);
		}
		return this;
	}

	public async sendPasswordReset(email: string, username: string, token: string): Promise<void> {
		await this.send(email, 'Project-Pandora - Password reset', `
Hello ${username},

You have requested a password reset.
Please enter the following token to reset your password: ${token}

If you did not request a password reset, please ignore this email.
		`);
	}

	public async sendRegistrationConfirmation(email: string, username: string, token: string): Promise<void> {
		await this.send(email, 'Project-Pandora - Registration confirmation', `
Hello ${username},

You have successfully registered on Project-Pandora.
Please enter the following token to confirm your registration: ${token}

If you did not register on Project-Pandora, please ignore this email.
		`);
	}

	private async send(email: string, subject: string, text: string): Promise<void> {
		const result = await this._transporter.sendMail({
			from: 'game@project-pandora.com',
			to: email,
			subject,
			text: text.trim(),
		});
		if (result.rejected.length > 0)
			logger.error(`Email rejected: ${result.response}`);
		else
			logger.debug(`Email sent: ${result.response}`);
	}
}
