import { ImmigrationRecord } from '../types/immigration';

export interface SimulationResult {
  submitDate: string;
  vettingStartDate?: string; // Ngày bắt đầu được thẩm tra (ước lượng hiển thị)
  queueWaitDays: number;     // Số ngày chờ trong hàng đợi (ước lượng hiển thị)
  activeVettingDays: number; // Số ngày thẩm tra hồ sơ (ước lượng hiển thị)
  completionDate?: string;   // Ngày trả kết quả dự kiến
  waitDays: number;          // Tổng số ngày từ ngày nộp đến khi trả kết quả
  projected: boolean;        // true nếu tháng nộp nằm ngoài dữ liệu thật (phải ngoại suy)
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
    D_queue: number;       // Số ngày để xử lý hết Q_pos, tính từ anchorDate
    D_elapsed: number;     // Số ngày từ ngày nộp đến anchorDate
    D_rem: number;         // Số ngày chờ còn lại tính từ hôm nay
    D_total: number;       // Tổng số ngày chờ từ ngày nộp = D_elapsed + D_queue
    daysWaited: number;    // Số ngày đã chờ từ ngày nộp đến hôm nay
    anchorDate: string;    // Mốc bắt đầu tính D_queue (cuối tháng dữ liệu thật, hoặc ngày nộp)
    clearedInData: boolean; // true nếu theo dữ liệu thật, hàng đợi trước bạn đã được xử lý hết
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

const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

// Chênh lệch ngày tròn giữa 2 mốc
const diffInDays = (from: Date, to: Date): number => {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

// Hồ sơ tồn đọng ĐẦU tháng (旧受) của một record.
// e-Stat: 受理_総数 = 旧受 + 新受  →  旧受 = totalHandled - received.
// Dùng 旧受 trực tiếp chính xác hơn pending tháng trước (có tháng lệch do chuyển hồ sơ giữa các cục).
const openingBacklog = (series: ImmigrationRecord[], index: number): number => {
  const rec = series[index];
  if (rec.totalHandled && rec.totalHandled > 0) {
    return Math.max(0, rec.totalHandled - rec.received);
  }
  return index > 0 ? series[index - 1].pending : 0;
};

// Ngoại suy dữ liệu cho các tháng CHƯA có số liệu thật (chỉ dùng khi tháng nộp > tháng dữ liệu thật cuối).
//   received  = trung bình 12 tháng thật gần nhất (trung hoà tính mùa vụ)
//   processed = R_daily × số ngày của tháng  (cùng tốc độ dùng để tính thời gian chờ → nhất quán)
const projectDataSeries = (
  dataSeries: ImmigrationRecord[],
  targetMonthStr: string,
  R_daily: number
): ImmigrationRecord[] => {
  const lastRecord = dataSeries[dataSeries.length - 1];
  if (lastRecord.month >= targetMonthStr) return dataSeries;

  const projected = [...dataSeries];
  const recent = dataSeries.slice(-12);
  const avgReceived = Math.round(recent.reduce((sum, r) => sum + r.received, 0) / recent.length);

  let [curY, curM] = monthStrToYM(lastRecord.month);
  let currentPending = lastRecord.pending;

  while (projected.length < dataSeries.length + 240) {
    if (curM >= 12) { curY += 1; curM = 1; } else { curM += 1; }
    const curMonthStr = `${curY}-${String(curM).padStart(2, '0')}`;
    const opening = currentPending;
    const available = opening + avgReceived;
    const processed = Math.min(available, Math.round(R_daily * daysInMonth(curY, curM)));
    currentPending = available - processed;

    projected.push({
      month: curMonthStr,
      bureau: lastRecord.bureau,
      type: lastRecord.type,
      received: avgReceived,
      processed,
      pending: currentPending,
      totalHandled: available
    });

    if (curMonthStr >= targetMonthStr) break;
  }

  return projected;
};

// ---------- Lõi: mô hình hàng đợi FIFO ----------
//
// Giả định: hồ sơ được xử lý theo thứ tự nộp (FIFO); trong một tháng, việc tiếp nhận và
// xử lý diễn ra đều theo ngày.
//
// 1) Số hồ sơ đứng trước bạn tại thời điểm nộp (ngày d của tháng có T ngày):
//      Q_app  = C_prev + N_app - P_app          (P_app = N_app·(T-d)/T : nộp SAU bạn)
//      A_0    = Q_app - C_proc                  (C_proc = P_month·d/T : đã xử lý TRƯỚC khi bạn nộp)
//
// 2) Trừ dần số hồ sơ đã xử lý THẬT sau ngày nộp (phần còn lại của tháng nộp + các tháng sau,
//    đến hết tháng dữ liệu thật cuối cùng):
//      E_proc = min(A_0, P_month·(T-d)/T + Σ processed(tháng sau → tháng thật cuối))
//      Q_pos  = A_0 - E_proc                    (số hồ sơ CÒN đứng trước bạn tại anchorDate)
//    Nếu hàng đợi hết giữa chừng → nội suy ra đúng ngày trong tháng đó (clearedInData).
//
// 3) Phần còn lại dùng tốc độ trung bình 6 tháng thật gần nhất:
//      R_daily = ΣP / ΣD
//      D_queue = ceil(Q_pos / R_daily)          (tính TỪ anchorDate, không phải từ ngày nộp)
//
// 4) anchorDate = ngày cuối của tháng dữ liệu thật cuối (nếu tháng nộp có dữ liệu thật)
//                 hoặc chính ngày nộp (nếu tháng nộp phải ngoại suy → E_proc = 0)
//    Ngày hoàn thành = anchorDate + D_queue
//    D_total = (anchorDate - ngày nộp) + D_queue ;  D_rem = max(0, ngày hoàn thành - hôm nay)

export const calculateCFM = (submitDate: string, dataSeries: ImmigrationRecord[]): SimulationResult | null => {
  if (!dataSeries || dataSeries.length === 0) return null;

  let submitObj = parseLocalDate(submitDate);
  const today = new Date();
  const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Tháng cuối cùng của dữ liệu THẬT
  const lastRealRecord = dataSeries[dataSeries.length - 1];
  const lastRealMonthStr = lastRealRecord.month;
  const [lastY, lastM] = monthStrToYM(lastRealMonthStr);
  const lastRealEnd = new Date(lastY, lastM - 1, daysInMonth(lastY, lastM));

  // Nếu ngày nộp trước cả tháng đầu tiên có dữ liệu → coi như nộp ngày đầu tháng đầu tiên
  const firstMonthStr = dataSeries[0].month;
  if (submitDate.substring(0, 7) < firstMonthStr) {
    const [fy, fm] = monthStrToYM(firstMonthStr);
    submitObj = new Date(fy, fm - 1, 1);
  }
  const submitMonthStr = formatDate(submitObj).substring(0, 7);

  // ---- R_daily: tốc độ xử lý/ngày, CHỈ từ dữ liệu thật (6 tháng gần nhất) ----
  const RATE_WINDOW = 6;
  const speedRecords = dataSeries.slice(-RATE_WINDOW);
  const sumP = speedRecords.reduce((sum, r) => sum + r.processed, 0);
  const sumD = speedRecords.reduce((sum, r) => {
    const [y, m] = monthStrToYM(r.month);
    return sum + daysInMonth(y, m);
  }, 0);
  const R_daily = sumD > 0 && sumP > 0 ? parseFloat((sumP / sumD).toFixed(4)) : 1.0;

  // ---- Chuỗi dữ liệu làm việc (ngoại suy nếu tháng nộp chưa có số liệu thật) ----
  const needProject = submitMonthStr > lastRealMonthStr;
  const workingSeries = needProject ? projectDataSeries(dataSeries, submitMonthStr, R_daily) : dataSeries;

  let startIndex = workingSeries.findIndex(r => r.month === submitMonthStr);
  if (startIndex === -1) {
    // Tháng bị thiếu trong dữ liệu → lấy tháng gần nhất phía sau
    startIndex = workingSeries.findIndex(r => r.month > submitMonthStr);
    if (startIndex === -1) startIndex = workingSeries.length - 1;
  }

  const currentRecord = workingSeries[startIndex];
  const [subY, subM] = monthStrToYM(currentRecord.month);
  const T = daysInMonth(subY, subM);
  const d = currentRecord.month === submitMonthStr ? Math.min(submitObj.getDate(), T) : 0;

  // ---- Bước 1: vị trí trong hàng đợi tại thời điểm nộp ----
  const C_prev = openingBacklog(workingSeries, startIndex);
  const N_app = currentRecord.received;
  const P_app = Math.round(N_app * ((T - d) / T));
  const Q_app = C_prev + N_app - P_app;
  const P_month = currentRecord.processed;
  const C_proc = Math.min(Q_app, Math.round(P_month * (d / T)));
  const A0 = Math.max(0, Q_app - C_proc);

  // ---- Bước 2: trừ dần phần đã xử lý THẬT sau ngày nộp ----
  let ahead = A0;
  let E_proc = 0;
  let clearanceDate: Date | null = null;
  const clearancePath: { month: string; processed: number }[] = [];

  if (!needProject) {
    for (let i = startIndex; i < dataSeries.length; i++) {
      const rec = dataSeries[i];
      const [y, m] = monthStrToYM(rec.month);
      const Tm = daysInMonth(y, m);
      const startDay = i === startIndex ? d : 0;     // số ngày trong tháng đã trôi qua trước "cửa sổ"
      const dailyRate = rec.processed / Tm;
      const available = dailyRate * (Tm - startDay);

      if (ahead <= 0) break;
      if (dailyRate > 0 && available >= ahead) {
        // Hàng đợi trước bạn được xử lý hết ngay trong tháng này → nội suy ra ngày cụ thể
        const daysNeeded = Math.ceil(ahead / dailyRate);
        clearanceDate = new Date(y, m - 1, Math.min(Tm, startDay + Math.max(1, daysNeeded)));
        clearancePath.push({ month: rec.month, processed: Math.round(ahead) });
        E_proc += ahead;
        ahead = 0;
        break;
      }
      clearancePath.push({ month: rec.month, processed: Math.round(available) });
      E_proc += available;
      ahead -= available;
    }
  }

  E_proc = Math.round(E_proc);
  const Q_pos = clearanceDate ? 0 : Math.max(0, A0 - E_proc);

  // ---- Bước 3 + 4: phần còn lại theo tốc độ R_daily, tính TỪ anchorDate ----
  const anchorObj = needProject ? submitObj : lastRealEnd;
  let D_queue = 0;
  let completionDateObj: Date;
  if (clearanceDate) {
    completionDateObj = clearanceDate < submitObj ? submitObj : clearanceDate;
  } else {
    D_queue = Math.ceil(Q_pos / R_daily);
    completionDateObj = addDays(anchorObj, D_queue);
  }

  const completionDate = formatDate(completionDateObj);
  const waitDays = Math.max(0, diffInDays(submitObj, completionDateObj));
  const D_total = waitDays;
  const D_elapsed = clearanceDate ? D_total : Math.max(0, diffInDays(submitObj, anchorObj));

  const isSubmitInFuture = submitObj.getTime() > todayZero.getTime();
  const daysWaited = isSubmitInFuture ? 0 : Math.max(0, diffInDays(submitObj, todayZero));
  const D_rem = Math.max(0, diffInDays(isSubmitInFuture ? submitObj : todayZero, completionDateObj));

  // Các trường tương thích ngược cho giao diện cũ (tỉ lệ 70/30 chỉ mang tính minh hoạ)
  const queueWaitDays = Math.max(0, Math.round(waitDays * 0.7));
  const activeVettingDays = Math.max(0, waitDays - queueWaitDays);
  const vettingStartDate = formatDate(addDays(submitObj, queueWaitDays));

  const referenceDateStr = formatDate(isSubmitInFuture ? submitObj : todayZero);

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
      aheadBacklog: A0,
      clearancePath
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
      D_queue,
      D_elapsed,
      D_rem,
      D_total,
      daysWaited,
      anchorDate: formatDate(anchorObj),
      clearedInData: !!clearanceDate,
      referenceDate: referenceDateStr,
      lastRealMonth: lastRealMonthStr
    }
  };
};
