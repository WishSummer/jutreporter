import _ from 'lodash';
import request from 'request';

export default class BugzillaCollector {

  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.bugs = {};
  }

  collect() {
    return new Promise((resolve, reject) => {
      request.get(`${this.baseUrl}/rest/bug`, {json: true}, (err, response, body) => {
        if (err) {
          return reject(new Error('无法请求 Bugzilla 服务器'));
        }
        this.bugs = _.keyBy(body.bugs, 'id');
        resolve();
      });
    });
  }

  getBug(id) {
    return {
      ...this.bugs[id],
      url: `${this.baseUrl}/show_bug.cgi?id=${id}`,
    };
  }

}
