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
  // Chart props
  chartSeries?: any;
  chartOptions?: any;
  type?: string;
  height?: string;
  width?: string;
  id?: string;

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
    { month: "September", value: 16, date: new Date(2024, 8, 1) },
    { month: "Oktober", value: 17, date: new Date(2024, 9, 1) },
    { month: "November", value: 18, date: new Date(2024, 10, 1) },
    { month: "Desember", value: 5, date: new Date(2024, 11, 1) },
    { month: "Januari", value: 5, date: new Date(2025, 0, 1) },
    { month: "Februari", value: 5, date: new Date(2025, 1, 1) },
    { month: "Maret", value: 5, date: new Date(2025, 2, 1) },
    { month: "April", value: 5, date: new Date(2025, 3, 1) },
    { month: "Mei", value: 5, date: new Date(2025, 4, 1) },
    { month: "Juni", value: 5, date: new Date(2025, 5, 1) },
    { month: "Juli", value: 5, date: new Date(2025, 6, 1) },
    { month: "Agustus", value: 5, date: new Date(2025, 7, 1) },
    { month: "September", value: 5, date: new Date(2025, 8, 1) },
    { month: "Oktober", value: 5, date: new Date(2025, 9, 1) },
    { month: "November", value: 5, date: new Date(2025, 10, 1) },
    { month: "Desember", value: 5, date: new Date(2025, 11, 1) },

  ],

  IndustriAgro: [
    { month: "Januari", value: 10, date: new Date(2024, 0, 1) },
    { month: "Februari", value: 11, date: new Date(2024, 1, 1) },
    { month: "Maret", value: 12, date: new Date(2024, 2, 1) },
    { month: "April", value: 13, date: new Date(2024, 3, 1) },
    { month: "Mei", value: 14, date: new Date(2024, 4, 1) },
    { month: "Juni", value: 15, date: new Date(2024, 5, 1) },
    { month: "Juli", value: 16, date: new Date(2024, 6, 1) },
    { month: "Agustus", value: 17, date: new Date(2024, 7, 1) },
    { month: "September", value: 18, date: new Date(2024, 8, 1) },
    { month: "Oktober", value: 19, date: new Date(2024, 9, 1) },
    { month: "November", value: 20, date: new Date(2024, 10, 1) },
    { month: "Desember", value: 21, date: new Date(2024, 11, 1) },
    { month: "Januari", value: 22, date: new Date(2025, 0, 1) },
    { month: "Februari", value: 23, date: new Date(2025, 1, 1) },
    { month: "Maret", value: 24, date: new Date(2025, 2, 1) },
    { month: "April", value: 25, date: new Date(2025, 3, 1) },
    { month: "Mei", value: 26, date: new Date(2025, 4, 1) },
    { month: "Juni", value: 27, date: new Date(2025, 5, 1) },
    { month: "Juli", value: 28, date: new Date(2025, 6, 1) },
    { month: "Agustus", value: 29, date: new Date(2025, 7, 1) },
    { month: "September", value: 30, date: new Date(2025, 8, 1) },
    { month: "Oktober", value: 31, date: new Date(2025, 9, 1) },
    { month: "November", value: 32, date: new Date(2025, 10, 1) },
    { month: "Desember", value: 33, date: new Date(2025, 11, 1) },
  ],

  IKFT: [
    { month: "Januari", value: 6, date: new Date(2024, 0, 1) },
    { month: "Februari", value: 7, date: new Date(2024, 1, 1) },
    { month: "Maret", value: 8, date: new Date(2024, 2, 1) },
    { month: "April", value: 9, date: new Date(2024, 3, 1) },
    { month: "Mei", value: 10, date: new Date(2024, 4, 1) },
    { month: "Juni", value: 11, date: new Date(2024, 5, 1) },
    { month: "Juli", value: 12, date: new Date(2024, 6, 1) },
    { month: "Agustus", value: 13, date: new Date(2024, 7, 1) },
    { month: "September", value: 14, date: new Date(2024, 8, 1) },
    { month: "Oktober", value: 15, date: new Date(2024, 9, 1) },
    { month: "November", value: 16, date: new Date(2024, 10, 1) },
    { month: "Desember", value: 17, date: new Date(2024, 11, 1) },
    { month: "Januari", value: 18, date: new Date(2025, 0, 1) },
    { month: "Februari", value: 19, date: new Date(2025, 1, 1) },
    { month: "Maret", value: 20, date: new Date(2025, 2, 1) },
    { month: "April", value: 21, date: new Date(2025, 3, 1) },
    { month: "Mei", value: 22, date: new Date(2025, 4, 1) },
    { month: "Juni", value: 23, date: new Date(2025, 5, 1) },
    { month: "Juli", value: 24, date: new Date(2025, 6, 1) },
    { month: "Agustus", value: 25, date: new Date(2025, 7, 1) },
    { month: "September", value: 26, date: new Date(2025, 8, 1) },
    { month: "Oktober", value: 27, date: new Date(2025, 9, 1) },
    { month: "November", value: 28, date: new Date(2025, 10, 1) },
    { month: "Desember", value: 29, date: new Date(2025, 11, 1) },
  ],

  IKAS: [
    { month: "Januari", value: 12, date: new Date(2024, 0, 1) },
    { month: "Februari", value: 13, date: new Date(2024, 1, 1) },
    { month: "Maret", value: 14, date: new Date(2024, 2, 1) },
    { month: "April", value: 15, date: new Date(2024, 3, 1) },
    { month: "Mei", value: 16, date: new Date(2024, 4, 1) },
    { month: "Juni", value: 17, date: new Date(2024, 5, 1) },
    { month: "Juli", value: 18, date: new Date(2024, 6, 1) },
    { month: "Agustus", value: 19, date: new Date(2024, 7, 1) },
    { month: "September", value: 20, date: new Date(2024, 8, 1) },
    { month: "Oktober", value: 21, date: new Date(2024, 9, 1) },
    { month: "November", value: 22, date: new Date(2024, 10, 1) },
    { month: "Desember", value: 23, date: new Date(2024, 11, 1) },
    { month: "Januari", value: 24, date: new Date(2025, 0, 1) },
    { month: "Februari", value: 25, date: new Date(2025, 1, 1) },
    { month: "Maret", value: 26, date: new Date(2025, 2, 1) },
    { month: "April", value: 27, date: new Date(2025, 3, 1) },
    { month: "Mei", value: 28, date: new Date(2025, 4, 1) },
    { month: "Juni", value: 29, date: new Date(2025, 5, 1) },
    { month: "Juli", value: 30, date: new Date(2025, 6, 1) },
    { month: "Agustus", value: 31, date: new Date(2025, 7, 1) },
    { month: "September", value: 32, date: new Date(2025, 8, 1) },
    { month: "Oktober", value: 33, date: new Date(2025, 9, 1) },
    { month: "November", value: 34, date: new Date(2025, 10, 1) },
    { month: "Desember", value: 35, date: new Date(2025, 11, 1) },
  ],

  SE: [
    { month: "Januari", value: 8, date: new Date(2024, 0, 1) },
    { month: "Februari", value: 9, date: new Date(2024, 1, 1) },
    { month: "Maret", value: 10, date: new Date(2024, 2, 1) },
    { month: "April", value: 11, date: new Date(2024, 3, 1) },
    { month: "Mei", value: 12, date: new Date(2024, 4, 1) },
    { month: "Juni", value: 13, date: new Date(2024, 5, 1) },
    { month: "Juli", value: 14, date: new Date(2024, 6, 1) },
    { month: "Agustus", value: 15, date: new Date(2024, 7, 1) },
    { month: "September", value: 16, date: new Date(2024, 8, 1) },
    { month: "Oktober", value: 17, date: new Date(2024, 9, 1) },
    { month: "November", value: 18, date: new Date(2024, 10, 1) },
    { month: "Desember", value: 19, date: new Date(2024, 11, 1) },
    { month: "Januari", value: 20, date: new Date(2025, 0, 1) },
    { month: "Februari", value: 21, date: new Date(2025, 1, 1) },
    { month: "Maret", value: 22, date: new Date(2025, 2, 1) },
    { month: "April", value: 23, date: new Date(2025, 3, 1) },
    { month: "Mei", value: 24, date: new Date(2025, 4, 1) },
    { month: "Juni", value: 25, date: new Date(2025, 5, 1) },
    { month: "Juli", value: 26, date: new Date(2025, 6, 1) },
    { month: "Agustus", value: 27, date: new Date(2025, 7, 1) },
    { month: "September", value: 28, date: new Date(2025, 8, 1) },
    { month: "Oktober", value: 29, date: new Date(2025, 9, 1) },
    { month: "November", value: 30, date: new Date(2025, 10, 1) },
    { month: "Desember", value: 31, date: new Date(2025, 11, 1) },
  ],

  CSIRT: [
    { month: "Januari", value: 10, date: new Date(2024, 0, 1) },
    { month: "Februari", value: 9, date: new Date(2024, 1, 1) },
    { month: "Maret", value: 10, date: new Date(2024, 2, 1) },
    { month: "April", value: 11, date: new Date(2024, 3, 1) },
    { month: "Mei", value: 12, date: new Date(2024, 4, 1) },
    { month: "Juni", value: 13, date: new Date(2024, 5, 1) },
    { month: "Juli", value: 12, date: new Date(2024, 6, 1) },
    { month: "Agustus", value: 11, date: new Date(2024, 7, 1) },
    { month: "September", value: 16, date: new Date(2024, 8, 1) },
    { month: "Oktober", value: 15, date: new Date(2024, 9, 1) },
    { month: "November", value: 3, date: new Date(2024, 10, 1) },
    { month: "Desember", value: 5, date: new Date(2024, 11, 1) },
    { month: "Januari", value: 6, date: new Date(2025, 0, 1) },
    { month: "Februari", value: 7, date: new Date(2025, 1, 1) },
    { month: "Maret", value: 8, date: new Date(2025, 2, 1) },
    { month: "April", value: 9, date: new Date(2025, 3, 1) },
    { month: "Mei", value: 10, date: new Date(2025, 4, 1) },
    { month: "Juni", value: 11, date: new Date(2025, 5, 1) },
    { month: "Juli", value: 12, date: new Date(2025, 6, 1) },
    { month: "Agustus", value: 13, date: new Date(2025, 7, 1) },
    { month: "September", value: 14, date: new Date(2025, 8, 1) },
    { month: "Oktober", value: 15, date: new Date(2025, 9, 1) },
    { month: "November", value: 16, date: new Date(2025, 10, 1) },
    { month: "Desember", value: 17, date: new Date(2025, 11, 1) },
  ],
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
function getColor(colorName: string): string {
  switch (colorName) {
    case 'primary': return '#845adf';
    case 'secondary': return '#23b7e5';
    case 'warning': return '#f5b849';
    case 'info': return '#26bf94';
    case 'success': return '#26bf94';
    case 'danger': return '#e6533c';
    case 'purple': return '#8c57ff';
    default: return '#845adf';
  }
}

// =====================================================

export function generatePerusahaanCard(dateRange: DateRange | null = null): PerusahaanType[] {
  const categories = [
    { key: "Ilmate", title: "ILMATE", color: "primary", svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,120h-8.34a95.07,95.07,0,0,0-8.82-32.9l7.23-4.17a8,8,0,0,0-8-13.86l-7.25,4.19a97,97,0,0,0-24.08-24.08l4.19-7.25a8,8,0,0,0-13.86-8l-4.17,7.23A95.07,95.07,0,0,0,136,32.34V24a8,8,0,0,0-16,0v8.34a95.07,95.07,0,0,0-32.9,8.82l-4.17-7.23a8,8,0,0,0-13.86,8l4.19,7.25A97,97,0,0,0,49.18,73.26l-7.25-4.19a8,8,0,0,0-8,13.86l7.23,4.17A95.07,95.07,0,0,0,32.34,120H24a8,8,0,0,0,0,16h8.34a95.07,95.07,0,0,0,8.82,32.9l-7.23,4.17a8,8,0,0,0,4,14.93,7.92,7.92,0,0,0,4-1.07l7.25-4.19a97,97,0,0,0,24.08,24.08l-4.19,7.25a8,8,0,0,0,13.86,8l4.17-7.23a95.07,95.07,0,0,0,32.9,8.82V232a8,8,0,0,0,16,0v-8.34a95.07,95.07,0,0,0,32.9-8.82l4.17,7.23a8,8,0,0,0,13.86-8l-4.19-7.25a97,97,0,0,0,24.08-24.08l7.25,4.19A8,8,0,0,0,225,184a8,8,0,0,0-2.92-10.93l-7.23-4.17a95.07,95.07,0,0,0,8.82-32.9H232a8,8,0,0,0,0-16ZM72,128A55.91,55.91,0,0,1,93.38,84l25.38,44L93.38,172A55.91,55.91,0,0,1,72,128Zm56,56a55.67,55.67,0,0,1-20.78-4l25.4-44h50.8A56.09,56.09,0,0,1,128,184Zm4.62-64-25.4-44a56,56,0,0,1,76.2,44Z"/></svg>' },
    { key: "IndustriAgro", title: "Industri Agro", color: "success", svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path fill="currentColor" d="M223.45,40.07a8,8,0,0,0-7.52-7.52C139.8,28.08,78.82,51,52.82,94a87.09,87.09,0,0,0-12.76,49A101.72,101.72,0,0,0,46.7,175.2a4,4,0,0,0,6.61,1.43l85-86.3a8,8,0,0,1,11.32,11.32L56.74,195.94,42.55,210.13a8.2,8.2,0,0,0-.6,11.1,8,8,0,0,0,11.71.43l16.79-16.79c14.14,6.84,28.41,10.57,42.56,11.07q1.67.06,3.33.06A86.93,86.93,0,0,0,162,203.18C205,177.18,227.93,116.21,223.45,40.07Z"/></svg>' },
    { key: "IKFT", title: "IKFT", color: "warning", svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M221.69,199.77,160,96.92V40h8a8,8,0,0,0,0-16H88a8,8,0,0,0,0,16h8V96.92L34.31,199.77A16,16,0,0,0,48,224H208a16,16,0,0,0,13.72-24.23Zm-90.08-42.91c-15.91-8.05-31.05-12.32-45.22-12.81l24.47-40.8A7.93,7.93,0,0,0,112,99.14V40h32V99.14a7.93,7.93,0,0,0,1.14,4.11L183.36,167C171.4,169.34,154.29,168.34,131.61,156.86Z"/></svg>' }
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
      svgIcon: (cat as any).svgIcon || `<svg></svg>`,

      // Chart Data
      id: `chart-${cat.key}`,
      type: 'area',
      height: '50',
      width: '100', // or '100%'
      chartSeries: [{
        name: cat.title,
        data: data.slice(-12).map(d => d.value)
      }],
      chartOptions: {
        chart: {
          type: 'area',
          sparkline: {
            enabled: true
          }
        },
        stroke: {
          curve: 'smooth',
          width: 2
        },
        fill: {
          opacity: 0.3,
        },
        colors: [getColor(cat.color)],
        tooltip: {
          fixed: {
            enabled: false
          },
          x: {
            show: false
          },
          y: {
            title: {
              formatter: function (seriesName: any) {
                return ''
              }
            }
          },
          marker: {
            show: false
          }
        }
      }
    };
  });
}

// Helper for colors (duplicate or move up)
// Since I can't easily move the helper up without reading whole file again or risking placement, I'll rely on it being defined or just redefine/inline it if needed, 
// actually I defined `getColor` below `generatePerusahaanCard` so it is hoisted or available.
// But `generatePerusahaanCard2` also needs it.

export function generatePerusahaanCard2(dateRange: DateRange | null = null): PerusahaanType[] {
  const categories = [
    { key: "IKAS", title: "IKAS", color: "purple", svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.27,47,25.53a8,8,0,0,0,4.2,0c1-.26,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm-37,87.43-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,1,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43Z"/></svg>' },
    { key: "SE", title: "KSE", color: "info", svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M160,136v-8H88v64a8,8,0,0,0,8,8h64v-8a16,16,0,0,1,16-16h32a16,16,0,0,1,16,16v32a16,16,0,0,1-16,16H176a16,16,0,0,1-16-16v-8H96a24,24,0,0,1-24-24V80H64A16,16,0,0,1,48,64V32A16,16,0,0,1,64,16H96a16,16,0,0,1,16,16V64A16,16,0,0,1,96,80H88v32h72v-8a16,16,0,0,1,16-16h32a16,16,0,0,1,16,16v32a16,16,0,0,1-16,16H176A16,16,0,0,1,160,136Z"/></svg>' },
    { key: "CSIRT", title: "CSIRT", color: "danger", svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm-72,78.63V184a8,8,0,0,1-16,0V158.63a24,24,0,1,1,16,0ZM160,80H96V56a32,32,0,0,1,64,0Z"/></svg>' }
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
      svgIcon: (cat as any).svgIcon || `<svg></svg>`,

      // Chart Data
      id: `chart-${cat.key}`,
      type: 'area', // or line
      height: '50',
      width: '100', // or '100%'
      chartSeries: [{
        name: cat.title,
        data: data.slice(-12).map(d => d.value)
      }],
      chartOptions: {
        chart: {
          type: 'area',
          sparkline: {
            enabled: true
          }
        },
        stroke: {
          curve: 'smooth',
          width: 2
        },
        fill: {
          opacity: 0.3,
        },
        colors: [getColor(cat.color)],
        tooltip: {
          fixed: {
            enabled: false
          },
          x: {
            show: false
          },
          y: {
            title: {
              formatter: function (seriesName: any) {
                return ''
              }
            }
          },
          marker: {
            show: false
          }
        }
      }
    };
  });
}

// DEFAULT EXPORT
export const PerusahaanCard1 = generatePerusahaanCard(null);
export const PerusahaanCard2 = generatePerusahaanCard2(null);
