import { prisma } from '../index.js';
import type { BotCredentialDiscord, BotCredentialTelegram, BotCredentialFacebookPage, BotCredentialFacebookMessenger, BotSession } from '../index.js';
import { Platforms, PLATFORM_TO_ID } from '@cat-bot/engine/constants/platform.constants.js';
import { toPlatformNumericId } from '@cat-bot/engine/utils/platform-id.util.js';

export async function findDiscordCredentialState(userId: string, sessionId: string): Promise<{ isCommandRegister: boolean; commandHash: string | null } | null> {
  return prisma.botCredentialDiscord.findUnique({
    where: { userId_platformId_sessionId: { userId, platformId: PLATFORM_TO_ID[Platforms.Discord], sessionId } },
    select: { isCommandRegister: true, commandHash: true },
  });
}

export async function updateDiscordCredentialCommandHash(userId: string, sessionId: string, data: { isCommandRegister: boolean; commandHash: string }): Promise<void> {
  await prisma.botCredentialDiscord.update({
    where: { userId_platformId_sessionId: { userId, platformId: PLATFORM_TO_ID[Platforms.Discord], sessionId } },
    data,
  });
}

export async function findAllDiscordCredentials(): Promise<BotCredentialDiscord[]> { return prisma.botCredentialDiscord.findMany(); }

export async function findTelegramCredentialState(userId: string, sessionId: string): Promise<{ isCommandRegister: boolean; commandHash: string | null } | null> {
  return prisma.botCredentialTelegram.findUnique({
    where: { userId_platformId_sessionId: { userId, platformId: PLATFORM_TO_ID[Platforms.Telegram], sessionId } },
    select: { isCommandRegister: true, commandHash: true },
  });
}

export async function updateTelegramCredentialCommandHash(userId: string, sessionId: string, data: { isCommandRegister: boolean; commandHash: string }): Promise<void> {
  await prisma.botCredentialTelegram.update({
    where: { userId_platformId_sessionId: { userId, platformId: PLATFORM_TO_ID[Platforms.Telegram], sessionId } },
    data,
  });
}

export async function findAllTelegramCredentials(): Promise<BotCredentialTelegram[]> { return prisma.botCredentialTelegram.findMany(); }
export async function findAllFbPageCredentials(): Promise<BotCredentialFacebookPage[]> { return prisma.botCredentialFacebookPage.findMany(); }
export async function findAllFbMessengerCredentials(): Promise<BotCredentialFacebookMessenger[]> { return prisma.botCredentialFacebookMessenger.findMany(); }
export async function findAllBotSessions(): Promise<BotSession[]> { return prisma.botSession.findMany(); }

export async function isBotAdmin(userId: string, platform: string, sessionId: string, adminId: string): Promise<boolean> {
  const row = await prisma.botAdmin.findUnique({
    where: { userId_platformId_sessionId_adminId: { userId, platformId: toPlatformNumericId(platform), sessionId, adminId } },
    select: { adminId: true },
  });
  return row !== null;
}
