import _ from 'lodash';
import fsp from 'fs-promise';
import bluebird from 'bluebird';
const xml2js = bluebird.promisifyAll(require('xml2js'));

export default class SourceCollector {

  static getNameFromFQN(FQN) {
    const seg = FQN.split('.');
    return seg[seg.length - 1];
  }

  constructor() {
    this.classes = {};
    this.methods = {};
  }

  extractTags(javaClassOrMethodObj) {
    if (javaClassOrMethodObj.tag === undefined) {
      return {};
    } else {
      return _(javaClassOrMethodObj.tag)
        .map(tag => tag.$)
        .keyBy('name')
        .value();
    }
  }

  extractMethods(javaClassObj) {
    if (javaClassObj.method === undefined) {
      return {};
    } else {
      return _(javaClassObj.method)
        .map(javaMethodObj => {
          const method = {
            FQN: javaMethodObj.$.qualified,
            name: javaMethodObj.$.name,
            tags: this.extractTags(javaMethodObj),
            signature: this.extractSignature(javaMethodObj),
            parentClassFQN: javaClassObj.$.qualified,
            parentClassName: javaClassObj.$.name,
          };
          return method;
        })
        .keyBy('FQN')
        .value();
    }
  }

  extractClassDetail(javaClassOrInterfaceObj) {
    if (javaClassOrInterfaceObj === undefined) {
      return {};
    } else {
      return _(javaClassOrInterfaceObj)
        .map(javaClassObj => {
          const javaClass = {
            FQN: javaClassObj.$.qualified,
            name: javaClassObj.$.name,
            tags: this.extractTags(javaClassObj),
            methods: this.extractMethods(javaClassObj),
          };
          return javaClass;
        })
        .keyBy('FQN')
        .value();
    }
  }

  extractTypeDetail(javaTypeObj) {
    let type = SourceCollector.getNameFromFQN(javaTypeObj.$.qualified);
    if (javaTypeObj.generic !== undefined) {
      type += '<';
      type += SourceCollector.getNameFromFQN(javaTypeObj.generic[0].$.qualified);
      type += '>';
    }
    return type;
  }

  extractSignature(javaMethodObj) {
    let parameters;
    if (javaMethodObj.parameter === undefined) {
      parameters = [];
    } else {
      parameters = _(javaMethodObj.parameter)
        .map(javaParamObj => `${this.extractTypeDetail(javaParamObj.type[0])} ${javaParamObj.$.name}`)
        .value();
    }
    let retType = this.extractTypeDetail(javaMethodObj.return[0]);
    return `${retType} ${javaMethodObj.$.name}(${parameters.join(', ')})`;
  }

  collectClassOrInterface(classOrInterfaceObj) {
    _.forEach(classOrInterfaceObj, (classObj, classFQN) => {
      this.classes[classFQN] = classObj;
      _.forEach(classObj.methods, (methodObj, methodFQN) => {
        this.methods[methodFQN] = methodObj;
      });
    });
  }

  async collectAsync(filePath) {
    const xml = (await fsp.readFile(filePath)).toString();
    const json = await xml2js.parseStringAsync(xml);
    json.root.package.forEach(javaPackageObj => {
      this.collectClassOrInterface(this.extractClassDetail(javaPackageObj.class));
      this.collectClassOrInterface(this.extractClassDetail(javaPackageObj.interface));
    });
  }

  getClass(FQN) {
    return this.classes[FQN];
  }

  getMethod(FQN) {
    return this.methods[FQN];
  }

}
