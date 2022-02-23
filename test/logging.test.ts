import fs, { readFileSync } from 'fs';
import { nanoid } from 'nanoid';
import { tmpdir } from 'os';
import { GetLogger, LogLevel } from 'pandora-common';
import { AddFileOutput } from '../src/logging';

describe('AddFileOutput()', () => {
	//disable console.info for this test suit
	jest.spyOn(console, 'info').mockImplementation(() => { /*empty*/ });

	const mockLogger = GetLogger('test');
	const testPath = `${tmpdir()}/pandora-test-${nanoid()}.log`;

	afterAll(() => {
		//Cleans up test.log after each test
		fs.stat(testPath, (err) => {
			expect(err).toBeFalsy();
			fs.rmSync(testPath);
		});
	});

	it('should create a valid text file based on fileName-path', () => {
		AddFileOutput(testPath, false, LogLevel.DEBUG);
		//no missing file error means it's working
		fs.readFileSync(testPath);
	});

	it('file should contain logs created with Logger', () => {
		AddFileOutput(testPath, false, LogLevel.DEBUG);
		mockLogger.debug('testing');
		mockLogger.info('Hello there!');
		const file = readFileSync(testPath);
		expect(file.includes('testing')).toBe(true);
		expect(file.includes('Hello there!')).toBe(true);
	});
});
