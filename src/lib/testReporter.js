import fsp from 'fs-promise';
import glob from 'glob-promise';
import path from 'path';

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
      await fsp.copy(file, path.join(destDirectory, path.basename(file)), { clobber: true });
    }
  }

  async generate(destDirectory) {
    await this.prepare(destDirectory);
    const suites = this.testCollector.getSuites();
    for (let suite of suites) {

    }
  }

}
