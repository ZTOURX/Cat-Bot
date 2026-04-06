// WHY: Abstracted safely through database workspace to support Prisma and JSON adapters.
export { 
  findDiscordCredentialState, updateDiscordCredentialCommandHash, findAllDiscordCredentials,
  findTelegramCredentialState, updateTelegramCredentialCommandHash, findAllTelegramCredentials,
  findAllFbPageCredentials, findAllFbMessengerCredentials, findAllBotSessions, isBotAdmin 
} from 'database';