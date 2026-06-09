import { createApi } from '@boost/api-client';

import { PUBLIC_API_BASE_URL } from './publicApiBaseUrl';

export const API_URL = PUBLIC_API_BASE_URL;
export const api = createApi(API_URL);
