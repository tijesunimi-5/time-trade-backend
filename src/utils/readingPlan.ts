export function calculateAutoIncrementReading(params: {
  dayNumber: number;
  startUnit?: number | null;
  startDayNumber?: number | null;
  unitsPerDay?: number | null;
  unitType?: string | null;
  bookName?: string | null;
  bibleVersion?: string | null;
  baseUrlOrTemplate?: string | null;
  resourceType?: string | null;
}) {
  const day = Math.max(1, params.dayNumber || 1);
  const startUnit = typeof params.startUnit === 'number' ? params.startUnit : 1;
  const startDayNumber = typeof params.startDayNumber === 'number' ? params.startDayNumber : 1;
  const unitsPerDay = typeof params.unitsPerDay === 'number' ? params.unitsPerDay : 3;
  const unitType = (params.unitType || (params.resourceType === 'BIBLE' ? 'CHAPTERS' : 'PAGES')).toUpperCase();
  const bookName = params.bookName || (params.resourceType === 'BIBLE' ? 'Matthew' : 'Book');
  const version = params.bibleVersion || 'KJV';

  // Calculate day offset relative to startDayNumber (so resetting startUnit at Day X starts cleanly from startUnit)
  const effectiveDayOffset = Math.max(0, day - startDayNumber);
  const startForToday = startUnit + effectiveDayOffset * unitsPerDay;
  const endForToday = startForToday + Math.max(1, unitsPerDay) - 1;

  let calculatedRange = '';
  if (unitType === 'CHAPTERS' || params.resourceType === 'BIBLE') {
    calculatedRange =
      startForToday === endForToday
        ? `${bookName} ${startForToday}`
        : `${bookName} ${startForToday}–${endForToday}`;
  } else {
    calculatedRange =
      startForToday === endForToday
        ? `Page ${startForToday}`
        : `Pages ${startForToday}–${endForToday}`;
  }

  let calculatedUrl = params.baseUrlOrTemplate || null;
  if (params.resourceType === 'BIBLE' || (calculatedUrl && calculatedUrl.includes('bible.com'))) {
    if (calculatedUrl) {
      // Regex replace chapter in YouVersion Bible URL pattern e.g. mat.2.1.kjv -> mat.4.kjv
      calculatedUrl = calculatedUrl.replace(/(\.[a-z0-9]+\.)\d+(\.\d+)?(\.[a-z]+)?/i, `$1${startForToday}$3`);
    } else {
      const bookSlug = bookName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 3) || 'mat';
      calculatedUrl = `https://bible.com/bible/1/${bookSlug}.${startForToday}.${version.toLowerCase()}`;
    }
  }

  return {
    startForToday,
    endForToday,
    calculatedRange,
    calculatedUrl,
    dayNumber: day,
  };
}
