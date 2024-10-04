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
import { getSyncTimestamp, saveProductsToR2, setSyncTimestamp } from '../utils/r2.js';

export async function handleCatalogSyncRequest(ctx, config) {
  const { log } = ctx;
  const pageSize = 50;
  let currentPage = 1;
  let totalPages = 1;
  let allItems = [];

  const fetchPage = async (page) => {
    const query = coreProductsQuery({
      pageSize,
      currentPage: page,
    });
    const response = await fetch(config.coreEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(query),
    });

    const result = await response.json();
    return result.data.products;
  };

  // Fetch the first page to get total_pages
  const firstPage = await fetchPage(currentPage);
  totalPages = firstPage.page_info.total_pages;
  allItems = firstPage.items;

  // Loop through remaining pages and merge results
  currentPage = 2;
  while (currentPage <= totalPages) {
    const pageData = await fetchPage(currentPage);
    allItems = [...allItems, ...pageData.items];
    currentPage += 1;
  }

  log.debug('Found', allItems.length, 'products');

  const lastSync = await getSyncTimestamp(ctx, config);
  log.debug('Last sync:', lastSync);

  if (!config.force) {
    allItems = allItems.filter((item) => new Date(item.updated_at) > lastSync);
    log.debug('Filtered', allItems.length, 'products');
  }

  await saveProductsToR2(ctx, config, allItems);

  await setSyncTimestamp(ctx, config);

  return new Response(JSON.stringify(allItems), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  });
}
