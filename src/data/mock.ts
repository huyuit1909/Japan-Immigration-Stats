export interface ImmigrationRecord {
  month: string;
  bureau: string;
  type: string;
  received: number;    // Hồ sơ tiếp nhận MỚI
  processed: number;   // Hồ sơ đã xử lý
  pending: number;     // Hồ sơ tồn đọng (chưa xử lý)
  totalHandled?: number; // Tổng số hồ sơ thụ lý (Tồn cũ + nhận mới)
  approved?: number;
  rejected?: number;
  passRate?: number;
}

export const BUREAUS = [
  'Toàn quốc', 'Cục Tokyo', 'Cục Osaka', 'Cục Nagoya', 'Cục Fukuoka', 'Cục Sapporo'
];

export const APP_TYPES = [
  'Tổng cộng', 'Cấp Giấy chứng nhận (COE)', 'Thay đổi thư cách lưu trú', 'Gia hạn lưu trú', 'Xin vĩnh trú'
];

// Generate fake data based on realistic trends (e.g. rising backlog)
export const generateMockData = (): ImmigrationRecord[] => {
  const data: ImmigrationRecord[] = [];
  const startYear = 2023;
  const startMonth = 1;

  BUREAUS.forEach((bureau) => {
    APP_TYPES.forEach((type) => {
      // Base values to simulate different scales
      let baseReceived = bureau === 'Toàn quốc' ? 50000 : (bureau === 'Cục Tokyo' ? 25000 : 5000);
      if (type === 'Xin vĩnh trú') baseReceived = Math.floor(baseReceived * 0.1);
      
      let currentPending = baseReceived * 2.5; // Starts with a backlog

      for (let i = 0; i < 12; i++) {
        const date = new Date(startYear, startMonth + i - 1, 1);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        // Add some random noise
        const received = Math.floor(baseReceived * (1 + (Math.random() * 0.2 - 0.1)));
        // Processed is usually around what's received but slightly less recently, causing backlog growth
        const processed = Math.floor(received * (1 + (Math.random() * 0.1 - 0.08))); 
        
        currentPending = currentPending + received - processed;

        data.push({
          month: monthStr,
          bureau,
          type,
          received,
          processed,
          pending: Math.floor(currentPending),
          totalHandled: Math.floor(currentPending + processed)
        });
      }
    });
  });

  return data;
};

export const MOCK_DATA = generateMockData();
