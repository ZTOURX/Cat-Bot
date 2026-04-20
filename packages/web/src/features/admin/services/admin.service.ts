import apiClient from '@/lib/api-client.lib'

// ── Response types ─────────────────────────────────────────────────────────────

export interface AdminBotItemDto {
  sessionId: string
  userId: string
  platformId: number
  platform: string
  nickname: string
  prefix: string
  isRunning: boolean
  userName?: string
  userEmail?: string
}

export interface GetAdminBotsResponseDto {
  bots: AdminBotItemDto[]
}

export interface SystemAdminDto {
  id: string
  adminId: string
  createdAt: string
}

export interface GetSystemAdminsResponseDto {
  admins: SystemAdminDto[]
}

// ── Service class ──────────────────────────────────────────────────────────────

export class AdminService {
  // GET /api/v1/admin/bots — all bot sessions across all owners
  async getAdminBots(): Promise<GetAdminBotsResponseDto> {
    const response = await apiClient.get<GetAdminBotsResponseDto>('/api/v1/admin/bots')
    return response.data
  }

  async getSystemAdmins(): Promise<GetSystemAdminsResponseDto> {
    const response = await apiClient.get<GetSystemAdminsResponseDto>('/api/v1/admin/system-admins')
    return response.data
  }

  async addSystemAdmin(adminId: string): Promise<SystemAdminDto> {
    const response = await apiClient.post<SystemAdminDto>('/api/v1/admin/system-admins', { adminId })
    return response.data
  }

  async removeSystemAdmin(adminId: string): Promise<void> {
    await apiClient.delete(`/api/v1/admin/system-admins/${encodeURIComponent(adminId)}`)
  }
}

export const adminService = new AdminService()
export default adminService
