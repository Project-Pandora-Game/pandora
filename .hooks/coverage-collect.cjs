#!/usr/bin/env node
/* Scripts are run in Node, so don't make use of the logger or ES imports */
/* eslint-disable no-console, @typescript-eslint/no-var-requires*/

const { constants } = require('fs');
const { copyFile } = require('fs/promises');
const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs');
const rimraf = require('rimraf');

collectCoverage();

async function collectCoverage() {
	const COVERAGE_TEMP = path.resolve(process.cwd(), './.nyc_output');
	const COVERAGE_OUTPUT = path.resolve(process.cwd(), './coverage');

	if (fs.existsSync(COVERAGE_TEMP)) {
		rimraf.sync(COVERAGE_TEMP);
	}
	fs.mkdirSync(COVERAGE_TEMP)

	if (fs.existsSync(COVERAGE_OUTPUT)) {
		rimraf.sync(COVERAGE_OUTPUT);
	}
	fs.mkdirSync(COVERAGE_OUTPUT)

	for (const project of ['pandora-common', 'pandora-server-directory', 'pandora-server-shard', 'pandora-client-web', 'pandora-tests']) {
		try {
			await copyFile(
				path.resolve(process.cwd(), project, 'coverage/coverage-final.json'),
				path.resolve(COVERAGE_TEMP, `coverage-${project}.json`),
				constants.COPYFILE_EXCL,
			);
		} catch (error) {
			console.error(`Failed to copy coverage file from ${project}:\n`, error);
			process.exitCode = 1;
		}
	}

	console.log("\n\nCollecting overall coverage from all tests...\n\n")

	if (process.platform === 'win32') {
		console.log('!!! WARNING !!!\nRunning on Windows - coverage will be imprecise.\n\n');
	}

	const { error } = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', [
		'exec',
		'nyc',
		'report',
		'--cwd', path.resolve(process.cwd()), // This is "working directory" only for istanbul, not for rest of command
		'--temp-dir', COVERAGE_TEMP, // This needs to be an absolute path
		'--report-dir', COVERAGE_OUTPUT,
		'--reporter=html',
		'--reporter=json',
		'--reporter=text-summary',
	], {
		shell: true,
		stdio: 'inherit',
	});
	if (error)
		throw error;

	// Cleanup the temporary collection directory
	rimraf.sync(COVERAGE_TEMP);
}
