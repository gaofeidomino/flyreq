# FeiFly / flyreq

飞着请求走 —— 分层、可换传输实现的前端请求库。

- **品牌**：FeiFly
- **包 scope**：`@flyreq/*`
- **设计**：依赖倒置（DIP）隔离传输层；`core` 提供缓存 / 幂等 / 重试 / 串行 / 并发；`bus` 承载可定制业务协议；`cli` 从 JSON 生成样板 API。

参考设计文档：[请求库的封装.md](./请求库的封装.md)

## 包一览

| 包 | 说明 |
|----|------|
| `@flyreq/core` | `Requestor` 接口、`inject`、装饰器工厂、`CacheStore` |
| `@flyreq/axios` | axios 实现（**默认推荐**） |
| `@flyreq/fetch` | 原生 fetch 实现（零 axios 依赖，适合拷源码） |
| `@flyreq/bus` | 业务层：默认注入 axios、token、`{code,data,message}` 解包、示例 API |
| `@flyreq/cli` | `flyreq gen`：从 endpoints JSON 生成 bus 样板 |

## 安装（npm）

```bash
pnpm add @flyreq/core @flyreq/axios @flyreq/bus
# 或改用 fetch
pnpm add @flyreq/core @flyreq/fetch
# 代码生成
pnpm add -D @flyreq/cli
```

### 快速使用

```ts
import { setupBus, setToken, busCall } from '@flyreq/bus'
import { createRetryRequestor } from '@flyreq/core'

setupBus({ baseURL: 'https://api.example.com' })
setToken('your-jwt')

const req = createRetryRequestor({ maxCount: 3 })
const data = await busCall(req, 'GET', '/api/user/me')
```

切换到 fetch：

```ts
import { useFetchBackend, configureBus } from '@flyreq/bus'

configureBus({ baseURL: 'https://api.example.com' })
useFetchBackend()
```

只使用 core + axios（不经过 bus）：

```ts
import { inject, createCacheRequestor } from '@flyreq/core'
import { requestor } from '@flyreq/axios'

inject(requestor)
const req = createCacheRequestor({ duration: 60_000 })
const resp = await req.get('/api/list')
```

## 源码拷贝（个性化改）

各包发布时包含 `src/`，也可直接拷贝 monorepo 子目录进业务项目：

1. 拷贝 `packages/core`（及需要的 `axios` / `fetch` / `bus`）
2. 用 workspace / path 依赖引用
3. **优先改 `bus`**：`baseURL`、鉴权头、解包约定（[`packages/bus/src/protocol.ts`](packages/bus/src/protocol.ts)、[`setup.ts`](packages/bus/src/setup.ts)）

适合公司协议字段与公共 npm 不一致时的深度定制。

## CLI 生成样板

```bash
pnpm exec flyreq gen ./api.json -o ./src/generated
```

约定：

- 生成结果放 `generated/`，不要手改
- 个性化包装放 `overrides/` 或手写模块（v1 **不做**补丁引擎）

示例 JSON 见 [`examples/basic/api.json`](examples/basic/api.json)。

## 本地开发

```bash
pnpm install
pnpm build
pnpm test
pnpm --filter @flyreq/example-basic start
```

## 架构

```text
@flyreq/bus  ──inject──►  @flyreq/axios  (default)
     │                         │
     │                    @flyreq/fetch  (optional)
     ▼
@flyreq/core  (Requestor + cache / idempotent / retry / parallel / serial)
```

## License

MIT
