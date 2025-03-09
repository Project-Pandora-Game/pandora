import type { Transporter } from 'nodemailer';
import type { Logger } from 'pandora-common';
import type { IEmailSender } from './index.ts';

const ENVELOPE_FROM = 'game@project-pandora.com';

export abstract class BaseEmailSender<T> implements IEmailSender {
	private _transporter?: Transporter<T>;

	protected readonly logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	protected abstract handleSendResult(result: Awaited<T>): void;
	protected abstract createTransport(): Promise<Transporter<T>>;

	public async init(): Promise<void> {
		try {
			this._transporter = await this.createTransport();
			await this._transporter.verify();
			this.logger.info('Email transporter is ready');
		} catch (err) {
			this._transporter = undefined;
			this.logger.error(err);
		}
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

	protected async send(email: string, subject: string, text: string): Promise<void> {
		if (!this._transporter) {
			this.logger.error('Email transporter is not ready');
			return;
		}
		try {
			const result = await this._transporter.sendMail({
				from: ENVELOPE_FROM,
				to: email,
				subject,
				text: text.trimStart(),
			});
			this.handleSendResult(result);
		} catch (err) {
			this.logger.error(err);
		}
	}
}
