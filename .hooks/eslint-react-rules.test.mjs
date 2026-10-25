import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { ESLint, Linter } from 'eslint';
import * as tsEslint from 'typescript-eslint';

// Exercise the actual migrated rule configuration without requiring a TypeScript project.
const effective = await new ESLint().calculateConfigForFile('pandora-client-web/src/main.tsx');
const config = {
	files: ['**/*.tsx'],
	languageOptions: { parser: tsEslint.parser },
	plugins: effective.plugins,
	settings: effective.settings,
	rules: Object.fromEntries(Object.entries(effective.rules).filter(([name]) => name.startsWith('@eslint-react/') || name === 'no-restricted-syntax' || name === 'import-x/no-internal-modules')),
};

function rulesFor(code) {
	const messages = new Linter().verify(code, [config], { filename: resolve('pandora-client-web/src/Example.tsx') });
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

test('raw form elements are restricted but wrappers are allowed', () => {
	assert.ok(rulesFor('const element = <input />;').includes('no-restricted-syntax'));
	assert.ok(rulesFor('const element = <select />;').includes('no-restricted-syntax'));
	assert.deepEqual(rulesFor('const element = <TextInput />;'), []);
});

test('Zod root imports are allowed and internal entry points stay restricted', () => {
	assert.deepEqual(rulesFor("import * as z from 'zod';"), []);
	assert.ok(rulesFor("import * as z from 'zod/v4';").includes('import-x/no-internal-modules'));
	assert.ok(rulesFor("import * as z from 'zod/v4/core';").includes('import-x/no-internal-modules'));
});

test('nested components and unsafe URLs remain errors', () => {
	assert.ok(rulesFor('function Parent() { function Child() { return <div />; } return <Child />; }').includes('@eslint-react/no-nested-component-definitions'));
	assert.ok(rulesFor('const element = <a href="javascript:alert(1)">link</a>;').includes('@eslint-react/dom-no-script-url'));
});
