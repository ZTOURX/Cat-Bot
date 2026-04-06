export type Platform =
  | 'discord'
  | 'telegram'
  | 'facebook_page'
  | 'facebook_messenger'

// Discriminated union — mirrors the server model exactly so the web form and
// API contract stay in sync; changing a platform's shape forces updates on both sides.
export type PlatformCredentials =
  | { platform: 'discord'; discordToken: string; discordClientId?: string }
  | { platform: 'telegram'; telegramToken: string }
  | { platform: 'facebook_page'; fbAccessToken: string; fbPageId: string }
  | { platform: 'facebook_messenger'; appstate: string }

export interface CreateBotRequestDto {
  botNickname: string
  botPrefix: string
  botAdmins: string[]
  credentials: PlatformCredentials
}

export interface CreateBotResponseDto {
  sessionId: string
  userId: string
  platformId: number
  nickname: string
  prefix: string
}

export interface GetBotListItemDto {
  sessionId: string
  platformId: number
  // Human-readable platform string — matches the Platform union values
  platform: string
  nickname: string
  prefix: string
}

export interface GetBotDetailResponseDto {
  sessionId: string
  userId: string
  platformId: number
  // Human-readable platform string
  platform: string
  nickname: string
  prefix: string
  admins: string[]
  credentials: PlatformCredentials
}

// Omits the platform field internally inside the update payload itself since PKs are immutable
export type UpdateBotRequestDto = CreateBotRequestDto
export interface GetBotListResponseDto {
  bots: GetBotListItemDto[]
}

// ── Commands & Events toggle DTOs ─────────────────────────────────────────────

export interface BotCommandItemDto {
  commandName: string
  isEnable: boolean
  version?: string
  description?: string
  usage?: string
  role?: number
  aliases?: string[]
  cooldown?: number
  author?: string
}

export interface GetBotCommandsResponseDto {
  commands: BotCommandItemDto[]
}

export interface BotEventItemDto {
  eventName: string
  isEnable: boolean
  version?: string
  description?: string
  author?: string
}

export interface GetBotEventsResponseDto {
  events: BotEventItemDto[]
}
