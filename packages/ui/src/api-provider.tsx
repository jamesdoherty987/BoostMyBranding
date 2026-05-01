'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createApi, type BoostApi } from '@boost/api-client';

const ApiContext = createContext<BoostApi | null>(null);

export function ApiProvider({ baseUrl, children }: { baseUrl: string; children: ReactNode }) {
  const api = useMemo(() => createApi(baseUrl), [baseUrl]);
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi() {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside <ApiProvider>');
  return api;
}
