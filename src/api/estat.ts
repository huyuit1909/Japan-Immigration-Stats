import { ImmigrationRecord } from '../data/mock';

const ACTION_MAP: Record<string, 'received' | 'processed' | 'totalHandled' | 'approved' | 'rejected'> = {
  '103000': 'received',      // Tiếp nhận mới trong kỳ (Received New)
  '300000': 'processed',     // Đã xử lý (Processed)
  '100000': 'totalHandled',  // Tổng thụ lý (Bao gồm tồn cũ + nhận mới)
  '301000': 'approved',      // Được cấp phép (Permission)
  '302000': 'rejected',      // Bị từ chối (Denial)
};

const BUREAU_MAP: Record<string, string> = {
  '100000': 'Toàn quốc (Tổng số)',
  '101010': 'Cục Sapporo',
  '101090': 'Cục Sendai',
  '101170': 'Cục Tokyo',
  '101190': 'Sân bay Narita',
  '101200': 'Sân bay Haneda',
  '101210': 'Chi nhánh Yokohama',
  '101350': 'Cục Nagoya',
  '101370': 'Sân bay Chubu',
  '101460': 'Cục Osaka',
  '101480': 'Sân bay Kansai',
  '101490': 'Chi nhánh Kobe',
  '101580': 'Cục Hiroshima',
  '101670': 'Cục Takamatsu',
  '101720': 'Cục Fukuoka',
  '101740': 'Chi nhánh Naha'
};

const TYPE_MAP: Record<string, string> = {
  '10': 'Cấp mới tư cách lưu trú',
  '20': 'Gia hạn lưu trú',
  '30': 'Thay đổi tư cách lưu trú',
  '40': 'Hoạt động ngoài tư cách',
  '50': 'Tái nhập cảnh',
  '60': 'Xin vĩnh trú'
};

export const fetchRealEstatData = async (appId: string): Promise<ImmigrationRecord[]> => {
  try {
    const url = `/api/estat/getStatsData?appId=${appId}&statsDataId=0003449073`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.GET_STATS_DATA?.RESULT?.STATUS !== 0) {
      throw new Error(data.GET_STATS_DATA?.RESULT?.ERROR_MSG || 'Lỗi từ API');
    }

    const values = data.GET_STATS_DATA.STATISTICAL_DATA.DATA_INF.VALUE;

    const map = new Map<string, ImmigrationRecord>();

    for (const v of values) {
      const action = ACTION_MAP[v['@cat01']];
      const type = TYPE_MAP[v['@cat02']];
      const bureau = BUREAU_MAP[v['@cat03']];
      const time = v['@time']; 

      if (!action || !type || !bureau) continue;

      // time format: 2023000101. Year is 0-4, Month is 6-8.
      const monthStr = time.length >= 8 ? `${time.substring(0, 4)}-${time.substring(6, 8)}` : time;

      const key = `${bureau}-${type}-${monthStr}`;

      if (!map.has(key)) {
        map.set(key, { month: monthStr, bureau, type, received: 0, processed: 0, pending: 0, totalHandled: 0, approved: 0, rejected: 0, passRate: 0 });
      }

      const record = map.get(key)!;
      const amount = parseInt(v['$'], 10) || 0;
      record[action] += amount;
    }

    const result = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));

    // Calculate exact pending & pass rate for each month
    for (const row of result) {
      row.pending = Math.max(0, (row.totalHandled || 0) - row.processed);
      
      const a = row.approved || 0;
      const r = row.rejected || 0;
      row.passRate = (a + r) > 0 ? parseFloat(((a / (a + r)) * 100).toFixed(1)) : 0;
    }

    return result;
  } catch (err) {
    console.error("API error:", err);
    throw err;
  }
};
