const assert = chai.assert;
import sinon from '/node_modules/sinon/pkg/sinon-esm.js';

import { CloudQueryEngine } from '/@keymanapp/keyman/build/engine/package-cache/lib/index.mjs';
import { PathConfiguration } from '/@keymanapp/keyman/build/engine/paths/lib/index.mjs';
import DOMCloudRequester from '/@keymanapp/keyman/build/engine/package-cache/lib/dom-cloud-requester.mjs';

const pathConfig = new PathConfiguration({
  root: '',
  resources: '',
  keyboards: '',
  fonts: '',
}, window.location.href);

describe("Cloud-query interface", () => {
  describe("Query URI construction", () => {
    it('sil_euro_latin@no,sv', () => {
      const requester = new DOMCloudRequester();
      const mockedMethod = requester.request = sinon.fake(() => { return {promise: Promise.resolve()} });

      const querier = new CloudQueryEngine(requester, pathConfig);
      querier.fetchCloudStubs(['sil_euro_latin@no', 'sil_euro_latin@sv']);

      assert.isTrue(mockedMethod.called);
      const queryURI = mockedMethod.firstCall.args[0];
      assert.isTrue(queryURI.includes('&keyboardid=sil_euro_latin@no,sil_euro_latin@sv'));
      assert.isFalse(queryURI.includes('&keyboardid=sil_euro_latin@no,sil_euro_latin@sv,'));
    });

    it('sil_cameroon_azerty', () => {
      const requester = new DOMCloudRequester();
      const mockedMethod = requester.request = sinon.fake(() => { return {promise: Promise.resolve()} });

      const querier = new CloudQueryEngine(requester, pathConfig);
      querier.fetchCloudStubs(['sil_cameroon_azerty']);

      assert.isTrue(mockedMethod.called);
      const queryURI = mockedMethod.firstCall.args[0];
      assert.isTrue(queryURI.includes('&keyboardid=sil_cameroon_azerty'));
      assert.isFalse(queryURI.includes('&keyboardid=sil_cameroon_azerty@'));
    });

    it('@dz', () => {
      const requester = new DOMCloudRequester();
      const mockedMethod = requester.request = sinon.fake(() => { return {promise: Promise.resolve()} });

      const querier = new CloudQueryEngine(requester, pathConfig);
      querier.fetchCloudStubs(['@dz']);

      assert.isTrue(mockedMethod.called);
      const queryURI = mockedMethod.firstCall.args[0];
      assert.isTrue(queryURI.includes('&keyboardid=@dz'));
      assert.isFalse(queryURI.includes('&keyboardid=@dz,'));
    });

    it('sil_euro_latin@no,sv + @dz', () => {
      const requester = new DOMCloudRequester();
      const mockedMethod = requester.request = sinon.fake(() => { return {promise: Promise.resolve()} });

      const querier = new CloudQueryEngine(requester, pathConfig);
      querier.fetchCloudStubs(['sil_euro_latin@no','sil_euro_latin@sv', '@dz']);

      assert.isTrue(mockedMethod.called);
      const queryURI = mockedMethod.firstCall.args[0];
      assert.isTrue(queryURI.includes('&keyboardid=sil_euro_latin@no,sil_euro_latin@sv,@dz'));
      assert.isFalse(queryURI.includes('&keyboardid=sil_euro_latin@no,sil_euro_latin@sv,@dz,'));
    });
  });

  describe('Stub fetching', () => {
    /**
     * Performs mocking setup to facilitate unit testing for the `CloudQueryEngine` class.
     *
     * @param {*} queryResultsFile An absolute local filepath to a file containing the mocked results to generate.
     * @returns A fully-mocked `CloudQueryEngine` whose `.fetchCloudStubs()` call will yield a Promise for the
     *          expected mocked results.
     */
    function mockQuery(queryResultsFile) {
      const mockedRequester = new DOMCloudRequester();      // Would attempt to https-request.
      const mockingRequester = new DOMCloudRequester(true); // Used to replace that with a local request.

      const querier = new CloudQueryEngine(mockedRequester, pathConfig); // The query engine builds https-request query strings.
      // Promises are tracked via their queryId, which is generated by the requester.
      // We need to apply it before allowing the actual registration method to execute.
      const idInjector = {
        registerFromCloud: (x) => {
          x.timerid = idInjector.injectionId;

          querier.registerFromCloud(x);
        }
      }

      /*
       * Serves two purposes:
       *
       * 1. Captures the queryID generated by the https-based requester (being mocked) for application
       *    as seen above.
       * 2. Forwards the local-request (mocked) query's Promise as if it were produced by the https-based requester.
       */
      mockedRequester.request = sinon.fake(() => {
        let retObj = mockingRequester.request(queryResultsFile);

        // We need to capture + inject that timerId into the returned results!
        idInjector.injectionId = retObj.queryId;
        return retObj;
      });

      // Install the queryId-injection register as the global registration point for returned queries.
      window.keyman = {
        register: idInjector.registerFromCloud
      };

      return querier;
    }

    it('sil_euro_latin@no,sv', async () => {
      const querier = mockQuery(`base/web/src/test/auto/resources/query-mock-results/sil_euro_latin@no_sv.js.fixture`);
      const promise = querier.fetchCloudStubs(['sil_euro_latin@no','sil_euro_latin@sv']);

      const stubs = await promise;

      assert.equal(stubs.length, 2);
      for(let stub of stubs) {
        assert.equal(stub.KI, 'Keyboard_sil_euro_latin');
        assert.equal(stub.KN, "EuroLatin (SIL)");
        assert.isTrue(stub.KF.includes('s.keyman.com')); // The keyboardsURI property from the cloud options should be applied.
      }

      assert.sameOrderedMembers(stubs.map((stub) => stub.KLC), ['no', 'sv']);
      assert.sameOrderedMembers(stubs.map((stub) => stub.KL),  ['Norwegian', 'Swedish']);
    });

    it('sil_cameroon_azerty', async () => {
      const querier = mockQuery(`base/web/src/test/auto/resources/query-mock-results/sil_cameroon_azerty.js.fixture`);
      const promise = querier.fetchCloudStubs(['sil_cameroon_azerty']);

      const stubs = await promise;

      assert.equal(stubs.length, 278);
      for(let stub of stubs) {
        assert.equal(stub.KI, 'Keyboard_sil_cameroon_azerty');
        assert.equal(stub.KN, "Cameroon AZERTY");
        assert.isTrue(stub.KF.includes('s.keyman.com')); // The keyboardsURI property from the cloud options should be applied.
      }

      assert.equal(stubs.find((stub) => stub.KLC == 'pny').KL, 'Pinyin');
    });

    it('@dz', async () => {
      const querier = mockQuery(`base/web/src/test/auto/resources/query-mock-results/@dz.js.fixture`);
      const promise = querier.fetchCloudStubs(['@dz']);

      const stubs = await promise;

      // `CloudQueryEngine` returns only a single stub.
      //
      // Within `CloudQueryEngine.registerLanguagesForKeyboard`:
      // > Register the default keyboard for the language code
      assert.equal(stubs.length, 1);
      // When available, a perfect match between keyboard and language name = "the default keyboard".
      assert.equal(stubs[0].KN, "Dzongkha");
      assert.isTrue(stubs[0].KF.includes('s.keyman.com')); // The keyboardsURI property from the cloud options should be applied.
    });
  });
});