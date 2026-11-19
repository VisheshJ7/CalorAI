export function calculateDailySummary(foodLogs = [], exerciseLogs = [], dailyGoal = 2000) {
  const consumed = foodLogs.reduce((sum, log) => sum + Number(log.calories || 0), 0);
  const exercise = exerciseLogs.reduce((sum, log) => sum + Number(log.calories_burnt || 0), 0);
  const net = consumed - exercise;
  const goal = Number(dailyGoal) || 2000;
  return {
    consumed: Math.round(consumed),
    exercise: Math.round(exercise),
    net: Math.round(net),
    remaining: Math.max(0, Math.round(goal - net)),
    progress: Math.min(100, Math.max(0, Math.round((net / goal) * 100))),
  };
}

export function calculateMaintenance(profile) {
  const weight = Number(profile.weight);
  const height = Number(profile.height);
  const age = Number(profile.age);
  const factors = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const base = profile.gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;
  return base * (factors[profile.activityLevel] || factors.moderate);
}

export function calculateGoalPreview(currentGoal, profile) {
  const maintenance = calculateMaintenance(profile);
  const weeklyChange = Number(profile.weeklyChangePerWeek || 0);
  let goal = Math.round(maintenance);
  if (profile.goal === 'lose') {
    goal = Math.max(1200, Math.round(maintenance - (weeklyChange * 7700) / 7));
  } else if (profile.goal === 'gain') {
    goal = Math.round(maintenance + (weeklyChange * 7700) / 7);
  }
  return {
    maintenance: Math.round(maintenance),
    goal,
    changed: goal !== Number(currentGoal),
  };
}
