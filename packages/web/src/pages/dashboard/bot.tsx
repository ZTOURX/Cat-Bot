import { useSearchParams, useNavigate } from 'react-router-dom'
import { Bot, ArrowLeft } from 'lucide-react'
import Tabs from '@/components/ui/navigation/Tabs'
import Progress from '@/components/ui/feedback/Progress'
import Button from '@/components/ui/buttons/Button'
import { ROUTES } from '@/constants/routes.constants'

import { useBotDetail } from '@/hooks/useBotDetail'
import { useBotStatus } from '@/hooks/useBotStatus'
import { useBotLogs } from '@/hooks/useBotLogs'
import { useBotCommands } from '@/hooks/useBotCommands'
import { useBotEvents } from '@/hooks/useBotEvents'

import { ConsoleTab } from '@/components/bot/ConsoleTab'
import { CommandsTab } from '@/components/bot/CommandsTab'
import { EventsTab } from '@/components/bot/EventsTab'
import { BotSettingsTab } from '@/components/bot/BotSettingsTab'
import { botService } from '@/services/bot.service'

/**
 * Bot detail page — reached via /dashboard/bot?id=<id>
 *
 * Uses query params instead of path segments (/dashboard/bot/:id) so the
 * route registration stays a simple static path with no dynamic segment.
 *
 * Implemented using a modular architecture: sub-panels are isolated components
 * mapping exactly to their tab boundaries.
 */
export default function BotPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const id = searchParams.get('id') ?? ''

  // Construct the full session key once the bot DTO resolves — matches the key format
  const botStatuses = useBotStatus(id ? [id] : [])
  const { bot, setBot, isLoading, error } = useBotDetail(id)
  const sessionKey = bot
    ? `${bot.userId}:${bot.platformId}:${bot.sessionId}`
    : undefined
  const { logs } = useBotLogs(sessionKey)

  // Determine active presence visual status
  const botStatus = botStatuses[id] ?? { active: false, startedAt: null }
  const isActive = botStatus.active
  const startedAt = botStatus.startedAt

  // Commands and events hooks are called unconditionally (React rules); empty id = no-op fetch
  const {
    commands,
    isLoading: commandsLoading,
    error: commandsError,
    toggleCommand,
  } = useBotCommands(id)
  const {
    events,
    isLoading: eventsLoading,
    error: eventsError,
    toggleEvent,
  } = useBotEvents(id)

  // Determine active tab from URL hash so deep-linking works
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  const defaultTab =
    hash === '#settings'
      ? 'settings'
      : hash === '#commands'
        ? 'commands'
        : hash === '#events'
          ? 'events'
          : 'console'

  if (isLoading) {
    return <Progress.Circular fullScreen message="Loading bot details..." />
  }

  // Missing or unknown bot ID — surface a clear recovery path instead of a blank page
  if (error || !bot) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-on-surface">
        <Bot className="h-12 w-12 text-on-surface-variant/40" />
        <p className="text-headline-sm font-medium">
          {error || 'Bot not found'}
        </p>
        <p className="text-body-md text-on-surface-variant">
          No bot exists with ID <code>{id || '(empty)'}</code>.
        </p>
        <Button
          variant="tonal"
          color="primary"
          size="lg"
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate(ROUTES.DASHBOARD.ROOT)}
        >
          Back to Bot Manager
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Tabs.Root defaultValue={defaultTab}>
        <Tabs.List variant="line">
          <Tabs.Tab value="console">Console</Tabs.Tab>
          <Tabs.Tab value="commands">Commands</Tabs.Tab>
          <Tabs.Tab value="events">Events</Tabs.Tab>
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panels>
          <Tabs.Panel value="console">
            <ConsoleTab
              bot={bot}
              logs={logs}
              isActive={isActive}
              startedAt={startedAt}
              onStart={() => void botService.startBot(id)}
              onStop={() => void botService.stopBot(id)}
              onRestart={() => void botService.restartBot(id)}
            />
          </Tabs.Panel>
          <Tabs.Panel value="settings">
            <BotSettingsTab
              bot={bot}
              isActive={isActive}
              onUpdateSuccess={setBot}
            />
          </Tabs.Panel>
          <Tabs.Panel value="commands">
            <CommandsTab
              commands={commands}
              isLoading={commandsLoading}
              error={commandsError}
              toggleCommand={toggleCommand}
              prefix={bot.prefix}
            />
          </Tabs.Panel>
          <Tabs.Panel value="events">
            <EventsTab
              events={events}
              isLoading={eventsLoading}
              error={eventsError}
              toggleEvent={toggleEvent}
            />
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs.Root>
    </div>
  )
}
