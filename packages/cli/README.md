# @flyreq/cli

Codegen and configuration CLI for
[flyreq](https://github.com/gaofeidomino/flyreq). Ships inside
[`flyreq`](https://www.npmjs.com/package/flyreq), so if you installed that you
already have the `flyreq` command.

```bash
pnpm add -D @flyreq/cli
```

## Generate an API client

```bash
flyreq gen ./api.json -o ./src/generated
flyreq gen https://api-platform.example.com/export -o ./src/generated
```

Each endpoint in the JSON becomes a typed function built on the `flyreq`
client, with path parameters, per-call options and a barrel `index.ts`. Treat
the output as generated — layer call options at the call site instead of
editing it.

Set `platform` in `flyreq.config.json` to omit the URL:

```json
{ "platform": "https://api-platform.example.com/export" }
```

## Select a transport

```bash
flyreq use fetch
flyreq use axios
```

This writes to `flyreq.config.json`. Since browsers cannot read it at runtime,
it takes effect through `setupFlyreqFromConfig()` from `flyreq/node`; browser
apps pass `backend` to `setupFlyreq()` directly.

## License

MIT
