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

/* eslint-disable no-await-in-loop */

import coreProductsQuery from '../queries/core-all-products.js';
import coreUpdatedProductsQuery from '../queries/core-all-updated-products.js';
import { getSyncTimestamp } from '../utils/r2.js';

const PAGE_SIZE = 50;
const MAX_CONCURRENT_REQUESTS = 25;

export async function fetchPage(config, queryBuilder, variables) {
  const query = queryBuilder({ ...variables, pageSize: PAGE_SIZE });
  const response = await fetch(config.coreEndpoint, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'Magento-Environment-Id': config.magentoEnvironmentId,
      'Magento-Website-Code': config.magentoWebsiteCode,
      'Magento-Store-View-Code': config.magentoStoreViewCode,
      'Magento-Store-Code': config.magentoStoreCode,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(query),
  });

  const result = await response.json();
  return result.data.products;
}

export async function fetchAllProducts(config, queryBuilder, variables) {
  let currentPage = 1;
  let totalPages = 1;
  let allItems = [];

  const firstPage = await fetchPage(config, queryBuilder, { currentPage, ...variables });
  totalPages = firstPage.page_info.total_pages;
  allItems = firstPage.items;

  currentPage = 2;

  // Process pages in batches of MAX_CONCURRENT_REQUESTS
  while (currentPage <= totalPages) {
    const batchPromises = [];

    // Create a batch of up to MAX_CONCURRENT_REQUESTS
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < MAX_CONCURRENT_REQUESTS && currentPage <= totalPages; i++) {
      batchPromises.push(fetchPage(config, queryBuilder, { currentPage, ...variables }));
      currentPage += 1;
    }

    // Wait for the current batch to resolve
    const batchResults = await Promise.all(batchPromises);

    // Collect items from the resolved pages
    const items = batchResults.flatMap((page) => page.items);
    allItems = [...allItems, ...items];
  }

  return allItems;
}

/**
 * Handle a request to sync the catalog
 * @param {Context} ctx
 * @param {Config} config
 * @returns {Promise<Response>}
 */
export async function handleCatalogSyncRequest(ctx, config) {
  const { log } = ctx;
  let results = [];

  const query = config.force ? coreProductsQuery : coreUpdatedProductsQuery;
  results = await fetchAllProducts(config, query);
  console.log('Total products', results.length);

  if (!config.force) {
    const lastSync = await getSyncTimestamp(ctx, config);
    results = results.filter((item) => new Date(item.updated_at) > lastSync);

    if (results.length > 0) {
      log.debug('Found', results.length, 'out of sync products');

      const message = {
        type: 'catalog-sync',
        config,
        products: results,
      };

      try {
        await ctx.env.COMMERCE_QUEUE.send(message);
        log.debug('Sent message to queue', message);
      } catch (e) {
        log.error(e);
        return Response.json({ msg: e }, { status: 500 });
      }
    } else {
      results = [];
      log.debug('No out of sync products found');
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  });
}

// /**
//  * Handle a request to sync the catalog
//  * @param {Context} ctx
//  * @param {Config} config
//  * @returns {Promise<Response>}
//  */
// export async function handleCatalogSyncRequest(ctx, config) {
//   const { log } = ctx;
//   let results = [];

//   const query = config.force ? coreProductsQuery : coreUpdatedProductsQuery;
//   results = await fetchAllProducts(config, query);
//   console.log('Total products', results.length);

//   if (!config.force) {
//     const lastSync = await getSyncTimestamp(ctx, config);
//     results = results.filter((item) => new Date(item.updated_at) > lastSync);

//     if (results.length > 0) {
//       log.debug('Found', results.length, 'out of sync products');

//       results = await fetchAllProducts(config, coreProductsBySku, {
//         currentPage: 1,
//         skus: results.map((item) => item.sku),
//       });
//     } else {
//       results = [];
//       log.debug('No out of sync products found');
//     }
//   }

//   if (results.length > 0) {
//     await saveProductsToR2(ctx, config, results);
//   }

//   await setSyncTimestamp(ctx, config);
//   return new Response(JSON.stringify(results), {
//     status: 200,
//     headers: {
//       'content-type': 'application/json',
//     },
//   });
// }
