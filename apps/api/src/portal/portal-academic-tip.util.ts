export type AcademicTipInput = {
  lowestAttendance?: {
    courseCode: string;
    ratePercent: number;
  };
  dueSoonCount?: number;
  cgpa?: number | null;
};

/** Rule-based academic coaching tip (no external AI required). */
export function buildRuleBasedAcademicTip(input: AcademicTipInput): string | null {
  if (input.lowestAttendance && input.lowestAttendance.ratePercent < 75) {
    const { courseCode, ratePercent } = input.lowestAttendance;
    return `Based on your ${courseCode} attendance (${Math.round(ratePercent)}%), review this week's materials before the next class session.`;
  }
  if ((input.dueSoonCount ?? 0) > 0) {
    return `You have ${input.dueSoonCount} assessment${input.dueSoonCount === 1 ? '' : 's'} due in the next 7 days — block time on your calendar to finish them early.`;
  }
  if (input.cgpa != null && input.cgpa < 2.5) {
    return `Your CGPA is ${input.cgpa.toFixed(2)}. Meet your academic advisor to plan support sessions for courses where you need extra help.`;
  }
  if (input.cgpa != null && input.cgpa >= 3.5) {
    return `Strong academic standing (CGPA ${input.cgpa.toFixed(2)}). Keep consistent study habits to maintain your momentum this term.`;
  }
  return "Stay on top of this week's LMS modules and check due dates every morning.";
}
