/**
 * 飞书 WebSocket 长连接：EventDispatcher + WSClient（@larksuiteoapi/node-sdk）
 * 飞书开放平台需选择「使用长连接接收事件」，无需公网 Webhook URL。
 */
import * as Lark from "@larksuiteoapi/node-sdk"
import { HttpsProxyAgent } from "https-proxy-agent"
import type { Agent } from "node:https"
import type { ResolvedConfig, FeishuMessageContext, LogFn, GatewayHandlers } from "../types.js"
import { isDuplicateMessageId } from "./dedup.js"

export interface FeishuWebSocketGatewayOptions {
  config: ResolvedConfig
  /** 复用 token 的 Client（WS 仍用 appId/appSecret 建连，此参数预留与 sender 一致） */
  larkClient: InstanceType<typeof Lark.Client>
  botOpenId: string
  handlers: GatewayHandlers
  log: LogFn
}

export interface FeishuWebSocketGatewayResult {
  shutdown: () => Promise<void>
}

function extractTextContent(message: Record<string, unknown>): string {
  try {
    if (message.message_type === "text") {
      const content = JSON.parse((message.content as string) || "{}")
      return (content.text as string) || ""
    }
  } catch {
    // ignore
  }
  return ""
}

function computeShouldReply(
  chatType: "p2p" | "group",
  message: Record<string, unknown>,
  botOpenId: string,
): boolean {
  if (chatType === "p2p") return true

  const mentions = message.mentions as Array<{ id?: { open_id?: string } }> | undefined
  if (Array.isArray(mentions) && mentions.length > 0) {
    return mentions.some((m) => m?.id?.open_id === botOpenId)
  }

  if (message.message_type === "text") {
    try {
      const content = JSON.parse((message.content as string) || "{}")
      const text = (content.text as string) || ""
      return (
        text.includes(`<at user_id="${botOpenId}">`) ||
        text.includes(`<at open_id="${botOpenId}">`)
      )
    } catch {
      return false
    }
  }
  return false
}

/**
 * 启动飞书 WebSocket 长连接网关
 */
export function startFeishuWebSocketGateway(
  options: FeishuWebSocketGatewayOptions,
): FeishuWebSocketGatewayResult {
  const { config, botOpenId, handlers, log } = options
  const { appId, appSecret } = config

  const proxyUrl =
    process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || ""

  let wsAgent: Agent | undefined
  if (proxyUrl) {
    wsAgent = new HttpsProxyAgent(proxyUrl)
    log("info", "飞书 WS 已启用代理", { proxy: proxyUrl })
  }

  const dispatcher = new Lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (data: Record<string, unknown>) => {
      try {
        const message = data.message as Record<string, unknown> | undefined
        if (!message) return

        const chatId = message.chat_id as string | undefined
        if (!chatId) return

        const messageId = message.message_id as string | undefined
        if (isDuplicateMessageId(messageId)) return

        const messageType = (message.message_type as string) || "text"
        let text = extractTextContent(message)
        if (messageType === "text") {
          text = text.replace(/@_user_\d+\s*/g, "").trim()
        }
        if (!text) return

        const chatType: "p2p" | "group" =
          (message.chat_type as string) === "group" ? "group" : "p2p"

        const shouldReply = computeShouldReply(chatType, message, botOpenId)

        const sender = data.sender as { sender_id?: { open_id?: string; user_id?: string } } | undefined
        const senderId =
          sender?.sender_id?.open_id || sender?.sender_id?.user_id || ""

        const ctx: FeishuMessageContext = {
          chatId,
          messageId: messageId || "",
          messageType,
          content: text,
          rawContent: (message.content as string) || "{}",
          chatType,
          senderId,
          rootId: message.root_id as string | undefined,
          createTime: message.create_time as string | undefined,
          shouldReply,
        }

        log("info", "WS 收到飞书消息", {
          chatId,
          messageId: messageId || "",
          chatType,
          shouldReply,
          preview: text.slice(0, 80),
        })

        if (handlers.onMessage) {
          await handlers.onMessage(ctx)
        }
      } catch (err) {
        log("error", "WS 处理消息失败", {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },

    "im.chat.member.bot.added_v1": async (data: Record<string, unknown>) => {
      try {
        const chatId = (data.chat_id as string) || (data.detail as { event?: { chat_id?: string } })?.event?.chat_id
        if (chatId && handlers.onBotAdded) {
          log("info", "WS: Bot 入群", { chatId })
          await handlers.onBotAdded(chatId)
        }
      } catch (err) {
        log("error", "WS 处理入群失败", {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
  })

  const logLevelMap: Record<string, Lark.LoggerLevel> = {
    fatal: Lark.LoggerLevel.fatal,
    error: Lark.LoggerLevel.error,
    warn: Lark.LoggerLevel.warn,
    info: Lark.LoggerLevel.info,
    debug: Lark.LoggerLevel.debug,
    trace: Lark.LoggerLevel.trace,
  }

  const wsClient = new Lark.WSClient({
    appId,
    appSecret,
    domain: Lark.Domain.Feishu,
    ...(wsAgent ? { agent: wsAgent } : {}),
    loggerLevel: logLevelMap[config.logLevel] ?? Lark.LoggerLevel.info,
    logger: {
      error: (...msg: unknown[]) => log("error", "[lark.ws]", { msg }),
      warn: (...msg: unknown[]) => log("warn", "[lark.ws]", { msg }),
      info: (...msg: unknown[]) => log("info", "[lark.ws]", { msg }),
      debug: (...msg: unknown[]) => log("info", "[lark.ws]", { msg }),
      trace: (...msg: unknown[]) => log("info", "[lark.ws]", { msg }),
    },
  })

  wsClient.start({ eventDispatcher: dispatcher })
  log("info", "飞书 WebSocket 长连接已启动", { appIdPrefix: appId.slice(0, 8) + "..." })
  log("info", "飞书侧请选择「使用长连接接收事件」，无需配置请求地址")

  return {
    shutdown: async () => {
      log("info", "飞书 WebSocket 正在关闭")
      wsClient.close()
      log("info", "飞书 WebSocket 已关闭")
    },
  }
}
