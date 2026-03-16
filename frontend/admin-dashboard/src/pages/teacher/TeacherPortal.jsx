import React, { useEffect, useState, useCallback, useRef } from "react";
import { getUser, logout } from "../../services/auth";
import API from "../../services/api";
import AnnouncementsFeed from "../AnnouncementsFeed";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const TERMS = [
  { value: "term1", label: "Term 1" },
  { value: "term2", label: "Term 2" },
  { value: "term3", label: "Term 3" },
];

const GRADE_REMARK = {
  "1":  { label: "HIGHEST",      bg: "bg-green-100   text-green-800"   },
  "2":  { label: "HIGHER",       bg: "bg-emerald-100 text-emerald-800" },
  "3":  { label: "HIGH",         bg: "bg-blue-100    text-blue-800"    },
  "4":  { label: "HIGH AVERAGE", bg: "bg-cyan-100    text-cyan-800"    },
  "5":  { label: "AVERAGE",      bg: "bg-yellow-100  text-yellow-800"  },
  "6":  { label: "LOW AVERAGE",  bg: "bg-orange-100  text-orange-800"  },
  "7":  { label: "LOW",          bg: "bg-red-100     text-red-700"     },
  "8":  { label: "LOWER",        bg: "bg-red-200     text-red-800"     },
  "9":  { label: "LOWEST",       bg: "bg-red-300     text-red-900"     },
  "A":  { label: "EXCELLENT",    bg: "bg-green-100   text-green-800"   },
  "B":  { label: "VERY GOOD",    bg: "bg-emerald-100 text-emerald-800" },
  "C":  { label: "GOOD",         bg: "bg-blue-100    text-blue-800"    },
  "D":  { label: "HIGH AVERAGE", bg: "bg-cyan-100    text-cyan-800"    },
  "E2": { label: "BELOW AVERAGE",bg: "bg-orange-100  text-orange-800"  },
  "E3": { label: "LOW",          bg: "bg-red-100     text-red-700"     },
  "E4": { label: "LOWER",        bg: "bg-red-200     text-red-800"     },
  "E5": { label: "LOWEST",       bg: "bg-red-300     text-red-900"     },
};

const GRADE_SCALE_B79 = [
  { range: "90–100", grade: "1", label: "HIGHEST"      },
  { range: "80–89",  grade: "2", label: "HIGHER"       },
  { range: "60–79",  grade: "3", label: "HIGH"         },
  { range: "55–59",  grade: "4", label: "HIGH AVERAGE" },
  { range: "50–54",  grade: "5", label: "AVERAGE"      },
  { range: "45–49",  grade: "6", label: "LOW AVERAGE"  },
  { range: "40–44",  grade: "7", label: "LOW"          },
  { range: "35–39",  grade: "8", label: "LOWER"        },
  { range: "0–34",   grade: "9", label: "LOWEST"       },
];

const GRADE_SCALE_B16 = [
  { range: "90–100", grade: "A",  label: "EXCELLENT"     },
  { range: "80–89",  grade: "B",  label: "VERY GOOD"     },
  { range: "60–79",  grade: "C",  label: "GOOD"          },
  { range: "55–59",  grade: "D",  label: "HIGH AVERAGE"  },
  { range: "45–49",  grade: "E2", label: "BELOW AVERAGE" },
  { range: "40–44",  grade: "E3", label: "LOW"           },
  { range: "35–39",  grade: "E4", label: "LOWER"         },
  { range: "0–34",   grade: "E5", label: "LOWEST"        },
];

const CONDUCT_OPTIONS = ["Excellent", "Very Good", "Good", "Fair", "Poor"];

const TABS = [
  { key: "Classes",    icon: "🏫" },
  { key: "Attendance", icon: "📋" },
  { key: "Results",    icon: "📊" },
  { key: "Reports",       icon: "📄" },
  { key: "Announcements", icon: "📢" },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * FIX: The original had a precedence bug:
 *   parseFloat(reopen) || 0 + parseFloat(ca) || 0 ...
 * The `+` binds tighter than `||`, so `0 + parseFloat(ca)` was evaluated
 * first, meaning `reopen` was always 0 unless truthy on its own.
 * Correct form wraps each operand before adding.
 */
const computeTotal = (reopen, ca, exams) =>
  Math.round(
    ((parseFloat(reopen) || 0) + (parseFloat(ca) || 0) + (parseFloat(exams) || 0)) * 10
  ) / 10;

const gradeFromTotal = (total) => {
  if (total >= 90) return "1";
  if (total >= 80) return "2";
  if (total >= 60) return "3";
  if (total >= 55) return "4";
  if (total >= 50) return "5";
  if (total >= 45) return "6";
  if (total >= 40) return "7";
  if (total >= 35) return "8";
  return "9";
};

const STATUS_CYCLE  = { present: "absent", absent: "late", late: "present" };
const STATUS_STYLES = {
  present: { dot: "bg-green-500",  pill: "bg-green-50  text-green-700  ring-green-200"  },
  absent:  { dot: "bg-red-500",    pill: "bg-red-50    text-red-700    ring-red-200"    },
  late:    { dot: "bg-yellow-400", pill: "bg-yellow-50 text-yellow-700 ring-yellow-200" },
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

const Badge = ({ grade }) => {
  const info = GRADE_REMARK[grade];
  if (!info) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${info.bg}`}>
      {grade}
    </span>
  );
};

const RemarkBadge = ({ grade }) => {
  const info = GRADE_REMARK[grade];
  if (!info) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${info.bg}`}>
      {info.label}
    </span>
  );
};

const StatCard = ({ label, value, color = "text-gray-800" }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
  </div>
);

const Toast = ({ message, type, onDismiss }) => {
  if (!message) return null;
  const styles = type === "error"
    ? "bg-red-50 border-red-200 text-red-700"
    : "bg-emerald-50 border-emerald-200 text-emerald-700";
  const icon = type === "error" ? "✕" : "✓";
  return (
    <div className={`mb-4 flex items-center justify-between px-4 py-3 rounded-lg border text-sm ${styles}`}>
      <span><b className="mr-2">{icon}</b>{message}</span>
      <button onClick={onDismiss} className="ml-4 opacity-50 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
};

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

const TeacherPortal = () => {
  const user = getUser();

  const [tab, setTab]             = useState("Classes");
  const [selectedTerm, setSelectedTerm] = useState("term1");

  // Classes
  const [classes, setClasses]                     = useState([]);
  const [selectedClass, setSelectedClass]         = useState(
    user.class_id ? String(user.class_id) : ""
  );
  const [selectedClassName, setSelectedClassName] = useState(user.class || "");

  // Students
  const [students, setStudents]               = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Attendance
  const [attendance, setAttendance] = useState({});
  const [attDate, setAttDate]       = useState(new Date().toISOString().split("T")[0]);
  const [savingAtt, setSavingAtt]   = useState(false);

  // Results
  const [subjects, setSubjects]           = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [scores, setScores]               = useState({});
  const [saving, setSaving]               = useState(false);

  // Reports
  const [selectedStudent, setSelectedStudent] = useState("");
  const [report, setReport]                   = useState(null);
  const [loadingReport, setLoadingReport]     = useState(false);
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [summary, setSummary]                 = useState([]);
  const [loadingSummary, setLoadingSummary]   = useState(false);

  // Report remarks
  const [remarks, setRemarks]             = useState({ conduct: "", interest: "", teacher_remark: "" });
  const [savingRemarks, setSavingRemarks] = useState(false);
  const [remarksSaved, setRemarksSaved]   = useState(false);
  const [downloading, setDownloading]     = useState(false);

  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  // ── Prevent stale effect calls when class / subject changes rapidly ──
  const latestStudentsRef = useRef([]);
  latestStudentsRef.current = students;

  // ─────────────────────────────────────
  // Data fetching  (useCallback for stable deps)
  // ─────────────────────────────────────

  const fetchClasses = useCallback(async () => {
    try {
      const res = await API.get("/classes/");
      setClasses(res.data.results ?? res.data);
    } catch {
      setError("Failed to load classes.");
    }
  }, []);

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await API.get("/subjects/");
      setSubjects(res.data.results ?? res.data);
    } catch {}
  }, []);

  const fetchStudents = useCallback(async (classId) => {
    if (!classId) return;
    setLoadingStudents(true);
    try {
      const res = await API.get(`/students/?school_class=${classId}`);
      setStudents(res.data.results ?? res.data);
    } catch {
      setError("Failed to load students.");
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const loadAttendance = useCallback(async (classId, date) => {
    if (!classId) return;
    try {
      const res = await API.get(`/attendance/?school_class=${classId}&date=${date}`);
      const records = res.data.results ?? res.data;
      const map = Object.fromEntries(records.map((r) => [r.student, r.status]));
      setAttendance(
        Object.fromEntries(
          latestStudentsRef.current.map((s) => [s.id, map[s.id] ?? "present"])
        )
      );
    } catch {}
  }, []);

  const loadExistingScores = useCallback(async (classId, term, subjectId) => {
    if (!classId || !term || !subjectId) return;
    try {
      const res = await API.get(
        `/results/?school_class=${classId}&term=${term}&subject=${subjectId}`
      );
      const records = res.data.results ?? res.data;
      const map = Object.fromEntries(
        records.map((r) => [r.student, { reopen: r.reopen, ca: r.ca, exams: r.exams }])
      );
      setScores(
        Object.fromEntries(
          latestStudentsRef.current.map((s) => [
            s.id,
            map[s.id] ?? { reopen: "", ca: "", exams: "" },
          ])
        )
      );
    } catch {}
  }, []);

  const fetchSummary = useCallback(async (classId, term) => {
    if (!classId || !term) return;
    setLoadingSummary(true);
    try {
      const res = await API.get(`/results/summary/?school_class=${classId}&term=${term}`);
      setSummary(res.data);
    } catch {
      setError("Failed to load summary.");
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchStudentReport = useCallback(async (studentId, term) => {
    setLoadingReport(true);
    setReport(null);
    setRemarksSaved(false);
    try {
      const res = await API.get(`/report/student/${studentId}/?term=${term}`);
      setReport(res.data);
      setRemarks({
        conduct:        res.data.conduct        ?? "",
        interest:       res.data.interest       ?? "",
        teacher_remark: res.data.teacher_remark ?? "",
      });
    } catch {
      setError("No report found for this student and term.");
    } finally {
      setLoadingReport(false);
    }
  }, []);

  // ─────────────────────────────────────
  // Effects
  // ─────────────────────────────────────

  useEffect(() => {
    fetchClasses();
    fetchSubjects();
  }, [fetchClasses, fetchSubjects]);

  // FIX: only fetch students when selectedClass actually changes;
  // user.class_id pre-select no longer triggers a double-fetch on mount.
  useEffect(() => {
    if (selectedClass) fetchStudents(selectedClass);
    else setStudents([]);
  }, [selectedClass, fetchStudents]);

  useEffect(() => {
    if (tab === "Attendance" && selectedClass && students.length > 0) {
      loadAttendance(selectedClass, attDate);
    }
  }, [tab, attDate, selectedClass, students, loadAttendance]);

  useEffect(() => {
    if (tab === "Results" && selectedClass && selectedSubject && selectedTerm && students.length > 0) {
      loadExistingScores(selectedClass, selectedTerm, selectedSubject);
    }
  }, [tab, selectedClass, selectedSubject, selectedTerm, students, loadExistingScores]);

  useEffect(() => {
    if (tab === "Reports" && selectedClass && selectedTerm) {
      fetchSummary(selectedClass, selectedTerm);
    }
  }, [tab, selectedClass, selectedTerm, fetchSummary]);

  useEffect(() => {
    setError("");
    setSuccess("");
  }, [tab]);

  // ─────────────────────────────────────
  // Attendance handlers
  // ─────────────────────────────────────

  const toggleStatus = useCallback((studentId) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: STATUS_CYCLE[prev[studentId]] ?? "present",
    }));
  }, []);

  const saveAttendance = async () => {
    setSavingAtt(true);
    setError("");
    setSuccess("");
    try {
      const records = students.map((s) => ({
        student:      s.id,
        school_class: selectedClass,
        term:         selectedTerm,
        date:         attDate,
        status:       attendance[s.id] ?? "present",
      }));
      await Promise.all(records.map((r) => API.post("/attendance/", r)));
      setSuccess("Attendance saved successfully.");
    } catch {
      setError("Failed to save attendance.");
    } finally {
      setSavingAtt(false);
    }
  };

  // ─────────────────────────────────────
  // Results handlers
  // ─────────────────────────────────────

  const handleScoreChange = useCallback((studentId, field, value) => {
    const max     = field === "reopen" ? 20 : 40;
    const numeric = value === "" ? "" : Math.min(max, Math.max(0, parseFloat(value) || 0));
    setScores((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: numeric },
    }));
  }, []);

  const submitResults = async () => {
    if (!selectedClass || !selectedTerm || !selectedSubject) {
      setError("Please select a class, term, and subject.");
      return;
    }
    const records = Object.entries(scores)
      .filter(([, v]) => v.reopen !== "" || v.ca !== "" || v.exams !== "")
      .map(([studentId, v]) => ({
        student:      studentId,
        subject:      selectedSubject,
        school_class: selectedClass,
        term:         selectedTerm,
        reopen:       parseFloat(v.reopen) || 0,
        ca:           parseFloat(v.ca)     || 0,
        exams:        parseFloat(v.exams)  || 0,
      }));
    if (!records.length) {
      setError("No scores entered.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await API.post("/results/bulk/", records);
      setSuccess(`Saved ${res.data.saved} result(s) successfully.`);
    } catch (err) {
      setError(err.response?.data?.detail || "Error saving results.");
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────
  // Report remarks + PDF handlers
  // ─────────────────────────────────────

  const saveRemarks = async () => {
    setSavingRemarks(true);
    setRemarksSaved(false);
    setError("");
    try {
      await API.patch(`/report/student/${selectedStudent}/`, {
        term:           selectedTerm,
        conduct:        remarks.conduct,
        interest:       remarks.interest,
        teacher_remark: remarks.teacher_remark,
      });
      setRemarksSaved(true);
      // Re-fetch to keep report in sync with saved remarks
      const res = await API.get(`/report/student/${selectedStudent}/?term=${selectedTerm}`);
      setReport(res.data);
    } catch {
      setError("Failed to save remarks.");
    } finally {
      setSavingRemarks(false);
    }
  };

  const downloadPDF = async () => {
    setDownloading(true);
    setError("");
    try {
      const res = await API.get(
        `/report/student/${selectedStudent}/pdf/?term=${selectedTerm}`,
        { responseType: "blob" }
      );
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute("download", `report_${selectedStudent}_${selectedTerm}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download PDF.");
    } finally {
      setDownloading(false);
    }
  };

  // ─────────────────────────────────────
  // Class selector helper
  // ─────────────────────────────────────

  const handleClassChange = (classId) => {
    setSelectedClass(classId);
    const found = classes.find((c) => String(c.id) === String(classId));
    setSelectedClassName(found?.name ?? "");
    setStudents([]);
    setScores({});
    setAttendance({});
    setSummary([]);
    setReport(null);
    setSelectedStudent("");
    setExpandedStudent(null);
    setRemarks({ conduct: "", interest: "", teacher_remark: "" });
    setRemarksSaved(false);
    setDownloading(false);
    setError("");
    setSuccess("");
  };

  // ─────────────────────────────────────
  // Derived values
  // ─────────────────────────────────────

  const filledCount = Object.values(scores).filter(
    (v) => v?.reopen !== "" || v?.ca !== "" || v?.exams !== ""
  ).length;

  const attStats = {
    present: Object.values(attendance).filter((v) => v === "present").length,
    absent:  Object.values(attendance).filter((v) => v === "absent").length,
    late:    Object.values(attendance).filter((v) => v === "late").length,
  };

  // ─────────────────────────────────────
  // Render
  // ─────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Header ── */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-800 text-white px-6 py-0 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
              {user.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">{user.username}</p>
              <p className="text-blue-200 text-xs">
                {user.teacher_id}{user.subject ? ` · ${user.subject}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs text-blue-200 hover:text-white border border-blue-500/50 hover:border-white/50 px-3 py-1.5 rounded-lg transition-all"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ── Global filters ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-5 flex gap-3 flex-wrap items-end">
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => handleClassChange(e.target.value)}
              className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm min-w-[150px] focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {TERMS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {tab === "Results" && (
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">Subject</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm min-w-[160px] focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Select Subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {tab === "Attendance" && (
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">Date</label>
              <input
                type="date"
                value={attDate}
                onChange={(e) => setAttDate(e.target.value)}
                className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-200 mb-5 gap-1">
          {TABS.map(({ key, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                tab === key
                  ? "border-blue-600 text-blue-600 bg-blue-50/60"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{icon}</span>{key}
            </button>
          ))}
        </div>

        {/* ── Toasts ── */}
        <Toast message={error}   type="error"   onDismiss={() => setError("")}   />
        <Toast message={success} type="success" onDismiss={() => setSuccess("")} />

        {!selectedClass && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🏫</p>
            <p className="text-sm">Select a class above to get started.</p>
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB 1: Classes
        ══════════════════════════════════════ */}
        {tab === "Classes" && selectedClass && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Students"       value={students.length}          color="text-blue-700" />
              <StatCard label="Class"          value={selectedClassName || "—"} color="text-gray-800" />
              <StatCard label="Term"           value={TERMS.find(t => t.value === selectedTerm)?.label} color="text-gray-800" />
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                <p className="font-semibold text-gray-700 text-sm">{selectedClassName} — Student List</p>
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium">
                  {students.length} enrolled
                </span>
              </div>
              {loadingStudents ? (
                <p className="p-8 text-center text-gray-400 text-sm">Loading students…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                        <th className="px-5 py-3 text-left font-medium">#</th>
                        <th className="px-5 py-3 text-left font-medium">Name</th>
                        <th className="px-5 py-3 text-left font-medium">Admission No.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {students.map((s, i) => (
                        <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-5 py-3 font-medium text-gray-800">{s.student_name}</td>
                          <td className="px-5 py-3 text-gray-500 font-mono text-xs">{s.admission_number}</td>
                        </tr>
                      ))}
                      {students.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-5 py-10 text-center text-gray-400">
                            No students found for this class.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB 2: Attendance
        ══════════════════════════════════════ */}
        {tab === "Attendance" && selectedClass && (
          <div className="space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Present" value={attStats.present} color="text-green-600" />
              <StatCard label="Absent"  value={attStats.absent}  color="text-red-600"   />
              <StatCard label="Late"    value={attStats.late}    color="text-yellow-600" />
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2">
                <p className="font-semibold text-gray-700 text-sm">
                  {selectedClassName} — {attDate}
                </p>
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                  Tap to cycle: Present → Absent → Late
                </span>
              </div>

              {loadingStudents ? (
                <p className="p-8 text-center text-gray-400 text-sm">Loading students…</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                          <th className="px-5 py-3 text-left font-medium">#</th>
                          <th className="px-5 py-3 text-left font-medium">Name</th>
                          <th className="px-5 py-3 text-center font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {students.map((s, i) => {
                          const status = attendance[s.id] ?? "present";
                          const st     = STATUS_STYLES[status];
                          return (
                            <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                              <td className="px-5 py-3 font-medium text-gray-800">{s.student_name}</td>
                              <td className="px-5 py-3 text-center">
                                <button
                                  onClick={() => toggleStatus(s.id)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold capitalize ring-1 transition-all active:scale-95 ${st.pill}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                  {status}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {students.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-5 py-10 text-center text-gray-400">No students found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={saveAttendance}
                      disabled={savingAtt || students.length === 0}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {savingAtt ? "Saving…" : "Save Attendance"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB 3: Results
        ══════════════════════════════════════ */}
        {tab === "Results" && selectedClass && (
          <>
            {!selectedSubject && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-sm">Select a subject above to enter scores.</p>
              </div>
            )}

            {selectedSubject && students.length > 0 && (
              <>
                <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold text-blue-600">{filledCount}</span> of{" "}
                    <span className="font-semibold">{students.length}</span> students filled
                  </p>
                  {filledCount > 0 && (
                    <button
                      onClick={submitResults}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {saving ? "Saving…" : `Save ${filledCount} Result${filledCount !== 1 ? "s" : ""}`}
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-4 py-3 text-left font-medium sticky left-0 bg-gray-50">#</th>
                          <th className="px-4 py-3 text-left font-medium sticky left-8 bg-gray-50">Student</th>
                          <th className="px-4 py-3 text-center font-medium text-blue-600">
                            Re-Open <span className="text-gray-400 normal-case font-normal">/20</span>
                          </th>
                          <th className="px-4 py-3 text-center font-medium text-blue-600">
                            CA/MGT <span className="text-gray-400 normal-case font-normal">/40</span>
                          </th>
                          <th className="px-4 py-3 text-center font-medium text-blue-600">
                            Exams <span className="text-gray-400 normal-case font-normal">/40</span>
                          </th>
                          <th className="px-4 py-3 text-center font-bold">Total</th>
                          <th className="px-4 py-3 text-center font-medium">Grade</th>
                          <th className="px-4 py-3 text-center font-medium">Remark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {students.map((student, i) => {
                          const s     = scores[student.id] ?? { reopen: "", ca: "", exams: "" };
                          const dirty = s.reopen !== "" || s.ca !== "" || s.exams !== "";
                          const total = dirty ? computeTotal(s.reopen, s.ca, s.exams) : null;
                          const grade = total !== null ? gradeFromTotal(total) : null;

                          return (
                            <tr key={student.id} className={`hover:bg-blue-50/20 transition-colors ${dirty ? "" : "opacity-75"}`}>
                              <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                              <td className="px-4 py-3 font-medium text-gray-800">{student.student_name}</td>
                              {["reopen", "ca", "exams"].map((field) => (
                                <td key={field} className="px-4 py-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max={field === "reopen" ? 20 : 40}
                                    step="0.5"
                                    value={s[field]}
                                    placeholder="—"
                                    onChange={(e) => handleScoreChange(student.id, field, e.target.value)}
                                    className="w-16 border border-gray-200 rounded-lg py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-gray-50 hover:bg-white transition-colors"
                                  />
                                </td>
                              ))}
                              <td className="px-4 py-3 text-center font-bold text-blue-700">
                                {total !== null ? total : <span className="text-gray-300 font-normal">—</span>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Badge grade={grade} />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <RemarkBadge grade={grade} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {filledCount === 0 && (
                  <p className="mt-3 text-xs text-gray-400 text-center">
                    Enter scores above, then click Save.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════
            TAB 4: Reports
        ══════════════════════════════════════ */}
        {tab === "Reports" && selectedClass && (
          <div className="space-y-6">

            {/* ── Student picker + Download ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-gray-400 block mb-1">
                  Student — Full Report
                </label>
                <select
                  value={selectedStudent}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedStudent(id);
                    setReport(null);
                    setRemarksSaved(false);
                    if (id) fetchStudentReport(id, selectedTerm);
                  }}
                  className="w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">— Select a student —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.student_name}</option>
                  ))}
                </select>
              </div>

              {report && (
                <button
                  onClick={downloadPDF}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
                >
                  {downloading ? "Generating…" : "⬇ Download PDF"}
                </button>
              )}
            </div>

            {/* ── Individual report ── */}
            {loadingReport && (
              <p className="text-center text-gray-400 text-sm py-6">Loading report…</p>
            )}

            {!loadingReport && selectedStudent && !report && !error && (
              <div className="text-center py-14 text-gray-400 bg-white rounded-xl border border-gray-100 shadow-sm">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-sm">No report found for this student and term.</p>
                <p className="text-xs mt-1 text-gray-300">Make sure results have been entered for this term.</p>
              </div>
            )}

            {report && !loadingReport && (() => {
              const level      = report.level || "basic_7_9";
              const gradeScale = level === "basic_7_9" ? GRADE_SCALE_B79 : GRADE_SCALE_B16;
              const subjectOptions = report.subjects?.map((s) => s.subject) ?? [];

              return (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

                  {/* Report header */}
                  <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white px-6 py-5 flex justify-between items-start gap-4">
                    <div className="space-y-0.5">
                      <p className="font-bold text-lg leading-tight">
                        {report.school_name || "LEADING STARS ACADEMY"}
                      </p>
                      <p className="text-blue-200 text-xs">
                        {level === "nursery_kg" ? "GLOBAL LEADERS" : "WHERE LEADERS ARE BORN"}
                      </p>
                      <p className="text-white font-semibold mt-2">{report.student}</p>
                      <p className="text-blue-200 text-xs">Admission No: {report.admission_number ?? "—"}</p>
                      <p className="text-blue-200 text-xs">Class: {report.class ?? "—"}</p>
                      <p className="text-blue-200 text-xs">
                        Term: {TERMS.find((t) => t.value === report.term)?.label ?? report.term}
                      </p>
                    </div>
                    {report.photo ? (
                      <img
                        src={report.photo}
                        alt="student"
                        className="w-20 h-20 rounded-xl border-2 border-white/50 object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl border-2 border-white/30 bg-white/10 flex items-center justify-center text-3xl font-bold flex-shrink-0">
                        {report.student?.[0] ?? "?"}
                      </div>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-gray-100">
                    {[
                      { label: "Total Marks",   value: report.total_score   ?? "—" },
                      { label: "Average Mark",  value: report.average_score ?? "—" },
                      {
                        label: "Position",
                        value: report.show_position
                          ? (report.position_formatted ? `${report.position_formatted} / ${report.out_of}` : "—")
                          : "N/A",
                      },
                      { label: "Overall Grade", value: report.overall_grade ?? "—" },
                    ].map((stat) => (
                      <div key={stat.label} className="p-4 text-center border-r border-gray-100 last:border-r-0">
                        <p className="text-2xl font-bold text-blue-700">{stat.value}</p>
                        <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Subject results table */}
                  <div className="p-5">
                    <h3 className="font-semibold text-gray-700 mb-3 text-sm">Subject Results</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-blue-50 text-xs text-blue-700 uppercase tracking-wide">
                            <th className="px-3 py-2.5 text-left font-medium">Subject</th>
                            <th className="px-3 py-2.5 text-center font-medium">
                              Re-Open<br /><span className="font-normal text-gray-400 normal-case">/20</span>
                            </th>
                            <th className="px-3 py-2.5 text-center font-medium">
                              CA/MGT<br /><span className="font-normal text-gray-400 normal-case">/40</span>
                            </th>
                            <th className="px-3 py-2.5 text-center font-medium">
                              Exams<br /><span className="font-normal text-gray-400 normal-case">/40</span>
                            </th>
                            <th className="px-3 py-2.5 text-center font-bold">
                              Total<br /><span className="font-normal text-gray-400 normal-case">/100</span>
                            </th>
                            {report.show_position && (
                              <th className="px-3 py-2.5 text-center font-medium">Pos.</th>
                            )}
                            <th className="px-3 py-2.5 text-center font-medium">Grade</th>
                            <th className="px-3 py-2.5 text-center font-medium">Remark</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {report.subjects?.map((sub, i) => (
                            <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                              <td className="px-3 py-2.5 font-medium text-gray-800">{sub.subject}</td>
                              <td className="px-3 py-2.5 text-center text-gray-600">{sub.reopen ?? "—"}</td>
                              <td className="px-3 py-2.5 text-center text-gray-600">{sub.ca     ?? "—"}</td>
                              <td className="px-3 py-2.5 text-center text-gray-600">{sub.exams  ?? "—"}</td>
                              <td className="px-3 py-2.5 text-center font-bold text-blue-700">{sub.score}</td>
                              {report.show_position && (
                                <td className="px-3 py-2.5 text-center text-gray-500 font-semibold">
                                  {sub.subject_position ?? "—"}
                                </td>
                              )}
                              <td className="px-3 py-2.5 text-center"><Badge grade={sub.grade} /></td>
                              <td className="px-3 py-2.5 text-center"><RemarkBadge grade={sub.grade} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Grade scale legend */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-600">
                      <p className="font-semibold text-gray-700 mb-2 uppercase tracking-wide text-xs">
                        Result Interpretation
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                        {gradeScale.map((g) => (
                          <span key={g.grade}>
                            {g.range}:{" "}
                            <b>{g.grade} – {g.label}</b>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Attendance + Teacher Remarks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 px-5 pb-5">

                    {/* Attendance */}
                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                      <h3 className="font-semibold text-gray-700 mb-3 text-sm">Attendance</h3>
                      {(report.attendance_total ?? 0) > 0 ? (
                        <>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-500">Days Present</span>
                            <span className="font-semibold text-gray-800">
                              {report.attendance} / {report.attendance_total}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                report.attendance_percent >= 80 ? "bg-green-500" :
                                report.attendance_percent >= 60 ? "bg-yellow-400" : "bg-red-500"
                              }`}
                              style={{ width: `${report.attendance_percent ?? 0}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1.5 text-right">
                            {report.attendance_percent}% attendance
                          </p>
                        </>
                      ) : (
                        <p className="text-gray-400 text-sm">No attendance data recorded.</p>
                      )}
                    </div>

                    {/* Teacher's Remarks */}
                    <div className="border border-gray-100 rounded-xl p-4">
                      <h3 className="font-semibold text-gray-700 mb-3 text-sm">Teacher's Remarks</h3>
                      <div className="space-y-3">

                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-1">Conduct</label>
                          <select
                            value={remarks.conduct}
                            onChange={(e) => { setRemarks((p) => ({ ...p, conduct: e.target.value })); setRemarksSaved(false); }}
                            className="w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            <option value="">— Select —</option>
                            {CONDUCT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-1">
                            Interest{" "}
                            <span className="font-normal text-gray-300">(subject of most interest)</span>
                          </label>
                          <select
                            value={remarks.interest}
                            onChange={(e) => { setRemarks((p) => ({ ...p, interest: e.target.value })); setRemarksSaved(false); }}
                            className="w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            <option value="">— Select Subject —</option>
                            {subjectOptions.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-1">
                            Teacher's Remark
                          </label>
                          <textarea
                            value={remarks.teacher_remark}
                            onChange={(e) => { setRemarks((p) => ({ ...p, teacher_remark: e.target.value })); setRemarksSaved(false); }}
                            rows={3}
                            placeholder="Write a remark for this student…"
                            className="w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={saveRemarks}
                            disabled={savingRemarks}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
                          >
                            {savingRemarks ? "Saving…" : "Save Remarks"}
                          </button>
                          {remarksSaved && (
                            <span className="text-green-600 text-xs font-medium">✓ Saved</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* ── Class summary ── */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-700">Class Summary — {selectedClassName}</h3>
                {summary.length > 0 && (
                  <span className="text-xs text-gray-400 bg-white border border-gray-100 px-2 py-1 rounded-lg shadow-sm">
                    {summary.length} students ranked
                  </span>
                )}
              </div>

              {loadingSummary && (
                <p className="text-center text-gray-400 text-sm py-6">Loading summary…</p>
              )}

              {!loadingSummary && summary.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-4 py-3 text-center font-medium">Rank</th>
                          <th className="px-4 py-3 text-left font-medium">Student</th>
                          <th className="px-4 py-3 text-center font-medium">Total</th>
                          <th className="px-4 py-3 text-center font-medium">Average</th>
                          <th className="px-4 py-3 text-center font-medium">Grade</th>
                          <th className="px-4 py-3 text-center font-medium">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {summary.map((row) => {
                          const rankColor =
                            row.rank === 1 ? "text-yellow-500" :
                            row.rank === 2 ? "text-slate-400"  :
                            row.rank === 3 ? "text-orange-400" : "text-gray-400";
                          const isExpanded = expandedStudent === row.student_id;

                          return (
                            <React.Fragment key={row.student_id}>
                              <tr
                                className="hover:bg-blue-50/20 cursor-pointer transition-colors"
                                onClick={() => setExpandedStudent(isExpanded ? null : row.student_id)}
                              >
                                <td className="px-4 py-3 text-center">
                                  <span className={`font-bold text-sm ${rankColor}`}>#{row.rank}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-gray-800">{row.student_name}</p>
                                  <p className="text-xs text-gray-400 font-mono">{row.admission_number}</p>
                                </td>
                                <td className="px-4 py-3 text-center font-semibold text-gray-700">
                                  {row.total_score}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600">{row.average_score}</td>
                                <td className="px-4 py-3 text-center">
                                  <Badge grade={row.overall_grade} />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-blue-500 text-xs font-medium">
                                    {isExpanded ? "▲ Hide" : "▼ Show"}
                                  </span>
                                </td>
                              </tr>

                              {isExpanded && (
                                <tr className="bg-slate-50/80">
                                  <td colSpan={6} className="px-6 py-4">
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs rounded-lg overflow-hidden border border-gray-100">
                                        <thead>
                                          <tr className="bg-blue-50 text-blue-700 uppercase tracking-wide">
                                            <th className="px-3 py-2 text-left font-medium">Subject</th>
                                            <th className="px-3 py-2 text-center font-medium">Re-Open</th>
                                            <th className="px-3 py-2 text-center font-medium">CA/MGT</th>
                                            <th className="px-3 py-2 text-center font-medium">Exams</th>
                                            <th className="px-3 py-2 text-center font-medium">Total</th>
                                            <th className="px-3 py-2 text-center font-medium">Grade</th>
                                            <th className="px-3 py-2 text-center font-medium">Remark</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                          {row.subjects.map((sub) => (
                                            <tr key={sub.subject_id} className="hover:bg-blue-50/20">
                                              <td className="px-3 py-2 font-medium text-gray-800">{sub.subject_name}</td>
                                              <td className="px-3 py-2 text-center text-gray-500">{sub.reopen ?? "—"}</td>
                                              <td className="px-3 py-2 text-center text-gray-500">{sub.ca ?? "—"}</td>
                                              <td className="px-3 py-2 text-center text-gray-500">{sub.exams ?? "—"}</td>
                                              <td className="px-3 py-2 text-center font-bold text-blue-700">{sub.score ?? "—"}</td>
                                              <td className="px-3 py-2 text-center"><Badge grade={sub.grade} /></td>
                                              <td className="px-3 py-2 text-center"><RemarkBadge grade={sub.grade} /></td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!loadingSummary && summary.length === 0 && (
                <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-2xl mb-2">📭</p>
                  <p className="text-sm">No results found for this class and term.</p>
                </div>
              )}
            </div>
          </div>
        )}


        {/* ══════════════════════════════════════
            TAB 5: Announcements
        ══════════════════════════════════════ */}
        {tab === "Announcements" && (
          <AnnouncementsFeed audience="teachers" />
        )}

      </div>
    </div>
  );
};

export default TeacherPortal;