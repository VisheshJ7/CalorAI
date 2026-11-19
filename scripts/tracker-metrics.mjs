import assert from 'node:assert/strict';
import { calculateDailySummary, calculateGoalPreview } from '../src/utils/trackerMetrics.js';

assert.deepEqual(
  calculateDailySummary([
    { calories: 680, protein: 30, carbs: 95, fats: 21 },
    { calories: 420, protein: 22, carbs: 40, fats: 18 },
  ], [{ calories_burnt: 255 }], 2000),
  {
    consumed: 1100,
    exercise: 255,
    net: 845,
    remaining: 1155,
    progress: 42,
  },
);

assert.deepEqual(
  calculateGoalPreview(2734, {
    gender: 'male',
    age: 24,
    height: 179,
    weight: 76,
    activityLevel: 'moderate',
    goal: 'lose',
    weeklyChangePerWeek: 0.5,
  }),
  { maintenance: 2734, goal: 2184, changed: true },
);
