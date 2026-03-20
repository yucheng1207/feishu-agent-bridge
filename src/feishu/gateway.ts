/**
 * Feishu HTTP 模式占位说明（实际收事件由宿主如 Express 解析后调 onMessage）
 *
 * WebSocket 长连接见 `gateway-ws.ts`（`startFeishuWebSocketGateway`）。
 * 双模式由环境变量 `FEISHU_TRANSPORT` 或 `createFeishuService({ transport })` 控制。
 */

import * as Lark from "@larksuiteoapi/node-sdk"
import type { ResolvedConfig, LogFn, GatewayHandlers } from "../types.js"

export interface FeishuGatewayResult {
  shutdown: () => Promise<void>
}

export interface GatewayOptions {
  config: ResolvedConfig
  larkClient: InstanceType<typeof Lark.Client>
  botOpenId: string
  handlers: GatewayHandlers
  log: LogFn
}

/**
 * HTTP/Webhook 占位：事件由宿主（如 cursor-agent 的 Express）解析后调用 onMessage。
 * 与 `startFeishuWebSocketGateway` 二选一或并存（双模式时飞书勿对同一事件重复订阅）。
 */
export async function startFeishuGateway(options: GatewayOptions): Promise<FeishuGatewayResult> {
  const { log } = options

  log("info", "飞书 HTTP 模式：由宿主提供 Webhook（如 POST /webhook/feishu）")

  return {
    shutdown: async () => {
      log("info", "关闭飞书 HTTP 占位网关")
    },
  }
}
