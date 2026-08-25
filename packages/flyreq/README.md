# flyreq

Layered frontend request library with swappable transports. This is the
umbrella package — install it alone and you get the core, the business protocol
layer, the fetch/xhr transports and the codegen CLI.

```bash
pnpm add flyreq
```

## Usage

```ts
import { setupFlyreq, flyreq } from 'flyreq'

setupFlyreq({
  baseURL: 'https://api.example.com',
  token: () => localStorage.getItem('jwt') ?? '',
})

const user = await flyreq.get<User>('/user/1')
await flyreq.post('/order', payload, { idempotent: true })
```

`setupFlyreq` is the composition root: it configures the business protocol and
injects a transport. After that you only touch `flyreq.get / post / put /
patch / delete / head / options`.

## Call options

| Option | Meaning |
|--------|---------|
| `retry` | Retry network errors, 5xx and 429. `true`, a count, or full options |
| `cache` | Cache successful responses only. `true`, a TTL in ms, or full options |
| `idempotent` | Deduplicate concurrent identical requests (double-click safe) |

## Transports

`fetch` (default) and `xhr` are built in. axios lives behind a subpath so it
stays out of bundles that never use it — a static import would add ~48 kB to
every consumer:

```ts
import { setupFlyreq } from 'flyreq'
import { createAxiosRequestor } from 'flyreq/axios'

setupFlyreq({ baseURL, backend: createAxiosRequestor() })
```

Using `backend: 'axios'` by name (including via `flyreq.config.json`) needs the
adapter registered first:

```ts
import { registerAxiosAdapter } from 'flyreq/axios'

registerAxiosAdapter()
```

Any object satisfying `Requestor` works too, so you can bring your own
transport with `setBackend(myRequestor)` or `registerAdapter(name, factory)`.

## Entry points

| Import | Contents |
|--------|----------|
| `flyreq` | Runtime API. Free of Node built-ins, safe for browser bundles |
| `flyreq/axios` | axios transport, opt-in |
| `flyreq/node` | Reads `flyreq.config.json`. Node/SSR only |
| `flyreq` (bin) | `flyreq gen` codegen, `flyreq use` transport selection |

## CLI

```bash
flyreq gen ./api.json -o ./src/generated
flyreq use fetch
```

## License

MIT
