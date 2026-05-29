export function formatDateInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function todayInTimeZone(timeZone) {
  return formatDateInTimeZone(new Date(), timeZone);
}

export function yesterdayInTimeZone(timeZone) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - 1);
  return formatDateInTimeZone(now, timeZone);
}

export function localTimeParts(timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}
