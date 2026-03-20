# cursor-feishu

[![npm](https://img.shields.io/npm/v/cursor-feishu)](https://www.npmjs.com/package/cursor-feishu)

**Cursor 飞书集成** — 通过飞书 WebSocket 长连接将飞书消息接入 Cursor Headless CLI。

## 传输模式（`FEISHU_TRANSPORT` / `createFeishuService({ transport })`）

| 值 | 说明 |
|----|------|
| `http`（默认） | 由宿主（如 Express）提供 Webhook；飞书选「发送到开发者服务器」，需公网/ngrok |
| `ws` | `Lark.WSClient` 长连接；飞书选「使用长连接接收事件」，**无需**配置请求地址 |
| `both` | 同时启用 WS + HTTP；请勿在飞书对同一事件重复订阅，否则依赖包内 message_id 去重 |

## 特性

- 🚀 **WebSocket 长连接** — `transport: ws` 时实时收消息，无需公网 Webhook
- 🌐 **HTTP Webhook** — `transport: http` 时由宿主提供 POST 回调
- 🤖 **多媒体支持** — 图片、文件、音频、富文本消息自动处理
- 👥 **智能群聊** — 仅 @提及时回复，其他消息静默监听作为上下文
- 💬 **流式响应** — 支持实时更新消息（流式输出）
- 🔧 **灵活配置** — 支持环境变量注入和配置文件加载
- 📝 **完整类型** — TypeScript 类型定义，开发友好

## 快速开始

### 1. 安装依赖

```bash
npm install cursor-feishu
```

### 2. 创建飞书配置文件

创建 `~/.config/cursor/plugins/feishu.json`：

```json
{
  "appId": "cli_xxxxxxxxxxxx",
  "appSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

也支持通过环境变量注入敏感值（适合容器部署）：

```json
{
  "appId": "${FEISHU_APP_ID}",
  "appSecret": "${FEISHU_APP_SECRET}"
}
```

### 3. 配置飞书应用

在 [飞书开放平台](https://open.feishu.cn/app) 创建自建应用，然后：

1. **添加机器人能力**
2. **事件订阅** — 添加 `im.message.receive_v1` 和 `im.chat.member.bot.added_v1`
3. **订阅方式**（与 `FEISHU_TRANSPORT` 一致）  
   - 使用 **`ws`**：选「**使用长连接接收事件**」  
   - 使用 **`http`**：选「**发送到开发者服务器**」并填写你的 Webhook URL  
4. **权限** — 开通 `im:message`、`im:message:send_as_bot`、`im:chat`
5. **发布应用**

### 4. 使用

```typescript
import { createFeishuService } from 'cursor-feishu'

const service = await createFeishuService({
  transport: process.env.FEISHU_TRANSPORT === 'ws' ? 'ws' : 'http', // 或 'both'
  onMessage: async (msgCtx) => {
    console.log(`收到消息: ${msgCtx.content}`)
    // 调用 cursor-agent 处理消息
    // const result = await execCursor(msgCtx.content)
    // 发送结果回飞书
    // await service.getSender().sendText(msgCtx.chatId, result)
  },
  onBotAdded: async (chatId) => {
    console.log(`Bot 已加入群聊: ${chatId}`)
  }
})

await service.run()
```

## API 文档

### `createFeishuService(options)`

创建飞书服务实例。

**参数**：

```typescript
interface FeishuServiceOptions {
  /** 飞书配置，可从 ~/.config/cursor/plugins/feishu.json 自动加载 */
  config?: Partial<ResolvedConfig>
  appId?: string
  appSecret?: string
  /** `http` | `ws` | `both`，默认读 `FEISHU_TRANSPORT` */
  transport?: 'http' | 'ws' | 'both'
  /** 消息处理回调 */
  onMessage?: (msgCtx: FeishuMessageContext) => Promise<void>
  /** Bot 入群回调 */
  onBotAdded?: (chatId: string) => Promise<void>
  /** 卡片交互回调 */
  onCardAction?: (action: any) => Promise<void>
  /** 自定义日志函数 */
  log?: LogFn
}
```

**返回**：

```typescript
interface FeishuService {
  readonly transport: 'http' | 'ws' | 'both'
  run: () => Promise<void>           // 启动并运行服务
  shutdown: () => Promise<void>      // 关闭服务
  getSender: () => FeishuSender      // 获取消息发送器
  getClient: () => LarkClient        // 获取 Lark SDK 客户端
}
```

### `FeishuMessageContext`

收到的消息上下文：

```typescript
interface FeishuMessageContext {
  chatId: string           // 聊天 ID
  messageId: string        // 消息 ID
  messageType: string      // 消息类型（text, image, file 等）
  content: string          // 提取的文本内容
  rawContent: string       // 原始 JSON content
  chatType: "p2p" | "group"  // 聊天类型
  senderId: string         // 发送者 ID
  rootId?: string          // 回复的消息 ID
  createTime?: string      // 消息创建时间
  shouldReply: boolean     // 是否需要回复
}
```

### `FeishuSender`

消息发送器：

```typescript
class FeishuSender {
  // 发送文本消息
  sendText(chatId: string, text: string): Promise<boolean>

  // 发送富文本卡片
  sendCard(chatId: string, card: any): Promise<boolean>

  // 更新消息（用于流式响应）
  updateMessage(messageId: string, text: string): Promise<boolean>
}
```

## 配置说明

完整配置字段（`~/.config/cursor/plugins/feishu.json`）：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| `appId` | string | ✅ | — | 飞书应用 App ID |
| `appSecret` | string | ✅ | — | 飞书应用 App Secret |
| `timeout` | number | ❌ | `120000` | AI 响应超时（毫秒） |
| `logLevel` | string | ❌ | `"info"` | 日志级别：fatal/error/warn/info/debug/trace |
| `maxHistoryMessages` | number | ❌ | `200` | 入群时拉取历史消息的最大条数 |
| `pollInterval` | number | ❌ | `1000` | 轮询响应的间隔（毫秒） |
| `stablePolls` | number | ❌ | `3` | 连续几次轮询内容不变视为回复完成 |
| `dedupTtl` | number | ❌ | `600000` | 消息去重缓存过期时间（毫秒） |
| `directory` | string | ❌ | `""` | 默认工作目录，支持 `~` 和 `${ENV_VAR}` 展开 |

## 群聊行为

| 场景 | 接收消息 | 回复 |
|------|:---:|:---:|
| 单聊 | ✅ | ✅ |
| 群聊 + @bot | ✅ | ✅ |
| 群聊未 @bot | ✅ (静默) | ❌ |
| bot 入群 | ✅ (历史) | ❌ |

## 环境变量

```bash
# 启用调试日志（结构化 JSON 输出到 stderr）
FEISHU_DEBUG=1

# Feishu 应用凭证（如配置文件中使用 ${VAR} 占位符）
FEISHU_APP_ID=cli_xxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# HTTP/HTTPS 代理支持
HTTP_PROXY=http://proxy.company.com:8080
HTTPS_PROXY=http://proxy.company.com:8080
```

## 开发

```bash
npm install           # 安装依赖
npm run build         # 构建
npm run dev           # 开发模式（监听变更）
npm run typecheck     # 类型检查
npm run release       # 交互式版本发布
npm publish           # 发布到 npm
```

## 项目结构

```
src/
├── index.ts           # 主入口，导出 createFeishuService
├── types.ts           # 类型定义
├── feishu/
│   ├── gateway.ts     # WebSocket 网关，连接飞书
│   └── sender.ts      # 消息发送器
```

## 常见问题

### Q: 消息无法接收？

检查以下几点：

1. 飞书应用凭证是否正确（在飞书开放平台验证）
2. 是否订阅了 `im.message.receive_v1` 事件
3. 是否使用「长连接」方式（不是 Webhook）
4. 查看调试日志：`FEISHU_DEBUG=1 node app.js 2>&1 | grep error`

### Q: 群聊消息无法回复？

群聊中必须 @bot，否则消息只会静默监听。这是设计行为，可以避免 bot 过度回复。

### Q: 如何支持代理？

设置环境变量即可：

```bash
HTTP_PROXY=http://proxy:8080 npm start
```

### Q: 如何与 cursor-agent 容器集成？

在 Dockerfile 中安装 cursor-feishu，然后启动一个长期运行的 Node.js 服务来处理飞书消息，再调用 cursor-agent 容器执行任务。

示例见 `cursor-agent` 仓库的 `docs/feishu/` 目录。

## 许可证

MIT

## 相关项目

- [opencode-feishu](https://github.com/NeverMore93/opencode-feishu) — OpenCode 飞书插件（原型）
- [cursor-agent](https://github.com/NeverMore93/cursor-agent) — Cursor Headless CLI 容器化解决方案
- [Feishu SDK](https://open.feishu.cn/document) — 飞书官方文档
