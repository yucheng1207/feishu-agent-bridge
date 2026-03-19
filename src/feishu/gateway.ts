/**
 * Feishu WebSocket 网关 — 与飞书建立长连接，接收事件
 */

import * as Lark from "@larksuiteoapi/node-sdk"
import type { ResolvedConfig, FeishuMessageContext, LogFn, CardAction, GatewayHandlers } from "../types.js"

/**
 * 类型增强：为 Lark SDK 添加缺失的类型定义
 */
declare module "@larksuiteoapi/node-sdk" {
  export const im: any
}

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
 * 启动飞书 WebSocket 网关
 */
export async function startFeishuGateway(options: GatewayOptions): Promise<FeishuGatewayResult> {
  const { config, larkClient, botOpenId, handlers, log } = options

  log("info", "启动飞书 WebSocket 网关")

  // 创建 WebSocket 客户端连接到飞书
  const ws = new Lark.EventDispatcher({}) as any

  // 先启动连接，这会初始化 Lark.im 模块
  await (larkClient as any).startEventDispatcher(ws)

  // 然后注册事件处理器（此时 Lark.im 已可用）
  ws.addEventListener((Lark.im as any).MessageReceive.v1, async (data: any) => {
    try {
      const event = data.detail.event
      const message = event.message

      const msgCtx: FeishuMessageContext = {
        chatId: event.chat_id,
        messageId: message.message_id,
        messageType: message.message_type,
        content: extractTextContent(message),
        rawContent: message.content || "{}",
        chatType: event.chat_type as "p2p" | "group",
        senderId: event.sender.sender_id.user_id || event.sender.sender_id.open_id || "",
        rootId: message.root_id,
        createTime: message.create_time,
        shouldReply: shouldReply(event, botOpenId),
      }

      if (handlers.onMessage) {
        await handlers.onMessage(msgCtx)
      }
    } catch (err) {
      log("error", "处理消息事件失败", {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })

  ws.addEventListener((Lark.im as any).ChatMemberBotAdded.v1, async (data: any) => {
    try {
      const chatId = data.detail.event.chat_id
      if (handlers.onBotAdded) {
        await handlers.onBotAdded(chatId)
      }
    } catch (err) {
      log("error", "处理 bot 入群事件失败", {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })

  log("info", "飞书 WebSocket 网关已启动")

  return {
    shutdown: async () => {
      log("info", "关闭飞书 WebSocket 网关")
      await (larkClient as any).stopEventDispatcher(ws)
    },
  }
}

/**
 * 从飞书消息中提取文本内容
 */
function extractTextContent(message: any): string {
  try {
    if (message.message_type === "text") {
      const content = JSON.parse(message.content || "{}")
      return content.text || ""
    }
  } catch {
    // ignore
  }
  return ""
}

/**
 * 判断是否应该回复
 */
function shouldReply(event: any, botOpenId: string): boolean {
  // 单聊总是回复
  if (event.chat_type === "p2p") {
    return true
  }

  // 群聊只有被 @提及 才回复
  const message = event.message
  if (message.message_type === "text") {
    try {
      const content = JSON.parse(message.content || "{}")
      const text = content.text || ""
      // 检查是否包含 @bot
      return text.includes(`<at user_id="${botOpenId}">`) || text.includes(`<at open_id="${botOpenId}">`)
    } catch {
      // ignore
    }
  }

  return false
}
