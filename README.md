# flyreq

分层、可换传输实现的前端请求库。依赖倒置（DIP）隔离 `request-core` 与请求实现；缓存走统一 `CacheStore` 接口。

- **推荐安装**：单个包 `flyreq`
- **日常用法**：`setupFlyreq` 一次，然后 `flyreq.get` / `flyreq.post`，或用 CLI 生成的业务函数
- **切换传输**：改 `setupFlyreq({ backend })` 或 `flyreq use`，不必改业务代码

## 安装

```bash
pnpm add flyreq
```

即可使用（默认传输：**axios**）。无需再分别安装 `@flyreq/core` / `@flyreq/axios` / `@flyreq/bus`。

分场景可运行示例见 [`examples/basic`](examples/basic)。

开发依赖（可选，用于 CLI）：`flyreq` 已自带 `flyreq` 命令；若只要 codegen 也可 `pnpm add -D @flyreq/cli`。

### 快速使用

```ts
import { setupFlyreq, flyreq } from 'flyreq'

setupFlyreq({
  baseURL: 'https://api.example.com',
  token: 'your-jwt', // 或 () => store.token
})

const me = await flyreq.get('/api/user/me')
await flyreq.post('/api/article', { title: 'Hi' })
```

调用级能力（不必先 `createXxxRequestor`）：

```ts
await flyreq.get('/api/article', { cache: 60_000, retry: 3 })
await flyreq.post('/api/pay', body, { idempotent: true })
```

这三个选项的默认语义：

| 选项 | 行为 |
|------|------|
| `retry` | 重试网络异常、5xx、429；4xx 不重试（`shouldRetryResponse: false` 可退回只重试异常） |
| `cache` | 只缓存成功响应；HTTP 失败和 `code !== 0` 的业务错误都不入库 |
| `idempotent` | 并发连点复用同一个请求；去重窗口默认 5 分钟（`duration` 可调） |

全局默认重试：

```ts
setupFlyreq({ baseURL: 'https://api.example.com', retry: 3 })
```

接口平台生成的函数是正路：

```bash
flyreq gen ./api.json -o ./src/generated
```

```ts
import { setupFlyreq } from 'flyreq'
import { getArticles, publishArticle } from './generated'

setupFlyreq({ baseURL: 'https://api.example.com', token: () => getToken() })

await getArticles(1, 10)
await publishArticle({ title: 'Hi', content: '...' })
await publishArticle(article, { retry: 3 }) // overrides 里叠选项，不要改 generated/
```

### 切换传输层（代码）

```ts
import { setupFlyreq, setBackend } from 'flyreq'

setupFlyreq({ baseURL: 'https://api.example.com', backend: 'fetch' })
setBackend('axios')
setBackend('xhr')
```

### 切换传输层（CLI）

```bash
flyreq use fetch
flyreq use axios
flyreq use xhr
```

`flyreq use` 把选择写进 `flyreq.config.json`。主入口 `flyreq` 不含任何 Node API，
所以浏览器构建里不会出现 `node:fs`；想让配置文件生效，在 Node / SSR 侧改用
`flyreq/node`：

```ts
import { setupFlyreqFromConfig } from 'flyreq/node'

setupFlyreqFromConfig() // 读取 flyreq.config.json，显式传入的选项优先
```

纯浏览器项目直接把 `backend` 写在 `setupFlyreq()` 里即可。

### 自定义 / 未来适配器

```ts
import { registerAdapter, setBackend, type Requestor } from 'flyreq'

registerAdapter('ofetch', () => createOfetchRequestor())
setBackend('ofetch')

setBackend(myRequestor)
```

## 请求缓存与存储 DIP

`{ cache: 60_000 }` 默认走内存仓库。需要换存储时，仍只依赖 `CacheStore` 接口：

| 方案 | 工厂 |
|------|------|
| 内存 | `createMemoryStore()` / `resolveCacheStore(false)` |
| Web Storage | `createStorageStore()` / `resolveCacheStore(true)` |
| IndexedDB | `createIndexedDBStore()` |
| Cache API (SW) | `createServiceWorkerStore()` |
| WebSQL | `createWebSQLStore()` |
| Cookie | `createCookieStore()` |

```ts
await flyreq.get('/api/profile', { cache: 60_000 })

await flyreq.get('/api/profile', {
  cache: { persist: true, duration: 60_000 },
})

await flyreq.get('/api/profile', {
  cache: { store: createIndexedDBStore(), duration: 60_000 },
})
```

环境缺少对应 API 时，自动回退到内存仓库。

缓存键默认是 `method:url:params`。想按路径缓存（忽略 query）可以用 `config.pathname`：

```ts
await flyreq.get('/api/search', {
  params: { q },
  cache: { duration: 60_000, key: (config) => config.pathname! },
})
```

## CLI 生成样板

从本地 JSON 或**接口平台**拉取最新配置，再生成业务函数：

```bash
pnpm exec flyreq gen ./api.json -o ./src/generated
pnpm exec flyreq gen https://api-platform.example.com/export -o ./src/generated
```

在 `flyreq.config.json` 写入 `platform` 后可省略 URL：

```json
{ "backend": "axios", "platform": "https://api-platform.example.com/export" }
```

```bash
flyreq gen -o ./src/generated
```

约定：生成放 `generated/`（含 `index.ts`）；个性化放 `overrides/`（对生成函数传入 `{ retry, cache }`，不要改生成物）。

## 源码拷贝 / 按层安装（高级）

内部仍发布分层包，适合深度定制或只取一层：

| 包 | 说明 |
|----|------|
| `flyreq` | **推荐** 伞包（单包安装） |
| `@flyreq/core` | Requestor / CacheStore 接口、injectRequestor、缓存 / 幂等 / 重试 / 串行 / 并发 |
| `@flyreq/axios` | axios 实现 |
| `@flyreq/fetch` | fetch 实现 |
| `@flyreq/xhr` | XMLHttpRequest 实现 |
| `@flyreq/bus` | 协议层 + `flyreq.get/post` 客户端；`bootstrapRequestor` 注入 |
| `@flyreq/cli` | `gen`（可拉接口平台）/ `use` |

DIP 手动接线（一般用不到）：

```ts
import { bootstrapRequestor, flyreq } from 'flyreq'
import { requestor } from '@flyreq/axios'

bootstrapRequestor(requestor, { baseURL: 'https://api.example.com', token: 'jwt' })
await flyreq.get('/api/user/me')
```

拷贝 `packages/*` 进业务仓库时，优先改 bus 协议字段。

## 本地开发

```bash
pnpm install
pnpm build
pnpm test
pnpm --filter @flyreq/example-basic start            # 全部场景
pnpm --filter @flyreq/example-basic start -- quick   # 日常用法
pnpm --filter @flyreq/example-basic start -- cache   # 单个场景，见 examples/basic
```

## 架构

```text
flyreq (request-lib)
  ├── request-bus    @flyreq/bus     协议 + flyreq.get/post
  ├── request-core   @flyreq/core    Requestor / CacheStore 接口
  └── request-imp    axios / fetch / xhr / ...
                     实现 core 中的接口，core 不依赖任何传输库
```

## License

MIT
