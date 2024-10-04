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

import coreProductQuery from '../queries/core-get-product.js';
import { saveProductsToR2 } from '../utils/r2.js';

export async function getProduct(ctx, config, sku, urlKey) {
  const { log } = ctx;
  try {
    const query = coreProductQuery({ sku, urlKey });
    const response = await fetch(config.coreEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      log.warn(`Failed to fetch product. Status: ${response.status}`);
      return null;
    }

    const result = await response.json();
    const products = result?.data?.products;

    if (!products || products.items.length === 0) {
      log.warn('No products found.');
      return null;
    }

    return products.items[0];
  } catch (error) {
    log.error('Error fetching product:', error);
    return null;
  }
}

// eslint-disable-next-line no-unused-vars
export async function handleProductPostRequest(ctx, config) {
  return new Response('POST method not implemented', { status: 501 });
}

// Helper function to resolve SKU from either SKU or URL key
async function resolveSku(ctx, config) {
  if (config.sku) {
    // Directly use the provided SKU
    return config.sku;
  } else if (config.urlKey) {
    // Make a HEAD request to retrieve the SKU from metadata based on the URL key
    const urlKeyPath = `${config.tenant}/${config.store}/urlkeys/${config.urlKey}`;
    const headResponse = await ctx.env.CATALOG_BUCKET.head(urlKeyPath);

    if (!headResponse || !headResponse.customMetadata?.sku) {
      // SKU not found for the provided URL key
      return null;
    }
    // Return the resolved SKU
    return headResponse.customMetadata.sku;
  }
  // Neither SKU nor URL key provided
  return null;
}

// Helper function to load product from R2 using SKU
async function loadProductFromR2(ctx, config, sku) {
  const key = `${config.tenant}/${config.store}/${sku}.json`;
  const object = await ctx.env.CATALOG_BUCKET.get(key);

  if (!object) {
    // Product not found in R2
    return null;
  }

  // Convert the object to JSON and return
  const productData = await object.text();

  // Return the product as a parsed object
  return JSON.parse(productData);
}

export async function handleProductGetRequest(ctx, config) {
  const sku = await resolveSku(ctx, config); // Determine SKU based on either SKU or URL key

  if (!sku) {
    return new Response('Either SKU or urlKey must be provided', { status: 400 });
  }

  // Try to load the product from R2
  const product = await loadProductFromR2(ctx, config, sku);

  if (!product) {
    // If not found in R2, try fetching the product via `getProduct`
    const externalProduct = await getProduct(ctx, config, sku, config.urlKey);

    if (!externalProduct) {
      // Return the appropriate error message based on what was provided in the request
      const identifier = config.sku ? `SKU: ${sku}` : `urlKey: ${config.urlKey}`;
      return new Response(`Product with ${identifier} not found after fallback`, { status: 404 });
    }

    await saveProductsToR2(ctx, config, [externalProduct]);

    // Return the product fetched from external source
    return new Response(JSON.stringify(externalProduct), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Return the product found in R2
  return new Response(JSON.stringify(product), {
    headers: { 'Content-Type': 'application/json' },
  });
}
