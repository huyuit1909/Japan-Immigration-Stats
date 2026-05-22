export interface PersonalProfile {
  visaRoute: 'regular' | 'hsp' | 'spouse';
  yearsInJapan: number;
  hspPoints?: number; // Only if hsp
  income: number; // in millions of Yen (man)
  taxPensionClean: boolean;
  criminalRecord: boolean;
}

export interface AIPrediction {
  passRate: number;
  waitDaysMultiplier: number;
  reasons: string[];
}

export const calculatePersonalProfile = (
  profile: PersonalProfile,
  basePassRate: number
): AIPrediction => {
  let rate = basePassRate;
  const multiplier = 1.0;
  const reasons: string[] = [];

  // Critical Failure Checks
  if (profile.criminalRecord) {
    reasons.push("❌ Bị đánh rớt cực cao do có tiền sự án tích hoặc vi phạm giao thông nghiêm trọng.");
    rate *= 0.05;
  }
  if (!profile.taxPensionClean) {
    reasons.push("❌ Rủi ro từ chối rất cao do lịch sử nộp thuế/nenkin không minh bạch hoặc nợ đọng.");
    rate *= 0.1;
  }

  // Route specific checks
  // LƯU Ý: Đây là xin VĨNH TRÚ (永住). Ưu đãi HSP là RÚT NGẮN ĐIỀU KIỆN thời gian
  // cư trú để được nộp (80đ→1 năm, 70đ→3 năm), KHÔNG rút ngắn thời gian thẩm định.
  // Vì vậy multiplier luôn = 1.0 cho Vĩnh trú (không có luồng siêu tốc cho 永住).
  if (profile.visaRoute === 'hsp') {
    if (profile.hspPoints && profile.hspPoints >= 80) {
      if (profile.yearsInJapan < 1) {
        reasons.push("⚠️ Có 80+ điểm HSP nhưng chưa đủ 1 năm cư trú nên CHƯA đủ điều kiện nộp Vĩnh trú theo chế độ đặc biệt.");
        rate *= 0.2;
      } else {
        reasons.push("✨ HSP 80+ điểm: đủ điều kiện nộp Vĩnh trú sớm chỉ sau 1 năm (thay vì 10 năm). Hồ sơ điểm cao thường có tỉ lệ đậu rất tốt.");
        rate = Math.min(rate * 1.5, 98);
        // multiplier giữ 1.0: thời gian thẩm định Vĩnh trú không được rút ngắn.
      }
    } else if (profile.hspPoints && profile.hspPoints >= 70) {
      if (profile.yearsInJapan < 3) {
        reasons.push("⚠️ Có 70+ điểm HSP nhưng chưa đủ 3 năm cư trú nên CHƯA đủ điều kiện nộp Vĩnh trú theo chế độ đặc biệt.");
        rate *= 0.2;
      } else {
        reasons.push("✨ HSP 70+ điểm: đủ điều kiện nộp Vĩnh trú sớm sau 3 năm (thay vì 10 năm). Cần duy trì điểm ở cả mốc 3 năm trước và lúc nộp.");
        rate = Math.min(rate * 1.2, 95);
        // multiplier giữ 1.0: thời gian thẩm định Vĩnh trú không được rút ngắn.
      }
    } else {
      reasons.push("ℹ️ Dưới 70 điểm HSP nên không áp dụng chế độ đặc biệt — xét Vĩnh trú theo diện thường (10 năm cư trú).");
    }
  } else if (profile.visaRoute === 'spouse') {
    if (profile.yearsInJapan >= 3) {
      reasons.push("❤️ Diện kết hôn: Được miễn giảm yêu cầu 10 năm lưu trú.");
      rate = Math.min(rate * 1.3, 96);
    } else {
      reasons.push("⚠️ Diện kết hôn nhưng chưa đủ số năm chung sống cơ bản.");
      rate *= 0.4;
    }
  } else {
    // regular rules
    if (profile.yearsInJapan < 10) {
      reasons.push("⚠️ Rủi ro tước quyền: Visa thường bắt buộc phải ở đủ 10 năm và đi làm 5 năm!");
      rate *= 0.1;
    } else {
      reasons.push("✅ Đã vượt qua rào cản 10 năm bám trụ. Xét duyệt theo đúng tiến độ Cục.");
    }
  }

  // Income checks
  if (profile.income < 300) {
    reasons.push("📉 Cảnh báo: Thu nhập cá nhân dưới 300 man/năm là mức rất yếu với định cư độc lập.");
    rate *= 0.6;
  } else if (profile.income > 500) {
    reasons.push("💰 Nền tảng Tài chính tốt (Trên 500 man) giúp củng cố tỷ lệ đậu cao.");
    rate = Math.min(rate * 1.1, 99);
  }

  // Ensure bounds
  rate = Math.max(1, Math.min(rate, 99.9));

  return { passRate: parseFloat(rate.toFixed(1)), waitDaysMultiplier: multiplier, reasons };
};
