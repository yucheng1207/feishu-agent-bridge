import { z } from "zod"

/**
 * 飞书消息上下文
 */
export interface FeishuMessageContext {
  chatId: string
  messageId: string
  messageType: string
  /** 提取后的文本内容 */
  content: string
  /** 原始 JSON content 字符串 */
  rawContent: string
  chatType: "p2p" | "group"
  senderId: string
  rootId?: string
  /** 消息创建时间 */
  createTime?: string
  /** 是否需要回复 */
  shouldReply: boolean
}

/**
 * 飞书桥接配置（默认从 ~/.config/feishu-agent-bridge/feishu.json 读取，兼容 ~/.config/cursor/plugins/feishu.json）
 */
export interface FeishuPluginConfig {
  appId: string
  appSecret: string
  timeout?: number
  logLevel?: "fatal" | "error" | "warn" | "info" | "debug" | "trace"
  /** 入群时拉取历史消息的最大条数 */
  maxHistoryMessages?: number
  /** 轮询响应的间隔毫秒数 */
  pollInterval?: number
  /** 连续几次轮询内容不变视为回复完成 */
  stablePolls?: number
  /** 消息去重缓存过期毫秒数 */
  dedupTtl?: number
  /** 默认工作目录 */
  directory?: string
}

const AutoPromptSchema = z.object({
  enabled: z.boolean().default(false),
  intervalSeconds: z.number().int().positive().max(300).default(30),
  maxIterations: z.number().int().positive().max(100).default(10),
  message: z.string().min(1).default("请同步当前进度，如需帮助请说明"),
})

export const FeishuConfigSchema = z.object({
  appId: z.string().min(1, "appId 不能为空"),
  appSecret: z.string().min(1, "appSecret 不能为空"),
  timeout: z.number().int().positive().max(600_000).default(120_000),
  logLevel: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  maxHistoryMessages: z.number().int().positive().max(500).default(200),
  pollInterval: z.number().int().positive().default(1_000),
  stablePolls: z.number().int().positive().default(3),
  dedupTtl: z.number().int().positive().default(10 * 60 * 1_000),
  directory: z.string().optional(),
})

/**
 * 合并默认值后的完整配置
 */
export type ResolvedConfig = z.infer<typeof FeishuConfigSchema> & { directory: string }

/**
 * 日志函数签名
 */
export type LogFn = (
  level: "info" | "warn" | "error",
  message: string,
  extra?: Record<string, unknown>,
) => void

/**
 * 网关回调处理器
 */
export interface GatewayHandlers {
  onMessage?: (msgCtx: FeishuMessageContext) => Promise<void>
  onBotAdded?: (chatId: string) => Promise<void>
  onCardAction?: (action: CardAction) => Promise<void>
}

/**
 * 卡片交互动作
 */
export interface CardAction {
  actionId: string
  messageId: string
  chatId: string
  senderId: string
  actionValue: Record<string, unknown>
}
