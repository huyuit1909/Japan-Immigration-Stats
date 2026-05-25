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
