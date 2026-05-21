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
