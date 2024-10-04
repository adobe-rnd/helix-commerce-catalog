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

export async function setSyncTimestamp(ctx, config) {
  const timestampKey = `${config.tenant}/${config.store}/.helix/last-sync.json`;
  const timestampData = {
    lastSyncDate: new Date().toISOString(),
  };

  await ctx.env.CATALOG_BUCKET.put(timestampKey, JSON.stringify(timestampData), {
    httpMetadata: {
      contentType: 'application/json',
    },
  });
}

export async function getSyncTimestamp(ctx, config) {
  const timestampKey = `${config.tenant}/${config.store}/.helix/last-sync.json`;
  const object = await ctx.env.CATALOG_BUCKET.get(timestampKey);

  if (!object) {
    return new Date(0);
  }

  const timestampData = await object.json();
  return new Date(timestampData.lastSyncDate);
}

export async function saveProductsToR2(ctx, config, products) {
  const BATCH_SIZE = 50;

  const storeProductsBatch = async (batch) => {
    const storePromises = batch.map(async (product) => {
      const { sku, name, url_key } = product;
      const key = `${config.tenant}/${config.store}/${sku}.json`;
      const body = JSON.stringify(product);
      const customMetadata = { sku, name, url_key };

      try {
        const productPromise = ctx.env.CATALOG_BUCKET.put(key, body, {
          httpMetadata: { contentType: 'application/json' },
          customMetadata,
        });

        if (url_key) {
          const metadataKey = `${config.tenant}/${config.store}/urlkeys/${url_key}`;
          const metadataPromise = ctx.env.CATALOG_BUCKET.put(metadataKey, '', {
            httpMetadata: { contentType: 'application/octet-stream' },
            customMetadata,
          });
          return Promise.all([productPromise, metadataPromise]);
        } else {
          return productPromise;
        }
      } catch (error) {
        console.error(`Error storing product ${sku}:`, error);
        throw error;
      }
    });

    return Promise.all(storePromises);
  };

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    await storeProductsBatch(batch);
  }
}
