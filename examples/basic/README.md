# flyreq 示例

按场景演示用法（mock 传输，不访问真实网络）。

```bash
pnpm --filter @flyreq/example-basic start           # 跑完全部场景
pnpm --filter @flyreq/example-basic start -- list
pnpm --filter @flyreq/example-basic start -- quick  # 日常用法
```

| 场景 | 命令参数 | 演示内容 |
|------|----------|----------|
| 日常用法 | `quick` | `setupFlyreq` + `flyreq.get/post` + 调用级 cache / idempotent |
| DIP 接线 | `setup` | `setupFlyreq` / `bootstrapRequestor` / `setBackend` |
| 业务协议 | `bus` | token、跳过鉴权、信封解包、`BusError` |
| 重试 | `retry` | `{ retry: 3 }`、`shouldRetry` |
| 缓存 | `cache` | `{ cache: 60_000 }`、自定义 key、`isValid`、注入 `CacheStore` |
| 幂等 | `idempotent` | `{ idempotent: true }`、自定义幂等键 |
| 流控 | `flow` | 串行、并发上限 |
| 自定义传输 | `adapter` | `defineRequestor` + `registerAdapter` |
| 自定义存储 | `store` | 自己实现 `CacheStore`、`storeKind` |
| 业务模板 | `templates` | 分页 / 幂等发布 / 缓存详情 |
| 钩子 | `hooks` | `beforeRequest` / `responseBody` / `error` |

从接口平台 JSON 生成 bus 样板：

```bash
pnpm gen:example
```

生成文件在 `generated/`（git 忽略），含 `index.ts`。个性化写在 `src/overrides/`（传入 `{ retry }` 等），不要改生成物。
