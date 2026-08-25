# @flyreq/xhr

`XMLHttpRequest` transport for
[flyreq](https://github.com/gaofeidomino/flyreq) — an implementation of the
`Requestor` interface from `@flyreq/core`.

Worth choosing over `fetch` when you need upload progress events or have to
support an environment without `fetch`. It is built into
[`flyreq`](https://www.npmjs.com/package/flyreq) as the `xhr` backend.

```bash
pnpm add @flyreq/xhr @flyreq/core
```

## Usage

```ts
import { createXhrRequestor } from '@flyreq/xhr'
import { bootstrapRequestor } from '@flyreq/bus'

bootstrapRequestor(createXhrRequestor())
```

## License

MIT
