import { afterAll, describe, expect, it, jest } from '@jest/globals';
import fs, { readFileSync } from 'fs';
import { nanoid } from 'nanoid';
import { tmpdir } from 'os';
import { GetLogger, LogLevel, logConfig } from 'pandora-common';
import { AddFileOutput } from '../src/logging.ts';

describe('AddFileOutput()', () => {
	//disable console.info for this test suit
	jest.spyOn(console, 'info').mockImplementation(() => { /*empty*/ });

	const mockLogger = GetLogger('test');
	const testPath1 = `${tmpdir()}/pandora-test-${nanoid()}.log`;
	const testPath2 = `${tmpdir()}/pandora-test-${nanoid()}.log`;

	async function flushAllOutputs(): Promise<void> {
		for (const output of logConfig.logOutputs) {
			await output.flush?.();
		}
	}

	afterAll(() => {
		//Cleans up test.log after each test
		fs.stat(testPath1, (err) => {
			expect(err).toBeFalsy();
			fs.rmSync(testPath1);
		});
		fs.stat(testPath2, (err) => {
			expect(err).toBeFalsy();
			fs.rmSync(testPath2);
		});
	});

	it('should create a valid text file based on fileName-path, overwriting existing', async () => {
		fs.writeFileSync(testPath1, 'Original content\n', { encoding: 'utf-8' });
		await AddFileOutput(testPath1, false, LogLevel.DEBUG);
		await flushAllOutputs();
		// The file has been emptied
		expect(readFileSync(testPath1, { encoding: 'utf-8' })).toHaveLength(0);
	});

	it('should create a valid text file based on fileName-path, appending to existing', async () => {
		fs.writeFileSync(testPath2, 'Original content\n');
		await AddFileOutput(testPath2, true, LogLevel.DEBUG);
		await flushAllOutputs();
		// The file has NOT been emptied
		expect(readFileSync(testPath2, { encoding: 'utf-8' })).toContain('Original content');
	});

	it('file should contain logs created with Logger', async () => {
		mockLogger.debug('testing');
		mockLogger.info('Hello there!');
		await flushAllOutputs();
		// Overwrite variant
		const file1 = readFileSync(testPath1, { encoding: 'utf-8' });
		expect(file1).not.toContain('Original content');
		expect(file1).toContain('testing');
		expect(file1).toContain('Hello there!');
		// Append variant
		const file2 = readFileSync(testPath2, { encoding: 'utf-8' });
		expect(file2).toContain('Original content');
		expect(file2).toContain('testing');
		expect(file2).toContain('Hello there!');
	});
});
