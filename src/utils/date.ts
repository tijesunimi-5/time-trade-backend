import { Request } from 'express';

/**
 * Helper to get the current date string in YYYY-MM-DD format based on client date header / query or local server time.
 * Prevents UTC offset bugs where new Date().toISOString().split('T')[0] returns yesterday's date
 * after local midnight in UTC+1/UTC+2 timezones.
 */
export function getTodayDateString(req?: any): string {
  // 1. Check req.query.date if explicitly passed as a valid YYYY-MM-DD string
  if (req?.query?.date && typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
    return req.query.date;
  }
  // 2. Check x-client-date header sent from frontend
  const clientHeader = req?.headers?.['x-client-date'];
  if (clientHeader && typeof clientHeader === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(clientHeader)) {
    return clientHeader;
  }
  // 3. Fallback to server local date in YYYY-MM-DD format (sv-SE locale outputs YYYY-MM-DD)
  return new Date().toLocaleDateString('sv-SE');
}

/**
 * Helper: Calculate date string (YYYY-MM-DD) for Day X given startDate (YYYY-MM-DD)
 */
export function getDateForDayNumber(startDateStr: string, dayNumber: number): string {
  const [year, month, day] = startDateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + (dayNumber - 1));
  return d.toISOString().split('T')[0];
}

/**
 * Helper: Calculate Day Number given startDate (YYYY-MM-DD) and target date (YYYY-MM-DD)
 */
export function getDayNumberFromDate(startDateStr: string, targetDateStr: string): number {
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const target = Date.UTC(ty, tm - 1, td);
  const diffDays = Math.floor((target - start) / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}
