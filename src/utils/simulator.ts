import { ImmigrationRecord } from '../types/immigration';

export interface SimulationResult {
  submitDate: string;
  vettingStartDate?: string; // Ngày bắt đầu được thẩm tra
  queueWaitDays: number;     // Số ngày chờ trong hàng đợi
  activeVettingDays: number; // Số ngày thẩm tra hồ sơ
  completionDate?: string;   // Ngày trả kết quả dự kiến
  waitDays: number;          // Tổng số ngày từ ngày nộp đến khi trả kết quả
  projected: boolean;
  positionDetails: {
    startingBacklog: number;
    aheadBacklog: number;
    clearancePath: { month: string; processed: number }[];
  };
  formulaDetails?: {
    C_prev: number;
    N_app: number;
    P_app: number;
    Q_app: number;
    C_proc: number;
    E_proc: number;
    Q_pos: number;
    sumP: number;
    sumD: number;
    R_daily: number;
    D_rem: number;      // Số ngày chờ còn lại từ ngày hôm nay
    D_total: number;    // Tổng số ngày chờ từ ngày nộp
    daysWaited: number; // Số ngày đã chờ từ ngày nộp đến hôm nay
    referenceDate: string;
    lastRealMonth: string;
  };
}

// ---------- Helpers ngày tháng (an toàn múi giờ) ----------

// Parse "YYYY-MM-DD" thành Date theo GIỜ ĐỊA PHƯƠNG
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

// Số ngày thực tế của một tháng
const daysInMonth = (year: number, month1to12: number): number =>
  new Date(year, month1to12, 0).getDate();

const monthStrToYM = (monthStr: string): [number, number] => {
  const [y, m] = monthStr.split('-').map(Number);
  return [y, m];
};

// Chênh lệch ngày tròn giữa 2 mốc
const diffInDays = (from: Date, to: Date): number => {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

// Ngoại suy tuyến tính dữ liệu thật e-Stat cho các tháng trống tiếp theo
// CHỈ dùng để tìm tháng nộp khi nộp ở tương lai
const projectDataSeries = (dataSeries: ImmigrationRecord[], targetMonthStr: string): ImmigrationRecord[] => {
  const lastRecord = dataSeries[dataSeries.length - 1];
  if (lastRecord.month >= targetMonthStr) return dataSeries;

  const projected = [...dataSeries];

  // Tính tốc độ nhận và xử lý trung bình của 12 tháng gần nhất (dữ liệu thật)
  const window = 12;
  const recent = dataSeries.slice(-window);
  const avgReceived = Math.round(recent.reduce((sum, r) => sum + r.received, 0) / recent.length) || 1;
  const avgProcessed = Math.round(recent.reduce((sum, r) => sum + r.processed, 0) / recent.length) || 1;

  let [curY, curM] = lastRecord.month.split('-').map(Number);
  let currentPending = lastRecord.pending;

  while (true) {
    if (curM >= 12) {
      curY += 1;
      curM = 1;
    } else {
      curM += 1;
    }

    const curMonthStr = `${curY}-${String(curM).padStart(2, '0')}`;

    // pending mới = pending cũ + nhận mới - xử lý
    currentPending = Math.max(0, currentPending + avgReceived - avgProcessed);

    projected.push({
      month: curMonthStr,
      bureau: lastRecord.bureau,
      type: lastRecord.type,
      received: avgReceived,
      processed: avgProcessed,
      pending: currentPending,
      totalHandled: currentPending + avgProcessed
    });

    if (curMonthStr >= targetMonthStr || projected.length > 240) {
      break;
    }
  }

  return projected;
};

// ---------- Lõi: Tính toán theo công thức toán học ----------
//
// Công thức:
//   Q_app  = C_prev + N_app - P_app
//   Q_pos  = max(0, Q_app - C_proc - E_proc)
//   R_daily = ΣP_real / ΣD_real   (chỉ dùng dữ liệu thật từ e-Stat)
//   D_rem  = ceil(Q_pos / R_daily)
//
// Trong đó:
//   C_prev  = pending cuối tháng TRƯỚC tháng nộp  (hồ sơ tồn đọng sang tháng của bạn)
//   N_app   = received trong tháng nộp             (tổng tiếp nhận mới tháng đó)
//   P_app   = N_app × (T - d) / T                  (hồ sơ nộp SAU bạn cùng tháng, ước tính)
//   C_proc  = processed_month × d / T              (đã xử lý TRƯỚC khi bạn nộp trong tháng đó)
//   E_proc  = chỉ tính khi ngày nộp đã QUA
//             = processed_month × (T - d) / T     (xử lý sau bạn trong cùng tháng nộp)
//             + Σ processed(tháng kế tiếp đến tháng cuối dữ liệu THẬT)
//             nhưng KHÔNG vượt quá Q_app - C_proc (không âm Q_pos)
//   R_daily = Σ processed(6 tháng thật gần nhất) / Σ days(6 tháng đó)
//
// Ngày hoàn thành = baseDate + D_rem ngày
//   baseDate = ngày hiện tại (nếu đã nộp quá khứ/hôm nay) hoặc ngày nộp (nếu tương lai)

export const calculateCFM = (submitDate: string, dataSeries: ImmigrationRecord[]): SimulationResult | null => {
  if (!dataSeries || dataSeries.length === 0) return null;

  const submitMonthStr = submitDate.substring(0, 7); // "YYYY-MM"
  const submitObj = parseLocalDate(submitDate);

  // Ngày hiện tại của hệ thống
  const today = new Date();
  const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Tháng cuối cùng của dữ liệu THẬT từ e-Stat (KHÔNG ngoại suy)
  const lastRealRecord = dataSeries[dataSeries.length - 1];
  const lastRealMonthStr = lastRealRecord.month;

  // Nếu tháng nộp > tháng dữ liệu thật → cần ngoại suy để tìm record tháng nộp
  const needProject = submitMonthStr > lastRealMonthStr;
  const workingSeries = needProject
    ? projectDataSeries(dataSeries, submitMonthStr)
    : dataSeries;

  // Tìm index tháng nộp
  let startIndex = workingSeries.findIndex(d => d.month === submitMonthStr);
  if (startIndex === -1) {
    // Không có tháng đó → lấy tháng gần nhất
    startIndex = workingSeries.findIndex(d => d.month > submitMonthStr);
    if (startIndex === -1) startIndex = workingSeries.length - 1;
  }

  const currentRecord = workingSeries[startIndex];
  const d = submitObj.getDate();
  const [submitY, submitM] = monthStrToYM(currentRecord.month);
  const T = daysInMonth(submitY, submitM);

  // ---- Bước 1: C_prev ----
  // Hồ sơ tồn đọng cuối tháng TRƯỚC (= pending tháng trước)
  let C_prev = 0;
  if (startIndex > 0) {
    C_prev = workingSeries[startIndex - 1].pending;
  } else {
    // Không có tháng trước trong data → ước tính từ totalHandled
    C_prev = Math.max(0, (currentRecord.totalHandled || 0) - currentRecord.received);
  }

  // ---- Bước 2: N_app ----
  // Tổng hồ sơ tiếp nhận mới trong tháng nộp
  const N_app = currentRecord.received;

  // ---- Bước 3: P_app ----
  // Hồ sơ nộp SAU bạn trong cùng tháng (ước tính đều đặn tuyến tính)
  const P_app = Math.round(N_app * ((T - d) / T));

  // ---- Bước 4: Q_app ----
  // Tổng hồ sơ đứng trước bạn tại thời điểm nộp
  const Q_app = C_prev + N_app - P_app;

  // ---- Bước 5: C_proc ----
  // Số hồ sơ đã xử lý TRƯỚC ngày nộp của bạn trong tháng nộp (ước tính tuyến tính)
  const P_month = currentRecord.processed;
  const C_proc = Math.round(P_month * (d / T));

  // ---- Bước 6: E_proc ----
  // Hồ sơ đã được xử lý từ sau khi bạn nộp cho đến THÁNG CUỐI DỮ LIỆU THẬT
  // Chỉ tính khi ngày nộp đã qua (hoặc hôm nay)
  const submitDateZero = new Date(submitObj.getFullYear(), submitObj.getMonth(), submitObj.getDate());
  const isSubmitInFuture = submitDateZero.getTime() > todayZero.getTime();

  let E_proc = 0;
  if (!isSubmitInFuture) {
    // Phần sau bạn nộp trong cùng tháng (dữ liệu thật)
    const submitMonthIsReal = submitMonthStr <= lastRealMonthStr;
    if (submitMonthIsReal) {
      const P_submit_after_in_month = Math.round(P_month * ((T - d) / T));

      // Các tháng sau tháng nộp cho đến tháng cuối dữ liệu THẬT
      let P_after_months = 0;
      for (let i = 0; i < dataSeries.length; i++) {
        if (dataSeries[i].month > submitMonthStr && dataSeries[i].month <= lastRealMonthStr) {
          P_after_months += dataSeries[i].processed;
        }
      }

      E_proc = P_submit_after_in_month + P_after_months;
    }
    // Nếu tháng nộp là tháng tương lai (ngoại suy) thì E_proc = 0
    // (không có dữ liệu thật nào sau ngày nộp cả)
  }

  // E_proc KHÔNG được vượt quá (Q_app - C_proc) để tránh Q_pos âm
  E_proc = Math.min(E_proc, Math.max(0, Q_app - C_proc));

  // ---- Bước 7: Q_pos ----
  const Q_pos = Math.max(0, Q_app - C_proc - E_proc);

  // ---- Bước 8: R_daily ----
  // Tốc độ xử lý trung bình hàng ngày — CHỈ dùng dữ liệu THẬT (không ngoại suy)
  // Lấy 6 tháng thật gần nhất tính từ cuối dataSeries gốc
  const RATE_WINDOW = 6;
  const speedRecords = dataSeries.slice(Math.max(0, dataSeries.length - RATE_WINDOW));
  const sumP = speedRecords.reduce((sum, r) => sum + r.processed, 0);
  const sumD = speedRecords.reduce((sum, r) => {
    const [y, m] = monthStrToYM(r.month);
    return sum + daysInMonth(y, m);
  }, 0);

  const R_daily = sumD > 0 ? parseFloat((sumP / sumD).toFixed(4)) : 1.0;

  // ---- Bước 9: Tính toán tổng số ngày thẩm định kể từ ngày nộp ----
  const D_total = R_daily > 0 ? Math.ceil(Q_pos / R_daily) : 0;

  // ---- Bước 10: Ngày hoàn thành ----
  // Ngày hoàn thành dự kiến luôn bằng Ngày nộp + Tổng số ngày chờ tính từ ngày nộp
  const completionDateObj = new Date(
    submitObj.getFullYear(),
    submitObj.getMonth(),
    submitObj.getDate() + D_total
  );
  const completionDate = formatDate(completionDateObj);

  // Tổng số ngày chờ thực tế từ ngày nộp đến ngày hoàn thành
  const waitDays = Math.max(0, diffInDays(submitObj, completionDateObj));

  // Tính số ngày đã chờ và số ngày còn lại
  const daysWaited = isSubmitInFuture ? 0 : Math.max(0, diffInDays(submitObj, todayZero));
  const D_rem = isSubmitInFuture ? D_total : Math.max(0, D_total - daysWaited);

  // Các trường tương thích ngược cho giao diện cũ
  const queueWaitDays = Math.max(0, Math.round(waitDays * 0.7));
  const activeVettingDays = Math.max(0, waitDays - queueWaitDays);
  const vettingStartDateObj = new Date(
    submitObj.getFullYear(),
    submitObj.getMonth(),
    submitObj.getDate() + queueWaitDays
  );
  const vettingStartDate = formatDate(vettingStartDateObj);

  const baseCalcDate = isSubmitInFuture ? submitObj : today;
  const referenceDateStr = formatDate(baseCalcDate);

  return {
    submitDate,
    vettingStartDate,
    queueWaitDays,
    activeVettingDays,
    completionDate,
    waitDays,
    projected: needProject,
    positionDetails: {
      startingBacklog: currentRecord.pending,
      aheadBacklog: C_prev,
      clearancePath: []
    },
    formulaDetails: {
      C_prev,
      N_app,
      P_app,
      Q_app,
      C_proc,
      E_proc,
      Q_pos,
      sumP,
      sumD,
      R_daily,
      D_rem,
      D_total,
      daysWaited,
      referenceDate: referenceDateStr,
      lastRealMonth: lastRealMonthStr
    }
  };
};
