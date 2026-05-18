import { LIMIT_ACCOUNT_PASSKEY_COUNT } from 'pandora-common';
import { ReactElement } from 'react';

export function WikiAccountSecurity(): ReactElement {
	return (
		<>
			<h2>Account Security</h2>

			<h3>Introduction</h3>

			<p>
				Pandora accounts can be protected with a password and, if supported by your browser and device, passkeys.
				Passkeys let you sign in with a hardware security key or another platform authenticator without typing your Pandora password.
			</p>
			<p>
				Pandora also uses your account password to protect your direct message encryption key. Passkey support is designed so that
				a passkey can unlock that direct message key on your device without sending the key secret to the server.
			</p>

			<h3>Account security topics</h3>
			<ul>
				<li><a href='#AS_Passkeys'>Passkeys</a></li>
				<li><a href='#AS_Backup_keys'>Backup keys</a></li>
				<li><a href='#AS_Password_changes'>Password changes</a></li>
				<li><a href='#AS_Password_resets'>Password resets</a></li>
				<li><a href='#AS_Direct_messages'>Direct messages</a></li>
			</ul>

			<h4 id='AS_Passkeys'>Passkeys</h4>
			<p>
				Passkeys can be managed in Settings under the Security tab. You can register up to { LIMIT_ACCOUNT_PASSKEY_COUNT } passkeys on one account.
				Before adding, renaming, or deleting a passkey, Pandora asks you to confirm your identity with your current password
				or a registered passkey. After that, your browser creates or manages the passkey.
			</p>
			<ul>
				<li>Passkey registration may require your authenticator PIN and a touch or biometric confirmation.</li>
				<li>Hardware security keys cannot normally be cloned. Register each key separately.</li>
				<li>You can rename passkeys in Pandora after adding them, which is useful for telling a main key from a backup key.</li>
				<li>Deleting a passkey removes only that passkey from your Pandora account. It does not reset the security key itself.</li>
			</ul>

			<h4 id='AS_Backup_keys'>Backup keys</h4>
			<p>
				If you use hardware security keys, it is recommended to register at least two keys before relying on passkey login.
				Keep the backup key somewhere safe and test that it can sign in before storing it away.
			</p>
			<p>
				When registering a key, connect only the key you intend to add. Multiple security keys may be supported by your browser,
				but registration prompts do not always make it clear which physical key is being enrolled.
			</p>

			<h4 id='AS_Password_changes'>Password changes</h4>
			<p>
				Changing your password starts by confirming your identity with your current password or a registered passkey.
				Pandora then rewraps your direct message key with the new password and keeps your passkeys.
			</p>
			<p>
				Changing your password invalidates existing login sessions. Other signed-in browser sessions may need to sign in again.
			</p>

			<h4 id='AS_Password_resets'>Password resets</h4>
			<p>
				If you reset your password through account recovery, Pandora cannot prove that you still have access to the old direct message key.
				For that reason, password reset removes the saved direct message key and removes all passkeys from the account.
			</p>
			<p>
				After a password reset, you will need to sign in with the new password and register passkeys again.
			</p>

			<h4 id='AS_Direct_messages'>Direct messages</h4>
			<p>
				Direct messages use an encryption key stored on your account in encrypted form. The server stores only wrapped key data.
				The password or passkey-derived wrapping secret needed to unlock the direct message key is handled by the client.
			</p>
			<p>
				If the direct message key is reset, old direct messages may no longer be readable because they were encrypted to the previous key.
			</p>
		</>
	);
}
