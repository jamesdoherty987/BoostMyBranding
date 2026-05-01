import { createApi } from '@boost/api-client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const api = createApi(API_URL);
