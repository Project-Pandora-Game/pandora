import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { ESLint, Linter } from 'eslint';
import * as tsEslint from 'typescript-eslint';

// Exercise the actual migrated rule configuration without requiring a TypeScript project.
const eslint = new ESLint();
function focusedConfig(effective) {
	return {
		files: ['**/*.tsx'],
		languageOptions: { parser: tsEslint.parser },
		plugins: effective.plugins,
		settings: effective.settings,
		rules: Object.fromEntries(Object.entries(effective.rules).filter(([name]) => name.startsWith('@eslint-react/') || name === 'no-restricted-syntax' || name === 'import-x/no-internal-modules' || name === 'import-x/default' || name === 'import-x/no-named-as-default-member')),
	};
}
const config = focusedConfig(await eslint.calculateConfigForFile('pandora-client-web/src/main.tsx'));

function rulesFor(code, fileConfig = config, filename = 'pandora-client-web/src/Example.tsx') {
	const messages = new Linter().verify(code, [fileConfig], { filename: resolve(filename) });
	assert.ok(messages.every((message) => !message.fatal), JSON.stringify(messages));
	return messages.map((message) => message.ruleId);
}

test('component props still require destructuring', () => {
	assert.ok(rulesFor('function Example(props: { value: string }) { return <div>{props.value}</div>; }').includes('@eslint-react/kit/require-destructured-props'));
	assert.deepEqual(rulesFor('function Example({ value }: { value: string }) { return <div>{value}</div>; }'), []);
});

test('ordinary helpers and graphics builders are not component props', () => {
	assert.deepEqual(rulesFor('function ImageToCanvas(image: HTMLImageElement): HTMLCanvasElement { return image.canvas; }'), []);
	assert.deepEqual(rulesFor('function BuildLayer(layer, previous, reverse) { return <div>{layer.id}</div>; }'), []);
});

test('class component props and state still require destructuring', () => {
	assert.ok(rulesFor('class Example extends React.Component { render() { return <div>{this.props.value}</div>; } }').includes('@eslint-react/kit/require-destructured-props'));
	assert.ok(rulesFor('class Example extends React.PureComponent { render() { return <div>{this.state.value}</div>; } }').includes('@eslint-react/kit/require-destructured-props'));
	assert.deepEqual(rulesFor('class Example extends React.Component { render() { const { value } = this.props; return <div>{value}</div>; } }'), []);
});

test('raw form elements are restricted but wrappers are allowed', () => {
	assert.ok(rulesFor('const element = <input />;').includes('no-restricted-syntax'));
	assert.ok(rulesFor('const element = <select />;').includes('no-restricted-syntax'));
	assert.deepEqual(rulesFor('const element = <TextInput />;'), []);
});

test('native date and file inputs remain allowed', () => {
	assert.deepEqual(rulesFor("const element = <input type='date' />;"), []);
	assert.deepEqual(rulesFor("const element = <input type='file' />;"), []);
	assert.ok(rulesFor("const element = <input type='text' />;").includes('no-restricted-syntax'));
	assert.ok(rulesFor("const element = <input type='color' />;").includes('no-restricted-syntax'));
});

test('native wrapper implementations retain the Zod import restriction', async () => {
	for (const filename of [
		'pandora-client-web/src/common/userInteraction/checkbox.tsx',
		'pandora-client-web/src/common/userInteraction/input/formInput.tsx',
		'pandora-client-web/src/common/userInteraction/input/numberInput.tsx',
		'pandora-client-web/src/common/userInteraction/input/textInput.tsx',
		'pandora-client-web/src/common/userInteraction/select/select.tsx',
	]) {
		const wrapperConfig = focusedConfig(await eslint.calculateConfigForFile(filename));
		assert.deepEqual(rulesFor('const element = <input />;', wrapperConfig, filename), []);
		assert.deepEqual(rulesFor('const element = <select />;', wrapperConfig, filename), []);
		assert.ok(rulesFor("import { z } from 'zod';", wrapperConfig, filename).includes('no-restricted-syntax'));
	}
});

test('only asset metadata permits the native color field', async () => {
	const filename = 'pandora-client-web/src/editor/components/assetInfo/assetInfo.tsx';
	const assetConfig = focusedConfig(await eslint.calculateConfigForFile(filename));
	assert.deepEqual(rulesFor("const element = <input type='color' readOnly />;", assetConfig, filename), []);
	assert.ok(rulesFor("const element = <input type='color' />;", assetConfig, filename).includes('no-restricted-syntax'));
	assert.ok(rulesFor("const element = <input type='text' />;", assetConfig, filename).includes('no-restricted-syntax'));
	assert.ok(rulesFor('const element = <select />;', assetConfig, filename).includes('no-restricted-syntax'));
});

test('import checks remain active with the correct Bowser browser export', () => {
	assert.deepEqual(rulesFor("import bowser from 'bowser'; bowser.parse('example');"), []);
	assert.ok(rulesFor("import WrongDefault from 'lodash-es';").includes('import-x/default'));
	assert.ok(rulesFor("import React from 'react'; React.useState();").includes('import-x/no-named-as-default-member'));
});

test('Zod root imports are allowed and internal entry points stay restricted', () => {
	assert.deepEqual(rulesFor("import * as z from 'zod';"), []);
	assert.ok(rulesFor("import * as z from 'zod/v4';").includes('import-x/no-internal-modules'));
	assert.ok(rulesFor("import * as z from 'zod/v4/core';").includes('import-x/no-internal-modules'));
});

test('nested components and unsafe URLs remain errors', () => {
	assert.deepEqual(rulesFor('const Child = () => <div />; function Parent() { return <Child />; }'), []);
	assert.ok(rulesFor('function Parent({ value }) { const Child = useCallback(() => <div>{value}</div>, [value]); return <Child />; }').includes('@eslint-react/no-nested-component-definitions'));
	assert.ok(rulesFor('function Parent() { function Child() { return <div />; } return <Child />; }').includes('@eslint-react/no-nested-component-definitions'));
	assert.ok(rulesFor('const element = <a href="javascript:alert(1)">link</a>;').includes('@eslint-react/dom-no-script-url'));
});
