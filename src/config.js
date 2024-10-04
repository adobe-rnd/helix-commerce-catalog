/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/**
 * @param {Context} ctx
 * @param {string} tenant
 * @param {Partial<Config>} [overrides={}]
 * @returns {Promise<Config|null>}
 */
export async function resolveConfig(ctx, tenant, store, overrides = {}) {
  // Get the config map the tenant
  const confMap = await ctx.env.CONFIGS.get(tenant, 'json');
  if (!confMap) {
    return null;
  }
  if (typeof confMap !== 'object') {
    ctx.log.warn('invalid config for tenant', tenant);
    return null;
  }
  // merge configs
  /** @type {Config} */
  const resolved = {
    tenant,
    store,
    ...confMap.base,
    ...overrides,
    force: overrides.force === 'true',
  };

  return resolved;
}
