/*

Usage: node main.js --javadoc javadoc_filename.xml directory_of_uwrite

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

// Commandline options
const [ projectRoot ] = argv._;

// Base libraries
const sourceCollector = new SourceCollector();
const testCollector = new TestCollector();
const testReporter = new TestReporter(sourceCollector, testCollector, argv.verbose);

// Main
async function main () {
  console.log(chalk.green('[+] 正在清理测试环境...'));
  await spawnMaven('clean');

  console.log(chalk.green('[+] 正在分析源代码...'));
  await spawnMaven('javadoc:javadoc');
  await sourceCollector.collectAsync(path.join(projectRoot, 'target', argv.javadoc));

  console.log(chalk.green('[+] 正在分析测试代码...'));
  await spawnMaven('javadoc:test-javadoc');
  await sourceCollector.collectAsync(path.join(projectRoot, 'target', argv.javadoc));

  console.log(chalk.green('[+] 正在执行单元测试...'));
  await spawnMaven('test');
  await testCollector.collectAsync(path.join(projectRoot, 'target/surefire-reports/*.xml'));

  console.log(chalk.green('[+] 正在生成测试报告...'));
  await testReporter.generate('/Users/summer/uwrite/test_report');

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
