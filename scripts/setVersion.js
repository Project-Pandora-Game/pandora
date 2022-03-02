/* eslint-disable no-console, @typescript-eslint/no-var-requires */
const { readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

setVersion();

function setVersion() {
	const { version } = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'));
	const configFile = resolve(__dirname, '..', 'src', 'config.ts');
	const config = readFileSync(configFile, 'utf8')
		.toString()
		.split('\n')
		.map((line) => line.replace(/^export const APP_VERSION = '[^']+';$/g, `export const APP_VERSION = '${version}';`))
		.join('\n');

	writeFileSync(configFile, config);
}
