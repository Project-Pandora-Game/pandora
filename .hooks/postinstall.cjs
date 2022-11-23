/* Scripts are run in Node, so don't make use of the logger or ES imports */
/* eslint-disable no-console, @typescript-eslint/no-var-requires*/
const { constants } = require('fs');
const { copyFile } = require('fs/promises');
const { resolve } = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');
const fs = require('fs');

postinstall();
async function postinstall() {
	const isCI = process.env.CI === 'true';
	if (!isCI) {
		configureGitHooks();
	}
	try {
		const doc = yaml.load(fs.readFileSync('pnpm-workspace.yaml', 'utf-8'));
		const WORKSPACES = doc.packages;
		for (const workspace of WORKSPACES) {
			await copyDotenv(workspace);
		}
	} catch (e) {
		console.log(e);
	}
}

async function copyDotenv(basePath) {
	try {
		await copyFile(
			resolve(basePath, '.env.template'),
			resolve(basePath, '.env'),
			constants.COPYFILE_EXCL,
		);
		console.log(`${basePath}: No .env file found - template copied`);
	} catch (error) {
		if (error.code !== 'EEXIST' && error.code !== 'ENOENT') {
			throw error;
		}
	}
}

function configureGitHooks() {
	const requiredPath = './.hooks';
	const { stdout } = spawnSync('git', ['config', 'core.hooksPath']);
	const hooksPath = stdout.toString().trim();
	if (hooksPath === requiredPath)
		return;

	const { error } = spawnSync('git', ['config', 'core.hooksPath', requiredPath]);
	if (error)
		throw error;

	console.log('Git hooks path configured');
}
