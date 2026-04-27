import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { createUrl } from '@/engine/utils/api.util.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WeatherLocation {
  name: string;
  degreetype: string;
}

interface WeatherCurrent {
  temperature: string;
  skycode: string;
  skytext: string;
  observationtime: string;
  feelslike: string;
  humidity: string;
  winddisplay: string;
  day: string;
  date: string;
}

interface WeatherForecast {
  low: string;
  high: string;
  skytextday: string;
  date: string;
  day: string;
  shortday: string;
  precip: string;
}

interface WeatherResult {
  location: WeatherLocation;
  current: WeatherCurrent;
  forecast: WeatherForecast[];
}

// ── Sky Emoji Map ─────────────────────────────────────────────────────────────

const SKY_EMOJI: Record<string, string> = {
  '32': '☀️',
  '34': '🌤️',
  '30': '⛅',
  '28': '🌥️',
  '26': '☁️',
  '27': '☁️',
  '29': '🌥️',
  '31': '🌙',
  '33': '🌙',
  '11': '🌧️',
  '9':  '🌦️',
  '12': '🌧️',
  '6':  '🌨️',
  '15': '❄️',
  '16': '❄️',
  '17': '⛈️',
  '35': '⛈️',
  '37': '⛈️',
  '38': '⛈️',
  '25': '🌨️',
};

function skyEmoji(skycode: string): string {
  return SKY_EMOJI[skycode] ?? '🌡️';
}

// ── Command Config ────────────────────────────────────────────────────────────

export const config: CommandConfig = {
  name: 'weather',
  aliases: ['w', 'forecast'] as string[],
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Get current weather and 5-day forecast for a location.',
  category: 'utility',
  usage: '<location>',
  cooldown: 5,
  hasPrefix: true,
};

// ── Command Handler ───────────────────────────────────────────────────────────

export const onCommand = async ({ chat, args, usage }: AppCtx): Promise<void> => {
  const query = args.join(' ').trim();
  if (!query) return usage();

  try {
    const base = createUrl('popcat', '/v2/weather');
    if (!base) throw new Error('Failed to build Weather API URL.');

    const apiUrl = `${base}?q=${encodeURIComponent(query)}`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`API responded with status ${res.status}`);

    const json = await res.json() as { error: boolean; message: WeatherResult[] };

    if (json.error || !json.message?.length) {
      throw new Error('Location not found or API returned an error.');
    }

    const results = json.message;
    const data = results[0];

    // ✅ FIX: Guard against undefined before destructuring
    if (!data) throw new Error('No weather data returned.');

    const { location, current, forecast } = data;
    const unit = location.degreetype ?? 'C';

    // ── Current conditions ──────────────────────────────────────────────────
    const currentEmoji = skyEmoji(current.skycode);
    const lines: string[] = [
      `${currentEmoji} **Weather in ${location.name}**`,
      `📅 ${current.day}, ${current.date} · 🕐 ${current.observationtime}`,
      ``,
      `🌡️ Temperature: **${current.temperature}°${unit}** (feels like **${current.feelslike}°${unit}**)`,
      `☁️ Condition: **${current.skytext}**`,
      `💧 Humidity: **${current.humidity}%**`,
      `💨 Wind: **${current.winddisplay}**`,
    ];

    // ── 5-day forecast ──────────────────────────────────────────────────────
    if (forecast.length > 0) {
      lines.push(``, `📆 **5-Day Forecast**`);
      for (const day of forecast) {
        const emoji = skyEmoji(day.skytextday.trim());
        lines.push(
          `${emoji} **${day.shortday}** — ${day.skytextday} · ⬇️ ${day.low}° ⬆️ ${day.high}° · 🌂 ${day.precip}%`
        );
      }
    }

    // ── Disambiguation note ─────────────────────────────────────────────────
    if (results.length > 1) {
      const others = results
        .slice(1)
        .map(r => r.location.name)
        .join(', ');
      lines.push(``, `ℹ️ _Other matching locations: ${others}_`);
    }

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: lines.join('\n'),
    });
  } catch (err) {
    const error = err as { message?: string };
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${error.message ?? 'Unknown error'}`,
    });
  }
};