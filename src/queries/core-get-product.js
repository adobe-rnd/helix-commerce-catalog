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

export const productFields = `
  name
  sku
  meta_title
  meta_keyword
  meta_description
  url_key
  stock_status
  updated_at
  short_description {
    html
  }
  description {
    html
  }
  ... on ConfigurableProduct {
    variants {
      attributes {
      code
      label
      uid
      value_index
    }
    }
  }
  price_range {
    minimum_price {
      regular_price {
        value
        currency
      }
    }
  }
  image {
    url
    label
  }
  small_image {
    url
    label
  }
  media_gallery {
    url
    label
  }
`;

/**
 * @param {{ urlKey?: string; sku?: string }} param0
 */
export default ({
  urlKey, sku,
}) => {
  const filter = urlKey
    ? { url_key: { eq: urlKey } }
    : { sku: { eq: sku } };
  return {
    query: gql`
      query products($filter: ProductAttributeFilterInput) {
        products(filter: $filter) {
          items {
            ${productFields}
          }
        }
      }
    `,
    variables: {
      filter,
    },
  };
};
