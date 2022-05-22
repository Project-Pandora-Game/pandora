/* Scripts are run in Node, so don't make use of the logger or ES imports */
/* eslint-disable no-console, @typescript-eslint/no-var-requires*/
const { constants } = require('fs');
const { copyFile } = require('fs/promises');
const { resolve } = require('path');
const { spawnSync } = require('child_process');

postinstall();

async function postinstall() {
	const isCI = process.env.CI === 'true';
	await copyDotenv();
	if (!isCI) {
		configureGitHooks();
	}
}

async function copyDotenv() {
	try {
		await copyFile(
			resolve(__dirname, '..', '.env.template'),
			resolve(__dirname, '..', '.env'),
			constants.COPYFILE_EXCL,
		);
		console.log('No .env file found - template copied');
	} catch (error) {
		if (error.code !== 'EEXIST' && error.code !== 'ENOENT') {
			throw error;
		}
	}
}

function configureGitHooks() {
	const requiredPath = resolve(__dirname, '..', '.hooks');
	const { stdout } = spawnSync('git', ['config', 'core.hooksPath']);
	const hooksPath = stdout.toString().trim();
	if (hooksPath === requiredPath)
		return;

	const { error } = spawnSync('git', ['config', 'core.hooksPath', requiredPath]);
	if (error)
		throw error;

	console.log('Git hooks path configured');
}
