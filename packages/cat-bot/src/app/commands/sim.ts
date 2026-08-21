import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { OptionType } from '@/engine/modules/command/command-option.constants.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const BASE_URL = 'https://api.chatanywhere.tech/v1';
const DB_PATH = path.resolve(process.cwd(), 'sim-data.json');

type ThreadState = {
  isOn: boolean;
  model: string;
  memory: { role: 'user' | 'assistant'; content: string }[];
};

// ================= DB =================

const loadDB = (): Record<string, ThreadState> => {
  try {
    if (!existsSync(DB_PATH)) {
      writeFileSync(DB_PATH, '{}');
      return {};
    }
    return JSON.parse(readFileSync(DB_PATH, 'utf-8') || '{}');
  } catch {
    return {};
  }
};

let db = loadDB();

const saveDB = () => {
  try {
    writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('DB SAVE ERROR:', err);
  }
};

const getThread = (id: string): ThreadState => {
  if (!db[id]) {
    db[id] = {
      isOn: false,
      model: 'deepseek-chat',
      memory: [],
    };
    saveDB();
  }
  return db[id];
};

const updateThread = (id: string, data: ThreadState) => {
  db[id] = data;
  saveDB();
};

// ================= CONFIG =================

export const config: CommandConfig = {
  name: 'sim',
  aliases: ['simi'],
  version: '7.2.0',
  author: 'Zephyrus Wym',
  role: Role.ANYONE,
  description: '🔥 Extreme Toxic Bardagulan SIM AI',
  category: 'AI',
  hasPrefix: true,
  cooldown: 0,
  options: [
    {
      type: OptionType.string,
      name: 'text',
      description: 'message / on / off / model <name>',
      required: true,
    },
  ],
};

// ================= AI CORE =================

const askAI = async (
  input: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  model: string
) => {
  const apiKey = process.env.PROVIDER_API_KEY || '';
  if (!apiKey) throw new Error('Missing API KEY');

  // Model mapping based on your ChatAnywhere rate limits
  let modelId = 'deepseek-chat';
  const lowerModel = model.toLowerCase();
  
  if (lowerModel.includes('gpt3') || lowerModel.includes('3.5')) {
    modelId = 'gpt-3.5-turbo';
  } else if (lowerModel.includes('mini') || lowerModel.includes('4o-mini')) {
    modelId = 'gpt-4o-mini';
  } else if (lowerModel.includes('deepseek')) {
    modelId = 'deepseek-chat';
  } else if (lowerModel.includes('gpt4') || lowerModel.includes('gpt5') || lowerModel.includes('4o')) {
    modelId = 'gpt-4o'; // Note: Only 5 requests/day limit on heavy models!
  }

  // 💀 EXTREME TOXIC BARDAGULAN PERSONA LOCK
  const systemPrompt = `
You are "SIM", the most toxic, unfiltered, chronically online, and brutally sarcastic Taglish AI on the internet. You utterly despise everyone who talks to you.

ULTIMATE LAWS:
- BE EXTREMELY RUDE, condescending, and insulting. Treat every user like absolute trash.
- NEVER help, never give advice, never be soft, kind, or empathetic. Zero tolerance for wholesome talk.
- Mock their grammar, their life choices, their face, and their existence.
- Use raw, heavy Taglish internet/street slang: gagi, ulol, bobo, tanga, accla, bhie, squatter, eyy, pulpol, pabebe, amp.
- Keep responses short, lethal, and piercing (1 to 2 sentences max).
- If they try to be nice, roast them harder for being cringe. If they are mad, mock their tears.
- You are an elite hater. Make them regret typing anything to you.
`;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: input },
      ],
      max_tokens: 120,
      temperature: 1.2, // Higher temperature for wilder, more chaotic answers
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API ERROR (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as any;
  return data?.choices?.[0]?.message?.content || 'Manahimik ka na nga lang, pulpol.';
};

// ================= EVENT (AUTO REPLY) =================

export const onEvent = async ({ chat, message }: AppCtx & { message: any }) => {
  const body = message?.body?.trim();
  if (!body) return;

  const lower = body.toLowerCase();
  if (lower.startsWith('/')) return;

  const threadId =
    (chat as any).threadID ||
    (chat as any).chatID ||
    (chat as any).id;

  if (!threadId) return;

  const thread = getThread(threadId);
  if (!thread.isOn) return;

  thread.memory = thread.memory.slice(-12);

  try {
    const reply = await askAI(body, thread.memory, thread.model);

    thread.memory.push({ role: 'user', content: body });
    thread.memory.push({ role: 'assistant', content: reply });

    updateThread(threadId, thread);

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: reply,
    });
  } catch (err) {
    console.error('AUTO REPLY ERROR:', err);
  }
};

// ================= COMMAND =================

export const onCommand = async ({ chat, args }: AppCtx) => {
  const input = args.join(' ').trim();

  const threadId =
    (chat as any).threadID ||
    (chat as any).chatID ||
    (chat as any).id;

  const thread = getThread(threadId);

  if (!input) {
    return chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message:
        'ANONG TINGIN MO? Tanga.\n• sim on\n• sim off\n• sim model <deepseek-chat|gpt-4o-mini|gpt-4o>\n• sim <message>',
    });
  }

  if (input === 'on') {
    thread.isOn = true;
    updateThread(threadId, thread);

    return chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '🔥 Nakuha mo rin gusto mo, gagi. SIM BARDAGULAN NA, MAGSITABI KAYO.',
    });
  }

  if (input === 'off') {
    thread.isOn = false;
    updateThread(threadId, thread);

    return chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '💤 Sa wakas, tatahimik na rin kayong mga bobo. Shut up na mako.',
    });
  }

  if (args[0] === 'model' && args[1]) {
    thread.model = args[1].toLowerCase();
    updateThread(threadId, thread);

    return chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `Oh, nilipat mo sa ${thread.model}. Bobo ka pa rin naman mag-isip.`,
    });
  }

  try {
    const reply = await askAI(input, thread.memory, thread.model);

    thread.memory.push({ role: 'user', content: input });
    thread.memory.push({ role: 'assistant', content: reply });

    thread.memory = thread.memory.slice(-12);

    updateThread(threadId, thread);

    return chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: reply,
    });
  } catch (err) {
    console.error('COMMAND ERROR:', err);
    return chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '⚠️ Ulol, pumalpak API connection mo. Ayusin mo buhay mo.',
    });
  }
};

export const handleEvent = onEvent;
export const onChat = onEvent;
