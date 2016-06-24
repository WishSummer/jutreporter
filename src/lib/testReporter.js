import _ from 'lodash';
import fsp from 'fs-promise';
import glob from 'glob-promise';
import path from 'path';
import * as utils from './utils';
import nunjucks from 'nunjucks';
import dateFilter from 'nunjucks-date-filter-local';

export default class TestReporter {

  constructor(sourceCollector, testCollector, verbose) {
    this.sourceCollector = sourceCollector;
    this.testCollector = testCollector;
    this.isVerbose = verbose;
  }

  log(text) {
    if (this.isVerbose) {
      console.log(text);
    }
  }

  async prepare(destDirectory) {
    this.log(`[-] Copying asset files to ${destDirectory}`);
    await fsp.ensureDir(destDirectory);
    const filesInAssetsDir = await glob('./template/*');
    for (let file of filesInAssetsDir) {
      const dest = path.join(destDirectory, path.basename(file));
      this.log(`[-] ${dest}`);
      await fsp.copy(file, dest, { clobber: true });
    }
  }

  async generateTemplate(report, destFile) {
    // prepare nunjucks
    const env = new nunjucks.Environment();
    env.addFilter('date', dateFilter);
    env.addFilter('json', o => JSON.stringify(o));
    env.addFilter('keys', o => _.keys(o));
    env.addFilter('values', o => _.values(o));
    env.addFilter('toPairs', o => _.toPairs(o));

    const template = (await fsp.readFile('./template/index.html')).toString();

    console.log(`[-] Writing to ${destFile}`);
    const html = env.renderString(template, report);
    await fsp.writeFile(destFile, html);
  }

  getStat(suites) {
    const statTestCases = {
      passed: 0,
      failed: 0,
    };
    const statTestType = {};

    suites.forEach(suite => {
      suite.cases.forEach(testCase => {
        if (testCase.passed) {
          statTestCases.passed++;
        } else {
          statTestCases.failed++;
        }
        if (statTestType[testCase.type] === undefined) {
          statTestType[testCase.type] = 0;
        }
        statTestType[testCase.type]++;
      });
    });

    return {
      testcases: statTestCases,
      types: statTestType,
    };
  }

  async generate(destDirectory) {
    await this.prepare(destDirectory);
    console.log(`[-] Analyzing test report...`);
    const suites = this.testCollector.getSuites().map(suite => {
      console.log(`[-] ${suite.FQN}`);
      return {
        name: utils.getNameFromFQN(suite.FQN),
        FQN: suite.FQN,
        cases: suite.cases.map(testCase => {
          console.log(`[-] ${testCase.FQN}`);
          const testMethod = this.sourceCollector.getMethod(testCase.FQN);
          if (testMethod === undefined) {
            throw new Error(`Unable to find meta info for test method ${testCase.FQN}`);
          }
          const tags = testMethod.tags;
          const targetFQN = `${utils.getPackageFromFQN(testMethod.parentClassFQN)}.${tags['@unitTestTarget']}`;
          const targetMethod = this.sourceCollector.getMethod(targetFQN);
          if (targetMethod === undefined) {
            throw new Error(`Unable to find meta info for test target method ${targetFQN}`);
          }

          return {
            id: tags['@unitTestId'],
            type: tags['@unitTestType'],
            description: tags['@unitTestDescription'],
            signature: targetMethod.signature,
            passed: testCase.passed,
            time: testCase.time,
          };
        }),
        passed: suite.passed,
      };
    });
    const report = {
      generateAt: new Date(),
      suites,
      stat: this.getStat(suites),
    };
    const destFile = path.join(destDirectory, 'index.html');
    await this.generateTemplate(report, destFile);
  }

}
