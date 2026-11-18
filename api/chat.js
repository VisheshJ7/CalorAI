import { generateGeminiContent } from './gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, systemInstruction } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const text = await generateGeminiContent(message, systemInstruction);
    return res.status(200).json({ message: text });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Gemini request failed' });
  }
}
