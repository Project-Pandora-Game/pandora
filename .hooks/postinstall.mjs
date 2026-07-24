#!/usr/bin/env node
/* Scripts are run in Node, so don't make use of the logger */
import { spawnSync } from 'child_process';
import { constants, readFileSync } from 'fs';
import { copyFile } from 'fs/promises';
import { load as yamlLoad } from 'js-yaml';
import { resolve } from 'path';

postinstall();
async function postinstall() {
	const isCI = process.env.CI === 'true';
	if (!isCI) {
		configureGitHooks();
	}
	try {
		const doc = yamlLoad(readFileSync('pnpm-workspace.yaml', 'utf-8'));
		const WORKSPACES = doc.packages;
		for (const workspace of WORKSPACES) {
			await copyDotenv(workspace);
		}
	} catch (e) {
		console.log(e);
	}
}

/**
 * @param {string} basePath
 */
async function copyDotenv(basePath) {
	try {
		await copyFile(
			resolve(basePath, '.env.template'),
			resolve(basePath, '.env'),
			constants.COPYFILE_EXCL,
		);
		console.log(`${basePath}: No .env file found - template copied`);
	} catch (error) {
		if (!error || typeof error !== 'object' || !(error instanceof Error) || (error.code !== 'EEXIST' && error.code !== 'ENOENT')) {
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
