function getDstStart(year) {
  const march = new Date(year, 2, 1); // March
  const firstSundayOffset = (7 - march.getDay()) % 7;
  const secondSunday = 1 + firstSundayOffset + 7;
  return new Date(year, 2, secondSunday);
}

function getDstEnd(year) {
  const november = new Date(year, 10, 1); // November
  const firstSundayOffset = (7 - november.getDay()) % 7;
  const firstSunday = 1 + firstSundayOffset;
  return new Date(year, 10, firstSunday);
}

function getServerOffset(date) {
  const year = date.getUTCFullYear();
  const dstStart = getDstStart(year);
  const dstEnd = getDstEnd(year);
  if (date >= dstStart && date < dstEnd) {
    return 3; // hours offset during DST
  }
  return 2; // standard offset
}

export function getServerTime() {
  const utcNow = new Date();
  const offsetHours = getServerOffset(utcNow);
  const localTime = new Date(utcNow.getTime() + offsetHours * 60 * 60 * 1000);
  return localTime;
}
