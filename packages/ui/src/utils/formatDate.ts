// Casa Smart Date Formatting
// See CASA-VISUAL-STANDARD.md Part IX, Detail #13.
//
// Never display raw dates. Always show human-friendly relative dates.
// "Just now" → "5 min ago" → "Today at 2:30 PM" → "Yesterday" →
// "Last Tuesday" → "12 Feb" → "12 Feb 2025"

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a date string or Date object into a human-friendly relative format.
 *
 * @param input - ISO date string or Date object
 * @param options - Optional configuration
 * @returns Human-friendly date string
 *
 * @example
 * formatDate(new Date()) // "Just now"
 * formatDate('2026-02-13T10:30:00Z') // "Today at 10:30 AM" (if today)
 * formatDate('2026-02-12T10:30:00Z') // "Yesterday" (if yesterday)
 * formatDate('2026-02-10T10:30:00Z') // "Last Monday" (if within this week)
 * formatDate('2026-01-15T10:30:00Z') // "15 Jan" (if this year)
 * formatDate('2025-06-15T10:30:00Z') // "15 Jun 2025" (if different year)
 */
export function formatDate(
  input: string | Date | null | undefined,
  options?: {
    includeTime?: boolean;
    shortForm?: boolean;
  }
): string {
  if (!input) return '';

  const date = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Future dates
  if (diffMs < 0) {
    const absDays = Math.abs(diffDays);
    if (absDays === 0) return 'Later today';
    if (absDays === 1) return 'Tomorrow';
    if (absDays < 7) return `${DAY_NAMES[date.getDay()]}`;
    return formatAbsoluteDate(date, now);
  }

  // Just now (< 1 minute)
  if (diffMins < 1) return 'Just now';

  // Minutes ago (< 1 hour)
  if (diffMins < 60) return `${diffMins} min ago`;

  // Hours ago (< 4 hours, same day)
  if (diffHours < 4 && isSameDay(date, now)) {
    return `${diffHours}h ago`;
  }

  // Today (same calendar day)
  if (isSameDay(date, now)) {
    if (options?.shortForm) return 'Today';
    return `Today at ${formatTime(date)}`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    if (options?.shortForm) return 'Yesterday';
    return options?.includeTime ? `Yesterday at ${formatTime(date)}` : 'Yesterday';
  }

  // Within the last 7 days
  if (diffDays < 7) {
    const dayName = DAY_NAMES[date.getDay()];
    if (options?.shortForm) return dayName;
    return options?.includeTime ? `${dayName} at ${formatTime(date)}` : `Last ${dayName}`;
  }

  // Absolute date
  return formatAbsoluteDate(date, now, options?.includeTime);
}

/**
 * Formats a date as a short relative string for compact displays.
 * "Now" → "5m" → "2h" → "Yesterday" → "Mon" → "12 Feb"
 */
export function formatDateCompact(input: string | Date | null | undefined): string {
  if (!input) return '';

  const date = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMs < 0) return formatAbsoluteDate(date, now);
  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24 && isSameDay(date, now)) return `${diffHours}h`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';

  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) return DAY_NAMES[date.getDay()].slice(0, 3);

  return formatAbsoluteDate(date, now);
}

/**
 * Formats a date range for display.
 * "12 Feb - 15 Feb" or "12 Feb 2025 - 15 Mar 2026"
 */
export function formatDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  if (!start || !end) return '';

  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '';

  const now = new Date();
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const currentYear = startDate.getFullYear() === now.getFullYear() && endDate.getFullYear() === now.getFullYear();

  const startStr = currentYear
    ? `${startDate.getDate()} ${MONTH_NAMES[startDate.getMonth()]}`
    : `${startDate.getDate()} ${MONTH_NAMES[startDate.getMonth()]} ${startDate.getFullYear()}`;

  const endStr = sameYear && currentYear
    ? `${endDate.getDate()} ${MONTH_NAMES[endDate.getMonth()]}`
    : `${endDate.getDate()} ${MONTH_NAMES[endDate.getMonth()]} ${endDate.getFullYear()}`;

  return `${startStr} – ${endStr}`;
}

// --- Internal helpers ---

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${period}`;
}

function formatAbsoluteDate(date: Date, now: Date, includeTime?: boolean): string {
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  const sameYear = year === now.getFullYear();

  const base = sameYear ? `${day} ${month}` : `${day} ${month} ${year}`;
  if (includeTime) return `${base} at ${formatTime(date)}`;
  return base;
}
