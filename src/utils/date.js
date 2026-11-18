export function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDayRange(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { start, end };
}

export function loggedAtForDate(dateKey) {
  const now = new Date();
  const [year, month, day] = dateKey.split('-').map(Number);
  const selected = new Date(year, month - 1, day);
  if (toLocalDateKey(selected) === toLocalDateKey(now)) return now;
  selected.setHours(12, 0, 0, 0);
  return selected;
}
