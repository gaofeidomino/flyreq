# @flyreq/fetch

`fetch` transport for [flyreq](https://github.com/gaofeidomino/flyreq) — an
implementation of the `Requestor` interface from `@flyreq/core`. No
dependencies beyond the platform's `fetch`.

This is the default transport in
[`flyreq`](https://www.npmjs.com/package/flyreq); install this package directly
only if you are assembling the layers yourself.

```bash
pnpm add @flyreq/fetch @flyreq/core
```

## Usage

```ts
import { createFetchRequestor } from '@flyreq/fetch'
import { bootstrapRequestor } from '@flyreq/bus'

bootstrapRequestor(createFetchRequestor({ credentials: 'include' }))
```

Non-2xx responses resolve rather than throw, so retry and cache policies in the
layers above can act on the status code.

## License

MIT
