const MONTHS_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];

export const parseEventDatePart = (dateStr: string) => {
  if (!dateStr) return null;
  const t = dateStr.replace("T", " ");
  const [datePart, timePart] = t.split(" ");
  if (!datePart) return new Date(dateStr);
  const [y, m, d] = datePart.split(/[-/]/).map(Number);
  if (timePart) {
    const [hh, mm, ss] = timePart.split(":").map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
  }
  return new Date(y, m - 1, d);
};

const formatEventDateParts = (dateStr: string, months: string[]) => {
  if (!dateStr) return "-";
  try {
    const d = parseEventDatePart(dateStr);
    if (!d || isNaN(d.getTime())) return dateStr;

    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hour = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");

    return `${day} ${month} ${year}, ${hour}.${min}`;
  } catch {
    return dateStr;
  }
};

export const formatEventDate = (dateStr: string) => formatEventDateParts(dateStr, MONTHS_LONG);
export const formatEventDateShort = (dateStr: string) => formatEventDateParts(dateStr, MONTHS_SHORT);
