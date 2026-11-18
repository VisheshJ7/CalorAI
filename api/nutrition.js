import { generateGeminiContent } from './gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { foodItem } = req.body || {};
  if (!foodItem || typeof foodItem !== 'string') {
    return res.status(400).json({ error: 'foodItem is required' });
  }

  const prompt = `You are a precise nutrition database. For "${foodItem}", return ONLY valid JSON with:
calories (number kcal), protein (grams), carbs (grams), fats (grams),
serving_size (string), notes (one-sentence string).`;

  try {
    const text = (await generateGeminiContent(prompt))
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    const data = JSON.parse(text);
    if (!Number.isFinite(Number(data.calories)) || Number(data.calories) <= 0) {
      throw new Error('Invalid calorie value');
    }
    return res.status(200).json({
      calories: Number(data.calories),
      protein: Number(data.protein || 0),
      carbs: Number(data.carbs || 0),
      fats: Number(data.fats || 0),
      serving_size: String(data.serving_size || '1 serving'),
      notes: String(data.notes || ''),
    });
  } catch {
    return res.status(422).json({ error: 'Could not parse nutrition data. Try a more specific food name.' });
  }
}
