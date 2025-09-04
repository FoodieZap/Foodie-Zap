// lib/aiOcr.ts
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * Extract menu-like text from an image buffer using GPT-4o Vision (chat.completions).
 * We pass a data URL to avoid hosting. Uses high detail for stability.
 */
export async function aiExtractTextFromImage(
  buffer: Buffer,
  meta?: { url?: string; mime?: string },
): Promise<string> {
  const mime =
    meta?.mime ||
    (buffer[0] === 0xff && buffer[1] === 0xd8
      ? 'image/jpeg'
      : buffer[0] === 0x89 && buffer[1] === 0x50
      ? 'image/png'
      : 'image/png')
  const b64 = buffer.toString('base64')
  const dataUrl = `data:${mime};base64,${b64}`

  const sys =
    'You are an OCR assistant for restaurant menus. Return only plain text lines with dish/drink names and prices if visible. No commentary.'
  const prompt =
    'Extract the menu text (item names and prices if present). Keep one item per line. If no prices are visible, return names only.'

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    top_p: 1,
    messages: [
      { role: 'system', content: sys },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' as any } },
        ],
      },
    ],
  })

  const txt = resp.choices?.[0]?.message?.content || ''
  return (txt || '').trim()
}
