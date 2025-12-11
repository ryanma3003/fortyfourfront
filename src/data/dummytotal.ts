// =====================================================
// INTERFACES
// =====================================================

export interface PerusahaanType {
  title: string;
  avatarClass: string;
  ValueClass: string;
  smallText: string;
  ValueClass1: string;
  count: string;     // TOTAL AKUMULASI ALL TIME
  percent: string;   // VALUE BULAN TERAKHIR / THIS MONTH
  iconColor: string;
  cardClass: string;
  priceColor: string;
  svgIcon: string;
}

export interface MonthlyDataType {
  month: string;
  value: number;
  date: Date;
}

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

// =====================================================
// BASE STATIC DATA (BULAN TERSERAH TAPI TAHUN NANTI DICONVERT)
// =====================================================

export const monthlyDataByCategory = {
  Ilmate: [
    { month: "Januari", value: 8, date: new Date(2024, 0, 1) },
    { month: "Februari", value: 9, date: new Date(2024, 1, 1) },
    { month: "Maret", value: 10, date: new Date(2024, 2, 1) },
    { month: "April", value: 11, date: new Date(2024, 3, 1) },
    { month: "Mei", value: 12, date: new Date(2024, 4, 1) },
    { month: "Juni", value: 13, date: new Date(2024, 5, 1) },
    { month: "Juli", value: 14, date: new Date(2024, 6, 1) },
    { month: "Agustus", value: 15, date: new Date(2024, 7, 1) },
    { month: "Desember", value: 5, date: new Date(2025, 11, 1) },
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

// =====================================================
// UTILITIES
// =====================================================

// Convert semua tahun lama → current year
function normalizeYear(data: MonthlyDataType[]): MonthlyDataType[] {
  const currentYear = new Date().getFullYear();

  return data.map(item => {
    const newDate = new Date(item.date);
    if (item.date.getFullYear() < currentYear) {
      newDate.setFullYear(currentYear);
    }
    return { ...item, date: newDate };
  });
}

// COUNT ALL TIME
function getTotalValueAllTime(monthlyData: MonthlyDataType[]): number {
  return monthlyData.reduce((sum, item) => sum + item.value, 0);
}

// FILTER BERDASARKAN DATE RANGE
function getDataByDateRange(
  monthlyData: MonthlyDataType[],
  dateRange: DateRange | null
): MonthlyDataType[] {
  if (!dateRange || !dateRange.start || !dateRange.end) return monthlyData;

  return monthlyData.filter(item => {
    return item.date >= dateRange.start! && item.date <= dateRange.end!;
  });
}

// VALUE THIS MONTH BERDASARKAN TANGGAL SISTEM
function getThisMonthValue(data: MonthlyDataType[]): number {
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth();

  const found = data.find(item => {
    return item.date.getFullYear() === cy && item.date.getMonth() === cm;
  });

  return found ? found.value : 0;
}

// VALUE BULAN YANG DIPILIH DARI DATE RANGE (untuk "In This Month")
function getSelectedMonthValue(
  data: MonthlyDataType[],
  dateRange: DateRange | null
): number {
  // Jika tidak ada dateRange, gunakan bulan sistem
  if (!dateRange || !dateRange.end) {
    return getThisMonthValue(data);
  }

  // Gunakan bulan dari end date (tanggal akhir range)
  const endDate = dateRange.end;
  const targetMonth = endDate.getMonth();

  // Cari data dengan bulan yang sama (abaikan tahun)
  const found = data.find(item => {
    return item.date.getMonth() === targetMonth;
  });

  return found ? found.value : 0;
}

// VALUE TERAKHIR (fallback: THIS MONTH)
function getLastMonthValue(
  monthlyData: MonthlyDataType[],
  dateRange: DateRange | null
): number {
  // Gunakan bulan yang dipilih (dari date range) atau bulan sistem
  return getSelectedMonthValue(monthlyData, dateRange);
}

// =====================================================
// GENERATE CARD
// =====================================================

export function generatePerusahaanCard(dateRange: DateRange | null = null): PerusahaanType[] {
  const categories = [
    { key: "Ilmate", title: "Ilmate", color: "primary" },
    { key: "IndustriArgo", title: "Argo", color: "success" },
    { key: "IKTF", title: "IKTF", color: "warning" }
  ] as const;

  return categories.map(cat => {
    let data = normalizeYear(monthlyDataByCategory[cat.key]);

    return {
      title: cat.title,
      avatarClass: "avatar-md flex-shrink-0",
      ValueClass: "fw-semibold lh-sm",
      smallText: "fs-12 lh-base",
      ValueClass1: "fs-12 lh-base",

      count: getTotalValueAllTime(data).toString(),
      percent: getLastMonthValue(data, dateRange).toString(),

      iconColor: "success fw-medium",
      cardClass: `dashboard-main-card overflow-hidden ${cat.color}`,
      priceColor: cat.color,
      svgIcon: `<svg></svg>`
    };
  });
}

export function generatePerusahaanCard2(dateRange: DateRange | null = null): PerusahaanType[] {
  const categories = [
    { key: "IKAS", title: "IKAS", color: "success" },
    { key: "SE", title: "SE", color: "primary" }
  ] as const;

  return categories.map(cat => {
    let data = normalizeYear(monthlyDataByCategory[cat.key]);

    return {
      title: cat.title,
      avatarClass: "avatar-md flex-shrink-0",
      ValueClass: "fw-semibold lh-sm",
      smallText: "fs-12 lh-base",
      ValueClass1: "fs-12 lh-base",

      count: getTotalValueAllTime(data).toString(),
      percent: getLastMonthValue(data, dateRange).toString(),

      iconColor: "success fw-medium",
      cardClass: `dashboard-main-card overflow-hidden ${cat.color}`,
      priceColor: cat.color,
      svgIcon: `<svg></svg>`
    };
  });
}

// DEFAULT EXPORT
export const PerusahaanCard1 = generatePerusahaanCard(null);
export const PerusahaanCard2 = generatePerusahaanCard2(null);
