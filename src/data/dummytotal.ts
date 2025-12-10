interface PerusahaanType {
  title: string;
  avatarClass: string;
  ValueClass: string;
  smallText: string;
  ValueClass1: string;
  count: string;
  percent: string;
  iconColor: string;
  cardClass: string;
  priceColor: string;
  svgIcon: string;
}

interface SektorType {
  nama: string;
  total: number;
}

export interface MonthlyDataType {
  month: string;
  value: number;
  date: Date; // Tambahkan field date untuk filtering
}

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export const perusahaanKategori = {
  Ilmate: {
    sektor: [
      { nama: "Elektronik", total: 4 },
      { nama: "Otomotif", total: 4 },
      { nama: "Keamanan Siber", total: 2 }
    ]
  },
  IndustriArgo: {
    sektor: [
      { nama: "Argo Bisnis", total: 5 },
      { nama: "Kontruksi", total: 3 },
      { nama: "Jasa", total: 4 },
      { nama: "Surveyor", total: 2 }
    ]
  },
  IKTF: {
    sektor: [
      { nama: "Tekstil", total: 2 },
      { nama: "Kimia", total: 2 },
      { nama: "Kawasan Industri", total: 2 },
      { nama: "Faarmasi", total: 2 }
    ]
  }
};

// Data per bulan untuk setiap kategori dengan date
export const monthlyDataByCategory = {
  Ilmate: [
    { month: "Januari", value: 8, date: new Date(2024, 0, 1) },
    { month: "Februari", value: 9, date: new Date(2024, 1, 1) },
    { month: "Maret", value: 10, date: new Date(2024, 2, 1) },
    { month: "April", value: 11, date: new Date(2024, 3, 1) },
    { month: "Mei", value: 12, date: new Date(2024, 4, 1) },
    { month: "Juni", value: 13, date: new Date(2024, 5, 1) },
    { month: "Juli", value: 14, date: new Date(2024, 6, 1) }
  ],
  IndustriArgo: [
    { month: "Januari", value: 10, date: new Date(2024, 0, 1) },
    { month: "Februari", value: 11, date: new Date(2024, 1, 1) },
    { month: "Maret", value: 12, date: new Date(2024, 2, 1) },
    { month: "April", value: 13, date: new Date(2024, 3, 1) },
    { month: "Mei", value: 14, date: new Date(2024, 4, 1) },
    { month: "Juni", value: 15, date: new Date(2024, 5, 1) },
    { month: "Juli", value: 16, date: new Date(2024, 6, 1) }
  ],
  IKTF: [
    { month: "Januari", value: 6, date: new Date(2024, 0, 1) },
    { month: "Februari", value: 7, date: new Date(2024, 1, 1) },
    { month: "Maret", value: 8, date: new Date(2024, 2, 1) },
    { month: "April", value: 9, date: new Date(2024, 3, 1) },
    { month: "Mei", value: 10, date: new Date(2024, 4, 1) },
    { month: "Juni", value: 11, date: new Date(2024, 5, 1) },
    { month: "Juli", value: 12, date: new Date(2024, 6, 1) }
  ],
  IKAS: [
    { month: "Januari", value: 12, date: new Date(2024, 0, 1) },
    { month: "Februari", value: 13, date: new Date(2024, 1, 1) },
    { month: "Maret", value: 14, date: new Date(2024, 2, 1) },
    { month: "April", value: 15, date: new Date(2024, 3, 1) },
    { month: "Mei", value: 16, date: new Date(2024, 4, 1) },
    { month: "Juni", value: 17, date: new Date(2024, 5, 1) },
    { month: "Juli", value: 18, date: new Date(2024, 6, 1) }
  ],
  SE: [
    { month: "Januari", value: 8, date: new Date(2024, 0, 1) },
    { month: "Februari", value: 9, date: new Date(2024, 1, 1) },
    { month: "Maret", value: 10, date: new Date(2024, 2, 1) },
    { month: "April", value: 11, date: new Date(2024, 3, 1) },
    { month: "Mei", value: 12, date: new Date(2024, 4, 1) },
    { month: "Juni", value: 13, date: new Date(2024, 5, 1) },
    { month: "Juli", value: 14, date: new Date(2024, 6, 1) }
  ]
};

// Fungsi untuk mendapatkan data berdasarkan range tanggal
function getDataByDateRange(
  monthlyData: MonthlyDataType[],
  dateRange: DateRange | null
): MonthlyDataType[] {
  if (!dateRange || !dateRange.start || !dateRange.end) {
    return monthlyData;
  }

  return monthlyData.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= dateRange.start! && itemDate <= dateRange.end!;
  });
}

// Fungsi untuk mendapatkan value dari data range yang di-filter
function getValueByDateRange(
  monthlyData: MonthlyDataType[],
  dateRange: DateRange | null
): number {
  const filteredData = getDataByDateRange(monthlyData, dateRange);
  
  if (filteredData.length === 0) {
    return 0;
  }

  // Return value terbaru dalam range
  return filteredData[filteredData.length - 1].value;
}

// Fungsi untuk mendapatkan data bulan sekarang
function getCurrentMonthData(monthlyData: MonthlyDataType[]): string {
  const currentMonth = new Date().getMonth();
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const monthName = monthNames[currentMonth];
  
  const monthData = monthlyData.find(d => d.month === monthName);
  if (monthData) {
    return `${monthData.value}`;
  }
  
  // Jika bulan tidak ditemukan, gunakan data terbaru
  return monthlyData[monthlyData.length - 1]?.value.toString() || "0";
}

// ✅ Fungsi untuk generate card data dengan date range filter
export function generatePerusahaanCard(dateRange: DateRange | null = null): PerusahaanType[] {
  const categories: Array<{key: KategoriKey, title: string, color: string}> = [
    { key: "Ilmate", title: "Ilmate", color: "primary" },
    { key: "IndustriArgo", title: "Argo", color: "success" },
    { key: "IKTF", title: "IKTF", color: "warning" }
  ];

  return categories.map(cat => ({
    title: cat.title,
    avatarClass: "avatar-md flex-shrink-0",
    ValueClass: "fw-semibold lh-sm",
    smallText: "fs-12 lh-base",
    ValueClass1: "fs-12 lh-base",
    count: totalPerKategori(cat.key).toString(),
    percent: getValueByDateRange(monthlyDataByCategory[cat.key], dateRange).toString(),
    iconColor: "success fw-medium",
    cardClass: `dashboard-main-card overflow-hidden ${cat.color}`,
    priceColor: cat.color,
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" ... ></svg>`
  }));
}

// ✅ Fungsi untuk generate card 2 dengan date range filter
export function generatePerusahaanCard2(dateRange: DateRange | null = null): PerusahaanType[] {
  const categories: Array<{key: KategoriKey, title: string, count: string, color: string}> = [
    { key: "IKAS", title: "IKAS", count: "15", color: "success" },
    { key: "SE", title: "SE", count: "10", color: "primary" }
  ];

  return categories.map(cat => ({
    title: cat.title,
    avatarClass: "avatar-md flex-shrink-0",
    ValueClass: "fw-semibold lh-sm",
    smallText: "fs-12 lh-base",
    ValueClass1: "fs-12 lh-base",
    count: cat.count,
    percent: getValueByDateRange(monthlyDataByCategory[cat.key], dateRange).toString(),
    iconColor: "success fw-medium",
    cardClass: `dashboard-main-card overflow-hidden ${cat.color}`,
    priceColor: cat.color,
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" ... ></svg>`
  }));
}

type KategoriKey = keyof typeof perusahaanKategori;

function totalPerKategori(kategori: KategoriKey): number {
  return perusahaanKategori[kategori].sektor.reduce(
    (sum: number, item: SektorType) => sum + item.total,
    0
  );
}

// ✅ Default exports (tanpa filter date range)
export const PerusahaanCard1: PerusahaanType[] = generatePerusahaanCard(null);
export const PerusahaanCard2: PerusahaanType[] = generatePerusahaanCard2(null);

