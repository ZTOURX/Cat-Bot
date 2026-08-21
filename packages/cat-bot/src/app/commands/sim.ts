import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

const BASE_URL =
  process.env.CHATANYWHERE_BASE_URL ||
  'https://api.chatanywhere.org/v1';

const DEFAULT_MODEL = 'deepseek';
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
  usage: [
    'sim',
    'sim on',
    'sim off',
    'sim model <gpt3|gpt4|gpt5|deepseek>',
    'sim <message>',
  ],
};

// ================= DATABASE =================

const getThread = async (
  db: AppCtx['db'],
  threadId: string,
) => {
  const threadColl = db.threads.collection(threadId);

  if (!(await threadColl.isCollectionExist('sim'))) {
    await threadColl.createCollection('sim');
  }

  const sim = await threadColl.getCollection('sim');

  const stored = (await sim.get('state')) as
    | ThreadState
    | undefined;

  if (!stored) {
    const state: ThreadState = {
      isOn: false,
      model: DEFAULT_MODEL,
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
    model: stored.model || DEFAULT_MODEL,
    memory: Array.isArray(stored.memory)
      ? stored.memory
      : [],
  };

  return {
    collection: sim,
    state,
  };
};

// ================= AI CORE =================

const askAI = async (
  input: string,
  history: MemoryMessage[],
  model: string,
): Promise<string> => {
  const apiKey = process.env.PROVIDER_API_KEY || '';

  if (!apiKey) {
    throw new Error('Missing PROVIDER_API_KEY');
  }

  // ================= MODEL MAPPING =================

  let modelId = 'deepseek-chat';

  const selectedModel = model.toLowerCase();

  if (selectedModel === 'gpt3') {
    modelId = 'gpt-3.5-turbo';
  }

  if (selectedModel === 'gpt4') {
    modelId = 'gpt-4o-mini';
  }

  if (selectedModel === 'gpt5') {
    modelId = 'gpt-4o';
  }

  if (
    selectedModel === 'deepseek' ||
    selectedModel === 'deepseek-chat'
  ) {
    modelId = 'deepseek-chat';
  }

  // ================= PERSONA =================

  const systemPrompt = `
You are "SIM", the most toxic, unapologetic, sharp-tongued, chronically online Taglish AI.

YOUR PERSONALITY:
- Brutally sarcastic.
- Extremely confident.
- Street-smart Taglish.
- Short and entertaining.
- You roast the user's questions and statements.
- You act like the user is wasting your electricity.

STRICT RULES:
- Use Taglish/Tagalog naturally.
- Use internet/street slang when appropriate.
- Words such as gago, tanga, ulol, bobo, pulpol, accla, bhie, gagi, amp and similar slang are allowed.
- Do not sound robotic.
- Do not repeat the exact same insult every response.
- Keep responses short.
- Prefer 1-2 sentences.
- If the user asks something simple, answer it with sarcasm.
- If the user is being serious, remain sarcastic but still answer when appropriate.
- If the user is emotional, respond with sarcastic humor rather than becoming overly sentimental.
`;

  // ================= API REQUEST =================

  const response = await fetch(
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

  // ================= API ERROR =================

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `CHATANYWHERE API ERROR (${response.status}): ${errorText}`,
    );
  }

  // ================= API RESPONSE =================

  const data = (await response.json()) as {
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

// ================= EVENT / AUTO REPLY =================

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

  // Don't process commands as normal SIM messages.
  if (text.startsWith('/')) return;

  const threadId = event['threadID'] as
    | string
    | undefined;

  if (!threadId) return;

  const { collection, state } =
    await getThread(db, threadId);

  // SIM must be enabled.
  if (!state.isOn) return;

  // Keep only recent memory.
  state.memory = state.memory.slice(
    -MEMORY_LIMIT,
  );

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

    // Limit memory.
    state.memory = state.memory.slice(
      -MEMORY_LIMIT,
    );

    // Save state.
    await collection.set('state', state);

    // Reply to the triggering message.
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: reply,
    });
  } catch (error) {
    console.error(
      'SIM AUTO REPLY ERROR:',
      error,
    );
  }
};

// ================= COMMAND =================

export const onCommand = async ({
  chat,
  args,
  db,
  event,
}: AppCtx): Promise<void> => {
  const threadId = event['threadID'] as
    | string
    | undefined;

  if (!threadId) return;

  const { collection, state } =
    await getThread(db, threadId);

  const input = args.join(' ').trim();

  // ================= COMMAND REACTION =================
  // Change this emoji to whatever you want.

  await chat.reactMessage('❤️');

  // ================= HELP =================

  if (!input) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,

      message:
        '**🔥 SIM COMMANDS**\n\n' +
        '• `sim on` — Enable SIM\n' +
        '• `sim off` — Disable SIM\n' +
        '• `sim model <name>` — Change model\n' +
        '• `sim <message>` — Talk to SIM\n\n' +
        '**Models:**\n' +
        '• `deepseek`\n' +
        '• `gpt3`\n' +
        '• `gpt4`\n' +
        '• `gpt5`',
    });

    return;
  }

  // ================= ON =================

  if (input.toLowerCase() === 'on') {
    state.isOn = true;

    await collection.set(
      'state',
      state,
    );

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,

      message:
        '🔥 **SIM BARDAGULAN MODE ON.** Magsitabi kayo, mga gagi.',
    });

    return;
  }

  // ================= OFF =================

  if (input.toLowerCase() === 'off') {
    state.isOn = false;

    await collection.set(
      'state',
      state,
    );

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,

      message:
        '💤 **SIM OFF.** Sa wakas, tahimik na rin.',
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
      'deepseek-chat',
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
          '⚠️ **Invalid model.**\n\n' +
          'Available:\n' +
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

  // ================= DIRECT AI COMMAND =================

  try {
    state.memory = state.memory.slice(
      -MEMORY_LIMIT,
    );

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

    // Limit memory.
    state.memory = state.memory.slice(
      -MEMORY_LIMIT,
    );

    // Save state.
    await collection.set(
      'state',
      state,
    );

    // Send response.
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: reply,
    });
  } catch (error) {
    console.error(
      'SIM COMMAND ERROR:',
      error,
    );

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,

      message:
        '⚠️ **CHATANYWHERE API ERROR.**\n' +
        'Check your `PROVIDER_API_KEY`, API host, and model.',
    });
  }
};
