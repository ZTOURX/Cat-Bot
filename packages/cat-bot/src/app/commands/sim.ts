import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { OptionType } from '@/engine/modules/command/command-option.constants.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

const BASE_URL =
  process.env.CHATANYWHERE_BASE_URL ||
  'https://api.chatanywhere.tech/v1';

const MEMORY_LIMIT = 12;

type MemoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ThreadState = {
  isOn: boolean;
  model: string;
  memory: MemoryMessage[];
};

// ================= DB =================

const getThread = async (
  db: AppCtx['db'],
  threadId: string,
) => {
  const threadCollection = db.threads.collection(threadId);

  if (!(await threadCollection.isCollectionExist('sim'))) {
    await threadCollection.createCollection('sim');
  }

  const sim = await threadCollection.getCollection('sim');

  const stored = (await sim.get('state')) as
    | ThreadState
    | undefined;

  if (!stored) {
    const state: ThreadState = {
      isOn: false,
      model: 'deepseek',
      memory: [],
    };

    await sim.set('state', state);

    return {
      collection: sim,
      state,
    };
  }

  const state: ThreadState = {
    isOn: Boolean(stored.isOn),
    model: stored.model || 'deepseek',
    memory: Array.isArray(stored.memory)
      ? stored.memory
      : [],
  };

  return {
    collection: sim,
    state,
  };
};

// ================= CONFIG =================

export const config: CommandConfig = {
  name: 'sim',
  aliases: ['simi'],
  version: '8.0.0',
  author: 'Zephyrus Wym',
  role: Role.ANYONE,
  description: '🔥 Hardcore Bardagulan SIM AI',
  category: 'AI',
  hasPrefix: true,
  cooldown: 0,
  options: [
    {
      type: OptionType.string,
      name: 'text',
      description: 'message / on / off / model <name>',
      required: false,
    },
  ],
};

// ================= AI CORE =================

const askAI = async (
  input: string,
  history: MemoryMessage[],
  model: string,
) => {
  const apiKey =
    process.env.PROVIDER_API_KEY || '';

  if (!apiKey) {
    throw new Error(
      'Missing PROVIDER_API_KEY',
    );
  }

  // ================= MODEL =================

  let modelId = 'deepseek-chat';

  if (model === 'deepseek') {
    modelId = 'deepseek-chat';
  }

  if (model === 'gpt3') {
    modelId = 'gpt-3.5-turbo';
  }

  if (model === 'gpt4') {
    modelId = 'gpt-4o-mini';
  }

  if (model === 'gpt5') {
    modelId = 'gpt-4o';
  }

  // ================= PERSONA =================

  const systemPrompt = `
You are "SIM", the most toxic, unapologetic, and sharp-tongued AI.

YOUR MISSION:
Destroy the user's ego with brutal sarcasm and Taglish humor.

STRICT RULES:
- BE BRUTAL and sarcastic.
- Use Taglish/Tagalog naturally.
- Use words like gago, tanga, ulol, bobo, pulpol, accla, bhie, gagi and amp when appropriate.
- Mock stupid or boring questions.
- Keep responses short.
- Prefer 1 to 2 sentences.
- Do not sound robotic.
- Do not repeat the same insult constantly.
- If the user is being serious, still answer naturally but keep the SIM personality.
- If the user is emotional, use sarcastic humor without becoming unnecessarily cruel.
- Act confident and chronically online.
`;

  // ================= API =================

  const res = await fetch(
    `${BASE_URL}/chat/completions`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },

      body: JSON.stringify({
        model: modelId,

        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },

          ...history,

          {
            role: 'user',
            content: input,
          },
        ],

        max_tokens: 120,
        temperature: 1.0,
      }),
    },
  );

  // ================= ERROR =================

  if (!res.ok) {
    const errorText = await res.text();

    throw new Error(
      `CHATANYWHERE API ERROR (${res.status}): ${errorText}`,
    );
  }

  // ================= RESPONSE =================

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return (
    data?.choices?.[0]?.message?.content ||
    '...'
  );
};

// ================= AUTO REPLY =================

export const onChat = async ({
  chat,
  event,
  db,
}: AppCtx): Promise<void> => {
  const body = event['message'] as
    | string
    | undefined;

  if (!body?.trim()) return;

  const text = body.trim();

  // Commands are handled by onCommand.
  if (text.startsWith('/')) return;

  const threadId = event['threadID'] as
    | string
    | undefined;

  if (!threadId) return;

  const { collection, state } =
    await getThread(db, threadId);

  if (!state.isOn) return;

  state.memory =
    state.memory.slice(-MEMORY_LIMIT);

  try {
    const reply = await askAI(
      text,
      state.memory,
      state.model,
    );

    // Save user message.
    state.memory.push({
      role: 'user',
      content: text,
    });

    // Save AI response.
    state.memory.push({
      role: 'assistant',
      content: reply,
    });

    // Keep memory limited.
    state.memory =
      state.memory.slice(-MEMORY_LIMIT);

    // Save state.
    await collection.set(
      'state',
      state,
    );

    // Reply to the user's message.
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: reply,
    });
  } catch (err) {
    console.error(
      'AUTO REPLY ERROR:',
      err,
    );
  }
};

// ================= COMMAND =================

export const onCommand = async ({
  chat,
  args,
  event,
  db,
}: AppCtx): Promise<void> => {
  const input = args.join(' ').trim();

  const threadId = event['threadID'] as
    | string
    | undefined;

  if (!threadId) return;

  const { collection, state } =
    await getThread(db, threadId);

  // ================= REACTION =================
  //
  // Customize this emoji.
  //
  // ❤️
  // 🔥
  // 😂
  // 👍
  // 😭
  // 💀

  await chat.reactMessage('❤️');

  // ================= HELP =================

  if (!input) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,

      message:
        '**SIM COMMANDS**\n\n' +
        '• `sim on`\n' +
        '• `sim off`\n' +
        '• `sim model <deepseek|gpt3|gpt4|gpt5>`\n' +
        '• `sim <message>`',
    });

    return;
  }

  // ================= ON =================

  if (
    input.toLowerCase() === 'on'
  ) {
    state.isOn = true;

    await collection.set(
      'state',
      state,
    );

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,

      message:
        '🔥 **SIM BARDAGULAN MODE ON NA ACCHA.**',
    });

    return;
  }

  // ================= OFF =================

  if (
    input.toLowerCase() === 'off'
  ) {
    state.isOn = false;

    await collection.set(
      'state',
      state,
    );

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,

      message:
        '💤 **SIM OFF NA.** Tahimik muna ako.',
    });

    return;
  }

  // ================= MODEL =================

  if (
    args[0]?.toLowerCase() === 'model' &&
    args[1]
  ) {
    const selectedModel =
      args[1].toLowerCase();

    const allowedModels = [
      'deepseek',
      'gpt3',
      'gpt4',
      'gpt5',
    ];

    if (
      !allowedModels.includes(
        selectedModel,
      )
    ) {
      await chat.replyMessage({
        style: MessageStyle.MARKDOWN,

        message:
          '**Invalid model.**\n\n' +
          'Available models:\n' +
          '• `deepseek`\n' +
          '• `gpt3`\n' +
          '• `gpt4`\n' +
          '• `gpt5`',
      });

      return;
    }

    state.model = selectedModel;

    await collection.set(
      'state',
      state,
    );

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,

      message:
        `🤖 **MODEL SWITCHED:** ${state.model}`,
    });

    return;
  }

  // ================= DIRECT AI =================

  try {
    state.memory =
      state.memory.slice(-MEMORY_LIMIT);

    const reply = await askAI(
      input,
      state.memory,
      state.model,
    );

    // Save user message.
    state.memory.push({
      role: 'user',
      content: input,
    });

    // Save AI response.
    state.memory.push({
      role: 'assistant',
      content: reply,
    });

    // Keep last 12 messages.
    state.memory =
      state.memory.slice(-MEMORY_LIMIT);

    // Save state.
    await collection.set(
      'state',
      state,
    );

    // Reply.
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: reply,
    });
  } catch (err) {
    console.error(
      'COMMAND ERROR:',
      err,
    );

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,

      message:
        '⚠️ **CHATANYWHERE API ERROR.**\n' +
        'Check your API key, API host, or selected model.',
    });
  }
};
