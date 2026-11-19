const FOODS = [
  { match: ['banana'], calories: 105, protein: 1.3, carbs: 27, fats: 0.4, serving: '1 medium banana' },
  { match: ['apple'], calories: 95, protein: 0.5, carbs: 25, fats: 0.3, serving: '1 medium apple' },
  { match: ['egg', 'boiled egg'], calories: 78, protein: 6.3, carbs: 0.6, fats: 5.3, serving: '1 large egg' },
  { match: ['chicken breast'], calories: 165, protein: 31, carbs: 0, fats: 3.6, serving: '100 g cooked chicken breast' },
  { match: ['rice'], calories: 205, protein: 4.3, carbs: 45, fats: 0.4, serving: '1 cup cooked rice' },
  { match: ['oatmeal', 'oats'], calories: 158, protein: 6, carbs: 27, fats: 3.2, serving: '1 cup cooked oatmeal' },
  { match: ['dal', 'lentils'], calories: 230, protein: 18, carbs: 40, fats: 1, serving: '1 cup cooked dal' },
];

export function estimateFoodFallback(description) {
  if (!description?.trim()) throw new Error('Food description is required');
  const text = description.toLowerCase();
  const match = FOODS.find((item) => item.match.some((term) => text.includes(term)));
  if (!match) {
    throw new Error('Could not estimate that food. Try a specific food and serving size.');
  }
  const quantityMatch = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:x\s*)?/);
  const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
  const scale = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const rounded = (value) => Math.round(value * 10 * scale) / 10;
  return {
    calories: Math.round(match.calories * scale),
    protein: rounded(match.protein),
    carbs: rounded(match.carbs),
    fats: rounded(match.fats),
    serving_size: scale === 1 ? match.serving : `${scale} × ${match.serving}`,
    notes: 'Estimated locally; edit the values if your quantity or serving size differs.',
  };
}
