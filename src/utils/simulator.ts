import { ImmigrationRecord } from '../data/mock';

export interface SimulationResult {
  submitDate: string;
  completionDate?: string;
  waitDays: number;
  projected: boolean;
  positionDetails: {
    startingBacklog: number;
    clearancePath: { month: string; processed: number }[];
  }
}

// ---------- Helpers ngày tháng (an toàn múi giờ) ----------

// Parse "YYYY-MM-DD" thành Date theo GIỜ ĐỊA PHƯƠNG (tránh lệch -1 ngày do UTC)
const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Số ngày thực tế của một tháng (28/29/30/31)
const daysInMonth = (year: number, month1to12: number): number =>
  new Date(year, month1to12, 0).getDate();

const monthStrToYM = (monthStr: string): [number, number] => {
  const [y, m] = monthStr.split('-').map(Number);
  return [y, m];
};

const nextMonth = (year: number, month1to12: number): [number, number] =>
  month1to12 >= 12 ? [year + 1, 1] : [year, month1to12 + 1];

// Chênh lệch ngày tròn giữa 2 mốc (theo lịch thật, đã chuẩn hoá về 0h)
const diffInDays = (from: Date, to: Date): number => {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

// Vận tốc xử lý dự báo bằng EMA (Exponential Moving Average) - ưu tiên các tháng gần đây hơn,
// phản ánh đúng xu hướng hiện tại của Cục thay vì trung bình phẳng.
const forecastVelocityEMA = (records: ImmigrationRecord[], window = 12): number => {
  const recent = records.slice(-window);
  if (recent.length === 0) return 0;
  const alpha = 2 / (recent.length + 1);
  let ema = recent[0].processed;
  for (let i = 1; i < recent.length; i++) {
    ema = recent[i].processed * alpha + ema * (1 - alpha);
  }
  return Math.round(ema);
};

// ---------- Mô hình Cumulative Flow theo lịch thật ----------

export const calculateCFM = (submitDate: string, dataSeries: ImmigrationRecord[]): SimulationResult | null => {
  if (!dataSeries || dataSeries.length === 0) return null;

  const submitMonthStr = submitDate.substring(0, 7); // "YYYY-MM"
  const submitObj = parseLocalDate(submitDate);

  // Tìm tháng nộp trong hồ sơ (nếu vượt quá data thì lấy tháng cuối cùng)
  let startIndex = dataSeries.findIndex(d => d.month === submitMonthStr);
  if (startIndex === -1) startIndex = dataSeries.length - 1;

  const startingBacklog = dataSeries[startIndex].pending;

  // Không có tồn đọng -> trả kết quả ngay
  if (startingBacklog <= 0) {
    return {
      submitDate,
      completionDate: submitDate,
      waitDays: 0,
      projected: false,
      positionDetails: { startingBacklog: 0, clearancePath: [] }
    };
  }

  const avgMonthlyVelocity = forecastVelocityEMA(dataSeries, 12);

  let remainingBacklog = startingBacklog;
  let isProjected = false;
  const clearancePath: { month: string; processed: number }[] = [];

  // Mốc bắt đầu bào mòn = đầu tháng KẾ TIẾP tháng nộp.
  // (Tồn đọng P0 là số liệu cuối tháng nộp, nên hàng chờ được giải quyết từ tháng sau.)
  let dataIndex = startIndex + 1;
  let [curY, curM] = nextMonth(...monthStrToYM(dataSeries[startIndex].month));

  let completionObj: Date | null = null;
  let guard = 0;

  while (remainingBacklog > 0) {
    if (++guard > 240) break; // chặn vòng lặp vô hạn (tối đa 20 năm)

    // Vận tốc xử lý của tháng đang xét: dùng số thực nếu còn data, ngược lại dùng EMA forecast
    let processedThisMonth: number;
    if (dataIndex < dataSeries.length) {
      const rec = dataSeries[dataIndex];
      [curY, curM] = monthStrToYM(rec.month);
      processedThisMonth = rec.processed;
      dataIndex++;
    } else {
      isProjected = true;
      processedThisMonth = avgMonthlyVelocity;
    }

    const curMonthStr = `${curY}-${String(curM).padStart(2, '0')}`;
    clearancePath.push({ month: curMonthStr, processed: processedThisMonth });

    const dim = daysInMonth(curY, curM);

    if (processedThisMonth <= 0) {
      // Tháng không xử lý hồ sơ nào -> chờ trọn tháng, sang tháng kế tiếp
      [curY, curM] = nextMonth(curY, curM);
      continue;
    }

    if (remainingBacklog <= processedThisMonth) {
      // Hồ sơ được giải quyết NGAY TRONG tháng này.
      // Quy đổi phần dư ra ngày theo SỐ NGÀY THỰC của chính tháng đó (không dùng hằng số 30.43).
      const dailyRate = processedThisMonth / dim;
      const daysIntoMonth = Math.min(dim, Math.ceil(remainingBacklog / dailyRate));
      // Ngày hoàn thành = đầu tháng + số ngày đã xử lý hết hàng chờ
      completionObj = new Date(curY, curM - 1, 1);
      completionObj.setDate(completionObj.getDate() + daysIntoMonth - 1);
      remainingBacklog = 0;
    } else {
      remainingBacklog -= processedThisMonth;
      [curY, curM] = nextMonth(curY, curM);
    }
  }

  // Trường hợp cực hiếm: vượt guard mà chưa clear -> dùng mốc cuối cùng đang xét
  if (!completionObj) {
    completionObj = new Date(curY, curM - 1, 1);
  }

  // waitDays = chênh lệch ngày THỰC giữa ngày nộp và ngày hoàn thành (không qua hằng số trung bình)
  const waitDays = Math.max(0, diffInDays(submitObj, completionObj));

  return {
    submitDate,
    completionDate: formatDate(completionObj),
    waitDays,
    projected: isProjected,
    positionDetails: {
      startingBacklog,
      clearancePath
    }
  };
};
