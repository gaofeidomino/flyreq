// Core
export {
  inject,
  useRequestor,
  resetRequestor,
  createHttpResponse,
  buildConfig,
  defineRequestor,
  wrapRequestor,
  createEventfulRequestor,
  createMemoryStore,
  createStorageStore,
  createIndexedDBStore,
  createServiceWorkerStore,
  createWebSQLStore,
  createCookieStore,
  createCacheStore,
  useCacheStore,
  createCacheRequestor,
  hashRequest,
  createIdempotentRequestor,
  createRetryRequestor,
  createParallelRequestor,
  createSerialRequestor,
  type HttpMethod,
  type RequestConfig,
  type RequestOptions,
  type PlainResponse,
  type HttpResponse,
  type Requestor,
  type RequestEvent,
  type EventfulRequestor,
  type CacheStore,
  type CacheStoreKind,
  type CacheRequestorOptions,
  type IdempotentRequestorOptions,
  type RetryRequestorOptions,
  type ParallelRequestorOptions,
  type SerialRequestorOptions,
} from '@flyreq/core'

// Bus protocol (no auto-inject)
export {
  BusError,
  unwrapEnvelope,
  isApiEnvelope,
  configureBus,
  setToken,
  getToken,
  getBusConfig,
  attachBus,
  injectBus,
  bootstrap,
  busCall,
  busRequest,
  publishArticle,
  getArticles,
  getArticleById,
  type ApiEnvelope,
  type BusConfig,
  type BusCallOptions,
  type Article,
} from '@flyreq/bus'

// Adapters / transport switching
export {
  setup,
  setBackend,
  registerAdapter,
  listBackends,
  getBackend,
  createBackend,
  type SetupOptions,
  type BackendName,
  type FlyreqFileConfig,
} from './setup'

export { loadFlyreqConfig, writeFlyreqConfig } from './config'

// Low-level creators (advanced)
export { createAxiosRequestor, requestor as axiosRequestor } from '@flyreq/axios'
export { createFetchRequestor, requestor as fetchRequestor } from '@flyreq/fetch'
export { createXhrRequestor, requestor as xhrRequestor } from '@flyreq/xhr'
