function getDstStartUTC(year) {
  // Find 2nd Sunday of March at 2:00 AM UTC
  const march = new Date(Date.UTC(year, 2, 1));
  const firstSundayOffset = (7 - march.getUTCDay()) % 7;
  const secondSunday = 1 + firstSundayOffset + 7;
  return new Date(Date.UTC(year, 2, secondSunday, 2, 0, 0));
}

function getDstEndUTC(year) {
  // Find 1st Sunday of November at 2:00 AM UTC
  const november = new Date(Date.UTC(year, 10, 1));
  const firstSundayOffset = (7 - november.getUTCDay()) % 7;
  const firstSunday = 1 + firstSundayOffset;
  return new Date(Date.UTC(year, 10, firstSunday, 2, 0, 0));
}

function getMt5OffsetHours(dateUTC) {
  const year = dateUTC.getUTCFullYear();
  const dstStart = getDstStartUTC(year);
  const dstEnd = getDstEndUTC(year);

  // MT5 offset: UTC+2 (Standard), UTC+3 (DST)
  return (dateUTC >= dstStart && dateUTC < dstEnd) ? 3 : 2;
}

function getServerTime() {
  const utcNow = new Date(); // ALWAYS current UTC internally
  const offset = getMt5OffsetHours(utcNow);
  return new Date(utcNow.getTime() + offset * 60 * 60 * 1000);
}

module.exports = getServerTime;