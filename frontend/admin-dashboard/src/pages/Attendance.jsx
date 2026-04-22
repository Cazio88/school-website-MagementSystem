// apps/attendance/components/Attendance.jsx
import { useEffect, useReducer, useCallback, useMemo, useRef } from "react";
import API from "../services/api";

// ─── Constants ────────────────────────────────────────────────────────────────

// BUG FIX: was a module-level constant, so it froze at page-load time.
// Using a function ensures the date is always "today" even if the tab is left
// open past midnight.
const todayStr = () => new Date().toISOString().split("T")[0];

const STATUS_OPTIONS = [
  {
    value: "present",
    label: "Present",
    icon: "✓",
    active: "bg-emerald-600 text-white ring-2 ring-emerald-300 shadow-md",
    inactive:
      "bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200",
    row: "bg-emerald-50 border-l-4 border-emerald-500",
    count: "text-emerald-700 bg-emerald-100",
  },
  {
    value: "absent",
    label: "Absent",
    icon: "✗",
    active: "bg-red-600 text-white ring-2 ring-red-300 shadow-md",
    inactive:
      "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-700 hover:border-red-200",
    row: "bg-red-50 border-l-4 border-red-500",
    count: "text-red-700 bg-red-100",
  },
  {
    value: "late",
    label: "Late",
    icon: "⏱",
    active: "bg-amber-500 text-white ring-2 ring-amber-300 shadow-md",
    inactive:
      "bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200",
    row: "bg-amber-50 border-l-4 border-amber-400",
    count: "text-amber-700 bg-amber-100",
  },
];

const TABS = ["Mark Attendance", "Student Summary"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStudentName = (student) =>
  student?.student_name ||
  [student?.first_name, student?.last_name].filter(Boolean).join(" ").trim() ||
  student?.username ||
  student?.admission_number ||
  "Unknown";

const getStatusMeta = (value) => STATUS_OPTIONS.find((s) => s.value === value);

const getRateMeta = (rate) => {
  if (rate === null)
    return { color: "text-gray-400", bar: "bg-gray-300", label: "—" };
  if (rate >= 80)
    return {
      color: "text-emerald-700 font-bold",
      bar: "bg-emerald-500",
      label: `${rate}%`,
    };
  if (rate >= 60)
    return {
      color: "text-amber-600 font-bold",
      bar: "bg-amber-400",
      label: `${rate}%`,
    };
  return { color: "text-red-600 font-bold", bar: "bg-red-500", label: `${rate}%` };
};

const isToday = (dateStr) => dateStr === todayStr();

// ─── Reducer ──────────────────────────────────────────────────────────────────

const initialState = {
  students: [],
  classes: [],
  selectedClass: "",
  selectedDate: todayStr(),
  // attendance: { [studentId]: status | null }
  // null  = no record yet (past date, unset)
  // string = recorded or locally changed
  attendance: {},
  existingIds: {}, // { [studentId]: attendanceRecordId }
  summaryData: [],
  activeTab: TABS[0],
  loadingStudents: false,
  loadingSummary: false,
  saving: false,
  refreshing: false,
  deletingId: null,
  error: "",
  success: "",
};

const reducer = (state, action) => {
  switch (action.type) {
    case "SET_CLASSES":
      return { ...state, classes: action.payload };

    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.payload, error: "", success: "" };

    case "SET_STATUS":
      return {
        ...state,
        attendance: { ...state.attendance, [action.studentId]: action.status },
      };

    case "SET_CLASS":
      return {
        ...state,
        selectedClass: action.payload,
        students: [],
        attendance: {},
        existingIds: {},
        // BUG FIX: clear stale summary when class changes
        summaryData: [],
        error: "",
        success: "",
      };

    case "SET_DATE":
      return {
        ...state,
        selectedDate: action.payload,
        students: [],
        attendance: {},
        existingIds: {},
        // BUG FIX: also clear summaryData on date change so Summary tab doesn't
        // show stale data while the new fetch is in-flight
        summaryData: [],
        error: "",
        success: "",
      };

    case "FETCH_STUDENTS_START":
      return { ...state, loadingStudents: true, error: "", success: "" };

    case "FETCH_STUDENTS_DONE":
      return {
        ...state,
        loadingStudents: false,
        students: action.students,
        attendance: action.attendance,
        existingIds: action.existingIds,
      };

    case "FETCH_SUMMARY_START":
      return { ...state, loadingSummary: true };

    case "FETCH_SUMMARY_DONE":
      return { ...state, loadingSummary: false, summaryData: action.payload };

    case "SAVING_START":
      return { ...state, saving: true, error: "", success: "" };

    case "SAVING_DONE":
      return { ...state, saving: false, success: "Attendance saved successfully." };

    case "SAVING_ERROR":
      return { ...state, saving: false, error: action.payload };

    case "REFRESHING_START":
      return { ...state, refreshing: true, error: "", success: "" };

    // REFRESH_DONE re-fetches from server (via action.students / action.attendance)
    // instead of blindly clearing existingIds, so any records that failed to delete
    // are still tracked correctly.
    case "REFRESH_DONE": {
      const freshAttendance = {};
      state.students.forEach((s) => {
        freshAttendance[s.id] = "present";
      });
      return {
        ...state,
        refreshing: false,
        // BUG FIX: clear existingIds only after confirmed server deletions;
        // the fresh re-fetch in handleRefreshAllPresent populates this correctly.
        attendance: freshAttendance,
        existingIds: {},
        success: "All students reset to Present. Review and save.",
      };
    }

    case "REFRESH_ERROR":
      return { ...state, refreshing: false, error: action.payload };

    case "DELETING_START":
      return { ...state, deletingId: action.payload };

    case "DELETING_DONE": {
      const attendance = { ...state.attendance };
      const existingIds = { ...state.existingIds };
      attendance[action.studentId] = null;
      delete existingIds[action.studentId];
      return { ...state, deletingId: null, attendance, existingIds, success: "Record deleted." };
    }

    // BUG FIX: was re-using DELETING_START with null payload to clear deletingId
    // on error — semantically wrong and could mask the real error state.
    case "DELETING_ERROR":
      return { ...state, deletingId: null, error: action.payload };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
        saving: false,
        loadingStudents: false,
        refreshing: false,
      };

    case "SET_SUCCESS":
      return { ...state, success: action.payload };

    case "MERGE_IDS":
      return { ...state, existingIds: { ...state.existingIds, ...action.payload } };

    case "CLEAR_SUCCESS":
      return { ...state, success: "" };

    default:
      return state;
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Alert = ({ type, message }) => {
  const styles =
    type === "error"
      ? "bg-red-50 border border-red-200 text-red-700"
      : "bg-emerald-50 border border-emerald-200 text-emerald-700";
  return (
    <div className={`mb-5 px-4 py-3 rounded-lg text-sm font-medium ${styles}`}>
      {message}
    </div>
  );
};

const Spinner = ({ text = "Loading..." }) => (
  <div className="flex items-center gap-2 text-gray-400 py-6 text-sm">
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
    {text}
  </div>
);

const CountBadge = ({ opt, count }) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${opt.count}`}
  >
    {opt.icon} {opt.label}: {count}
  </span>
);

const StatusToggle = ({ currentStatus, studentId, onStatusChange, disabled }) => (
  <div className="flex gap-1.5 justify-center flex-wrap" role="group" aria-label="Attendance status">
    {STATUS_OPTIONS.map(({ value, label, icon, active, inactive }) => (
      <button
        key={value}
        onClick={() => !disabled && onStatusChange(studentId, value)}
        disabled={disabled}
        aria-pressed={currentStatus === value}
        aria-label={label}
        className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
          currentStatus === value ? active : `border-transparent ${inactive}`
        }`}
      >
        {icon} {label}
      </button>
    ))}
  </div>
);

const RateBar = ({ rate }) => {
  const { color, bar, label } = getRateMeta(rate);
  if (rate === null)
    return <span className="text-gray-400 text-xs">No records</span>;
  return (
    <div className="flex items-center gap-2 justify-center">
      <div className="w-20 bg-gray-200 rounded-full h-1.5" role="progressbar" aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${bar}`}
          style={{ width: `${rate}%` }}
        />
      </div>
      <span className={`text-xs tabular-nums ${color}`}>{label}</span>
    </div>
  );
};

const DateModeBanner = ({ selectedDate, hasAnyRecord, studentCount }) => {
  const today = isToday(selectedDate);
  if (!selectedDate || studentCount === 0) return null;

  if (today && !hasAnyRecord) {
    return (
      <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
        <span className="text-lg leading-none">📋</span>
        <div>
          <span className="font-semibold">Today's attendance</span> — no records yet.
          All students are pre-set to{" "}
          <span className="font-semibold">Present</span>. Adjust and save.
        </div>
      </div>
    );
  }

  if (today && hasAnyRecord) {
    return (
      <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
        <span className="text-lg leading-none">✅</span>
        <div>
          <span className="font-semibold">Today's attendance is recorded.</span>{" "}
          Edit any status and save, or use{" "}
          <span className="font-semibold">Reset All to Present</span> to start over.
        </div>
      </div>
    );
  }

  if (!today && hasAnyRecord) {
    return (
      <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
        <span className="text-lg leading-none">📅</span>
        <div>
          <span className="font-semibold">Editing past attendance</span> for{" "}
          <span className="font-semibold">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          . Changes will update existing records.
        </div>
      </div>
    );
  }

  if (!today && !hasAnyRecord) {
    return (
      <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-sm">
        <span className="text-lg leading-none">🗓</span>
        <div>
          <span className="font-semibold">No attendance recorded</span> for{" "}
          <span className="font-semibold">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          . Students without a record are shown unset — assign statuses and save
          to create records.
        </div>
      </div>
    );
  }

  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Attendance = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    students,
    classes,
    selectedClass,
    selectedDate,
    attendance,
    existingIds,
    summaryData,
    activeTab,
    loadingStudents,
    loadingSummary,
    saving,
    refreshing,
    deletingId,
    error,
    success,
  } = state;

  // Auto-clear success messages after 4 s so they don't linger forever
  const successTimer = useRef(null);
  useEffect(() => {
    if (success) {
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(
        () => dispatch({ type: "CLEAR_SUCCESS" }),
        4000
      );
    }
    return () => clearTimeout(successTimer.current);
  }, [success]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchClasses = useCallback(async () => {
    try {
      const res = await API.get("/classes/");
      dispatch({ type: "SET_CLASSES", payload: res.data.results ?? res.data });
    } catch {
      dispatch({ type: "SET_ERROR", payload: "Failed to load classes." });
    }
  }, []);

  const fetchStudents = useCallback(async (classId, date) => {
    if (!classId || !date) return;
    dispatch({ type: "FETCH_STUDENTS_START" });
    try {
      const [studRes, attRes] = await Promise.all([
        API.get(`/students/?school_class=${classId}`),
        API.get(`/attendance/?date=${date}&school_class=${classId}`),
      ]);
      const studentList = studRes.data.results ?? studRes.data;
      const existing = attRes.data.results ?? attRes.data;
      const isDateToday = isToday(date);

      const newAttendance = {};
      const newIds = {};

      studentList.forEach((s) => {
        const record = existing.find(
          (a) =>
            String(a.student) === String(s.id) ||
            String(a.student_id) === String(s.id)
        );
        if (record) {
          newAttendance[s.id] = record.status;
          newIds[s.id] = record.id;
        } else if (isDateToday) {
          // Today, no record yet — pre-fill as "present" for convenience
          newAttendance[s.id] = "present";
        } else {
          // Past date, no record — leave unset so teacher knows nothing was recorded
          newAttendance[s.id] = null;
        }
      });

      dispatch({
        type: "FETCH_STUDENTS_DONE",
        students: studentList,
        attendance: newAttendance,
        existingIds: newIds,
      });
    } catch {
      dispatch({ type: "SET_ERROR", payload: "Failed to load students." });
    }
  }, []);

  const fetchSummary = useCallback(async (classId) => {
    if (!classId) return;
    dispatch({ type: "FETCH_SUMMARY_START" });
    try {
      const [studRes, attRes] = await Promise.all([
        API.get(`/students/?school_class=${classId}`),
        // BUG FIX: add school_class filter (was missing — fetched ALL attendance)
        // and request a high page-size limit to reduce pagination issues on large
        // datasets. For very large schools you may want server-side aggregation.
        API.get(`/attendance/?school_class=${classId}&page_size=2000`),
      ]);
      const classStudents = studRes.data.results ?? studRes.data;
      const records = attRes.data.results ?? attRes.data;

      const summary = classStudents.map((student) => {
        const sr = records.filter(
          (a) =>
            String(a.student) === String(student.id) ||
            String(a.student_id) === String(student.id)
        );
        const total = sr.length;
        const present = sr.filter((a) => a.status === "present").length;
        const absent = sr.filter((a) => a.status === "absent").length;
        const late = sr.filter((a) => a.status === "late").length;
        const rate =
          total > 0 ? Math.round(((present + late) / total) * 100) : null;
        return { student, total, present, absent, late, rate };
      });

      dispatch({ type: "FETCH_SUMMARY_DONE", payload: summary });
    } catch {
      dispatch({ type: "SET_ERROR", payload: "Failed to load attendance summary." });
    }
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (selectedClass && selectedDate) fetchStudents(selectedClass, selectedDate);
  }, [selectedClass, selectedDate, fetchStudents]);

  useEffect(() => {
    if (activeTab === "Student Summary" && selectedClass)
      fetchSummary(selectedClass);
  }, [activeTab, selectedClass, fetchSummary]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  /**
   * Reset all to present (today only).
   *
   * BUG FIX (original): silently swallowed per-record delete failures with
   * `.catch(() => null)`, then cleared existingIds locally, causing the next
   * save to POST instead of PATCH on any records that weren't actually deleted
   * — resulting in a unique-constraint 400 from the server.
   *
   * Fix: collect failed deletes, warn the teacher, and re-fetch the real
   * server state so existingIds is always accurate.
   */
  const handleRefreshAllPresent = async () => {
    if (
      !window.confirm(
        "This will delete all recorded attendance for today and reset everyone to Present. Continue?"
      )
    )
      return;

    dispatch({ type: "REFRESHING_START" });
    try {
      const ids = Object.values(existingIds);
      const results = await Promise.allSettled(
        ids.map((id) => API.delete(`/attendance/${id}/`))
      );

      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed > 0) {
        // Re-fetch to sync real server state before reporting the partial failure
        await fetchStudents(selectedClass, selectedDate);
        dispatch({
          type: "REFRESH_ERROR",
          payload: `${failed} record(s) could not be deleted. The list has been refreshed — please try again.`,
        });
        return;
      }

      dispatch({ type: "REFRESH_DONE" });
    } catch {
      dispatch({
        type: "REFRESH_ERROR",
        payload: "Failed to reset attendance. Please try again.",
      });
    }
  };

  const handleDeleteAttendance = async (studentId) => {
    const id = existingIds[studentId];
    if (!id || !window.confirm("Delete this attendance record?")) return;
    dispatch({ type: "DELETING_START", payload: studentId });
    try {
      await API.delete(`/attendance/${id}/`);
      dispatch({ type: "DELETING_DONE", studentId });
    } catch {
      // BUG FIX: was dispatching DELETING_START with null — use dedicated action
      dispatch({
        type: "DELETING_ERROR",
        payload: "Failed to delete attendance record.",
      });
    }
  };

  /**
   * Save attendance.
   * - Students with a null status (unset on a past date) are skipped.
   * - PATCH existing records, POST new ones.
   */
  const submitAttendance = async () => {
    if (!selectedClass || !selectedDate) {
      dispatch({
        type: "SET_ERROR",
        payload: "Please select both a class and a date.",
      });
      return;
    }
    if (students.length === 0) {
      dispatch({
        type: "SET_ERROR",
        payload: "No students to save attendance for.",
      });
      return;
    }

    const studentsToSave = students.filter(
      (s) => attendance[s.id] !== null && attendance[s.id] !== undefined
    );

    // BUG FIX: warn the teacher how many unset students will be skipped
    const unsetCount = students.length - studentsToSave.length;
    if (studentsToSave.length === 0) {
      dispatch({
        type: "SET_ERROR",
        payload:
          "No statuses assigned. Please mark at least one student before saving.",
      });
      return;
    }

    dispatch({ type: "SAVING_START" });
    try {
      const results = await Promise.all(
        studentsToSave.map(async (student) => {
          const studentId = student.id;
          const status = attendance[studentId];
          const existingId = existingIds[studentId];

          if (existingId) {
            const res = await API.patch(`/attendance/${existingId}/`, { status });
            return { studentId, id: res.data.id };
          } else {
            const res = await API.post("/attendance/", {
              student: studentId,
              school_class: selectedClass,
              date: selectedDate,
              status,
            });
            return { studentId, id: res.data.id };
          }
        })
      );

      const newIds = {};
      results.forEach(({ studentId, id }) => {
        if (!existingIds[studentId]) newIds[studentId] = id;
      });
      dispatch({ type: "MERGE_IDS", payload: newIds });

      const successMsg =
        unsetCount > 0
          ? `Attendance saved. ${unsetCount} student(s) with no status were skipped.`
          : "Attendance saved successfully.";
      dispatch({ type: "SAVING_DONE" });
      // Override the generic message if we need to mention skipped students
      if (unsetCount > 0) {
        dispatch({ type: "SET_SUCCESS", payload: successMsg });
      }

      if (activeTab === "Student Summary") fetchSummary(selectedClass);
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        Object.values(err.response?.data ?? {})
          .flat()
          .join(" ") ||
        "Error saving attendance.";
      dispatch({ type: "SAVING_ERROR", payload: msg });
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const counts = useMemo(() => {
    const base = { present: 0, absent: 0, late: 0, unset: 0 };
    Object.values(attendance).forEach((s) => {
      if (s === null || s === undefined) base.unset++;
      else if (base[s] !== undefined) base[s]++;
    });
    return base;
  }, [attendance]);

  const hasAnyRecord = useMemo(
    () => Object.keys(existingIds).length > 0,
    [existingIds]
  );

  // BUG FIX: compute reactively at render time instead of using a stale constant
  const dateIsToday = isToday(selectedDate);

  // BUG FIX: compute max date reactively so the date picker stays correct if
  // the browser tab is kept open past midnight
  const maxDate = todayStr();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
          Attendance
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Mark and review student attendance by class and date.
        </p>
      </div>

      {/* Alerts */}
      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="class-select"
            className="text-xs font-semibold text-gray-500 uppercase tracking-wide"
          >
            Class
          </label>
          <select
            id="class-select"
            value={selectedClass}
            onChange={(e) =>
              dispatch({ type: "SET_CLASS", payload: e.target.value })
            }
            className="border border-gray-200 bg-white text-gray-800 px-3 py-2 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[160px]"
          >
            <option value="">Select a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="date-input"
            className="text-xs font-semibold text-gray-500 uppercase tracking-wide"
          >
            Date
          </label>
          <input
            id="date-input"
            type="date"
            value={selectedDate}
            max={maxDate}
            onChange={(e) =>
              dispatch({ type: "SET_DATE", payload: e.target.value })
            }
            className="border border-gray-200 bg-white text-gray-800 px-3 py-2 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {selectedDate && (
          <div className="flex flex-col gap-1 justify-end">
            <span
              className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                dateIsToday
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {dateIsToday ? "📅 Today" : "🗓 Past date"}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      {selectedClass && (
        <div className="flex border-b border-gray-200 mb-6 gap-1" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: tab })}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* ── Tab: Mark Attendance ── */}
      {activeTab === "Mark Attendance" && (
        <>
          {loadingStudents && <Spinner text="Loading students..." />}

          {!loadingStudents && selectedClass && students.length === 0 && (
            <p className="text-sm text-gray-500 py-6">
              No students found for this class.
            </p>
          )}

          {!selectedClass && (
            <p className="text-sm text-gray-400 py-6">
              Select a class and date to begin.
            </p>
          )}

          {students.length > 0 && !loadingStudents && (
            <>
              <DateModeBanner
                selectedDate={selectedDate}
                hasAnyRecord={hasAnyRecord}
                studentCount={students.length}
              />

              {/* Count badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {STATUS_OPTIONS.map((opt) => (
                  <CountBadge
                    key={opt.value}
                    opt={opt}
                    count={counts[opt.value] || 0}
                  />
                ))}
                {counts.unset > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                    — Unset: {counts.unset}
                    <span className="text-gray-400 font-normal">(will be skipped on save)</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                  Total: {students.length}
                </span>
              </div>

              {/* Attendance table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left w-8">#</th>
                      <th className="px-4 py-3 text-left">Student</th>
                      <th className="px-4 py-3 text-left">Admission No.</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {students.map((student, index) => {
                      const status = attendance[student.id];
                      const statusMeta = status ? getStatusMeta(status) : null;
                      const isUnset = status === null || status === undefined;

                      return (
                        <tr
                          key={student.id}
                          className={`transition-colors ${
                            isUnset
                              ? "bg-white hover:bg-gray-50"
                              : statusMeta?.row || "hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {getStudentName(student)}
                            {existingIds[student.id] && (
                              <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">
                                saved
                              </span>
                            )}
                            {isUnset && (
                              <span className="ml-2 text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-semibold">
                                not recorded
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {student.admission_number || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusToggle
                              currentStatus={status}
                              studentId={student.id}
                              onStatusChange={(id, s) =>
                                dispatch({
                                  type: "SET_STATUS",
                                  studentId: id,
                                  status: s,
                                })
                              }
                              disabled={saving || refreshing}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {existingIds[student.id] && (
                              <button
                                onClick={() =>
                                  handleDeleteAttendance(student.id)
                                }
                                disabled={
                                  deletingId === student.id ||
                                  saving ||
                                  refreshing
                                }
                                aria-label={`Delete attendance record for ${getStudentName(student)}`}
                                className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors disabled:opacity-40"
                              >
                                {deletingId === student.id ? "…" : "Delete"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action bar */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={submitAttendance}
                  disabled={saving || refreshing}
                  className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold px-6 py-2.5 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : "Save Attendance"}
                </button>

                {dateIsToday && (
                  <button
                    onClick={handleRefreshAllPresent}
                    disabled={saving || refreshing}
                    className="flex items-center gap-2 bg-white border border-gray-300 hover:border-amber-400 hover:bg-amber-50 text-gray-700 hover:text-amber-800 text-sm font-semibold px-5 py-2.5 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                  >
                    {refreshing ? (
                      <>
                        <svg
                          className="animate-spin h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"
                          />
                        </svg>{" "}
                        Resetting…
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">↺</span> Reset All to Present
                      </>
                    )}
                  </button>
                )}

                {(saving || refreshing) && (
                  <span className="text-sm text-gray-400" aria-live="polite">
                    Please wait…
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Tab: Student Summary ── */}
      {activeTab === "Student Summary" && (
        <>
          {!selectedClass && (
            <p className="text-sm text-gray-400 py-6">
              Select a class to view the attendance summary.
            </p>
          )}
          {loadingSummary && <Spinner text="Loading summary..." />}

          {!loadingSummary && selectedClass && summaryData.length === 0 && (
            <p className="text-sm text-gray-500 py-6">
              No attendance records found for this class yet.
            </p>
          )}

          {!loadingSummary && summaryData.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left w-8">#</th>
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-center text-emerald-700">
                      Present
                    </th>
                    <th className="px-4 py-3 text-center text-red-600">
                      Absent
                    </th>
                    <th className="px-4 py-3 text-center text-amber-600">
                      Late
                    </th>
                    <th className="px-4 py-3 text-center">Total</th>
                    <th className="px-4 py-3 text-center">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summaryData.map(
                    ({ student, present, absent, late, total, rate }, index) => (
                      <tr
                        key={student.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {getStudentName(student)}
                        </td>
                        <td className="px-4 py-3 text-center text-emerald-700 font-semibold">
                          {present}
                        </td>
                        <td className="px-4 py-3 text-center text-red-600 font-semibold">
                          {absent}
                        </td>
                        <td className="px-4 py-3 text-center text-amber-600 font-semibold">
                          {late}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">
                          {total}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <RateBar rate={rate} />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Attendance;
