/* global process */
import fs from 'node:fs';
import path from 'node:path';
import { generateGeminiContent } from './gemini.js';
import { findExerciseCatalogueMatches, inferExerciseFallback, parseExerciseInference } from '../src/utils/exerciseInference.js';

function loadExerciseCatalogue() {
  const filePath = path.resolve(process.cwd(), 'public', 'exercises.json');
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { exerciseDescription, weightKg, heightCm } = req.body || {};
  if (!exerciseDescription || typeof exerciseDescription !== 'string') {
    return res.status(400).json({ error: 'exerciseDescription is required' });
  }
  if (!Number.isFinite(Number(weightKg)) || Number(weightKg) <= 0) {
    return res.status(400).json({ error: 'weightKg is required' });
  }

  const catalogue = loadExerciseCatalogue();
  const catalogueMatches = findExerciseCatalogueMatches(exerciseDescription, catalogue);
  const prompt = `Infer exercise details for "${exerciseDescription}".
The person weighs ${Number(weightKg)} kg${Number(heightCm) > 0 ? ` and is ${Number(heightCm)} cm tall` : ''}.
Use this catalogue and the person's height and weight to select the closest activity and estimate calories:
${JSON.stringify(catalogueMatches)}
Return ONLY valid JSON:
{"exerciseName":"specific exercise name","durationMinutes":number,"caloriesBurnt":number}
Distance activities must derive duration from distance and expected pace. Duration activities must use the stated duration.
Calories must be estimated for the person's weight and be a positive whole number.`;

  try {
    const text = await generateGeminiContent(prompt);
    const inference = parseExerciseInference(text);
    return res.status(200).json({ ...inference, source: 'ai' });
  } catch {
    try {
      const inference = inferExerciseFallback(
        exerciseDescription,
        Number(weightKg),
        Number(heightCm),
        catalogue,
      );
      return res.status(200).json(inference);
    } catch (fallbackError) {
      return res.status(422).json({
        error: fallbackError.message || 'Could not infer that exercise. Try a duration or distance.',
      });
    }
  }
}
