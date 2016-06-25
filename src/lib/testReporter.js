import _ from 'lodash';
import fsp from 'fs-promise';
import glob from 'glob-promise';
import path from 'path';
import * as utils from './utils';
import nunjucks from 'nunjucks';
import dateFilter from 'nunjucks-date-filter-local';

export default class TestReporter {

  constructor(bugzillaCollector, sourceXref, sourceCollector, testCollector, verbose) {
    this.bugzillaCollector = bugzillaCollector;
    this.sourceXref = sourceXref;
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
    this.log(`[-] 正在复制文件 ${destDirectory}`);
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

  statForUnitTestSuites(suites) {
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

  statForIntegrationTestSuites(suites) {
    return {
      ...this.statForUnitTestSuites(suites),
    };
  }

  getBugzillaStatus(idList) {
    const ret = _(idList)
      .map(id => this.bugzillaCollector.getBug(id))
      .filter()
      .value();
    return ret;
  }

  generateForUnitTest() {
    this.log(`[-] 正在分析单元测试情况...`);
    const suites = _(this.testCollector.getSuites())
    .filter(suite => {
      const javaClass = this.sourceCollector.getClass(suite.FQN);
      return javaClass.tags['@testType'] === 'UNIT_TEST';
    })
    .map(suite => {
      this.log(`[-] ${suite.FQN}`);
      return {
        name: utils.getNameFromFQN(suite.FQN),
        FQN: suite.FQN,
        cases: _(suite.cases).map(testCase => {
          console.log(`[-] ${testCase.FQN}`);
          const testMethod = this.sourceCollector.getMethod(testCase.FQN);
          if (testMethod === undefined) {
            console.error(`[ERROR] Unable to find meta info for test method ${testCase.FQN}`);
            return null;
          }

          const tags = testMethod.tags;
          const targetFQN = `${utils.getPackageFromFQN(testMethod.parentClassFQN)}.${tags['@unitTestTarget']}`;
          const targetMethod = this.sourceCollector.getMethod(targetFQN);
          if (targetMethod === undefined) {
            console.error(`[ERROR] Unable to find meta info for test target method ${targetFQN}`);
            return null;
          }

          return {
            id: tags['@unitTestId'],
            bugzilla: tags['@bugzillaRef'] ? this.getBugzillaStatus(tags['@bugzillaRef'].split(',').map(s => s.trim())) : [],
            url: this.sourceXref.getXrefForMethod(testCase.FQN, true).url,
            type: tags['@unitTestType'],
            description: tags['@unitTestDescription'],
            signature: targetMethod.signature,
            targetUrl: this.sourceXref.getXrefForMethod(targetFQN, false).url,
            passed: testCase.passed,
            time: testCase.time,
          };
        }).filter().sortBy('id').value(),
        passed: suite.passed,
      };
    })
    .filter().value();
    return suites;
  }

  generateForIntegrationTest() {
    this.log(`[-] 正在分析集成测试情况...`);
    const suites = _(this.testCollector.getSuites())
    .filter(suite => {
      const javaClass = this.sourceCollector.getClass(suite.FQN);
      return javaClass.tags['@testType'] === 'INTEGRATION_TEST';
    })
    .map(suite => {
      this.log(`[-] ${suite.FQN}`);
      return {
        name: utils.getNameFromFQN(suite.FQN),
        FQN: suite.FQN,
        cases: _(suite.cases).map(testCase => {
          console.log(`[-] ${testCase.FQN}`);
          const testMethod = this.sourceCollector.getMethod(testCase.FQN);
          if (testMethod === undefined) {
            console.error(`[ERROR] Unable to find meta info for test method ${testCase.FQN}`);
            return null;
          }
          const tags = testMethod.tags;
          return {
            id: tags['@integrationTestId'],
            bugzilla: tags['@bugzillaRef'] ? this.getBugzillaStatus(tags['@bugzillaRef'].split(',').map(s => s.trim())) : [],
            url: this.sourceXref.getXrefForMethod(testCase.FQN, true).url,
            type: tags['@integrationTestType'],
            description: tags['@integrationTestDescription'],
            target: tags['@integrationTestTarget'],
            passed: testCase.passed,
            time: testCase.time,
          };
        }).filter().sortBy('id').value(),
        passed: suite.passed,
      };
    })
    .filter().value();
    return suites;
  }

  async generate(destDirectory) {
    await this.prepare(destDirectory);
    const unitTestSuite = this.generateForUnitTest();
    const integrationTestSuite = this.generateForIntegrationTest();
    const report = {
      generateAt: new Date(),
      unitTest: {
        suites: unitTestSuite,
        stat: this.statForUnitTestSuites(unitTestSuite),
      },
      integrationTest: {
        suites: integrationTestSuite,
        stat: this.statForIntegrationTestSuites(integrationTestSuite),
      },
      BUGZILLA_STATUS_MAP: {
        'UNCONFIRMED': 'gray',
        'CONFIRMED': 'red',
        'IN_PROGRESS': 'yellow',
        'RESOLVED': 'green',
        'VERIFIED': 'yellow',
      },
    };
    const destFile = path.join(destDirectory, 'index.html');
    await this.generateTemplate(report, destFile);
  }

}
