# @flyreq/bus

Business protocol layer for [flyreq](https://github.com/gaofeidomino/flyreq):
auth headers, API envelope unwrapping, and the `flyreq` client that turns the
core decorators into per-call options.

Most people should install [`flyreq`](https://www.npmjs.com/package/flyreq)
instead. Use this package directly when you want the protocol layer without the
bundled transports.

```bash
pnpm add @flyreq/bus @flyreq/core
```

## Usage

```ts
import { configureBus, bootstrapRequestor, flyreq } from '@flyreq/bus'
import { createFetchRequestor } from '@flyreq/fetch'

configureBus({ baseURL: 'https://api.example.com', token: 'jwt' })
bootstrapRequestor(createFetchRequestor())

const user = await flyreq.get<User>('/user/1')
```

`configureBus` sets the protocol (base URL, auth header, success code) and
`bootstrapRequestor` injects the transport. The `flyreq` client unwraps the
`{ code, data, message }` envelope and throws `BusError` on a non-success code,
so call sites deal in domain data.

## Call options

`retry`, `cache` and `idempotent` accept `true`, a number, or the full option
object from `@flyreq/core`. Only successful responses are cached — both HTTP
failures and business-error envelopes are excluded — and `idempotent`
deduplicates concurrent identical requests.

## License

MIT
