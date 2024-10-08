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
// @ts-check

import { errorResponse, makeContext } from './util.js';
import { resolveConfig } from './config.js';
import { handleCatalogSyncRequest } from './catalog/sync.js';
import { handleProductGetRequest, handleProductPostRequest } from './catalog/product.js';

const ALLOWED_METHODS = ['GET', 'POST'];

const handlers = {
  sync: async (ctx, config) => handleCatalogSyncRequest(ctx, config),
  product: async (ctx, config) => {
    if (ctx.info.method === 'POST') {
      return handleProductPostRequest(ctx, config);
    }
    return handleProductGetRequest(ctx, config);
  },
};

export default {
  async queue(batch, env, ctx) {
    console.log('Reading from queue', batch);
    console.log('env', env);
    console.log('env', ctx);
    for (const msg of batch.messages) {
      console.log('Queue message', msg);
      // TODO: do something with the message
      // Explicitly acknowledge the message as delivered
      msg.ack();
    }
  },

  /**
   * @param {Request} request
   * @param {Record<string, string>} env
   * @param {import("@cloudflare/workers-types/experimental").ExecutionContext} pctx
   * @returns {Promise<Response>}
   */
  async fetch(request, env, pctx) {
    const ctx = makeContext(pctx, request, env);
    if (!ALLOWED_METHODS.includes(ctx.info.method)) {
      return errorResponse(405, 'method not allowed');
    }

    console.log('fetch', ctx.info.method, ctx.url.pathname);

    // eslint-disable-next-line no-unused-vars
    const [_, tenant, catalog, store, route] = ctx.url.pathname.split('/');
    if (!tenant) {
      return errorResponse(404, 'missing tenant');
    }

    if (!store) {
      return errorResponse(404, 'missing store');
    }

    if (!route) {
      return errorResponse(404, 'missing route');
    }

    try {
      const overrides = Object.fromEntries(ctx.url.searchParams.entries());
      const config = await resolveConfig(ctx, tenant, store, overrides);
      if (!config) {
        return errorResponse(404, 'config not found');
      }

      return handlers[route](ctx, config);
    } catch (e) {
      if (e.response) {
        return e.response;
      }
      ctx.log.error(e);
      return errorResponse(500, 'internal server error');
    }
  },
};
