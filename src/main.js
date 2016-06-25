/*

Usage:

npm run build && npm start -- --javadoc javadoc.xml ~/uwrite --bugzilla http://10.60.41.72:10086/bugzilla --outputDirectory ~/uwrite/test_report --verbose

Options:

--verbose: Show verbose output

*/

import 'source-map-support/register';

import { argv } from 'yargs';
import chalk from 'chalk';
import { spawnSync } from 'child_process';
import path from 'path';

import SourceCollector from './lib/sourceCollector';
import TestCollector from './lib/testCollector';
import TestReporter from './lib/testReporter';
import SourceXref from './lib/sourceXref';
import BugzillaCollector from './lib/bugzillaCollector';

// Commandline options
const [ projectRoot ] = argv._;

// Base libraries
const bugzillaCollector = new BugzillaCollector(argv.bugzilla);
const sourceXref = new SourceXref(projectRoot);
const sourceCollector = new SourceCollector();
const testCollector = new TestCollector();
const testReporter = new TestReporter(bugzillaCollector, sourceXref, sourceCollector, testCollector, argv.verbose);

// Main
async function main () {
  console.log(chalk.green('[+] 正在清理测试环境...'));
  //await spawnMaven('clean');

  console.log(chalk.green('[+] 正在分析 Bugzilla...'));
  await bugzillaCollector.collect();

  console.log(chalk.green('[+] 正在分析源代码...'));
  await spawnMaven('javadoc:javadoc');
  await spawnMaven('jxr:jxr');
  await sourceCollector.collectAsync(path.join(projectRoot, 'target', argv.javadoc));

  console.log(chalk.green('[+] 正在分析测试代码...'));
  await spawnMaven('javadoc:test-javadoc');
  await spawnMaven('jxr:test-jxr');
  await sourceCollector.collectAsync(path.join(projectRoot, 'target', argv.javadoc));

  console.log(chalk.green('[+] 正在执行单元测试和代码覆盖测试...'));
  //await spawnMaven('test', 'jacoco:report');
  await testCollector.collectAsync(path.join(projectRoot, 'target/surefire-reports/*.xml'));

  console.log(chalk.green('[+] 正在生成测试报告...'));
  await testReporter.generate(argv.outputDirectory);

  console.log(chalk.green('[+] 完毕!'));
}

async function spawnMaven(...params) {
  let mvnParams;
  if (argv.verbose) {
    mvnParams = [...params];
  } else {
    mvnParams = [...params, '-q'];
  }
  console.log(`[-] mvn ${mvnParams.join(' ')}`);
  spawnSync('mvn', mvnParams, {
    cwd: projectRoot,
    stdio: 'inherit',
  });
}

main().catch(e => console.error(e.stack));
