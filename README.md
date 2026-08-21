# FeiFly / flyreq

飞着请求走 —— 分层、可换传输实现的前端请求库。

- **推荐安装**：单个包 `flyreq`
- **设计**：依赖倒置（DIP）隔离传输层；内置 axios / fetch，可通过代码或 CLI 切换；也可 `registerAdapter` 扩展未来实现

## 安装

```bash
pnpm add flyreq
```

即可使用（默认传输：**axios**）。无需再分别安装 `@flyreq/core` / `@flyreq/axios` / `@flyreq/bus`。

开发依赖（可选，用于 CLI）：`flyreq` 已自带 `flyreq` 命令；若只要 codegen 也可 `pnpm add -D @flyreq/cli`。

### 快速使用

```ts
import { setup, setToken, busCall, createRetryRequestor } from 'flyreq'

setup({ baseURL: 'https://api.example.com' }) // 默认 axios
setToken('your-jwt')

const req = createRetryRequestor({ maxCount: 3 })
const data = await busCall(req, 'GET', '/api/user/me')
```

### 切换传输层（代码）

```ts
import { setup, setBackend } from 'flyreq'

setup({ baseURL: 'https://api.example.com', backend: 'fetch' })
// 或运行时切换
setBackend('axios')
setBackend('fetch')
```

### 切换传输层（CLI）

```bash
flyreq use fetch   # 写入项目根 flyreq.config.json
flyreq use axios
```

`setup()` 在 Node 下会自动读取 `flyreq.config.json`。

### 自定义 / 未来适配器

```ts
import { registerAdapter, setBackend, type Requestor } from 'flyreq'
import { createOfetchRequestor } from 'somewhere'

registerAdapter('ofetch', () => createOfetchRequestor())
setBackend('ofetch')

// 或直接传入任意 Requestor
setBackend(myRequestor)
```

## CLI 生成样板

```bash
pnpm exec flyreq gen ./api.json -o ./src/generated
```

约定：生成放 `generated/`；个性化放 `overrides/`（v1 不做补丁引擎）。

## 源码拷贝 / 按层安装（高级）

内部仍发布分层包，适合深度定制或只取一层：

| 包 | 说明 |
|----|------|
| `flyreq` | **推荐** 伞包（单包安装） |
| `@flyreq/core` | Requestor、inject、缓存 / 幂等 / 重试 / 串行 / 并发 |
| `@flyreq/axios` | axios 实现 |
| `@flyreq/fetch` | fetch 实现 |
| `@flyreq/bus` | 协议层（token、解包）；不自动注入传输 |
| `@flyreq/cli` | `gen` / `use` |

拷贝 `packages/*` 进业务仓库时，优先改 bus 协议字段。

## 本地开发

```bash
pnpm install
pnpm build
pnpm test
pnpm --filter @flyreq/example-basic start
```

## 架构

```text
flyreq (umbrella)
  ├── setBackend / registerAdapter / setup
  ├── @flyreq/bus   (protocol)
  ├── @flyreq/core  (decorators)
  ├── @flyreq/axios (default)
  └── @flyreq/fetch
```

## License

MIT
