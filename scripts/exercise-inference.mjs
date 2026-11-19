import assert from 'node:assert/strict';
import { inferExerciseFallback, parseExerciseInference } from '../src/utils/exerciseInference.js';

const aiResult = parseExerciseInference(JSON.stringify({
  exerciseName: 'Running 6 mph',
  durationMinutes: 30,
  caloriesBurnt: 344,
}));
assert.deepEqual(aiResult, {
  exerciseName: 'Running 6 mph',
  durationMinutes: 30,
  caloriesBurnt: 344,
});

const catalogue = [
  { name: 'Walking 3.5 mph, brisk pace', calories_per_kg_per_hour: 3.7974683544303796 },
];

const result = inferExerciseFallback('5KM Brisk Walk', 76, 179, catalogue);
assert.equal(result.exerciseName, 'Walking 3.5 mph, brisk pace');
assert.equal(result.durationMinutes, 53);
assert.equal(result.caloriesBurnt, 255);
assert.equal(result.source, 'catalogue');

assert.throws(
  () => parseExerciseInference('not enough information'),
  /exercise name/i,
);
