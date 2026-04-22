// apps/attendance/components/Attendance.jsx
import { useEffect, useReducer, useCallback, useMemo } from "react";
import API from "../services/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split("T")[0];

const STATUS_OPTIONS = [
  {
    value: "present",
    label: "Present",
    icon: "✓",
    active: "bg-emerald-600 text-white ring-2 ring-emerald-300 shadow-md",
    inactive: "bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200",
    row: "bg-emerald-50 border-l-4 border-emerald-500",
    count: "text-emerald-700 bg-emerald-100",
  },
  {
    value: "absent",
    label: "Absent",
    icon: "✗",
    active: "bg-red-600 text-white ring-2 ring-red-300 shadow-md",
    inactive: "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-700 hover:border-red-200",
    row: "bg-red-50 border-l-4 border-red-500",
    count: "text-red-700 bg-red-100",
  },
  {
    value: "late",
    label: "Late",
    icon: "⏱",
    active: "bg-amber-500 text-white ring-2 ring-amber-300 shadow-md",
    inactive: "bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200",
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
  if (rate === null) return { color: "text-gray-400", bar: "bg-gray-300", label: "—" };
  if (rate >= 80)    return { color: "text-emerald-700 font-bold", bar: "bg-emerald-500", label: `${rate}%` };
  if (rate >= 60)    return { color: "text-amber-600 font-bold",   bar: "bg-amber-400",   label: `${rate}%` };
  return               { color: "text-red-600 font-bold",          bar: "bg-red-500",     label: `${rate}%` };
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

const initialState = {
  students:       [],
  classes:        [],
  selectedClass:  "",
  selectedDate:   todayStr(),
  attendance:     {},   // { [studentId]: status }
  existingIds:    {},   // { [studentId]: attendanceRecordId }
  summaryData:    [],
  activeTab:      TABS[0],
  loadingStudents: false,
  loadingSummary:  false,
  saving:          false,
  deletingId:      null,
  error:           "",
  success:         "",
};

const reducer = (state, action) => {
  switch (action.type) {
    case "SET_CLASSES":        return { ...state, classes: action.payload };
    case "SET_ACTIVE_TAB":     return { ...state, activeTab: action.payload, error: "", success: "" };
    case "SET_STATUS":         return { ...state, attendance: { ...state.attendance, [action.studentId]: action.status } };
    case "SET_CLASS":          return { ...state, selectedClass: action.payload, students: [], attendance: {}, existingIds: {}, summaryData: [], error: "", success: "" };
    case "SET_DATE":           return { ...state, selectedDate: action.payload };
    case "FETCH_STUDENTS_START": return { ...state, loadingStudents: true, error: "", success: "" };
    case "FETCH_STUDENTS_DONE":  return { ...state, loadingStudents: false, students: action.students, attendance: action.attendance, existingIds: action.existingIds };
    case "FETCH_SUMMARY_START":  return { ...state, loadingSummary: true };
    case "FETCH_SUMMARY_DONE":   return { ...state, loadingSummary: false, summaryData: action.payload };
    case "SAVING_START":         return { ...state, saving: true, error: "", success: "" };
    case "SAVING_DONE":          return { ...state, saving: false, success: "Attendance saved successfully." };
    case "SAVING_ERROR":         return { ...state, saving: false, error: action.payload };
    case "DELETING_START":       return { ...state, deletingId: action.payload };
    case "DELETING_DONE": {
      const attendance = { ...state.attendance };
      const existingIds = { ...state.existingIds };
      delete attendance[action.studentId];
      delete existingIds[action.studentId];
      return { ...state, deletingId: null, attendance, existingIds, success: "Record deleted." };
    }
    case "SET_ERROR":   return { ...state, error: action.payload, saving: false, loadingStudents: false };
    case "SET_SUCCESS": return { ...state, success: action.payload };
    case "MERGE_IDS":   return { ...state, existingIds: { ...state.existingIds, ...action.payload } };
    default:            return state;
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Alert = ({ type, message }) => {
  const styles = type === "error"
    ? "bg-red-50 border border-red-200 text-red-700"
    : "bg-emerald-50 border border-emerald-200 text-emerald-700";
  return <div className={`mb-5 px-4 py-3 rounded-lg text-sm font-medium ${styles}`}>{message}</div>;
};

const Spinner = ({ text = "Loading..." }) => (
  <div className="flex items-center gap-2 text-gray-400 py-6 text-sm">
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
    {text}
  </div>
);

const CountBadge = ({ opt, count }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${opt.count}`}>
    {opt.icon} {opt.label}: {count}
  </span>
);

const StatusToggle = ({ currentStatus, studentId, onStatusChange }) => (
  <div className="flex gap-1.5 justify-center flex-wrap">
    {STATUS_OPTIONS.map(({ value, label, icon, active, inactive }) => (
      <button
        key={value}
        onClick={() => onStatusChange(studentId, value)}
        className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all duration-150 ${
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
  if (rate === null) return <span className="text-gray-400 text-xs">No records</span>;
  return (
    <div className="flex items-center gap-2 justify-center">
      <div className="w-20 bg-gray-200 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all duration-500 ${bar}`} style={{ width: `${rate}%` }} />
      </div>
      <span className={`text-xs tabular-nums ${color}`}>{label}</span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Attendance = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    students, classes, selectedClass, selectedDate,
    attendance, existingIds, summaryData, activeTab,
    loadingStudents, loadingSummary, saving, deletingId,
    error, success,
  } = state;

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
      const filtered = studRes.data.results ?? studRes.data;
      const existing = attRes.data.results ?? attRes.data;

      const newAttendance = {};
      const newIds = {};
      filtered.forEach((s) => {
        const record = existing.find(
          (a) => String(a.student) === String(s.id) || String(a.student_id) === String(s.id)
        );
        newAttendance[s.id] = record?.status ?? "present";
        if (record) newIds[s.id] = record.id;
      });

      dispatch({ type: "FETCH_STUDENTS_DONE", students: filtered, attendance: newAttendance, existingIds: newIds });
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
        API.get(`/attendance/?school_class=${classId}`),
      ]);
      const classStudents = studRes.data.results ?? studRes.data;
      const records       = attRes.data.results  ?? attRes.data;

      const summary = classStudents.map((student) => {
        const sr      = records.filter((a) => String(a.student) === String(student.id));
        const total   = sr.length;
        const present = sr.filter((a) => a.status === "present").length;
        const absent  = sr.filter((a) => a.status === "absent").length;
        const late    = sr.filter((a) => a.status === "late").length;
        const rate    = total > 0 ? Math.round(((present + late) / total) * 100) : null;
        return { student, total, present, absent, late, rate };
      });

      dispatch({ type: "FETCH_SUMMARY_DONE", payload: summary });
    } catch {
      dispatch({ type: "SET_ERROR", payload: "Failed to load attendance summary." });
    }
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  useEffect(() => {
    if (selectedClass && selectedDate) fetchStudents(selectedClass, selectedDate);
  }, [selectedClass, selectedDate, fetchStudents]);

  useEffect(() => {
    if (activeTab === "Student Summary" && selectedClass) fetchSummary(selectedClass);
  }, [activeTab, selectedClass, fetchSummary]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDeleteAttendance = async (studentId) => {
    const id = existingIds[studentId];
    if (!id || !window.confirm("Delete this attendance record?")) return;
    dispatch({ type: "DELETING_START", payload: studentId });
    try {
      await API.delete(`/attendance/${id}/`);
      dispatch({ type: "DELETING_DONE", studentId });
    } catch {
      dispatch({ type: "SET_ERROR", payload: "Failed to delete attendance record." });
      dispatch({ type: "DELETING_START", payload: null });
    }
  };

  /**
   * Bug fix: original code always POST-ed, causing duplicates for already-saved records.
   * Now we PATCH existing records and only POST new ones.
   */
  const submitAttendance = async () => {
    if (!selectedClass || !selectedDate) {
      dispatch({ type: "SET_ERROR", payload: "Please select both a class and a date." });
      return;
    }
    if (students.length === 0) {
      dispatch({ type: "SET_ERROR", payload: "No students to save attendance for." });
      return;
    }
    dispatch({ type: "SAVING_START" });
    try {
      const results = await Promise.all(
        students.map(async (student) => {
          const studentId  = student.id;
          const status     = attendance[studentId] ?? "present";
          const existingId = existingIds[studentId];

          if (existingId) {
            // Update existing record
            const res = await API.patch(`/attendance/${existingId}/`, { status });
            return { studentId, id: res.data.id };
          } else {
            // Create new record
            const res = await API.post("/attendance/", {
              student:      studentId,
              school_class: selectedClass,
              date:         selectedDate,
              status,
            });
            return { studentId, id: res.data.id };
          }
        })
      );

      // Merge newly created IDs back so subsequent saves use PATCH
      const newIds = {};
      results.forEach(({ studentId, id }) => { if (!existingIds[studentId]) newIds[studentId] = id; });
      dispatch({ type: "MERGE_IDS", payload: newIds });
      dispatch({ type: "SAVING_DONE" });

      if (activeTab === "Student Summary") fetchSummary(selectedClass);
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        Object.values(err.response?.data ?? {}).flat().join(" ") ||
        "Error saving attendance.";
      dispatch({ type: "SAVING_ERROR", payload: msg });
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const counts = useMemo(
    () => Object.values(attendance).reduce((acc, s) => ({ ...acc, [s]: (acc[s] || 0) + 1 }), {}),
    [attendance]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Attendance</h1>
        <p className="text-sm text-gray-500 mt-0.5">Mark and review student attendance by class and date.</p>
      </div>

      {/* Alerts */}
      {error   && <Alert type="error"   message={error}   />}
      {success && <Alert type="success" message={success} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</label>
          <select
            value={selectedClass}
            onChange={(e) => dispatch({ type: "SET_CLASS", payload: e.target.value })}
            className="border border-gray-200 bg-white text-gray-800 px-3 py-2 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[160px]"
          >
            <option value="">Select a class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
          <input
            type="date"
            value={selectedDate}
            max={todayStr()}
            onChange={(e) => dispatch({ type: "SET_DATE", payload: e.target.value })}
            className="border border-gray-200 bg-white text-gray-800 px-3 py-2 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
      </div>

      {/* Tabs */}
      {selectedClass && (
        <div className="flex border-b border-gray-200 mb-6 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
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
            <p className="text-sm text-gray-500 py-6">No students found for this class.</p>
          )}

          {!selectedClass && (
            <p className="text-sm text-gray-400 py-6">Select a class and date to begin.</p>
          )}

          {students.length > 0 && !loadingStudents && (
            <>
              {/* Count badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {STATUS_OPTIONS.map((opt) => (
                  <CountBadge key={opt.value} opt={opt} count={counts[opt.value] || 0} />
                ))}
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
                      const statusMeta = getStatusMeta(attendance[student.id]);
                      return (
                        <tr
                          key={student.id}
                          className={`transition-colors ${statusMeta?.row || "hover:bg-gray-50"}`}
                        >
                          <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {getStudentName(student)}
                            {existingIds[student.id] && (
                              <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">
                                saved
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-400">{student.admission_number || "—"}</td>
                          <td className="px-4 py-3">
                            <StatusToggle
                              currentStatus={attendance[student.id]}
                              studentId={student.id}
                              onStatusChange={(id, status) => dispatch({ type: "SET_STATUS", studentId: id, status })}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {existingIds[student.id] && (
                              <button
                                onClick={() => handleDeleteAttendance(student.id)}
                                disabled={deletingId === student.id}
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

              {/* Save button */}
              <div className="mt-5 flex items-center gap-4">
                <button
                  onClick={submitAttendance}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold px-6 py-2.5 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : "Save Attendance"}
                </button>
                {saving && <span className="text-sm text-gray-400">Please wait…</span>}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Tab: Student Summary ── */}
      {activeTab === "Student Summary" && (
        <>
          {!selectedClass && <p className="text-sm text-gray-400 py-6">Select a class to view the attendance summary.</p>}
          {loadingSummary && <Spinner text="Loading summary..." />}

          {!loadingSummary && selectedClass && summaryData.length === 0 && (
            <p className="text-sm text-gray-500 py-6">No attendance records found for this class yet.</p>
          )}

          {!loadingSummary && summaryData.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left w-8">#</th>
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-center text-emerald-700">Present</th>
                    <th className="px-4 py-3 text-center text-red-600">Absent</th>
                    <th className="px-4 py-3 text-center text-amber-600">Late</th>
                    <th className="px-4 py-3 text-center">Total</th>
                    <th className="px-4 py-3 text-center">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summaryData.map(({ student, present, absent, late, total, rate }, index) => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{getStudentName(student)}</td>
                      <td className="px-4 py-3 text-center text-emerald-700 font-semibold">{present}</td>
                      <td className="px-4 py-3 text-center text-red-600  font-semibold">{absent}</td>
                      <td className="px-4 py-3 text-center text-amber-600 font-semibold">{late}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{total}</td>
                      <td className="px-4 py-3 text-center"><RateBar rate={rate} /></td>
                    </tr>
                  ))}
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
