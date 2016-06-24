import _ from 'lodash';
import glob from 'glob-promise';
import fsp from 'fs-promise';
import bluebird from 'bluebird';
const xml2js = bluebird.promisifyAll(require('xml2js'));

export default class TestCollector {

  constructor() {
    this.suite = [];
  }

  collectTestcases(rawTestCasesObj) {
    return _(rawTestCasesObj)
      .map(rawTestCaseObj => {
        const testCase = {
          FQN: `${rawTestCaseObj.$.classname}.${rawTestCaseObj.$.name}`,
          name: rawTestCaseObj.$.name,
          time: rawTestCaseObj.$.time,
          passed: rawTestCaseObj.failure === undefined,
        };
        return testCase;
      })
      .value();
  }

  collectTestsuite(rawTestSuiteObj) {
    const testSuite = {
      FQN: rawTestSuiteObj.testsuite.$.name,
      cases: this.collectTestcases(rawTestSuiteObj.testsuite.testcase),
    };
    testSuite.passed = _.every(testSuite.cases, 'passed');
    return testSuite;
  }

  async collectAsync(pattern) {
    const files = await glob(pattern);
    for (let filePath of files) {
      const xml = (await fsp.readFile(filePath)).toString();
      const json = await xml2js.parseStringAsync(xml);
      this.suite.push(this.collectTestsuite(json));
    }
  }

  getSuites() {
    return this.suite;
  }

}
