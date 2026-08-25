# @flyreq/axios

axios transport for [flyreq](https://github.com/gaofeidomino/flyreq) — an
implementation of the `Requestor` interface from `@flyreq/core`.

`axios` is an optional peer dependency, so nothing is installed unless you
actually use this transport.

```bash
pnpm add @flyreq/axios axios
```

If you already depend on [`flyreq`](https://www.npmjs.com/package/flyreq),
import `flyreq/axios` instead of installing this package directly.

## Usage

```ts
import { createAxiosRequestor } from '@flyreq/axios'
import { bootstrapRequestor } from '@flyreq/bus'

bootstrapRequestor(createAxiosRequestor({ timeout: 10_000 }))
```

`createAxiosRequestor` takes axios `CreateAxiosDefaults`, or an existing
`AxiosInstance` when you need interceptors you already have set up.

Status codes are never thrown by the transport (`validateStatus` always
passes); classifying responses belongs to the layers above, which is what lets
retry and cache policies see 4xx and 5xx.

## License

MIT
