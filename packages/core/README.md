# @flyreq/core

Transport-agnostic core of [flyreq](https://github.com/gaofeidomino/flyreq). It
defines the `Requestor` interface and the decorators built on top of it, and
depends on no HTTP library — that inversion is the whole point.

Most people should install [`flyreq`](https://www.npmjs.com/package/flyreq)
instead. Reach for this package directly when building your own transport or
composition root.

```bash
pnpm add @flyreq/core
```

## The interface

```ts
import { defineRequestor, createHttpResponse, type RequestConfig } from '@flyreq/core'

export const myRequestor = defineRequestor(async (config: RequestConfig) => {
  const res = await myTransport(config)
  return createHttpResponse({ ...res, url: config.url })
})
```

## Decorators

Each one wraps a `Requestor` and returns a `Requestor`, so they compose freely.

| Factory | Behaviour |
|---------|-----------|
| `createRetryRequestor` | Retries network errors plus 5xx and 429 responses |
| `createCacheRequestor` | Caches successful responses; dedupes in-flight requests |
| `createIdempotentRequestor` | Cache keyed by request hash, with a default 5 minute window |
| `createParallelRequestor` | Bounded concurrency |
| `createSerialRequestor` | Strict ordering |
| `createEventfulRequestor` | Lifecycle events |

## Cache backends

`CacheStore` is a single interface with interchangeable implementations:
`createMemoryStore`, `createStorageStore`, `createIndexedDBStore`,
`createServiceWorkerStore`, `createWebSQLStore`, `createCookieStore`. Browser
stores fall back to memory when unavailable rather than throwing.

## License

MIT
