import assert from 'node:assert/strict';
import { estimateFoodFallback } from '../src/utils/foodEstimate.js';

const banana = estimateFoodFallback('1 medium banana');
assert.equal(banana.calories, 105);
assert.equal(banana.protein, 1.3);
assert.equal(banana.carbs, 27);
assert.equal(banana.fats, 0.4);

assert.throws(() => estimateFoodFallback(''), /food description/i);
