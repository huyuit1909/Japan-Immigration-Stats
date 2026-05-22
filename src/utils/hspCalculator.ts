export interface HSPCriteria {
  academic: 'doctor' | 'master' | 'bachelor' | 'none';
  experienceYears: number;
  age: number;
  annualIncome: number; // in millions of Yen
  japanese: 'n1' | 'n2' | 'none';
  japanUniGraduate: boolean;
  topUni: boolean; // Tốt nghiệp Top 300 thế giới hoặc trường do MOJ chỉ định (+10)
  dualDegree: boolean; // Có 2 bằng Thạc sĩ/Tiến sĩ trở lên (+5)
  itCert: 'disabled' | 'basic' | 'advanced'; // Bằng IT do Cục chứng nhận (FE, AP...)
  govSupportCompany: boolean; // Làm việc cho cty nhận hỗ trợ Sáng tạo của Chính phủ (+10)
}

export const calculateHSPPoints = (criteria: HSPCriteria): number => {
  let points = 0;

  // 1. Academy
  if (criteria.academic === 'doctor') points += 30;
  else if (criteria.academic === 'master') points += 20;
  else if (criteria.academic === 'bachelor') points += 10;

  // 2. Professional Experience
  if (criteria.experienceYears >= 10) points += 20;
  else if (criteria.experienceYears >= 7) points += 15;
  else if (criteria.experienceYears >= 5) points += 10;
  else if (criteria.experienceYears >= 3) points += 5;

  // 3. Age & Income matrix
  // Basic eligibility (Simplified for advanced professional i-b)
  if (criteria.annualIncome >= 300) { 
    // Age based income bonuses
    if (criteria.age <= 29) {
      if (criteria.annualIncome >= 700) points += 25;
      else if (criteria.annualIncome >= 600) points += 20;
      else if (criteria.annualIncome >= 500) points += 15;
      else if (criteria.annualIncome >= 400) points += 10;
    } else if (criteria.age >= 30 && criteria.age <= 34) {
      if (criteria.annualIncome >= 800) points += 30;
      else if (criteria.annualIncome >= 700) points += 25;
      else if (criteria.annualIncome >= 600) points += 20;
      else if (criteria.annualIncome >= 500) points += 15;
    } else if (criteria.age >= 35 && criteria.age <= 39) {
      if (criteria.annualIncome >= 900) points += 35;
      else if (criteria.annualIncome >= 800) points += 30;
      else if (criteria.annualIncome >= 700) points += 25;
      else if (criteria.annualIncome >= 600) points += 20;
    } else { // 40+
      if (criteria.annualIncome >= 1000) points += 40;
      else if (criteria.annualIncome >= 900) points += 35;
      else if (criteria.annualIncome >= 800) points += 30;
    }
  }

  // 4. Age Base Bonus
  if (criteria.age <= 29) points += 15;
  else if (criteria.age >= 30 && criteria.age <= 34) points += 10;
  else if (criteria.age >= 35 && criteria.age <= 39) points += 5;

  // 5. General Bonus
  if (criteria.japanese === 'n1') points += 15;
  else if (criteria.japanese === 'n2') points += 10;

  if (criteria.japanUniGraduate) {
    points += 10;
    if (criteria.japanese === 'n2') points -= 10; // Rule: if Japan Uni grad + N2, it caps at 10. If Japan Uni grad + N1, it's 25.
  }

  // 6. Extra MOJ Bonuses
  if (criteria.topUni) points += 10;
  if (criteria.dualDegree) points += 5;
  
  if (criteria.itCert === 'basic') points += 5;
  else if (criteria.itCert === 'advanced') points += 10;

  if (criteria.govSupportCompany) points += 10;

  return points;
};

// ============================================================
// XIN VĨNH TRÚ (永住) THEO CHẾ ĐỘ ĐẶC BIỆT CỦA HSP
// 高度人材ポイント制による永住許可の特例
// ============================================================
// Bản chất ưu đãi HSP cho Vĩnh trú là RÚT NGẮN ĐIỀU KIỆN THỜI GIAN CƯ TRÚ
// để ĐƯỢC PHÉP NỘP đơn — KHÔNG phải rút ngắn thời gian thẩm định:
//   - 80+ điểm (duy trì liên tục >= 1 năm)  -> được nộp sau 1 năm  (thay vì 10 năm)
//   - 70+ điểm (duy trì liên tục >= 3 năm)  -> được nộp sau 3 năm
//   - < 70 điểm                             -> theo diện thường: 10 năm cư trú
// Điểm phải đạt ngưỡng ở CẢ HAI mốc: thời điểm (nay - số năm yêu cầu) VÀ lúc nộp.
//
// Lưu ý quan trọng: Hồ sơ Vĩnh trú (kể cả của HSP) KHÔNG đi luồng xét siêu tốc
// 5–10 ngày (luồng đó chỉ áp dụng cho cấp/đổi/gia hạn tư cách lao động).
// Thời gian thẩm định Vĩnh trú vẫn theo tiến độ chuẩn của Cục (~4 tháng tới hơn 1 năm),
// nên ở đây ta dùng đúng số ngày hàng đợi (backlog) tính từ dữ liệu thực tế.

export interface HSPPermanentResidenceEstimate {
  route: 'hsp-80' | 'hsp-70' | 'regular';
  requiredYears: number;       // Số năm cư trú cần để ĐƯỢC NỘP
  eligibleNow: boolean;        // Đã đủ điều kiện nộp chưa
  yearsUntilEligible: number;  // Số năm còn thiếu (0 nếu đã đủ)
  processingDays: number;      // Thời gian THẨM ĐỊNH ước tính = backlog (HSP không rút ngắn)
  note: string;                // Diễn giải cho người dùng
}

export const estimateHSPPermanentResidence = (
  points: number,
  yearsInJapan: number,
  backlogWaitDays: number
): HSPPermanentResidenceEstimate => {
  // Xác định lộ trình & số năm yêu cầu
  let route: 'hsp-80' | 'hsp-70' | 'regular';
  let requiredYears: number;
  if (points >= 80) {
    route = 'hsp-80';
    requiredYears = 1;
  } else if (points >= 70) {
    route = 'hsp-70';
    requiredYears = 3;
  } else {
    route = 'regular';
    requiredYears = 10;
  }

  const eligibleNow = yearsInJapan >= requiredYears;
  const yearsUntilEligible = Math.max(0, requiredYears - yearsInJapan);

  let note: string;
  if (route === 'regular') {
    note = eligibleNow
      ? `Dưới 70 điểm HSP (hiện ${points}đ) → theo diện thường: đã đủ ${requiredYears} năm cư trú nên được nộp. Thời gian thẩm định ~${backlogWaitDays} ngày theo hàng đợi của Cục.`
      : `⚠️ Dưới 70 điểm HSP (hiện ${points}đ) → cần đủ ${requiredYears} năm cư trú mới được nộp Vĩnh trú (hiện mới ${yearsInJapan} năm, còn thiếu ${yearsUntilEligible} năm).`;
  } else {
    const tier = route === 'hsp-80' ? '80+' : '70+';
    note = eligibleNow
      ? `✨ HSP ${points}đ (mốc ${tier}): được nộp Vĩnh trú SỚM chỉ sau ${requiredYears} năm thay vì 10 năm — bạn đã ${yearsInJapan} năm nên đủ điều kiện. Lưu ý: ưu đãi là được nộp sớm, còn thời gian THẨM ĐỊNH vẫn ~${backlogWaitDays} ngày như diện thường (không xét siêu tốc). Cần duy trì điểm ở cả mốc ${requiredYears} năm trước và lúc nộp.`
      : `⚠️ HSP ${points}đ (mốc ${tier}): chế độ đặc biệt cho nộp sau ${requiredYears} năm, nhưng bạn mới ${yearsInJapan} năm — còn thiếu ${yearsUntilEligible} năm nữa mới đủ điều kiện nộp.`;
  }

  return {
    route,
    requiredYears,
    eligibleNow,
    yearsUntilEligible,
    processingDays: backlogWaitDays, // HSP KHÔNG rút ngắn thời gian thẩm định Vĩnh trú
    note,
  };
};
