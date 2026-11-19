function roundCalories(value) {
  return Math.round(value);
}

export function findExerciseCatalogueMatches(description, catalogue, limit = 20) {
  const text = description.toLowerCase();
  const words = text.match(/[a-z]+/g) || [];
  return catalogue
    .filter((item) => {
      const name = item.name.toLowerCase();
      if (/\b(walk|walking|brisk)\b/.test(text)) {
        return name.includes('walking') || name.includes('walk');
      }
      return words.some((word) => word.length >= 4 && name.includes(word));
    })
    .slice(0, limit);
}

export function parseExerciseInference(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Exercise name is required');
  }

  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
  } catch {
    throw new Error('Exercise name is required');
  }

  const exerciseName = String(parsed.exerciseName || parsed.exercise_name || '').trim();
  const durationMinutes = Number(parsed.durationMinutes ?? parsed.duration_minutes);
  const caloriesBurnt = Number(parsed.caloriesBurnt ?? parsed.calories_burnt);
  if (!exerciseName) throw new Error('Exercise name is required');
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error('Duration is required');
  if (!Number.isFinite(caloriesBurnt) || caloriesBurnt <= 0) throw new Error('Calories are required');

  return {
    exerciseName,
    durationMinutes: Math.round(durationMinutes),
    caloriesBurnt: roundCalories(caloriesBurnt),
  };
}

export function inferExerciseFallback(description, weightKg, heightCm, catalogue) {
  if (!description?.trim()) throw new Error('Exercise name is required');
  if (!Number.isFinite(Number(weightKg)) || Number(weightKg) <= 0) throw new Error('Weight is required');
  if (!Number.isFinite(Number(heightCm)) || Number(heightCm) <= 0) throw new Error('Height is required');

  const text = description.toLowerCase();
  const distanceMatch = text.match(/(\d+(?:\.\d+)?)\s*(km|kilometers?|mi|mile|miles)\b/i);
  const timeMatch = text.match(/(\d+(?:\.\d+)?)\s*(min|minutes?|hr|hours?)\b/i);
  const isWalking = /\b(walk|walking|brisk)\b/.test(text);

  const matches = findExerciseCatalogueMatches(description, catalogue, 100);
  const isCycling = /\b(cycl|bicycle|biking|bike)\b/.test(text);
  let catalogueEntry = null;
  if (isWalking) {
    catalogueEntry = matches.find((item) => item.name.toLowerCase().includes('3.5 mph, brisk pace'))
      || matches.find((item) => item.name.toLowerCase().includes('walking'));
  } else if (isCycling) {
    if (/\b(race|racing|fast|vigorous|20 mph)\b/.test(text)) {
      catalogueEntry = matches.find((item) => item.name.toLowerCase().includes('vigorous'));
    }
    catalogueEntry = catalogueEntry
      || matches.find((item) => item.name.toLowerCase().includes('12-13.9 mph'))
      || matches.find((item) => item.name.toLowerCase().includes('cycling'));
  } else {
    catalogueEntry = matches[0];
  }

  if (!catalogueEntry) {
    throw new Error('Could not match that exercise. Try a clearer activity name.');
  }

  let durationMinutes = 0;
  if (timeMatch) {
    const value = Number(timeMatch[1]);
    durationMinutes = /hr|hour/i.test(timeMatch[2]) ? value * 60 : value;
  } else if (distanceMatch) {
    const distanceKm = /mi|mile/i.test(distanceMatch[2])
      ? Number(distanceMatch[1]) * 1.60934
      : Number(distanceMatch[1]);
    const speedKmPerHour = isWalking ? 5.63 : 8;
    durationMinutes = (distanceKm / speedKmPerHour) * 60;
  } else {
    throw new Error('Include a duration or distance, for example “30 minutes” or “5 km”.');
  }

  durationMinutes = Math.round(durationMinutes);
  const normalizedHeight = Math.max(150, Math.min(210, Number(heightCm)));
  const heightFactor = 0.98 + ((normalizedHeight - 150) / 60) * 0.04;
  const caloriesBurnt = roundCalories(
    Number(weightKg) * catalogueEntry.calories_per_kg_per_hour * (durationMinutes / 60) * heightFactor,
  );

  return {
    exerciseName: catalogueEntry.name,
    durationMinutes,
    caloriesBurnt,
    source: 'catalogue',
  };
}
