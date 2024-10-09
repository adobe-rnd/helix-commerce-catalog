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

import { gql } from '../util.js';
import { productFields } from './core-get-product.js';

/**
 * @param {{ pageSize?: number; currentPage?: number; page?: number }} param0
 */
export default ({
  pageSize, currentPage, page,
}) => ({
  query: gql`
    query products($filter: ProductAttributeFilterInput, $pageSize: Int, $currentPage: Int) {
      products(filter: $filter, pageSize: $pageSize, currentPage: $currentPage) {
        total_count
        page_info {
          total_pages
          current_page
        }
        items {
          ${productFields}
        }
      }
    }
  `,
  variables: {
    pageSize,
    currentPage: page || currentPage, // Use 'page' if provided, otherwise fallback to 'currentPage'
    filter: {
      price: {
        from: 0,
        to: 10000000,
      },
    },
  },
});
