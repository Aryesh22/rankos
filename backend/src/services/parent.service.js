import mongoose from "mongoose";
import { ROLES } from "../constants/roles.js";
import { ApiError } from "../utils/ApiError.js";
import { User, ExamDNA, TestAttempt, StudyLog } from "../models/index.js";

/**
 * Parent service — the Parent View (API_SPEC.md → Page `/app/parent`). For the
 * demo we resolve the seeded student. Reports expose trends only (never
 * questions/chat). A student may self-preview their own report.
 */

/** The seeded demo student (oldest student account). */
async function findDemoStudent() {
  return User.findOne({ role: ROLES.STUDENT, deletedAt: null }).sort({ createdAt: 1 });
}

/** GET /parent/children → the children linked to this parent (demo: the seeded student). */
export async function getChildren() {
  const student = await findDemoStudent();
  const data = student
    ? [{ studentId: String(student._id), name: student.fullName, exam: student.exam || "JEE" }]
    : [];
  return { data };
}

/** GET /parent/report?studentId=&week=current */
export async function getReport(requester, { studentId } = {}) {
  // Students may only preview their own report.
  let targetId = studentId;
  if (requester.role === ROLES.STUDENT) targetId = requester.id;
  if (!targetId) {
    const demo = await findDemoStudent();
    targetId = demo?._id;
  }
  if (!targetId || !mongoose.isValidObjectId(targetId)) {
    throw ApiError.notFound("Student not found");
  }

  const [student, dna, latestAttempt, logs] = await Promise.all([
    User.findById(targetId),
    ExamDNA.findOne({ user: targetId }),
    TestAttempt.find({ user: targetId, status: "submitted" }).sort({ submittedAt: -1 }).limit(1),
    StudyLog.find({ user: targetId }).sort({ date: -1 }).limit(7),
  ]);
  if (!student) throw ApiError.notFound("Student not found");

  const week = [...logs].reverse();
  const studyTimeWeek = week.map((l) => ({
    day: new Date(l.date).toLocaleDateString("en-US", { weekday: "short" }),
    hours: Math.round(((l.minutes || 0) / 60) * 10) / 10,
    target: 6,
  }));

  const activeDays = week.filter((l) => (l.value || 0) > 0).length;
  const attendance = week.length ? Math.round((activeDays / week.length) * 100) : 0;
  const focusBehaviour = dna?.behaviours?.find((b) => b.key === "focus");
  const focusScore = focusBehaviour?.value ?? 81;

  const attempt = latestAttempt[0];
  const subjectBreakdown = attempt?.subjectBreakdown?.length
    ? attempt.subjectBreakdown.map((s) => ({ subject: s.subject, accuracy: s.accuracy }))
    : [];

  return {
    student: { name: student.fullName },
    studyTimeWeek,
    attendance,
    focusScore,
    burnoutRisk: dna?.burnoutRisk ?? "Low",
    subjectBreakdown,
    recommendation:
      "Consistency is strong this week. Protect the evening focus block and schedule the weakest subject earlier in the day, while energy is high.",
  };
}

export default { getChildren, getReport };
