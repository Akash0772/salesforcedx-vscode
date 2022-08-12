/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ConfigAggregator,
  ConfigFile,
  ConfigValue,
  Global
} from '@salesforce/core';
import * as path from 'path';
import { getRootWorkspacePath } from '../workspaces';
import { TelemetryService } from './telemetry';

export enum ConfigSource {
  Local,
  Global,
  None
}

// This class should be reworked or removed once the ConfigAggregator correctly checks
// local as well as global configs. It's also worth noting that ConfigAggregator, according
// to its docs checks local, global and environment and, for our purposes, environment may
// not be viable.

export class ConfigUtil {
  public static async getConfigSource(key: string): Promise<ConfigSource> {
    let value = await ConfigUtil.getConfigValue(key, ConfigSource.Local);
    if (value !== undefined && value != null) {
      return ConfigSource.Local;
    }
    value = await ConfigUtil.getConfigValue(key, ConfigSource.Global);
    if (value !== undefined && value != null) {
      return ConfigSource.Global;
    }
    return ConfigSource.None;
  }

  public static async getConfigValue(
    key: string,
    source?: ConfigSource.Global | ConfigSource.Local
  ): Promise<ConfigValue | undefined> {
    if (source === undefined || source === ConfigSource.Local) {
      try {
        const rootPath = getRootWorkspacePath();
        const myLocalConfig = await ConfigFile.create({
          isGlobal: false,
          rootFolder: path.join(rootPath, Global.SFDX_STATE_FOLDER),
          filename: 'sfdx-config.json'
        });
        const localValue = myLocalConfig.get(key);
        if (localValue !== undefined && localValue !== null) {
          return localValue;
        }
      } catch (err) {
        TelemetryService.getInstance().sendException(
          'get_config_value_local',
          err.message
        );
        return undefined;
      }
    }
    if (source === undefined || source === ConfigSource.Global) {
      try {
        const aggregator = await ConfigAggregator.create();
        const globalValue = aggregator.getPropertyValue(key);
        if (globalValue !== undefined && globalValue !== null) {
          return globalValue;
        }
      } catch (err) {
        TelemetryService.getInstance().sendException(
          'get_config_value_global',
          err.message
        );
        return undefined;
      }
    }
    return undefined;
  }
}
