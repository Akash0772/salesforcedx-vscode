/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceComponent } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs';
import * as path from 'path';

export interface ComponentDiff {
  projectPath: string;
  cachePath: string;
}

export class ComponentDiffer {

  constructor() {}

  /**
   * Finds the file paths of files that differ for a component stored in two locations
   * @param projectComponent The local SourceComponent
   * @param cacheComponent The remote SourceComponent, stored in a local cache
   * @param projectRoot The common root of all files in the projectComponent
   * @param cacheRoot The common root of all files in the cacheComponent
   * @returns An array of file paths, where each element corresponds to one file that differs
   */
  public diffComponents(
    projectComponent: SourceComponent,
    cacheComponent: SourceComponent,
    projectRoot: string,
    cacheRoot: string
  ): ComponentDiff[] {
    const diffs: ComponentDiff[] = [];

    const projectIndex = new Map<string, string>();
    const projectPaths = projectComponent.walkContent();
    if (projectComponent.xml) {
      projectPaths.push(projectComponent.xml);
    }
    for (const file of projectPaths) {
      const key = path.relative(projectRoot, file);
      projectIndex.set(key, file);
    }

    const cacheIndex = new Map<string, string>();
    const cachePaths = cacheComponent.walkContent();
    if (cacheComponent.xml) {
      cachePaths.push(cacheComponent.xml);
    }
    for (const file of cachePaths) {
      const key = path.relative(cacheRoot, file);
      cacheIndex.set(key, file);
    }

    projectIndex.forEach((projectPath, key) => {
      const cachePath = cacheIndex.get(key);
      if (cachePath && this.filesDiffer(projectPath, cachePath)) {
        diffs.push({ projectPath, cachePath });
      }
    });

    return diffs;
  }

  public filesDiffer(projectPath: string, cachePath: string): boolean {
    const bufferOne = fs.readFileSync(projectPath);
    const bufferTwo = fs.readFileSync(cachePath);
    return !bufferOne.equals(bufferTwo);
  }
}
