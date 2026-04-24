// apps/teacher/components/TeacherPortal.jsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
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

const YEARS = [2026, 2025, 2024, 2023, 2022];

const GRADE_REMARK = {
  "1":  { label: "HIGHEST",       bg: "bg-emerald-100 text-emerald-800" },
  "2":  { label: "HIGHER",        bg: "bg-emerald-50  text-emerald-700" },
  "3":  { label: "HIGH",          bg: "bg-blue-100    text-blue-800"    },
  "4":  { label: "HIGH AVERAGE",  bg: "bg-cyan-100    text-cyan-800"    },
  "5":  { label: "AVERAGE",       bg: "bg-yellow-100  text-yellow-800"  },
  "6":  { label: "LOW AVERAGE",   bg: "bg-orange-100  text-orange-800"  },
  "7":  { label: "LOW",           bg: "bg-red-100     text-red-700"     },
  "8":  { label: "LOWER",         bg: "bg-red-200     text-red-800"     },
  "9":  { label: "LOWEST",        bg: "bg-red-300     text-red-900"     },
  "A":  { label: "EXCELLENT",     bg: "bg-emerald-100 text-emerald-800" },
  "B":  { label: "VERY GOOD",     bg: "bg-emerald-50  text-emerald-700" },
  "C":  { label: "GOOD",          bg: "bg-blue-100    text-blue-800"    },
  "D":  { label: "HIGH AVERAGE",  bg: "bg-cyan-100    text-cyan-800"    },
  "E2": { label: "BELOW AVERAGE", bg: "bg-orange-100  text-orange-800"  },
  "E3": { label: "LOW",           bg: "bg-red-100     text-red-700"     },
  "E4": { label: "LOWER",         bg: "bg-red-200     text-red-800"     },
  "E5": { label: "LOWEST",        bg: "bg-red-300     text-red-900"     },
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
  { key: "Classes",       icon: "🏫", label: "Classes"       },
  { key: "Attendance",    icon: "📋", label: "Attendance"    },
  { key: "Results",       icon: "📊", label: "Results"       },
  { key: "Reports",       icon: "📄", label: "Reports"       },
  { key: "Announcements", icon: "📢", label: "Announcements" },
];

const STATUS_CYCLE  = { present: "absent", absent: "late", late: "present" };
const STATUS_CONFIG = {
  present: { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", label: "Present" },
  absent:  { dot: "bg-red-500",     pill: "bg-red-50    text-red-700    ring-1 ring-red-200",        label: "Absent"  },
  late:    { dot: "bg-amber-400",   pill: "bg-amber-50  text-amber-700  ring-1 ring-amber-200",      label: "Late"    },
};

// todayStr is defined once at module level so both the date input's max
// attribute and the saveAttendance future-date guard share the same value.
const todayStr = new Date().toISOString().split("T")[0];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const computeTotal = (reopen, ca, exams) =>
  Math.round(((parseFloat(reopen) || 0) + (parseFloat(ca) || 0) + (parseFloat(exams) || 0)) * 10) / 10;

// Mirrors the server-side grading logic in result_view.py exactly.
// Basic 7–9 uses numeric grades 1–9; Basic 1–6 and Nursery/KG use A–E5.
const THRESHOLDS_B79 = [
  [90, "1"], [80, "2"], [60, "3"], [55, "4"], [50, "5"],
  [45, "6"], [40, "7"], [35, "8"], [0, "9"],
];
const THRESHOLDS_B16 = [
  [90, "A"], [80, "B"], [60, "C"], [55, "D"],
  [45, "E2"], [40, "E3"], [35, "E4"], [0, "E5"],
];

const gradeFromTotal = (total, level = "basic_7_9") => {
  const thresholds = (level === "basic_1_6" || level === "nursery_kg")
    ? THRESHOLDS_B16
    : THRESHOLDS_B79;
  for (const [min, grade] of thresholds) {
    if (total >= min) return grade;
  }
  return thresholds[thresholds.length - 1][1];
};

// Clamp a score value to its field's allowed range and return it.
// Returns the empty string unchanged so blank cells stay blank.
const clampScore = (value, field) => {
  if (value === "") return "";
  const max = field === "reopen" ? 20 : 40;
  return Math.min(max, Math.max(0, parseFloat(value) || 0));
};

// ─────────────────────────────────────────────
// Password strength helper
// ─────────────────────────────────────────────

function pwStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "transparent", w: "0%" };
  let s = 0;
  if (pw.length >= 8)           s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const map = [
    { label: "Too short", color: "#f87171", w: "25%"  },
    { label: "Weak",      color: "#fb923c", w: "40%"  },
    { label: "Fair",      color: "#fbbf24", w: "60%"  },
    { label: "Good",      color: "#34d399", w: "80%"  },
    { label: "Strong",    color: "#16a34a", w: "100%" },
  ];
  return { score: s, ...map[Math.min(s, map.length - 1)] };
}

// ─────────────────────────────────────────────
// Eye icon
// ─────────────────────────────────────────────

const EyeIcon = ({ open }) =>
  open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

// ─────────────────────────────────────────────
// Change Password Modal
// ─────────────────────────────────────────────

const ChangePasswordModal = ({ onClose }) => {
  const [current, setCurrent] = useState("");
  const [next,    setNext]    = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCon, setShowCon] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const strength = pwStrength(next);
  const mismatch = confirm && next !== confirm;

  const handleSubmit = async () => {
    setError("");
    if (!current)         return setError("Enter your current password.");
    if (next.length < 8)  return setError("New password must be at least 8 characters.");
    if (next !== confirm)  return setError("New passwords do not match.");
    setSaving(true);
    try {
      await API.post("/auth/change-password/", {
        old_password: current,
        new_password: next,
      });
      setSuccess(true);
      setTimeout(onClose, 2200);
    } catch (e) {
      const d = e.response?.data;
      setError(
        d?.old_password?.[0] ||
        d?.new_password?.[0] ||
        d?.detail ||
        "Failed to change password. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // Close on backdrop click.
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape key.
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7"
        style={{ animation: "tp-slide-up .2s ease" }}
      >
        <style>{`
          @keyframes tp-slide-up {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0);    }
          }
          @keyframes tp-spin { to { transform: rotate(360deg); } }
        `}</style>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-lg font-black text-slate-800">Change Password</h2>
            <p className="text-sm text-slate-400 mt-0.5">Keep your account secure with a strong password.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-300 hover:text-slate-500 transition-colors text-2xl leading-none mt-0.5"
          >
            ×
          </button>
        </div>

        {success ? (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-4 text-sm font-medium">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Password changed successfully!
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCur ? "text" : "password"}
                  value={current}
                  onChange={(e) => { setCurrent(e.target.value); setError(""); }}
                  placeholder="Enter current password"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() => setShowCur((v) => !v)}
                  aria-label={showCur ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <EyeIcon open={showCur} />
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={next}
                  onChange={(e) => { setNext(e.target.value); setError(""); }}
                  placeholder="Min. 8 characters"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <EyeIcon open={showNew} />
                </button>
              </div>
              {next && (
                <>
                  <div
                    className="h-1 rounded-full mt-2 transition-all duration-300"
                    style={{ background: strength.color, width: strength.w, maxWidth: "100%" }}
                  />
                  <p className="text-xs mt-1" style={{ color: strength.color }}>{strength.label}</p>
                </>
              )}
            </div>

            <div className="mb-4">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showCon ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  placeholder="Repeat new password"
                  className="w-full border rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                  style={{
                    borderColor: mismatch
                      ? "#f87171"
                      : confirm && !mismatch
                      ? "#34d399"
                      : "#e2e8f0",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowCon((v) => !v)}
                  aria-label={showCon ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <EyeIcon open={showCon} />
                </button>
              </div>
              {mismatch && <p className="text-xs mt-1 text-red-400">Passwords don't match</p>}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !!mismatch}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div
                      style={{
                        width: "14px", height: "14px",
                        border: "2px solid rgba(255,255,255,.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "tp-spin .6s linear infinite",
                      }}
                    />
                    Saving…
                  </>
                ) : (
                  "Update Password"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Submit confirmation modal
// ─────────────────────────────────────────────

const ConfirmModal = ({ title, body, confirmLabel, onConfirm, onCancel }) => {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        style={{ animation: "tp-slide-up .2s ease" }}
      >
        <h2 className="text-base font-black text-slate-800 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 mb-6">{body}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────

const Badge = ({ grade }) => {
  const info = GRADE_REMARK[grade];
  if (!info) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${info.bg}`}>
      {grade}
    </span>
  );
};

const RemarkBadge = ({ grade }) => {
  const info = GRADE_REMARK[grade];
  if (!info) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${info.bg}`}>
      {info.label}
    </span>
  );
};

const KpiCard = ({ label, value, color = "text-slate-800", sub }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-2xl font-black ${color}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
);

const Alert = ({ message, type, onDismiss }) => {
  if (!message) return null;
  const s = type === "error"
    ? "bg-red-50 border-red-200 text-red-700"
    : "bg-emerald-50 border-emerald-200 text-emerald-700";
  return (
    <div role="alert" className={`mb-5 flex items-center justify-between px-4 py-3 rounded-xl border text-sm ${s}`}>
      <span>{type === "error" ? "⚠ " : "✓ "}{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss" className="ml-4 text-lg leading-none opacity-50 hover:opacity-100">×</button>
    </div>
  );
};

const EmptyState = ({ icon, title, sub }) => (
  <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">
    <div className="text-5xl mb-3">{icon}</div>
    <p className="font-medium text-slate-500">{title}</p>
    {sub && <p className="text-xs mt-1">{sub}</p>}
  </div>
);

const SectionHeader = ({ title, badge }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-bold text-slate-700">{title}</h3>
    {badge && (
      <span className="text-xs text-slate-500 bg-white border border-slate-100 px-2.5 py-1 rounded-full shadow-sm">
        {badge}
      </span>
    )}
  </div>
);

const Th = ({ children, center }) => (
  <th
    className={`px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide ${
      center ? "text-center" : "text-left"
    }`}
  >
    {children}
  </th>
);

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

const TeacherPortal = () => {
  const user = getUser();

  const [tab, setTab]                         = useState("Classes");
  const [selectedTerm, setSelectedTerm]       = useState("term1");
  // Keep selectedYear as a number throughout to avoid parseInt scattered
  // across the component. URLs stringify it automatically.
  const [selectedYear, setSelectedYear]       = useState(YEARS[0]);
  const [showPwModal, setShowPwModal]         = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const [classes, setClasses]                         = useState([]);
  const [selectedClass, setSelectedClass]             = useState(user.class_id ? String(user.class_id) : "");
  const [selectedClassName, setSelectedClassName]     = useState(user.class || "");
  // Level drives which grading scale is used (mirrors result_view.py get_thresholds).
  const [selectedClassLevel, setSelectedClassLevel]   = useState("basic_7_9");
  const [students, setStudents]                       = useState([]);
  const [loadingStudents, setLoadingStudents]         = useState(false);

  const [attendance, setAttendance] = useState({});
  const [attDate, setAttDate]       = useState(todayStr);
  const [savingAtt, setSavingAtt]   = useState(false);

  const [subjects, setSubjects]               = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [scores, setScores]                   = useState({});
  const [saving, setSaving]                   = useState(false);

  const [selectedStudent, setSelectedStudent]   = useState("");
  const [report, setReport]                     = useState(null);
  const [loadingReport, setLoadingReport]       = useState(false);
  const [expandedStudent, setExpandedStudent]   = useState(null);
  const [summary, setSummary]                   = useState([]);
  const [loadingSummary, setLoadingSummary]     = useState(false);

  const [remarks, setRemarks]             = useState({ conduct: "", interest: "", teacher_remark: "" });
  const [savingRemarks, setSavingRemarks] = useState(false);
  const [remarksSaved, setRemarksSaved]   = useState(false);
  const [downloading, setDownloading]     = useState(false);

  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  // Ref used only by loadExistingScores to avoid a stale closure without
  // needing students as a dependency (which would cause unnecessary refetches).
  const latestStudentsRef = useRef([]);
  latestStudentsRef.current = students;

  // ── Derived / memoised ──────────────────────────────────────────────────

  const filledCount = useMemo(
    () =>
      Object.values(scores).filter(
        (v) => v?.reopen !== "" || v?.ca !== "" || v?.exams !== ""
      ).length,
    [scores]
  );

  // Class average over filled students — memoised to avoid recomputing on
  // every render that doesn't touch scores.
  const classAvg = useMemo(() => {
    const filled = Object.values(scores).filter(
      (v) => v?.reopen !== "" || v?.ca !== "" || v?.exams !== ""
    );
    if (!filled.length) return null;
    const sum = filled.reduce((acc, v) => acc + computeTotal(v.reopen, v.ca, v.exams), 0);
    return (sum / filled.length).toFixed(1);
  }, [scores]);

  const below50Count = useMemo(
    () =>
      Object.values(scores).filter((v) => {
        if (!v || (v.reopen === "" && v.ca === "" && v.exams === "")) return false;
        return computeTotal(v.reopen, v.ca, v.exams) < 50;
      }).length,
    [scores]
  );

  const attStats = useMemo(
    () => ({
      present: Object.values(attendance).filter((v) => v === "present").length,
      absent:  Object.values(attendance).filter((v) => v === "absent").length,
      late:    Object.values(attendance).filter((v) => v === "late").length,
    }),
    [attendance]
  );

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchClasses  = useCallback(async () => {
    try { const r = await API.get("/classes/");  setClasses(r.data.results ?? r.data); }
    catch { setError("Failed to load classes."); }
  }, []);

  const fetchSubjects = useCallback(async () => {
    try { const r = await API.get("/subjects/"); setSubjects(r.data.results ?? r.data); }
    catch {}
  }, []);

  const fetchStudents = useCallback(async (classId) => {
    if (!classId) return;
    setLoadingStudents(true);
    try {
      const r = await API.get(`/students/?school_class=${classId}`);
      setStudents(r.data.results ?? r.data);
    }
    catch { setError("Failed to load students."); }
    finally { setLoadingStudents(false); }
  }, []);

  // loadAttendance receives currentStudents as a parameter so the closure
  // always uses the correct list, avoiding stale-ref race conditions when
  // the teacher switches class mid-fetch.
  const loadAttendance = useCallback(async (classId, date, currentStudents) => {
    if (!classId || !currentStudents.length) return;
    try {
      const r       = await API.get(`/attendance/?school_class=${classId}&date=${date}`);
      const records = r.data.results ?? r.data;
      const map     = Object.fromEntries(records.map((rec) => [String(rec.student), rec.status]));
      setAttendance(
        Object.fromEntries(currentStudents.map((s) => [s.id, map[String(s.id)] ?? "present"]))
      );
    } catch {}
  }, []);

  const loadExistingScores = useCallback(async (classId, term, subjectId, year) => {
    if (!classId || !term || !subjectId) return;
    try {
      const r       = await API.get(
        `/results/?school_class=${classId}&term=${term}&subject=${subjectId}&year=${year}`
      );
      const records = r.data.results ?? r.data;
      const serverMap = Object.fromEntries(
        records.map((rec) => [String(rec.student), { reopen: rec.reopen, ca: rec.ca, exams: rec.exams }])
      );
      setScores(
        Object.fromEntries(
          latestStudentsRef.current.map((s) => [
            s.id,
            serverMap[String(s.id)] ?? { reopen: "", ca: "", exams: "" },
          ])
        )
      );
    } catch {}
  }, []);

  const fetchSummary = useCallback(async (classId, term, year) => {
    if (!classId || !term) return;
    setLoadingSummary(true);
    try {
      const r = await API.get(`/results/summary/?school_class=${classId}&term=${term}&year=${year}`);
      setSummary(r.data);
    }
    catch { setError("Failed to load summary."); }
    finally { setLoadingSummary(false); }
  }, []);

  const fetchStudentReport = useCallback(async (studentId, term) => {
    setLoadingReport(true); setReport(null); setRemarksSaved(false);
    try {
      const r = await API.get(`/report/student/${studentId}/?term=${term}`);
      setReport(r.data);
      setRemarks({
        conduct:        r.data.conduct        ?? "",
        interest:       r.data.interest       ?? "",
        teacher_remark: r.data.teacher_remark ?? "",
      });
    } catch { setError("No report found for this student and term."); }
    finally { setLoadingReport(false); }
  }, []);

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => { fetchClasses(); fetchSubjects(); }, [fetchClasses, fetchSubjects]);

  useEffect(() => {
    if (selectedClass) fetchStudents(selectedClass);
    else setStudents([]);
  }, [selectedClass, fetchStudents]);

  useEffect(() => {
    if (tab === "Attendance" && selectedClass && students.length > 0)
      loadAttendance(selectedClass, attDate, students);
  }, [tab, attDate, selectedClass, students, loadAttendance]);

  useEffect(() => {
    if (tab === "Results" && selectedClass && selectedSubject && selectedTerm && students.length > 0)
      loadExistingScores(selectedClass, selectedTerm, selectedSubject, selectedYear);
  }, [tab, selectedClass, selectedSubject, selectedTerm, selectedYear, students, loadExistingScores]);

  useEffect(() => {
    if (tab === "Reports" && selectedClass && selectedTerm)
      fetchSummary(selectedClass, selectedTerm, selectedYear);
  }, [tab, selectedClass, selectedTerm, selectedYear, fetchSummary]);

  useEffect(() => { setError(""); setSuccess(""); }, [tab]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleStatus = useCallback((id) => {
    setAttendance((p) => ({ ...p, [id]: STATUS_CYCLE[p[id]] ?? "present" }));
  }, []);

  const saveAttendance = async () => {
    // Guard: reject future dates client-side so the teacher gets immediate
    // feedback rather than a cryptic 400 from the server.
    if (attDate > todayStr) {
      setError("Cannot record attendance for a future date.");
      return;
    }

    // Upsert pattern: PATCH existing records, POST only new ones.
    // Promise.allSettled ensures one student's failure doesn't abort the rest.
    setSavingAtt(true); setError(""); setSuccess("");
    try {
      const existingRes = await API.get(
        `/attendance/?school_class=${selectedClass}&date=${attDate}`
      );
      const existing    = existingRes.data.results ?? existingRes.data;
      const existingMap = Object.fromEntries(
        existing.map((rec) => [String(rec.student), rec.id])
      );

      const results = await Promise.allSettled(
        students.map((s) => {
          const existingId = existingMap[String(s.id)];
          const status     = attendance[s.id] ?? "present";
          return existingId
            ? API.patch(`/attendance/${existingId}/`, { status })
            : API.post("/attendance/", {
                student: s.id,
                school_class: selectedClass,
                date: attDate,
                status,
              });
        })
      );

      const failedCount = results.filter((r) => r.status === "rejected").length;
      if (failedCount > 0) {
        setError(`${failedCount} record(s) could not be saved. Please try again.`);
      } else {
        setSuccess("Attendance saved successfully.");
      }
    } catch {
      setError("Failed to save attendance.");
    } finally {
      setSavingAtt(false);
    }
  };

  const handleScoreChange = useCallback((studentId, field, value) => {
    setScores((p) => ({
      ...p,
      [studentId]: { ...p[studentId], [field]: clampScore(value, field) },
    }));
  }, []);

  // FIX: strip non-numeric characters on paste so pasting "40.5abc" doesn't
  // produce NaN in the score map.
  const handleScorePaste = useCallback((studentId, field, e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9.]/g, "");
    setScores((p) => ({
      ...p,
      [studentId]: { ...p[studentId], [field]: clampScore(pasted, field) },
    }));
  }, []);

  const submitResults = async () => {
    if (!selectedClass || !selectedTerm || !selectedSubject) {
      setError("Please select a class, term, and subject."); return;
    }
    const records = Object.entries(scores)
      .filter(([, v]) => v.reopen !== "" || v.ca !== "" || v.exams !== "")
      .map(([sid, v]) => ({
        student:      sid,
        subject:      selectedSubject,
        school_class: selectedClass,
        term:         selectedTerm,
        year:         selectedYear,
        reopen:       parseFloat(v.reopen) || 0,
        ca:           parseFloat(v.ca)     || 0,
        exams:        parseFloat(v.exams)  || 0,
      }));
    if (!records.length) { setError("No scores entered."); return; }
    setSaving(true); setError("");
    try {
      const r = await API.post("/results/bulk/", records);
      if (r.data.errors?.length > 0) {
        setError(
          `${r.data.saved} saved, ${r.data.errors.length} failed. Check scores and try again.`
        );
      } else {
        setSuccess(`Saved ${r.data.saved} result(s) successfully.`);
        loadExistingScores(selectedClass, selectedTerm, selectedSubject, selectedYear);
      }
    }
    catch (err) {
      const detail = err.response?.data?.detail || err.response?.data?.error;
      setError(detail || "Error saving results. Please try again.");
    }
    finally { setSaving(false); }
  };

  const saveRemarks = async () => {
    setSavingRemarks(true); setRemarksSaved(false); setError("");
    try {
      await API.patch(`/report/student/${selectedStudent}/`, { term: selectedTerm, ...remarks });
      setRemarksSaved(true);
      const r = await API.get(`/report/student/${selectedStudent}/?term=${selectedTerm}`);
      setReport(r.data);
    } catch { setError("Failed to save remarks."); }
    finally { setSavingRemarks(false); }
  };

  const downloadPDF = async () => {
    setDownloading(true); setError("");
    // revokeObjectURL is in a finally block to guarantee cleanup even if
    // link.click() throws.
    let url;
    try {
      const r = await API.get(
        `/report/student/${selectedStudent}/pdf/?term=${selectedTerm}`,
        { responseType: "blob" }
      );
      url = window.URL.createObjectURL(new Blob([r.data]));
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute("download", `report_${selectedStudent}_${selectedTerm}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("Failed to download PDF.");
    } finally {
      if (url) window.URL.revokeObjectURL(url);
      setDownloading(false);
    }
  };

  const handleClassChange = (classId) => {
    setSelectedClass(classId);
    const found = classes.find((c) => String(c.id) === String(classId));
    setSelectedClassName(found?.name ?? "");
    setSelectedClassLevel(found?.level ?? "basic_7_9");
    // FIX: also reset selectedSubject so a stale subject from the previous
    // class doesn't silently pre-populate the Results filter on the new class.
    setSelectedSubject("");
    setStudents([]); setScores({}); setAttendance({}); setSummary([]);
    setReport(null); setSelectedStudent(""); setExpandedStudent(null);
    setRemarks({ conduct: "", interest: "", teacher_remark: "" });
    setRemarksSaved(false); setError(""); setSuccess("");
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  const isB16 = selectedClassLevel === "basic_1_6" || selectedClassLevel === "nursery_kg";

  return (
    <div className="min-h-screen bg-slate-50">

      {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}

      {showSubmitConfirm && (
        <ConfirmModal
          title="Save Results?"
          body={`You are about to save ${filledCount} result${filledCount !== 1 ? "s" : ""} for ${selectedClassName}. This will overwrite any existing scores for the selected subject and term.`}
          confirmLabel={`Save ${filledCount} Result${filledCount !== 1 ? "s" : ""}`}
          onConfirm={() => { setShowSubmitConfirm(false); submitResults(); }}
          onCancel={() => setShowSubmitConfirm(false)}
        />
      )}

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-tight">{user.username}</p>
              <p className="text-slate-400 text-xs">
                {user.teacher_id}{user.subject ? ` · ${user.subject}` : ""}
              </p>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-1" aria-label="Main navigation">
            {TABS.map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-current={tab === key ? "page" : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === key
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="text-base" aria-hidden="true">{icon}</span>
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPwModal(true)}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors border border-slate-200 hover:border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg"
            >
              🔑 <span className="hidden md:inline">Password</span>
            </button>
            <button
              onClick={logout}
              className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile tab bar */}
        <nav className="sm:hidden flex border-t border-slate-100 overflow-x-auto" aria-label="Main navigation">
          {TABS.map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={tab === key ? "page" : undefined}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium border-b-2 transition-all min-w-[60px] ${
                tab === key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"
              }`}
            >
              <span className="text-lg" aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ── Global filters ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 mb-6">
          <div className="flex gap-3 flex-wrap items-end">

            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Term</label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => handleClassChange(e.target.value)}
                className="border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm min-w-[150px] focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Select Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {tab === "Results" && (
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm min-w-[160px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {tab === "Attendance" && (
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Date</label>
                {/* max={todayStr} prevents selecting a future date in the picker.
                    A client-side guard in saveAttendance catches any bypass. */}
                <input
                  type="date"
                  value={attDate}
                  max={todayStr}
                  onChange={(e) => setAttDate(e.target.value)}
                  className="border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}

            {/* Password button shown inline on mobile since the header hides it */}
            <div className="sm:hidden ml-auto">
              <button
                onClick={() => setShowPwModal(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-200 px-3 py-2 rounded-xl transition-colors"
              >
                🔑 Password
              </button>
            </div>

          </div>
        </div>

        {/* ── Alerts ── */}
        <Alert message={error}   type="error"   onDismiss={() => setError("")}   />
        <Alert message={success} type="success" onDismiss={() => setSuccess("")} />

        {!selectedClass && (
          <EmptyState icon="🏫" title="Select a class to get started" sub="Use the dropdown above to choose your class" />
        )}

        {/* ══════════════════════════════════════
            TAB: Classes
        ══════════════════════════════════════ */}
        {tab === "Classes" && selectedClass && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <KpiCard label="Students" value={students.length}          color="text-blue-600" />
              <KpiCard label="Class"    value={selectedClassName || "—"} color="text-slate-800" />
              <KpiCard label="Term"     value={TERMS.find((t) => t.value === selectedTerm)?.label} color="text-slate-800" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center">
                <p className="font-bold text-slate-700 text-sm">{selectedClassName} — Student List</p>
                <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-semibold">
                  {students.length} enrolled
                </span>
              </div>
              {loadingStudents ? (
                <div className="p-10 text-center text-slate-400 text-sm">Loading students…</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <Th>#</Th><Th>Name</Th><Th>Admission No.</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {students.map((s, i) => (
                      <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{s.student_name}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{s.admission_number}</td>
                      </tr>
                    ))}
                    {!students.length && (
                      <tr>
                        <td colSpan={3} className="px-5 py-12 text-center text-slate-400">
                          No students found for this class.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB: Attendance
        ══════════════════════════════════════ */}
        {tab === "Attendance" && selectedClass && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <KpiCard label="Present" value={attStats.present} color="text-emerald-600" sub={`of ${students.length}`} />
              <KpiCard label="Absent"  value={attStats.absent}  color="text-red-600"     sub={`of ${students.length}`} />
              <KpiCard label="Late"    value={attStats.late}    color="text-amber-600"   sub={`of ${students.length}`} />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center flex-wrap gap-2">
                <p className="font-bold text-slate-700 text-sm">{selectedClassName} — {attDate}</p>
                <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">
                  Tap to cycle: Present → Absent → Late
                </span>
              </div>
              {loadingStudents ? (
                <div className="p-10 text-center text-slate-400 text-sm">Loading students…</div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <Th>#</Th><Th>Name</Th><Th center>Status</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {students.map((s, i) => {
                        const status = attendance[s.id] ?? "present";
                        const cfg    = STATUS_CONFIG[status];
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{s.student_name}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => toggleStatus(s.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    toggleStatus(s.id);
                                  }
                                }}
                                aria-label={`${s.student_name}: ${cfg.label}. Press to change.`}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all active:scale-95 ${cfg.pill}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
                                {cfg.label}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!students.length && (
                        <tr>
                          <td colSpan={3} className="px-5 py-12 text-center text-slate-400">
                            No students found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={saveAttendance}
                      disabled={savingAtt || !students.length}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
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
            TAB: Results
        ══════════════════════════════════════ */}
        {tab === "Results" && selectedClass && (
          <>
            {!selectedSubject && (
              <EmptyState icon="📊" title="Select a subject above to enter scores" />
            )}
            {selectedSubject && students.length > 0 && (
              <>
                {/* KPI bar */}
                <div className="grid grid-cols-3 gap-4 mb-5">
                  <KpiCard
                    label="Filled"
                    value={`${filledCount} / ${students.length}`}
                    color="text-blue-600"
                  />
                  <KpiCard
                    label="Class Avg"
                    color="text-slate-700"
                    value={classAvg ?? "—"}
                  />
                  <KpiCard
                    label="Below 50%"
                    color="text-red-600"
                    value={below50Count}
                  />
                </div>

                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                  <p className="text-sm text-slate-500">
                    <span className="font-bold text-blue-600">{filledCount}</span>
                    {" "}of{" "}
                    <span className="font-semibold">{students.length}</span> students filled
                    <span className="ml-2 text-xs text-slate-400">
                      ({isB16 ? "A–E5 scale" : "1–9 scale"})
                    </span>
                  </p>
                  {filledCount > 0 && (
                    <button
                      onClick={() => setShowSubmitConfirm(true)}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <div style={{
                            width: "13px", height: "13px",
                            border: "2px solid rgba(255,255,255,.3)",
                            borderTopColor: "#fff", borderRadius: "50%",
                            animation: "tp-spin .6s linear infinite",
                          }} />
                          Saving…
                        </>
                      ) : (
                        `Save ${filledCount} Result${filledCount !== 1 ? "s" : ""}`
                      )}
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <Th>#</Th>
                          <Th>Student</Th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold text-blue-600 uppercase tracking-wide">
                            Re-Open<br /><span className="text-slate-400 normal-case font-normal">/20</span>
                          </th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold text-blue-600 uppercase tracking-wide">
                            CA/MGT<br /><span className="text-slate-400 normal-case font-normal">/40</span>
                          </th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold text-blue-600 uppercase tracking-wide">
                            Exams<br /><span className="text-slate-400 normal-case font-normal">/40</span>
                          </th>
                          <Th center>Total</Th>
                          <Th center>Grade</Th>
                          <Th center>Remark</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {students.map((student, i) => {
                          const s     = scores[student.id] ?? { reopen: "", ca: "", exams: "" };
                          const dirty = s.reopen !== "" || s.ca !== "" || s.exams !== "";
                          const total = dirty ? computeTotal(s.reopen, s.ca, s.exams) : null;
                          const grade = total !== null ? gradeFromTotal(total, selectedClassLevel) : null;
                          // Server values come back as numbers; empty strings mean unsaved.
                          const isSaved = typeof s.reopen === "number";
                          return (
                            <tr
                              key={student.id}
                              className={`hover:bg-blue-50/20 transition-colors ${dirty ? "" : "opacity-60"}`}
                            >
                              <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-800 leading-tight">{student.student_name}</div>
                                {isSaved && (
                                  <span className="text-[10px] text-emerald-600 font-semibold">✓ saved</span>
                                )}
                              </td>
                              {["reopen", "ca", "exams"].map((field) => (
                                <td key={field} className="px-3 py-2.5 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max={field === "reopen" ? 20 : 40}
                                    step="0.5"
                                    value={s[field]}
                                    placeholder="—"
                                    onChange={(e) => handleScoreChange(student.id, field, e.target.value)}
                                    onPaste={(e) => handleScorePaste(student.id, field, e)}
                                    className="w-16 border border-slate-200 rounded-xl py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 hover:bg-white transition-colors"
                                  />
                                </td>
                              ))}
                              <td className="px-4 py-3 text-center">
                                {total !== null ? (
                                  <span className={`font-black tabular-nums ${
                                    total >= 50 ? "text-blue-700" : "text-red-600"
                                  }`}>
                                    {total}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-normal">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center"><Badge grade={grade} /></td>
                              <td className="px-4 py-3 text-center"><RemarkBadge grade={grade} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Grade scale key */}
                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Grade Scale
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {(isB16 ? GRADE_SCALE_B16 : GRADE_SCALE_B79).map((g) => (
                        <span key={g.grade} className="text-[11px] text-slate-500">
                          {g.range}: <b>{g.grade}</b> {g.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════
            TAB: Reports
        ══════════════════════════════════════ */}
        {tab === "Reports" && selectedClass && (
          <div className="space-y-6">

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                  Student — Full Report
                </label>
                <select
                  value={selectedStudent}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedStudent(id);
                    setReport(null); setRemarksSaved(false);
                    if (id) fetchStudentReport(id, selectedTerm);
                  }}
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">— Select a student —</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.student_name}</option>)}
                </select>
              </div>
              {report && (
                <button
                  onClick={downloadPDF}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
                >
                  {downloading ? "Generating…" : "⬇ Download PDF"}
                </button>
              )}
            </div>

            {loadingReport && (
              <div className="text-center text-slate-400 text-sm py-8">Loading report…</div>
            )}

            {!loadingReport && selectedStudent && !report && !error && (
              <EmptyState
                icon="📋"
                title="No report found for this student and term"
                sub="Make sure results have been entered for this term."
              />
            )}

            {report && !loadingReport && (() => {
              const level      = report.level || "basic_7_9";
              const gradeScale = level === "basic_7_9" ? GRADE_SCALE_B79 : GRADE_SCALE_B16;
              const subjectOptions = report.subjects?.map((s) => s.subject) ?? [];
              return (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                  <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white px-6 py-5 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <p className="font-black text-lg leading-tight">
                        {report.school_name || "LEADING STARS ACADEMY"}
                      </p>
                      <p className="text-blue-300 text-xs">
                        {level === "nursery_kg" ? "GLOBAL LEADERS" : "WHERE LEADERS ARE BORN"}
                      </p>
                      <div className="mt-3 space-y-0.5">
                        <p className="font-bold text-base">{report.student}</p>
                        <p className="text-blue-200 text-xs">Admission: {report.admission_number ?? "—"}</p>
                        <p className="text-blue-200 text-xs">
                          Class: {report.class ?? "—"} · {TERMS.find((t) => t.value === report.term)?.label ?? report.term}
                        </p>
                      </div>
                    </div>
                    {report.photo ? (
                      <img
                        src={report.photo} alt="Student photo"
                        className="w-20 h-20 rounded-xl border-2 border-white/30 object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="w-20 h-20 rounded-xl border-2 border-white/20 bg-white/10 flex items-center justify-center text-3xl font-black flex-shrink-0"
                      >
                        {report.student?.[0] ?? "?"}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-100">
                    {[
                      { label: "Total Marks",   value: report.total_score   ?? "—" },
                      { label: "Average",        value: report.average_score ?? "—" },
                      {
                        label: "Position",
                        value: report.show_position
                          ? report.position_formatted
                            ? `${report.position_formatted} / ${report.out_of}`
                            : "—"
                          : "N/A",
                      },
                      { label: "Overall Grade",  value: report.overall_grade ?? "—" },
                    ].map((stat) => (
                      <div key={stat.label} className="p-4 text-center border-r border-slate-100 last:border-r-0">
                        <p className="text-2xl font-black text-blue-700">{stat.value}</p>
                        <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-5">
                    <SectionHeader title="Subject Results" />
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-blue-50">
                            <Th>Subject</Th>
                            <Th center>Re-Open</Th><Th center>CA/MGT</Th><Th center>Exams</Th>
                            <Th center>Total</Th>
                            {report.show_position && <Th center>Pos.</Th>}
                            <Th center>Grade</Th><Th center>Remark</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {report.subjects?.map((sub, i) => (
                            <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                              <td className="px-4 py-2.5 font-medium text-slate-800">{sub.subject}</td>
                              <td className="px-4 py-2.5 text-center text-slate-500">{sub.reopen ?? "—"}</td>
                              <td className="px-4 py-2.5 text-center text-slate-500">{sub.ca     ?? "—"}</td>
                              <td className="px-4 py-2.5 text-center text-slate-500">{sub.exams  ?? "—"}</td>
                              <td className="px-4 py-2.5 text-center font-black text-blue-700">{sub.score}</td>
                              {report.show_position && (
                                <td className="px-4 py-2.5 text-center text-slate-500 font-semibold">
                                  {sub.subject_position ?? "—"}
                                </td>
                              )}
                              <td className="px-4 py-2.5 text-center"><Badge grade={sub.grade} /></td>
                              <td className="px-4 py-2.5 text-center"><RemarkBadge grade={sub.grade} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500">
                      <p className="font-bold text-slate-600 mb-2 text-[11px] uppercase tracking-wide">
                        Result Interpretation
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                        {gradeScale.map((g) => (
                          <span key={g.grade}>{g.range}: <b>{g.grade} – {g.label}</b></span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 px-5 pb-5">
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                      <h3 className="font-bold text-slate-700 mb-3 text-sm">Attendance</h3>
                      {(report.attendance_total ?? 0) > 0 ? (
                        <>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-500">Days Present</span>
                            <span className="font-bold text-slate-700">
                              {report.attendance} / {report.attendance_total}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2" role="progressbar" aria-valuenow={report.attendance_percent ?? 0} aria-valuemin={0} aria-valuemax={100}>
                            <div
                              className={`h-2 rounded-full transition-all ${
                                report.attendance_percent >= 80
                                  ? "bg-emerald-500"
                                  : report.attendance_percent >= 60
                                  ? "bg-amber-400"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${report.attendance_percent ?? 0}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5 text-right">
                            {report.attendance_percent}% attendance
                          </p>
                        </>
                      ) : (
                        <p className="text-slate-400 text-sm">No attendance data recorded.</p>
                      )}
                    </div>

                    <div className="border border-slate-100 rounded-2xl p-4">
                      <h3 className="font-bold text-slate-700 mb-3 text-sm">Teacher's Remarks</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                            Conduct
                          </label>
                          <select
                            value={remarks.conduct}
                            onChange={(e) => { setRemarks((p) => ({ ...p, conduct: e.target.value })); setRemarksSaved(false); }}
                            className="w-full border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            <option value="">— Select —</option>
                            {CONDUCT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                            Interest
                          </label>
                          <select
                            value={remarks.interest}
                            onChange={(e) => { setRemarks((p) => ({ ...p, interest: e.target.value })); setRemarksSaved(false); }}
                            className="w-full border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            <option value="">— Select Subject —</option>
                            {subjectOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                            Remark
                          </label>
                          <textarea
                            value={remarks.teacher_remark}
                            onChange={(e) => { setRemarks((p) => ({ ...p, teacher_remark: e.target.value })); setRemarksSaved(false); }}
                            rows={3}
                            placeholder="Write a remark for this student…"
                            className="w-full border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={saveRemarks}
                            disabled={savingRemarks}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
                          >
                            {savingRemarks ? "Saving…" : "Save Remarks"}
                          </button>
                          {remarksSaved && (
                            <span className="text-emerald-600 text-xs font-semibold">✓ Saved</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Class summary */}
            <div>
              <SectionHeader
                title={`Class Summary — ${selectedClassName}`}
                badge={summary.length > 0 ? `${summary.length} students ranked` : null}
              />
              {loadingSummary && (
                <div className="text-center text-slate-400 text-sm py-8">Loading summary…</div>
              )}
              {!loadingSummary && summary.length === 0 && (
                <EmptyState icon="📭" title="No results found for this class and term" />
              )}
              {!loadingSummary && summary.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <Th center>Rank</Th><Th>Student</Th>
                        <Th center>Total</Th><Th center>Average</Th>
                        <Th center>Grade</Th><Th center>Details</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {summary.map((row) => {
                        const rankColor =
                          row.rank === 1 ? "text-amber-500"  :
                          row.rank === 2 ? "text-slate-400"  :
                          row.rank === 3 ? "text-orange-400" : "text-slate-400";
                        const rankBg = row.rank === 1 ? "bg-amber-50" : "";
                        const isExp  = expandedStudent === row.student_id;
                        return (
                          <React.Fragment key={row.student_id}>
                            <tr
                              className={`hover:bg-blue-50/20 cursor-pointer transition-colors ${rankBg}`}
                              onClick={() => setExpandedStudent(isExp ? null : row.student_id)}
                            >
                              <td className="px-4 py-3 text-center">
                                <span className={`font-black text-base ${rankColor}`}>
                                  {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `#${row.rank}`}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-slate-800">{row.student_name}</p>
                                <p className="text-xs text-slate-400 font-mono">{row.admission_number}</p>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-slate-700">{row.total_score}</td>
                              <td className="px-4 py-3 text-center text-slate-600">{row.average_score}</td>
                              <td className="px-4 py-3 text-center"><Badge grade={row.overall_grade} /></td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-blue-500 text-xs font-semibold">
                                  {isExp ? "▲ Hide" : "▼ Show"}
                                </span>
                              </td>
                            </tr>
                            {isExp && (
                              <tr className="bg-slate-50/80">
                                <td colSpan={6} className="px-6 py-4">
                                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-blue-50">
                                          <Th>Subject</Th>
                                          <Th center>Re-Open</Th><Th center>CA/MGT</Th>
                                          <Th center>Exams</Th><Th center>Total</Th>
                                          <Th center>Grade</Th><Th center>Remark</Th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {row.subjects.map((sub) => (
                                          <tr key={sub.subject_id} className="hover:bg-blue-50/20">
                                            <td className="px-3 py-2 font-medium text-slate-800">{sub.subject_name}</td>
                                            <td className="px-3 py-2 text-center text-slate-500">{sub.reopen ?? "—"}</td>
                                            <td className="px-3 py-2 text-center text-slate-500">{sub.ca     ?? "—"}</td>
                                            <td className="px-3 py-2 text-center text-slate-500">{sub.exams  ?? "—"}</td>
                                            <td className="px-3 py-2 text-center font-black text-blue-700">{sub.score ?? "—"}</td>
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
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB: Announcements
        ══════════════════════════════════════ */}
        {tab === "Announcements" && (
          <AnnouncementsFeed audience="teachers" />
        )}

      </div>
    </div>
  );
};

export default TeacherPortal;
