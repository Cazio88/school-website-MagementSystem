// src/pages/teacher/TeacherPortal.jsx
//
// Root component — orchestration only.
// No API calls, no calc functions, no inline CSS strings here.
// All logic lives in hooks.js / teacherPortalService.js / helpers.js.

import React, { useEffect, useState, useMemo } from "react";
import { getUser, logout } from "../../services/auth";

// Constants & helpers
import {
  TABS, TERMS, YEARS, MODAL_STYLES, todayStr,
} from "./constants";

// Hooks
import {
  useTeacherData,
  useAttendance,
  useResults,
  useCharAssessment,
} from "./Hooks";

// Shared UI
import { Alert, EmptyState } from "./Ui";

// Modals
import { ReopenModal, CAModal, ExamsModal } from "./Scoremodals";
import { ChangePasswordModal, ConfirmModal } from "./Authmodals";

// Tabs (created in next step — stub imports for now)
import ClassesTab     from "./tabs/ClassesTab";
import AttendanceTab  from "./tabs/AttendanceTab";
import ResultsTab     from "./tabs/ResultsTab";
import CharacterTab   from "./tabs/CharacterTab";
import ReportsTab     from "./tabs/ReportsTab";
import AnnouncementsFeed from "../AnnouncementsFeed";

// ─────────────────────────────────────────────
// TeacherPortal
// ─────────────────────────────────────────────

const TeacherPortal = () => {
  const user = getUser();

  // Inject portal-specific CSS animations once
  useEffect(() => {
    if (document.getElementById("tp-modal-styles")) return;
    const el = document.createElement("style");
    el.id          = "tp-modal-styles";
    el.textContent = MODAL_STYLES;
    document.head.appendChild(el);
  }, []);

  // ── UI state ────────────────────────────────────────────────────────────
  const [tab,               setTab]               = useState("Classes");
  const [selectedTerm,      setSelectedTerm]       = useState("term1");
  const [selectedYear,      setSelectedYear]       = useState(YEARS[0]);
  const [selectedSubject,   setSelectedSubject]    = useState("");
  const [attDate,           setAttDate]            = useState(todayStr);
  const [scoreModal,        setScoreModal]         = useState(null);
  const [showPwModal,       setShowPwModal]        = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm]  = useState(false);

  // ── Domain hooks ────────────────────────────────────────────────────────
  const teacherData  = useTeacherData(
    user.class_id ? String(user.class_id) : "",
    user.class ?? ""
  );
  const attendance   = useAttendance();
  const results      = useResults();
  const charAssess   = useCharAssessment();

  // Unified error/success — each hook owns its own; we surface them here
  const error   = teacherData.error   || attendance.error   || results.error   || charAssess.error;
  const success = teacherData.success || attendance.success || results.success || charAssess.success;

  const clearError   = () => {
    teacherData.setError(""); attendance.setError(""); results.setError(""); charAssess.setError("");
  };
  const clearSuccess = () => {
    teacherData.setSuccess?.(""); attendance.setSuccess(""); results.setSuccess(""); charAssess.setSuccess("");
  };

  // ── Boot ────────────────────────────────────────────────────────────────
  useEffect(() => {
    teacherData.loadClasses();
    teacherData.loadSubjects();
  }, [teacherData.loadClasses, teacherData.loadSubjects]);

  useEffect(() => {
    if (teacherData.selectedClass) {
      teacherData.loadStudents(teacherData.selectedClass);
    } else {
      // class was cleared — also reset all derived state
      attendance.reset();
      results.reset();
      charAssess.resetForClass();
    }
  }, [teacherData.selectedClass]);

  // Tab-driven side effects
  useEffect(() => {
    if (
      tab === "Attendance" &&
      teacherData.selectedClass &&
      teacherData.students.length > 0
    ) {
      attendance.load(teacherData.selectedClass, attDate, teacherData.students);
    }
  }, [tab, attDate, teacherData.selectedClass, teacherData.students]);

  useEffect(() => {
    if (
      tab === "Results" &&
      teacherData.selectedClass &&
      selectedSubject &&
      selectedTerm &&
      teacherData.students.length > 0
    ) {
      results.load(
        teacherData.selectedClass,
        selectedTerm,
        selectedSubject,
        selectedYear,
        teacherData.students
      );
    }
  }, [tab, teacherData.selectedClass, selectedSubject, selectedTerm, selectedYear, teacherData.students]);

  useEffect(() => {
    if (tab === "Character" && charAssess.charStudentId) {
      charAssess.load(charAssess.charStudentId, selectedTerm, selectedYear);
    }
  }, [tab, charAssess.charStudentId, selectedTerm, selectedYear]);

  useEffect(() => {
    if (tab === "Character" && teacherData.students.length > 0 && !charAssess.charStudentId) {
      charAssess.selectStudent(String(teacherData.students[0].id));
    }
  }, [tab, teacherData.students]);

  useEffect(() => { clearError(); clearSuccess(); }, [tab]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const filledCount = useMemo(
    () =>
      Object.values(results.scores).filter(
        (v) => v?.reopen !== "" || v?.ca !== "" || v?.exams !== ""
      ).length,
    [results.scores]
  );

  // ── Score modal handlers ─────────────────────────────────────────────────
  const applyReopen = (score, breakdown) => {
    results.applyScore(scoreModal.studentId, "reopen", score, breakdown);
    setScoreModal(null);
  };
  const applyCA = (score, breakdown) => {
    results.applyScore(scoreModal.studentId, "ca", score, breakdown);
    setScoreModal(null);
  };
  const applyExams = (score, breakdown) => {
    results.applyScore(scoreModal.studentId, "exams", score, breakdown);
    setScoreModal(null);
  };

  // ── Class change ─────────────────────────────────────────────────────────
  const handleClassChange = (classId) => {
    teacherData.changeClass(classId, teacherData.classes);
    setSelectedSubject("");
    results.reset();
    attendance.reset();
    charAssess.resetForClass();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Score entry modals */}
      {scoreModal?.type === "reopen" && (
        <ReopenModal
          studentName={scoreModal.studentName}
          initial={results.breakdowns[scoreModal.studentId]?.reopen}
          onApply={applyReopen}
          onClose={() => setScoreModal(null)}
        />
      )}
      {scoreModal?.type === "ca" && (
        <CAModal
          studentName={scoreModal.studentName}
          initial={results.breakdowns[scoreModal.studentId]?.ca}
          onApply={applyCA}
          onClose={() => setScoreModal(null)}
        />
      )}
      {scoreModal?.type === "exams" && (
        <ExamsModal
          studentName={scoreModal.studentName}
          initial={results.breakdowns[scoreModal.studentId]?.exams}
          onApply={applyExams}
          onClose={() => setScoreModal(null)}
        />
      )}

      {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}

      {showSubmitConfirm && (
        <ConfirmModal
          title="Save Results?"
          body={`You are about to save ${filledCount} result${filledCount !== 1 ? "s" : ""} for ${teacherData.selectedClassName}. This will overwrite any existing scores for the selected subject and term.`}
          confirmLabel={`Save ${filledCount} Result${filledCount !== 1 ? "s" : ""}`}
          onConfirm={() => {
            setShowSubmitConfirm(false);
            results.submitAll(
              teacherData.selectedClass,
              selectedTerm,
              selectedSubject,
              selectedYear,
              teacherData.students
            );
          }}
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

          <nav className="hidden sm:flex items-center gap-1">
            {TABS.map(({ key, icon, label }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === key
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}>
                <span className="text-base">{icon}</span>
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
        <nav className="sm:hidden flex border-t border-slate-100 overflow-x-auto">
          {TABS.map(({ key, icon, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium border-b-2 transition-all min-w-[60px] ${
                tab === key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"
              }`}>
              <span className="text-lg">{icon}</span>{label}
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
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Term</label>
              <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
                className="border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Class</label>
              <select value={teacherData.selectedClass} onChange={(e) => handleClassChange(e.target.value)}
                className="border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm min-w-[150px] focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Select Class</option>
                {teacherData.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {tab === "Results" && (
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Subject</label>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}
                  className="border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm min-w-[160px] focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Select Subject</option>
                  {teacherData.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {tab === "Attendance" && (
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Date</label>
                <input type="date" value={attDate} max={todayStr} onChange={(e) => setAttDate(e.target.value)}
                  className="border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            )}

            {tab === "Character" && teacherData.selectedClass && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Student</label>
                <select
                  value={charAssess.charStudentId}
                  onChange={(e) => {
                    const id = e.target.value;
                    charAssess.selectStudent(id);
                    if (id) charAssess.load(id, selectedTerm, selectedYear);
                  }}
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">— Select a student —</option>
                  {teacherData.students.map((s) => {
                    const filled = charAssess.charForms[s.id]
                      ? Object.values(charAssess.charForms[s.id].areas ?? {}).filter((a) => a.score !== "").length
                      : 0;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.student_name}{filled > 0 ? ` ✓ (${filled}/6)` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Mobile password button */}
            <div className="sm:hidden ml-auto">
              <button onClick={() => setShowPwModal(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-200 px-3 py-2 rounded-xl transition-colors">
                🔑 Password
              </button>
            </div>
          </div>
        </div>

        {/* ── Alerts ── */}
        <Alert message={error}   type="error"   onDismiss={clearError}   />
        <Alert message={success} type="success" onDismiss={clearSuccess} />

        {!teacherData.selectedClass && (
          <EmptyState icon="🏫" title="Select a class to get started" sub="Use the dropdown above to choose your class" />
        )}

        {/* ── Tab content ── */}
        {teacherData.selectedClass && (
          <>
            {tab === "Classes" && (
              <ClassesTab
                students={teacherData.students}
                loading={teacherData.loadingStudents}
                selectedClassName={teacherData.selectedClassName}
                selectedTerm={selectedTerm}
              />
            )}

            {tab === "Attendance" && (
              <AttendanceTab
                students={teacherData.students}
                loading={teacherData.loadingStudents}
                selectedClassName={teacherData.selectedClassName}
                attDate={attDate}
                attendance={attendance.attendance}
                saving={attendance.saving}
                onToggle={attendance.toggle}
                onSave={() => attendance.save(
                  teacherData.selectedClass,
                  attDate,
                  teacherData.students,
                  todayStr
                )}
              />
            )}

            {tab === "Results" && (
              <ResultsTab
                students={teacherData.students}
                selectedSubject={selectedSubject}
                selectedClassLevel={teacherData.selectedClassLevel}
                scores={results.scores}
                breakdowns={results.breakdowns}
                existingIds={results.existingIds}
                saving={results.saving}
                deleting={results.deleting}
                filledCount={filledCount}
                onOpenModal={setScoreModal}
                onDelete={results.deleteOne}
                onSubmit={() => setShowSubmitConfirm(true)}
              />
            )}

            {tab === "Character" && (
              <CharacterTab
                students={teacherData.students}
                selectedClassName={teacherData.selectedClassName}
                selectedTerm={selectedTerm}
                selectedYear={selectedYear}
                charAssess={charAssess}
              />
            )}

            {tab === "Reports" && (
              <ReportsTab
                students={teacherData.students}
                selectedClassName={teacherData.selectedClassName}
                selectedClass={teacherData.selectedClass}
                selectedTerm={selectedTerm}
                selectedYear={selectedYear}
              />
            )}

            {tab === "Announcements" && (
              <AnnouncementsFeed audience="teachers" />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TeacherPortal;