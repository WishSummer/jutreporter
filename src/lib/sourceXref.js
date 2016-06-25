import _ from 'lodash';
import fsp from 'fs-promise';
import path from 'path';
import * as utils from './utils';

const regexp = /(public|protected|private|static|\s) +[\w\<\>\[\]]+\s+(\w+) *\([^\)]*\) *(\{?|[^;])/;

export default class SourceXref {

  constructor(root) {
    this.root = root;
    this.cache = {};
  }

  getSourceCodeForClass(FQN, isTest = false) {
    const content = fsp.readFileSync(path.join(this.root, ...[
      'src',
      isTest ? 'test' : 'main',
      `java/${FQN.split('.').join('/')}.java`
    ])).toString();
    return content;
  }

  getXrefForMethod(FQN, isTest) {
    const xrefPath = isTest ? 'xref-test' : 'xref';
    const className = utils.getPackageFromFQN(FQN);
    if (!this.cache[className]) {
      const classMethods = {};
      const sourceCode = this.getSourceCodeForClass(className, isTest).split('\n');
      sourceCode.forEach((line, i) => {
        const lineNumber = i + 1;
        const match = line.match(regexp);
        if (match) {
          const fn = match[2];
          const fnFQN = `${className}.${fn}`;
          classMethods[fnFQN] = {
            lineNumber,
            url: `../target/site/${xrefPath}/${className.split('.').join('/')}.html#L${lineNumber}`,
          };
        }
      });
      this.cache[className] = classMethods;
    }
    if (this.cache[className] && this.cache[className][FQN]) {
      return this.cache[className][FQN];
    } else {
      return {
        lineNumber: 0,
        url: '#',
      };
    }
  }

}
