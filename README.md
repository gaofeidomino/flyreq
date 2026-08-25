# flyreq

分层、可换传输实现的前端请求库。依赖倒置（DIP）隔离 `request-core` 与请求实现；缓存走统一 `CacheStore` 接口。

- **推荐安装**：单个包 `flyreq`
- **三层**：`request-bus` → `request-core`（接口）← `request-imp`（axios / fetch / xhr）
- **切换传输**：改 composition root 的 inject（代码或 `flyreq use`），不必改 core

## 安装

```bash
pnpm add flyreq
```

即可使用（默认传输：**axios**）。无需再分别安装 `@flyreq/core` / `@flyreq/axios` / `@flyreq/bus`。

分场景、自定义适配器 / 存储的可运行示例见 [`examples/basic`](examples/basic)。

开发依赖（可选，用于 CLI）：`flyreq` 已自带 `flyreq` 命令；若只要 codegen 也可 `pnpm add -D @flyreq/cli`。

### 快速使用

```ts
import { setupFlyreq, setRequestToken, busCall, createRetryRequestor } from 'flyreq'

setupFlyreq({ baseURL: 'https://api.example.com' }) // 默认 axios
setRequestToken('your-jwt')

const req = createRetryRequestor(3)
const data = await busCall(req, 'GET', '/api/user/me')
```

DIP 接线（bus 注入具体实现，core 只依赖 `Requestor` 接口）：

```ts
import { bootstrapRequestor } from 'flyreq'
import { requestor } from '@flyreq/axios' // 换成 @flyreq/fetch 或 @flyreq/xhr 即可

bootstrapRequestor(requestor, { baseURL: 'https://api.example.com' })
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

`setupFlyreq()` 在 Node 下会自动读取 `flyreq.config.json`。

### 自定义 / 未来适配器

```ts
import { registerAdapter, setBackend, type Requestor } from 'flyreq'

registerAdapter('ofetch', () => createOfetchRequestor())
setBackend('ofetch')

setBackend(myRequestor)
```

## 请求缓存与存储 DIP

`createCacheRequestor` 只依赖 `CacheStore` 统一接口。实现可替换，不影响缓存逻辑：

| 方案 | 工厂 |
|------|------|
| 内存 | `createMemoryStore()` / `resolveCacheStore(false)` |
| Web Storage | `createStorageStore()` / `resolveCacheStore(true)` |
| IndexedDB | `createIndexedDBStore()` |
| Cache API (SW) | `createServiceWorkerStore()` |
| WebSQL | `createWebSQLStore()` |
| Cookie | `createCookieStore()` |

```ts
import { createCacheRequestor, createIndexedDBStore } from 'flyreq'

const req = createCacheRequestor({
  persist: true,
  duration: 60_000,
  key: (config) => config.url,
})

const idb = createCacheRequestor({
  store: createIndexedDBStore(),
  duration: 60_000,
})
```

环境缺少对应 API 时，自动回退到内存仓库。

## CLI 生成样板

从本地 JSON 或**接口平台**拉取最新配置，再生成 `request-bus` 样板：

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

约定：生成放 `generated/`；个性化放 `overrides/`（v1 不做补丁引擎）。

## 源码拷贝 / 按层安装（高级）

内部仍发布分层包，适合深度定制或只取一层：

| 包 | 说明 |
|----|------|
| `flyreq` | **推荐** 伞包（单包安装） |
| `@flyreq/core` | Requestor / CacheStore 接口、injectRequestor、缓存 / 幂等 / 重试 / 串行 / 并发 |
| `@flyreq/axios` | axios 实现 |
| `@flyreq/fetch` | fetch 实现 |
| `@flyreq/xhr` | XMLHttpRequest 实现 |
| `@flyreq/bus` | 协议层 + `bootstrapRequestor(requestor)` 注入；不自动绑定传输 |
| `@flyreq/cli` | `gen`（可拉接口平台）/ `use` |

拷贝 `packages/*` 进业务仓库时，优先改 bus 协议字段。

## 本地开发

```bash
pnpm install
pnpm build
pnpm test
pnpm --filter @flyreq/example-basic start            # 全部场景
pnpm --filter @flyreq/example-basic start -- cache   # 单个场景，见 examples/basic
```

## 架构

```text
flyreq (request-lib)
  ├── request-bus    @flyreq/bus     bootstrapRequestor(requestor) 注入实现
  ├── request-core   @flyreq/core    Requestor / CacheStore 接口
  └── request-imp    axios / fetch / xhr / ...
                     实现 core 中的接口，core 不依赖任何传输库
```

## License

MIT
