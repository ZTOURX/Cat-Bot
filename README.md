<div align="center">
  <img src="assets/cover.png" alt="Cat-Bot Cover" width="100%" />

  <h1>Cat-Bot</h1>

  <p><strong>Write once. Deploy everywhere.</strong></p>
  <p>
    A unified multi-platform, multi-instance chatbot framework for Discord, Telegram,
    Facebook Page, and Facebook Messenger — managed from a single dashboard.
  </p>

  <p>
    <img src="https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord" />
    <img src="https://img.shields.io/badge/Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram" />
    <img src="https://img.shields.io/badge/Facebook_Page-0866FF?style=for-the-badge&logo=facebook&logoColor=white" alt="Facebook Page" />
    <img src="https://img.shields.io/badge/Facebook_Messenger-0084FF?style=for-the-badge&logo=messenger&logoColor=white" alt="Facebook Messenger" />
  </p>

  <p>
    <img src="https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript" alt="TypeScript 5.9" />
    <img src="https://img.shields.io/badge/Node.js-ESM-green?logo=node.js" alt="Node.js ESM" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19" />
    <img src="https://img.shields.io/badge/License-ISC-lightgrey" alt="License ISC" />
  </p>

  <p>
    <a href="https://github.com/johnlester-0369/Cat-Bot">GitHub Repository</a>
  </p>
</div>

---

## The Problem

Most chatbot projects are locked into one platform and one running instance. Deploying on Discord *and* Telegram means writing two separate codebases. Each SDK has its own event model, attachment format, button system, and conversation-state pattern — quadruple the surface area, quadruple the maintenance.

Cat-Bot solves both problems simultaneously:

- **Multi-platform** — one command module runs natively on Discord, Telegram, Facebook Page, and Facebook Messenger. No `if platform === 'discord'` branches in your handler code.
- **Multi-instance** — any number of independent bot sessions run concurrently, each with its own credentials, prefix, command roster, and admin list, all controlled from a single web dashboard.

The platform transport layer absorbs every SDK difference (discord.js gateway, Telegraf polling, fca-unofficial MQTT, Graph API webhooks). Your command code calls `await chat.replyMessage({ message: 'Hello!' })` and it works everywhere.

---

## Table of Contents

1. [Quick Start — 5 Minutes](#quick-start--5-minutes)
2. [What Cat-Bot Provides](#what-cat-bot-provides)
3. [Screenshots](#screenshots)
4. [Features](#features)
5. [Architecture](#architecture)
6. [Production Setup](#production-setup)
7. [Writing Commands](#writing-commands)
8. [Writing Event Handlers](#writing-event-handlers)
9. [Developer Reference](#developer-reference)
10. [Database Adapters](#database-adapters)
11. [Environment Variables](#environment-variables)
12. [npm Scripts](#npm-scripts)
13. [Authors](#authors)

---

## Quick Start — 5 Minutes

The `json` adapter stores everything in a single flat file with no external database. It is the fastest path from clone to running bot.

**Prerequisites:** Node.js 20+, npm 10+

### 1. Clone and install

```bash
git clone https://github.com/johnlester-0369/Cat-Bot.git
cd Cat-Bot
npm install
```

### 2. Configure environment

```bash
cd packages/cat-bot
cp .env.example .env
```

Minimum required fields for local development:

```env
PORT=3000
NODE_ENV=development
DATABASE_TYPE=json

# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=your_secret_here
BETTER_AUTH_URL=http://localhost:3000
VITE_URL=http://localhost:5173

# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=your_64_hex_char_key_here
```

### 3. Create your admin account

```bash
npm run seed:admin -w packages/cat-bot
```

Follow the interactive prompt. This account works for both the user portal (`/login`) and the admin portal (`/admin`).

### 4. Start the bot engine and dashboard

```bash
# Terminal 1 — bot engine
npm run dev

# Terminal 2 — web dashboard
npm run dev:web
```

- **Dashboard:** http://localhost:5173
- **API:** http://localhost:3000

### 5. Add your first bot

1. Open http://localhost:5173 and sign in.
2. Click **Create New Bot**.
3. Select a platform and paste your credentials (Discord bot token, Telegram token, etc.).
4. Click **Verify** — Cat-Bot validates credentials against the live platform API before saving.
5. Click **Create**. The bot starts automatically.

> **Hot reload:** Command files in `packages/cat-bot/src/app/commands/` are watched by `tsx watch`. Save a file and the changes are live.

---

## What Cat-Bot Provides

The core insight is that the *bot problem* and the *platform problem* are separate concerns. Cat-Bot handles the platform problem so your code only addresses the bot problem.

### One API surface for four platforms

Every platform SDK solves the same tasks differently. Here is what sending a single message looks like natively, and what it looks like in Cat-Bot:

<table>
<tr><th>Native (four different SDKs)</th><th>Cat-Bot (one call)</th></tr>
<tr>
<td>

```js
// discord.js — slash command
await interaction.deferReply()
await interaction.editReply('Hello!')

// Telegraf
await ctx.reply('Hello!')

// fca-unofficial
api.sendMessage({ body: 'Hello!' }, threadID, cb)

// Facebook Page — raw HTTP
await axios.post(graphUrl, {
  recipient: { id: psid },
  message: { text: 'Hello!' }
})
```

</td>
<td>

```ts
await chat.replyMessage({
  style: MessageStyle.MARKDOWN,
  message: '**Hello!**',
})
```

</td>
</tr>
</table>

The same unification applies to file attachments, interactive buttons, conversation flows, and group management — all documented in the [Developer Reference](#developer-reference).

### Scoped conversation state

The standard global-array pattern creates race conditions the moment two users run the same command simultaneously:

```js
// ❌ Old pattern — shared mutable global, concurrent users corrupt each other's state
global.client.handleReply.push({
  name: 'quiz', messageID: info.messageID, author: event.senderID, answer: 'True'
})
```

Cat-Bot scopes every pending state to a composite key (`messageId:userId` for private flows, `messageId:threadId` for public flows):

```ts
// ✅ Cat-Bot — isolated per message and per user, zero global mutations
state.create({
  id: state.generateID({ id: String(messageID) }),
  state: 'awaiting_answer',
  context: { answer: 'True' },
})
```

Two users running the same flow simultaneously each have a completely independent state entry.

---

## Screenshots

### User Portal

<table>
  <tr>
    <td align="center"><strong>Home</strong></td>
    <td align="center"><strong>Login</strong></td>
    <td align="center"><strong>Sign Up</strong></td>
  </tr>
  <tr>
    <td><img src="assets/users/home.png" alt="Home Page" /></td>
    <td><img src="assets/users/login.png" alt="Login" /></td>
    <td><img src="assets/users/sign-up.png" alt="Sign Up" /></td>
  </tr>
</table>

<table>
  <tr>
    <td align="center"><strong>Bot Manager</strong></td>
    <td align="center"><strong>User Settings</strong></td>
  </tr>
  <tr>
    <td><img src="assets/users/dashboard.png" alt="Dashboard" /></td>
    <td><img src="assets/users/dashboard-settings.png" alt="Settings" /></td>
  </tr>
</table>

**Create New Bot — 3-Step Wizard**

<table>
  <tr>
    <td align="center"><strong>Step 1 — Identity</strong></td>
    <td align="center"><strong>Step 2 — Platform & Credentials</strong></td>
  </tr>
  <tr>
    <td><img src="assets/users/create-new-bot-step-1.png" alt="Create Bot Step 1" /></td>
    <td><img src="assets/users/create-new-bot-step-2-select-platform.png" alt="Create Bot Step 2" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Step 2 — Verified</strong></td>
    <td align="center"><strong>Step 3 — Review</strong></td>
  </tr>
  <tr>
    <td><img src="assets/users/create-new-bot-step-2-verified.png" alt="Credentials Verified" /></td>
    <td><img src="assets/users/create-new-bot-step-3.png" alt="Create Bot Step 3" /></td>
  </tr>
</table>

**Bot Detail Tabs**

<table>
  <tr>
    <td align="center"><strong>Live Console</strong></td>
    <td align="center"><strong>Commands</strong></td>
  </tr>
  <tr>
    <td><img src="assets/users/dashboard-bot-console.png" alt="Bot Console" /></td>
    <td><img src="assets/users/dashboard-bot-commands.png" alt="Bot Commands" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Event Handlers</strong></td>
    <td align="center"><strong>Bot Settings</strong></td>
  </tr>
  <tr>
    <td><img src="assets/users/dashboard-bot-events.png" alt="Bot Events" /></td>
    <td><img src="assets/users/dashboard-bot-settings.png" alt="Bot Settings" /></td>
  </tr>
</table>

### Admin Portal

<table>
  <tr>
    <td align="center"><strong>Admin Login</strong></td>
    <td align="center"><strong>Admin Dashboard</strong></td>
  </tr>
  <tr>
    <td><img src="assets/admin/login.png" alt="Admin Login" /></td>
    <td><img src="assets/admin/dashboard.png" alt="Admin Dashboard" /></td>
  </tr>
  <tr>
    <td align="center"><strong>User Management</strong></td>
    <td align="center"><strong>Bot Sessions (All Users)</strong></td>
  </tr>
  <tr>
    <td><img src="assets/admin/dashboard-users.png" alt="Admin Users" /></td>
    <td><img src="assets/admin/dashboard-bot-sessions.png" alt="Admin Bot Sessions" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Admin Settings</strong></td>
  </tr>
  <tr>
    <td><img src="assets/admin/dashboard-settings.png" alt="Admin Settings" /></td>
  </tr>
</table>

---

## Features

| Feature | Description |
|---|---|
| **Multi-platform** | One command module runs on Discord, Telegram, Facebook Page, and Facebook Messenger — no per-platform branches in your handler code |
| **Multi-instance** | Run any number of independent bot sessions concurrently, each with its own credentials, prefix, and admin list |
| **Unified Dashboard** | React 19 SPA — monitor live logs, toggle commands on/off per session, update credentials, start/stop/restart bots |
| **Conversation State** | Scoped `onReply` and `onReact` flows replace the global-array anti-pattern; concurrent users never interfere with each other's flow |
| **Interactive Buttons** | `export const button` in your command file — Discord gets `ActionRowBuilder`, Telegram gets inline keyboards, Messenger gets a numbered text menu, Facebook Page gets a Button Template |
| **Admin Portal** | Independent admin dashboard with separate session cookies — ban users, halt their sessions, manage system admins |
| **Pluggable Database** | Switch between SQLite (Prisma), JSON, MongoDB, and Neon PostgreSQL via one environment variable; 12 bidirectional migration scripts included |
| **Role-Based Access** | Five role levels (`ANYONE`, `THREAD_ADMIN`, `BOT_ADMIN`, `PREMIUM`, `SYSTEM_ADMIN`) enforced by middleware before `onCommand` runs |
| **Cooldown & Ban System** | Per-user cooldown and per-user/per-thread bans enforced by the middleware pipeline |
| **Slash Command Sync** | Discord and Telegram slash menus stay current with a SHA-based idempotency gate — no redundant REST calls on restart |
| **Economy API** | Built-in `currencies` context (`getMoney`, `increaseMoney`, `decreaseMoney`) backed by the active database adapter |
| **AI Agent** | Groq-powered ReAct agent with `execute_command`, `test_command`, and `help` tools accessible from chat |
| **Live Log Streaming** | Socket.IO pushes bot console output to the dashboard in real time with a 100-entry sliding window buffer |

---

## Architecture

Cat-Bot is an ESM TypeScript monorepo with three independent packages.

```
Cat-Bot/
├── packages/
│   ├── cat-bot/          — Bot engine + Express REST API + Socket.IO
│   │   ├── src/engine/   — Platform adapters, middleware pipeline, controller/dispatcher layer
│   │   └── src/server/   — Dashboard API, better-auth, Facebook Page webhook receiver
│   ├── database/         — Raw database adapters; selected by DATABASE_TYPE env var
│   │   └── adapters/
│   │       ├── json/            — Flat JSON file; zero runtime dependencies
│   │       ├── prisma-sqlite/   — Prisma v7 + better-sqlite3 (default)
│   │       ├── mongodb/         — MongoDB driver adapter
│   │       └── neondb/          — Neon PostgreSQL (node-postgres)
│   └── web/              — Vite + React 19 management dashboard SPA
└── packages/cat-bot/src/app/
    ├── commands/          — Your command modules (one file each)
    └── events/            — Your event handler modules
```

Every incoming message from every platform follows this fixed path:

```
Platform Transport  →  Middleware Chain       →  Controller Dispatch
  (Discord /            enforceNotBanned          onCommand / onReply /
   Telegram /           enforcePermission          onReact / onEvent /
   Messenger /          enforceCooldown            button.onClick
   Facebook Page)       chatPassthrough
```

The `UnifiedApi` abstract class sits between your command code and the platform SDKs. Calling `chat.replyMessage()` triggers `editReply()` on Discord, `ctx.reply()` on Telegram, `api.sendMessage()` on Messenger, and a Graph API POST on Facebook Page — all from the same call site.

For deep-dive architecture documentation covering each platform adapter, the middleware pipeline, the database access pattern, and the web dashboard: see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Production Setup

For production deployments use **NeonDB** (serverless PostgreSQL) or **MongoDB** for durable persistence. Both support the full feature set.

### Option A — NeonDB (Recommended)

NeonDB runs schema initialization automatically at boot via the `dbReady` promise — no manual migration step.

1. Create a project at [console.neon.tech](https://console.neon.tech) and copy the connection string.

2. Set environment variables:

```env
DATABASE_TYPE=neondb
NEON_DATABASE_URL=postgres://username:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require

BETTER_AUTH_SECRET=your_production_secret
BETTER_AUTH_URL=https://your-domain.com
ENCRYPTION_KEY=your_64_hex_char_key_here

NODE_ENV=production
LOG_LEVEL=warn
```

3. Run the better-auth schema migration (required once, for auth tables):

```bash
cd packages/cat-bot
npx @better-auth/cli migrate
```

4. Seed the admin account:

```bash
npm run seed:admin -w packages/cat-bot
```

5. Build and start:

```bash
npm run build:db      # compile the database package
npm run build         # compile cat-bot
npm run build:web     # compile the React dashboard
npm start             # serves everything from one process
```

### Option B — MongoDB

MongoDB Atlas M0 (free tier) works without changes.

```env
DATABASE_TYPE=mongodb
MONGODB_URI=mongodb+srv://username:<PASSWORD>@cluster0.mongodb.net?retryWrites=true&w=majority
MONGO_PASSWORD=your_mongodb_password
MONGO_DATABASE_NAME=catbot
```

Then seed, build, and start as above.

### Telegram Webhooks (optional)

By default, Telegram sessions use long-polling — no public domain required. For webhook mode:

```env
TELEGRAM_WEBHOOK_DOMAIN=https://your-domain.com
```

The Telegram adapter switches to webhook mode automatically when this variable is present.

---

## Writing Commands

Create a file in `packages/cat-bot/src/app/commands/`. The engine loads every `.ts`/`.js` file in this directory at startup.

### Minimal command

```ts
// src/app/commands/hello.ts
import type { AppCtx } from '@/engine/types/controller.types.js'
import type { CommandConfig } from '@/engine/types/module-config.types.js'
import { Role } from '@/engine/constants/role.constants.js'
import { MessageStyle } from '@/engine/constants/message-style.constants.js'

export const config: CommandConfig = {
  name: 'hello',
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'your-name',
  description: 'Says hello',
  usage: '',
  cooldown: 5,
  hasPrefix: true,
}

export const onCommand = async ({ chat }: AppCtx): Promise<void> => {
  await chat.replyMessage({
    style: MessageStyle.MARKDOWN,
    message: '👋 **Hello, world!**',
  })
}
```

### CommandConfig fields

| Field | Required | Description |
|---|---|---|
| `name` | ✅ | Command name (lowercase). Matched after the prefix is stripped. |
| `version` | ✅ | Semantic version string. |
| `role` | ✅ | Minimum role. Use `Role.ANYONE` for public commands. |
| `author` | ✅ | Author name shown in help output. |
| `description` | ✅ | One-line description; shown in Discord's `/` menu. |
| `cooldown` | ✅ | Per-user cooldown in seconds. `0` disables. |
| `aliases` | — | Alternative command names that map to the same handler. |
| `platform` | — | Restrict to specific platforms. Absent = all platforms. |
| `hasPrefix` | — | Set `false` for prefix-less (on-chat) commands. |
| `options` | — | Named options for slash command typed arguments. |
| `guide` | — | Multi-line usage guide shown by `ctx.usage()`. |

### Conversation flows

```ts
const STATE = { awaiting_name: 'awaiting_name', awaiting_age: 'awaiting_age' }

export const onReply = {
  [STATE.awaiting_name]: async ({ chat, session, event, state }: AppCtx) => {
    const name = event['message'] as string
    const msgId = await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '**How old are you?**',
    })
    state.delete(session.id)
    if (msgId) {
      state.create({
        id: state.generateID({ id: String(msgId) }),
        state: STATE.awaiting_age,
        context: { name },
      })
    }
  },
  [STATE.awaiting_age]: async ({ chat, session, event, state }: AppCtx) => {
    const { name } = session.context as { name: string }
    state.delete(session.id)
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `✅ Registered: **${name}**, age **${event['message'] as string}**`,
    })
  },
}

export const onCommand = async ({ chat, state }: AppCtx) => {
  const msgId = await chat.replyMessage({
    style: MessageStyle.MARKDOWN,
    message: '**Step 1/2:** What is your name?',
  })
  if (!msgId) return
  state.create({
    id: state.generateID({ id: String(msgId) }),
    state: STATE.awaiting_name,
    context: {},
  })
}
```

### Interactive buttons

```ts
import { ButtonStyle } from '@/engine/constants/button-style.constants.js'

export const button = {
  confirm: {
    label: '✅ Confirm',
    style: ButtonStyle.SUCCESS,
    onClick: async ({ chat, event }: AppCtx) => {
      await chat.editMessage({
        message_id_to_edit: event['messageID'] as string,
        message: '✅ Confirmed!',
        button: [],  // clear buttons after the action
      })
    },
  },
  cancel: {
    label: '❌ Cancel',
    style: ButtonStyle.DANGER,
    onClick: async ({ chat, event }: AppCtx) => {
      await chat.editMessage({
        message_id_to_edit: event['messageID'] as string,
        message: '❌ Cancelled.',
        button: [],
      })
    },
  },
}

export const onCommand = async ({ chat, button: btn }: AppCtx) => {
  const confirmId = btn.generateID({ id: 'confirm' })
  const cancelId = btn.generateID({ id: 'cancel' })
  await chat.replyMessage({
    style: MessageStyle.MARKDOWN,
    message: '**Are you sure?**',
    button: [confirmId, cancelId],
  })
}
```

> On Discord this produces an `ActionRowBuilder` with two buttons. On Telegram it produces an inline keyboard. On Messenger it produces a numbered text menu. On Facebook Page it produces a Button Template. The same `button` export drives all four outcomes.

### Platform filtering

```ts
import { Platforms } from '@/engine/modules/platform/platform.constants.js'

export const config: CommandConfig = {
  // ...
  platform: [Platforms.Discord, Platforms.Telegram],
}
```

### AppCtx quick reference

| Field | Description |
|---|---|
| `chat` | Send, edit, react — `reply`, `replyMessage`, `editMessage`, `reactMessage`, `unsendMessage` |
| `thread` | Group operations — `setName`, `setImage`, `addUser`, `removeUser`, `getInfo` |
| `user` | `getInfo(uid)`, `getName(uid)`, `getAvatarUrl(uid)` |
| `state` | Pending state CRUD — `generateID`, `create`, `delete` |
| `button` | Button lifecycle — `generateID`, `createContext`, `update` |
| `session` | Auto-resolved flow context in `onReply`/`onReact`/`onClick` — `id`, `state`, `context` |
| `db` | Per-user and per-thread collections — `db.users.collection(uid)`, `db.threads.collection(tid)` |
| `currencies` | Economy — `getMoney`, `increaseMoney`, `decreaseMoney` |
| `args` | Token array after the command name |
| `options` | Named slash-command / `key:value` options |
| `event` | Raw unified event (`senderID`, `threadID`, `messageID`, `message`, …) |
| `native` | Platform identity + raw platform object for SDK-level access |
| `logger` | Session-scoped structured logger |
| `prefix` | Active command prefix |
| `usage` | Replies with the formatted usage guide |

---

## Writing Event Handlers

Create a file in `packages/cat-bot/src/app/events/`.

```ts
// src/app/events/join.ts
import type { AppCtx } from '@/engine/types/controller.types.js'
import type { EventConfig } from '@/engine/types/module-config.types.js'
import { MessageStyle } from '@/engine/constants/message-style.constants.js'

export const config: EventConfig = {
  name: 'join',
  eventType: ['log:subscribe'],
  version: '1.0.0',
  author: 'your-name',
  description: 'Welcomes new members',
}

export const onEvent = async ({ chat, event }: AppCtx): Promise<void> => {
  const data = event['logMessageData'] as Record<string, unknown> | undefined
  const added = (data?.['addedParticipants'] as Record<string, unknown>[]) ?? []
  for (const p of added) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `👋 Welcome **${String(p['fullName'] ?? p['firstName'] ?? 'new member')}**!`,
    })
  }
}
```

**Common `eventType` values:**

| Value | Trigger |
|---|---|
| `log:subscribe` | Member(s) joined a group |
| `log:unsubscribe` | Member left or was removed |
| `log:thread-name` | Group name changed |
| `log:thread-image` | Group photo changed |
| `log:thread-icon` | Group emoji changed |
| `log:user-nickname` | A nickname was changed |
| `change_thread_admins` | Admin status changed |

---

## Developer Reference

The complete API reference for command and event module authors — including every `AppCtx` field, the full Chat API, State API, Button API, conversation flow patterns, native platform access, database collections, middleware extension, and migration notes from GoatBot/Mirai — is in:

**[`DOCS.md`](DOCS.md)**

It covers, among other things:

- Side-by-side comparisons of native SDK code vs. the Cat-Bot equivalent for every major operation
- How the 3-second Discord acknowledgment window is handled transparently
- The button ownership model and how `public: true` opts into thread-scoped buttons
- How to extend the middleware pipeline with custom guards
- The full `onReply`, `onReact`, and `button.onClick` lifecycle contract
- Native platform access patterns (`native.ctx` on Telegram, `native.message` on Discord, `native.api` on Messenger, `native.messaging` on Facebook Page)

---

## Database Adapters

| Adapter | `DATABASE_TYPE` | Best For | Notes |
|---|---|---|---|
| **JSON** | `json` | Local development, demos | Zero runtime deps; data in `packages/database/database/database.json`; not suitable for production |
| **Prisma + SQLite** | *(unset)* | Single-server production | Requires `prisma generate` + `prisma migrate dev`; WAL mode enabled for concurrent reads |
| **MongoDB** | `mongodb` | Production, cloud | Atlas M0 free tier supported; non-transactional on M0 |
| **NeonDB** | `neondb` | Production, serverless | Schema auto-initialized at boot via `dbReady` promise; connection pooling via `pg.Pool` |

### Switching adapters

Change `DATABASE_TYPE` in `.env` and restart. To migrate existing data, use one of the 12 cross-adapter scripts:

```bash
# Example: move data from JSON to NeonDB
npx tsx packages/database/scripts/migrate-json-to-neondb.ts
```

All bidirectional migration directions (`json ↔ sqlite ↔ mongodb ↔ neondb`) are available in `packages/database/scripts/`.

---

## Environment Variables

Full reference from `packages/cat-bot/.env.example`:

```env
# Server
PORT=3000
NODE_ENV=development               # development | production
LOG_LEVEL=info                     # error | warn | info | http | verbose | debug | silly

# Auth
BETTER_AUTH_SECRET=                # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
VITE_URL=http://localhost:5173     # dev proxy origin

# Database — choose one
DATABASE_TYPE=json                 # json | mongodb | neondb | (unset = prisma-sqlite)

# NeonDB (when DATABASE_TYPE=neondb)
NEON_DATABASE_URL=postgres://...

# MongoDB (when DATABASE_TYPE=mongodb)
MONGODB_URI=mongodb+srv://username:<PASSWORD>@cluster0.mongodb.net?...
MONGO_PASSWORD=
MONGO_DATABASE_NAME=catbot

# Telegram Webhooks (optional; omit for long-polling)
TELEGRAM_WEBHOOK_DOMAIN=https://your-domain.com

# Credential encryption at rest
ENCRYPTION_KEY=                    # openssl rand -hex 32
```

---

## npm Scripts

### Monorepo root

| Script | Description |
|---|---|
| `npm run dev` | Start bot engine in watch mode (`tsx watch`) |
| `npm run dev:web` | Start Vite dev server for the dashboard |
| `npm run build:db` | Compile the database package |
| `npm run build` | Compile cat-bot (TypeScript + tsc-alias) |
| `npm run build:web` | Compile the React dashboard |
| `npm start` | Start the compiled production server |
| `npm test` | Run Vitest unit and integration tests |

### `packages/cat-bot`

| Script | Description |
|---|---|
| `npm run seed:admin` | Create the initial system admin account |
| `npm run reset:password` | Reset an admin account password |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run test:watch` | Vitest in watch mode |

---

## Authors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/johnlester-0369">
        <img src="https://github.com/johnlester-0369.png" width="80" height="80" style="border-radius:50%" alt="John Lester" /><br />
        <strong>John Lester</strong>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/ajirodesu">
        <img src="https://github.com/ajirodesu.png" width="80" height="80" style="border-radius:50%" alt="Lance Cochangco" /><br />
        <strong>Lance Cochangco</strong>
      </a>
    </td>
  </tr>
</table>

---

**[https://github.com/johnlester-0369/Cat-Bot](https://github.com/johnlester-0369/Cat-Bot)** · ISC License