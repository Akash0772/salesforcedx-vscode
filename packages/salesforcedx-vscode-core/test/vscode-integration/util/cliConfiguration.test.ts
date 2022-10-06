/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Config, ConfigFile, OrgConfigProperties } from '@salesforce/core';
import { SfdxConfig } from '@salesforce/core/lib/config/config';
import {
  ConfigUtil,
  getRootWorkspacePath,
  GlobalCliEnvironment
} from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as fs from 'fs';
import * as shelljs from 'shelljs';
import { assert, createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { window } from 'vscode';
import { ENV_SFDX_DISABLE_TELEMETRY } from '../../../src/constants';
import { workspaceContext } from '../../../src/context';
import {
  disableCLITelemetry,
  isCLIInstalled,
  isCLITelemetryAllowed,
  showCLINotInstalledMessage
} from '../../../src/util';

describe('SFDX CLI Configuration utility', () => {
  let sandboxStub: SinonSandbox;
  describe('isCLIInstalled', () => {
    let whichStub: SinonStub;

    beforeEach(() => {
      sandboxStub = createSandbox();
      whichStub = sandboxStub.stub(shelljs, 'which');
    });

    afterEach(() => {
      sandboxStub.restore();
    });

    it('Should return false if sfdx cli path is not found', () => {
      whichStub.withArgs('sfdx').returns('');

      const response = isCLIInstalled();
      expect(response).equal(false);
    });

    it('Should return true if sfdx cli path is found', () => {
      whichStub.withArgs('sfdx').returns('Users/some/path/sfdx/cli');

      const response = isCLIInstalled();
      expect(response).equal(true);
    });

    it('Should return false if sfdx cli path query throwns an exception', () => {
      whichStub
        .withArgs('sfdx')
        .throws(new Error('some exception while querying system path'));

      const response = isCLIInstalled();
      expect(response).equal(false);
    });
  });

  describe('showCLINotInstalledMessage', () => {
    let mShowWarning: SinonStub;

    beforeEach(() => {
      sandboxStub = createSandbox();
      mShowWarning = sandboxStub
        .stub(window, 'showWarningMessage')
        .returns(Promise.resolve(null));
    });

    afterEach(() => {
      sandboxStub.restore();
    });

    it('Should show cli install info message', async () => {
      showCLINotInstalledMessage();
      assert.calledOnce(mShowWarning);
    });
  });

  describe('CLI Telemetry', () => {
    let isTelemetryDisabledStub: SinonStub;

    beforeEach(() => {
      sandboxStub = createSandbox();
      isTelemetryDisabledStub = sandboxStub.stub(
        ConfigUtil,
        'isTelemetryDisabled'
      );
    });

    afterEach(() => {
      sandboxStub.restore();
    });

    it('Should return false if telemetry setting is disabled', async () => {
      isTelemetryDisabledStub.resolves('true');

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(false);
    });

    it('Should return true if telemetry setting is undefined', async () => {
      isTelemetryDisabledStub.resolves(undefined);

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(true);
    });

    it('Should return true if telemetry setting is enabled', async () => {
      isTelemetryDisabledStub.resolves(false);

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(true);
    });

    it('Should set an environment variable', async () => {
      const cliEnvSpy = sandboxStub.stub(
        GlobalCliEnvironment.environmentVariables,
        'set'
      );
      disableCLITelemetry();
      expect(cliEnvSpy.firstCall.args).to.eql([
        ENV_SFDX_DISABLE_TELEMETRY,
        'true'
      ]);
    });
  });

  describe('ConfigAggregator integration tests', () => {
    const dummyLocalDefaultUsername = 'test@local.com';
    // let config: Config;

    afterEach(async () => {
      // Remove the config files that were created for the test
      try {
        const configFile = await ConfigFile.create(
          Config.getDefaultOptions(false, 'sfdx-config.json')
        );
        configFile.unlinkSync(); // delete the sfdx config file that was created for the test

        const config = await Config.create(Config.getDefaultOptions());
        config.unlinkSync(); // delete the sf config file that was created for the test

        // delete the sf directory that was created for the test
        fs.rmdir('.sf', err => {
          if (err) {
            console.log(err);
          }
        });
      } catch (error) {
        console.log(error);
      }
    });

    /*
     * workspaceContextUtil defines a listener that fires a VS Code event when
     * the config file changes.  Ideally, something like flushAllPromises()
     * would be used to force the promises to resolve - however, there seems
     * to be no mechanism to get the VS Code Events to fire before the assertions
     * in the test.  To work around this, a new listener for the event is
     * configured in this test, and the assertions are made within that event listener.
     * By asserting localProjectDefaultUsernameOrAlias, this test validates that:
     * 1. The config file listener in workspaceContextUtil is active
     * 2. When the listener detects a config file change (config.write()) it reloads the
     * configAggregator to ensure it has the latest values
     * 3. The VS Code onOrgChange event handler is invoked
     * 4. The VS Code orgChange event was fired with the correct values
     * 5. The call to ConfigUtil.getDefaultUsernameOrAlias() returns the expected local value
     */
    // tslint:disable-next-line:only-arrow-functions
    it.only('Should return the locally configured default username when it exists', async function() {
      this.timeout(320000);

      let res: (value: string) => void;
      let rej: (reason?: any) => void;
      const resultPromise = new Promise((resolveFunc, rejectsFunc) => {
        res = resolveFunc;
        rej = rejectsFunc;
      });
      workspaceContext.onOrgChange(async orgUserInfo => {
        try {
          // Act
          console.log('calling ConfigUtil.getDefaultUsernameOrAlias()');

          const localProjectDefaultUsernameOrAlias = await ConfigUtil.getDefaultUsernameOrAlias();

          // Assert

          console.log('asserting!');
          expect(localProjectDefaultUsernameOrAlias).to.equal(
            dummyLocalDefaultUsername
          );
          expect(localProjectDefaultUsernameOrAlias).to.equal(
            orgUserInfo.username
          );

          res('success');
        } catch (e) {
          rej(e);
        }
      });

      // Arrange
      // Create a local config file and set the local project default username
      const options = Object.assign(Config.getDefaultOptions(), {
        rootFolder: getRootWorkspacePath()
      });
      const config = await Config.create(options);
      config.set(OrgConfigProperties.TARGET_ORG, dummyLocalDefaultUsername);
      console.log('calling config.write - process.cwd is: ' + process.cwd());
      await config.write();
      console.log('config written - path is: ' + config.getPath());

      console.log('creating sfdx config file');
      const configFile = await ConfigFile.create(
        Config.getDefaultOptions(false, 'sfdx-config.json')
      );
      console.log('updating sfdx config file');
      configFile.update(
        OrgConfigProperties.TARGET_ORG,
        dummyLocalDefaultUsername
      );
      console.log('sfdx config file updated');
      console.log('sfdx config file path is: ' + configFile.getPath());

      return resultPromise;
    });
  });
});
