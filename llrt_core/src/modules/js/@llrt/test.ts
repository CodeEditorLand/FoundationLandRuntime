// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import * as chai from "chai";

import { JestAsymmetricMatchers } from "./expect/jest-asymmetric-matchers";
import { JestChaiExpect } from "./expect/jest-expect";

const GLOBAL = globalThis as any;

const START = Date.now();

const SUITE_LOAD_PROMISES: (() => Promise<void>)[] = [];

const DEFAULT_TIMEOUT_MS = 5000;

const TIMEOUT_MS =
	Number.parseInt((process.env as any).TEST_TIMEOUT) || DEFAULT_TIMEOUT_MS;

const EMPTY_ARROW_FN_REGEX = /^(async)?\s*\(\s*\)\s*=>/m;

const EMPTY_FN_REGEX = /^(async)?\s*function\s*[a-zA-Z0-9_-]*\s*\(\s*\)\s*\{/m;

type Test = TestSettings & {
	desc: string;

	fn: (done?: (error?: any) => void) => Promise<void>;
};

type TestSettings = {
	only?: boolean;

	skip?: boolean;
};

type TestSuite = TestSettings &
	TestSetup & {
		tests?: Test[];

		suites?: TestSuite[];

		parent?: TestSuite;

		containsOnly?: boolean;

		desc: string;
	};

type TestSetup = {
	afterAll?: MaybeAsyncFunction;

	afterEach?: MaybeAsyncFunction;

	beforeAll?: MaybeAsyncFunction;

	beforeEach?: MaybeAsyncFunction;
};

type RootSuite = TestSettings &
	TestSetup &
	Required<
		Omit<TestSuite, "parent" | keyof TestSettings | keyof TestSetup>
	> & {
		loadError?: string;

		module?: string;
	};

type MaybeAsyncFunction = () => Promise<void> | void;

const testList: RootSuite[] = [];

let rootSuite: RootSuite = {
	tests: [],
	suites: [],
	containsOnly: false,
	desc: "root",
};

let onlyCount = 0;

let skippedCount = 0;

let testCount = 0;

let failedCount = 0;

let passedCount = 0;

const colorizer = (color: string) => (text: string) =>
	`${color}${text}${RESET}`;

const Color = {
	GREEN: colorizer("\x1b[32m"),
	RED: colorizer("\x1b[31m"),
	GREY: colorizer("\x1b[30m"),
	GREEN_BACKGROUND: colorizer("\x1b[42m"),
	RED_BACKGROUND: colorizer("\x1b[41m"),
};

const RESET = "\x1b[0m";

class TestOutput {
	private output = "";

	private pass = true;

	private depth = 1;

	private getIndentation = () => " ".repeat(this.depth * 2);

	appendLine = (...message: string[]) => {
		this.output += `${
			this.output.length > 0 ? this.getIndentation() : ""
		}${message.join(" ")}\n`;
	};

	setDepth = (depth: number) => {
		this.depth = depth;
	};

	appendDone = (message: string, time: number) =>
		this.appendLine(
			Color.GREEN("\u2714"),
			Color.GREY(message),
			`(${time} ms)`,
		);

	appendError = (error: any, message: string) => {
		this.pass = false;

		return this.appendLine(
			Color.RED("\u2718"),
			Color.GREY(message),
			error
				? `\n${this.getIndentation()}${(console as any)["__format"](error)}`
				: "",
		);
	};

	toString = () =>
		this.output.replace(
			"{{STATUS}}",
			this.pass
				? Color.GREEN_BACKGROUND(" PASS ")
				: Color.RED_BACKGROUND(" FAIL "),
		);
}

const createTestFunction =
	({ only = false, skip = false }: TestSettings = {}) =>
	(desc: string, fn: () => Promise<void>) => {
		const suite: TestSuite = currentSuite;

		testCount++;

		if (skip || suite?.skip) {
			skippedCount++;

			return;
		}

		const onlyValue = only || suite.only;

		if (onlyValue) {
			onlyCount++;

			suite.containsOnly = true;

			let p = suite.parent;

			while (p) {
				p.containsOnly = true;

				p = p?.parent;
			}
		}

		const test = {
			desc,
			fn,
			only: onlyValue,
		};

		suite.tests?.push(test);
	};

let currentSuite: TestSuite = undefined as any;

let currentSuites: TestSuite[] = [];

const createDescribe =
	({ only = false, skip = false }: TestSettings = {}) =>
	(desc: string, fn: () => Promise<void>) => {
		SUITE_LOAD_PROMISES.push(async () => {
			const parent: TestSuite = currentSuites.shift() ?? rootSuite;

			currentSuite = {
				tests: [],
				suites: [],
				parent,
				only: only || parent.only,
				skip,
				desc,
			};

			parent.suites!.push(currentSuite);

			const beforeLength = SUITE_LOAD_PROMISES.length;

			await fn();

			const afterLength = SUITE_LOAD_PROMISES.length;

			const items = SUITE_LOAD_PROMISES.splice(
				beforeLength,
				afterLength - beforeLength,
			);

			if (items.length) {
				SUITE_LOAD_PROMISES.unshift(...items);

				const subSuites = new Array(items.length).fill(currentSuite);

				currentSuites.unshift(...subSuites);
			}
		});
	};

const testFunction: any = createTestFunction();
testFunction.only = createTestFunction({ only: true });
testFunction.skip = createTestFunction({ skip: true });

const describe: any = createDescribe();
describe.only = createDescribe({ only: true });
describe.skip = createDescribe({ skip: true });

chai.use(JestChaiExpect);
chai.use(JestAsymmetricMatchers);

export function createExpect() {
	const expect = (value: any, message?: string): any => {
		return chai.expect(value, message) as unknown as any;
	};

	Object.assign(expect, chai.expect);

	return expect;
}

const expect: any = createExpect();

GLOBAL.it = testFunction;
GLOBAL.test = testFunction;
GLOBAL.describe = describe;
GLOBAL.expect = expect;

GLOBAL.beforeEach = (cb: MaybeAsyncFunction) => {
	currentSuite.beforeEach = cb;
};

GLOBAL.beforeAll = (cb: MaybeAsyncFunction) => {
	currentSuite.beforeAll = cb;
};

GLOBAL.afterEach = (cb: MaybeAsyncFunction) => {
	currentSuite.afterEach = cb;
};

GLOBAL.afterAll = (cb: MaybeAsyncFunction) => {
	currentSuite.afterAll = cb;
};

const executeAsyncOrCallbackFn = async (fn: Function) => {
	const fnBody = fn.toString();

	const usesArgument = !(
		EMPTY_ARROW_FN_REGEX.test(fnBody) || EMPTY_FN_REGEX.test(fnBody)
	);

	EMPTY_ARROW_FN_REGEX.lastIndex = -1;

	EMPTY_FN_REGEX.lastIndex = -1;

	if (usesArgument) {
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(`Timeout after ${TIMEOUT_MS}ms`),
				TIMEOUT_MS,
			);

			const resolveWrapper = (error: any) => {
				clearTimeout(timeout);

				if (error) {
					return reject(error);
				}

				resolve();
			};

			Promise.resolve(fn(resolveWrapper)).catch(reject);
		});
	} else {
		await fn();
	}
};

const runTests = async (
	testSuite: RootSuite,
	testOutput: TestOutput,
	tests: Test[] = [],
) => {
	for (const test of tests) {
		if (test.skip || (onlyCount > 0 && !test.only)) {
			continue;
		}

		if (testSuite.beforeEach) {
			await executeAsyncOrCallbackFn(testSuite.beforeEach);
		}

		try {
			const start = Date.now();

			await executeAsyncOrCallbackFn(test.fn);

			const end = Date.now();

			testOutput.appendDone(test.desc, end - start);

			passedCount++;
		} catch (error: any) {
			failedCount++;

			testOutput.appendError(error, test.desc);
		}

		if (testSuite.afterEach) {
			await executeAsyncOrCallbackFn(testSuite.afterEach);
		}
	}
};

async function promiseAllMax(
	concurrencyLimit: number,
	promiseFunctions: (() => Promise<any>)[],
) {
	const results = new Array(promiseFunctions.length);

	let currentIndex = 0;

	const executePromise = async () => {
		while (currentIndex < promiseFunctions.length) {
			const index = currentIndex++;

			results[index] = await promiseFunctions[index]();
		}
	};

	await Promise.all(Array.from({ length: concurrencyLimit }, executePromise));

	return results;
}

const runAllTests = async () => {
	await promiseAllMax(
		5,
		testList.reduce<(() => Promise<void>)[]>((acc, testSuite, i) => {
			if (
				!testSuite.loadError &&
				(testSuite.skip ||
					(onlyCount > 0 &&
						!testSuite.only &&
						!testSuite.containsOnly))
			) {
				return acc;
			}

			const execute = async () => {
				const output = new TestOutput();

				output.appendLine(
					`${(i > 0 && "\n") || ""}{{STATUS}} ${testSuite.module}`,
				);

				if (testSuite.loadError) {
					output.appendError(null, testSuite.loadError);

					console.error(output.toString());

					return;
				}

				if (testSuite.beforeAll) {
					await executeAsyncOrCallbackFn(testSuite.beforeAll);
				}

				await runTests(testSuite, output, testSuite.tests);

				const stack = [...testSuite.suites];

				const depthList: number[] = [];

				if ((testSuite.tests?.length ?? 0) > 0) {
					output.setDepth(1);
				}

				while (stack.length > 0) {
					const suite = stack.shift()!;

					if (
						suite.skip ||
						(onlyCount > 0 && !suite.only && !suite.containsOnly)
					) {
						continue;
					}

					const depth = depthList.shift() ?? 1;

					output.setDepth(depth);

					output.appendLine(suite.desc);

					if (suite.beforeAll) {
						await executeAsyncOrCallbackFn(suite.beforeAll);
					}

					await runTests(testSuite, output, suite.tests);

					if (suite.afterAll) {
						await executeAsyncOrCallbackFn(suite.afterAll);
					}

					if (suite.suites) {
						depthList.unshift(
							...new Array(suite.suites.length).fill(depth + 1),
						);

						stack.unshift(...suite.suites);
					}
				}

				if (testSuite.afterAll) {
					await executeAsyncOrCallbackFn(testSuite.afterAll);
				}

				console.log(output.toString());
			};

			acc.push(execute);

			return acc;
		}, []),
	);
};

const findTests = async () => {
	for (const entry of GLOBAL.__testEntries) {
		currentSuite = rootSuite;

		currentSuites = [];

		const index = entry.lastIndexOf("/");

		if (index !== -1) {
			rootSuite.module = entry.substring(index + 1);
		} else {
			rootSuite.module = entry;
		}

		try {
			await import(entry);

			while (SUITE_LOAD_PROMISES.length > 0) {
				const suitePromise = SUITE_LOAD_PROMISES.shift()!;

				await suitePromise();
			}
		} catch (e: any) {
			rootSuite.loadError = `Failed to import module, caused by:\n${"".repeat(
				5,
			)}${Color.RED(
				`${e.message}${(e.stack && `\n${"".repeat(5)}${e.stack}`) || ""}`,
			)}`;

			failedCount++;
		}

		testList.push(rootSuite);

		rootSuite = {
			tests: [],
			suites: [],
			skip: false,
			only: false,
			containsOnly: false,
			desc: "root",
		};
	}
};

const printStats = () => {
	const end = Date.now();

	const includedCount = onlyCount || testCount - skippedCount;

	const passed = includedCount == passedCount && failedCount == 0;

	const status = passed
		? Color.GREEN_BACKGROUND(" \u2714 ALL PASSED ")
		: Color.RED_BACKGROUND(" \u2718 TESTS FAIL ");

	console.log(
		`${status} ${passedCount} passed, ${failedCount} failed, ${
			testCount - includedCount
		} skipped, ${testCount} total\nTime: ${end - START} ms`,
	);

	if (!passed) {
		process.exit(1);
	}
};

try {
	await findTests();

	await runAllTests();

	printStats();
} catch (e) {
	console.error(e);

	process.exit(1);
}
