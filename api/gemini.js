/* global process */
import fs from 'node:fs'
import path from 'node:path'

function loadLocalGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY

  const envFiles = ['.env.local', '.env']
  for (const fileName of envFiles) {
    const filePath = path.resolve(process.cwd(), fileName)
    if (!fs.existsSync(filePath)) continue

    const content = fs.readFileSync(filePath, 'utf8')
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const separator = line.indexOf('=')
      if (separator < 0) continue
      const name = line.slice(0, separator).trim()
      if (name !== 'GEMINI_API_KEY') continue
      const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
      if (value) return value
    }
  }

  return ''
}

export const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
];

export async function generateGeminiContent(prompt, systemInstruction) {
  const apiKey = loadLocalGeminiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: systemInstruction
              ? { parts: [{ text: systemInstruction }] }
              : undefined,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'text/plain',
            },
          }),
        }
      );
    } catch (error) {
      lastError = error.name === 'AbortError'
        ? new Error(`Gemini timed out while contacting ${model}`)
        : error;
      clearTimeout(timeout);
      continue;
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('')
        .trim();
      if (!text) throw new Error('Gemini returned an empty response');
      return text;
    }

    const body = await response.json().catch(() => ({}));
    const message = body.error?.message || `Gemini returned HTTP ${response.status}`;
    lastError = new Error(message);

    if (![404, 429, 400, 503].includes(response.status)) break;
  }

  throw lastError || new Error('Gemini request failed');
}
