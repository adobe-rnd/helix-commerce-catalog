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

import coreProductsBySku from '../queries/core-products-by-sku.js';
import { saveProductsToR2 } from '../utils/r2.js';
import { fetchAllProducts } from './sync.js';

export async function handleCatalogQueueRequest(ctx, config, skus) {
  const { log } = ctx;

  const results = await fetchAllProducts(config, coreProductsBySku, {
    currentPage: 1,
    skus: skus.map((item) => item.sku),
  });

  if (results.length > 0) {
    log.debug('Syncing products to r2', results.length);
    await saveProductsToR2(ctx, config, results);
  }

  return new Response(`Synced ${results.length} product(s)`, {
    status: 200,
    headers: {
      'content-type': 'text/plain',
    },
  });
}
