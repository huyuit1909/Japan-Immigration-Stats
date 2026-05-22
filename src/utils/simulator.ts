import { ImmigrationRecord } from '../data/mock';

export interface SimulationResult {
  submitDate: string;
  vettingStartDate?: string; // Ngày bắt đầu được thẩm tra (đến lượt hồ sơ của bạn)
  queueWaitDays: number;     // Số ngày chờ trong hàng đợi (nộp -> bắt đầu thẩm tra)
  activeVettingDays: number; // Số ngày thẩm tra hồ sơ (bắt đầu thẩm tra -> trả kết quả)
  completionDate?: string;   // Ngày trả kết quả dự kiến (giữ nguyên cách tính)
  waitDays: number;          // Tổng số ngày từ ngày nộp đến khi trả kết quả
  projected: boolean;
  positionDetails: {
    startingBacklog: number; // P0 = tồn đọng cuối tháng nộp (dùng cho ngày kết quả)
    aheadBacklog: number;    // Hồ sơ nộp TRƯỚC cohort của bạn (dùng cho ngày bắt đầu xét)
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

// Vận tốc xử lý dự báo bằng EMA (Exponential Moving Average) - ưu tiên các tháng gần đây hơn.
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

// ---------- Lõi: bào mòn một lượng tồn đọng theo lịch thật ----------
// Trả về ngày mà 'startBacklog' hồ sơ được xử lý xong, bắt đầu bào mòn từ
// tháng tại 'erodeFromIndex'. Dùng chung cho cả ngày bắt đầu xét và ngày kết quả.
interface ClearResult {
  date: Date;
  projected: boolean;
  path: { month: string; processed: number }[];
}

const clearBacklog = (
  startBacklog: number,
  erodeFromIndex: number,
  dataSeries: ImmigrationRecord[],
  avgVelocity: number,
  fallbackDate: Date
): ClearResult => {
  if (startBacklog <= 0) {
    return { date: fallbackDate, projected: false, path: [] };
  }

  let remaining = startBacklog;
  let dataIndex = erodeFromIndex;
  let projected = false;
  const path: { month: string; processed: number }[] = [];

  let [curY, curM] = dataIndex < dataSeries.length
    ? monthStrToYM(dataSeries[dataIndex].month)
    : nextMonth(...monthStrToYM(dataSeries[dataSeries.length - 1].month));

  let completionObj: Date | null = null;
  let guard = 0;

  while (remaining > 0) {
    if (++guard > 240) break; // chặn vòng lặp vô hạn (tối đa 20 năm)

    let processedThisMonth: number;
    if (dataIndex < dataSeries.length) {
      const rec = dataSeries[dataIndex];
      [curY, curM] = monthStrToYM(rec.month);
      processedThisMonth = rec.processed;
      dataIndex++;
    } else {
      projected = true;
      processedThisMonth = avgVelocity;
    }

    path.push({ month: `${curY}-${String(curM).padStart(2, '0')}`, processed: processedThisMonth });
    const dim = daysInMonth(curY, curM);

    if (processedThisMonth <= 0) {
      [curY, curM] = nextMonth(curY, curM);
      continue;
    }

    if (remaining <= processedThisMonth) {
      // Giải phóng ngay trong tháng này: quy đổi phần dư ra ngày theo SỐ NGÀY THỰC của tháng.
      const dailyRate = processedThisMonth / dim;
      const daysIntoMonth = Math.min(dim, Math.max(1, Math.ceil(remaining / dailyRate)));
      completionObj = new Date(curY, curM - 1, daysIntoMonth);
      remaining = 0;
    } else {
      remaining -= processedThisMonth;
      [curY, curM] = nextMonth(curY, curM);
    }
  }

  if (!completionObj) completionObj = new Date(curY, curM - 1, 1);
  return { date: completionObj, projected, path };
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

  // Hồ sơ nộp TRƯỚC cohort của bạn = tồn đọng cuối tháng LIỀN TRƯỚC tháng nộp.
  // (Nếu không có tháng trước trong dữ liệu, ước lượng = tồn đọng tháng nộp - hồ sơ nhận trong tháng.)
  const aheadBacklog = startIndex >= 1
    ? dataSeries[startIndex - 1].pending
    : Math.max(0, startingBacklog - (dataSeries[startIndex].received || 0));

  const avgMonthlyVelocity = forecastVelocityEMA(dataSeries, 12);

  // Không có tồn đọng -> trả kết quả & bắt đầu xét ngay
  if (startingBacklog <= 0) {
    return {
      submitDate,
      vettingStartDate: submitDate,
      queueWaitDays: 0,
      activeVettingDays: 0,
      completionDate: submitDate,
      waitDays: 0,
      projected: false,
      positionDetails: { startingBacklog: 0, aheadBacklog: 0, clearancePath: [] }
    };
  }

  // (1) NGÀY KẾT QUẢ: giải phóng P0 (tồn cuối tháng nộp), bào mòn từ tháng KẾ TIẾP. (Giữ nguyên cách tính cũ.)
  const resultClear = clearBacklog(startingBacklog, startIndex + 1, dataSeries, avgMonthlyVelocity, submitObj);

  // (2) NGÀY BẮT ĐẦU XÉT: giải phóng backlog của cohort TRƯỚC bạn, bào mòn ngay từ THÁNG NỘP.
  const startClear = clearBacklog(aheadBacklog, startIndex, dataSeries, avgMonthlyVelocity, submitObj);

  const completionObj = resultClear.date;
  let reviewStartObj = startClear.date;

  // An toàn: ngày bắt đầu xét không thể muộn hơn ngày trả kết quả, và không sớm hơn ngày nộp.
  if (reviewStartObj.getTime() > completionObj.getTime()) reviewStartObj = completionObj;
  if (reviewStartObj.getTime() < submitObj.getTime()) reviewStartObj = submitObj;

  const waitDays = Math.max(0, diffInDays(submitObj, completionObj));
  const reviewStartDays = Math.max(0, diffInDays(submitObj, reviewStartObj));

  return {
    submitDate,
    vettingStartDate: formatDate(reviewStartObj),
    queueWaitDays: reviewStartDays,
    activeVettingDays: Math.max(0, waitDays - reviewStartDays),
    completionDate: formatDate(completionObj),
    waitDays,
    projected: resultClear.projected,
    positionDetails: {
      startingBacklog,
      aheadBacklog,
      clearancePath: resultClear.path
    }
  };
};
