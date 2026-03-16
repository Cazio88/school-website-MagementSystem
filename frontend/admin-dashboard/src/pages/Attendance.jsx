import { useEffect, useState } from "react";
import API from "../services/api";

const todayStr = () => new Date().toISOString().split("T")[0];

const getStudentName = (student) =>
  student?.student_name ||
  (student?.first_name || student?.last_name
    ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
    : null) ||
  student?.username ||
  student?.admission_number ||
  "Unknown";

const STATUS_OPTIONS = [
  { value: "present", label: "✓ Present", active: "bg-green-600 ring-2 ring-green-800 ring-offset-1 font-bold", inactive: "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700" },
  { value: "absent",  label: "✗ Absent",  active: "bg-red-600 ring-2 ring-red-800 ring-offset-1 font-bold text-white", inactive: "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-700" },
  { value: "late",    label: "⏱ Late",    active: "bg-yellow-500 ring-2 ring-yellow-700 ring-offset-1 font-bold text-gray-900", inactive: "bg-gray-100 text-gray-500 hover:bg-yellow-50 hover:text-yellow-700" },
];

const ROW_HIGHLIGHT = {
  present: "bg-green-50 border-l-4 border-green-500",
  absent:  "bg-red-50 border-l-4 border-red-500",
  late:    "bg-yellow-50 border-l-4 border-yellow-400",
};

const TABS = ["Mark Attendance", "Student Summary"];

const Attendance = () => {
  const [students, setStudents]               = useState([]);
  const [classes, setClasses]                 = useState([]);
  const [selectedClass, setSelectedClass]     = useState("");
  const [selectedDate, setSelectedDate]       = useState(todayStr());
  const [attendance, setAttendance]           = useState({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [error, setError]                     = useState("");
  const [success, setSuccess]                 = useState("");
  const [activeTab, setActiveTab]             = useState("Mark Attendance");
  const [summaryData, setSummaryData]         = useState([]);
  const [loadingSummary, setLoadingSummary]   = useState(false);

  useEffect(() => { fetchClasses(); }, []);

  useEffect(() => {
    if (selectedClass && selectedDate) fetchStudents(selectedClass);
  }, [selectedClass, selectedDate]);

  useEffect(() => {
    if (activeTab === "Student Summary" && selectedClass) fetchSummary(selectedClass);
  }, [activeTab, selectedClass]);

  const fetchClasses = async () => {
    try {
      const res = await API.get("/classes/");
      setClasses(res.data.results || res.data);
    } catch (err) {
      setError("Failed to load classes.");
    }
  };

  const fetchStudents = async (classId) => {
    if (!classId) return;
    setLoadingStudents(true);
    setError(""); setSuccess("");
    try {
      const res = await API.get("/students/");
      const all = res.data.results || res.data;
      const filtered = all.filter((s) => {
        const classVal = s.school_class ?? s.class_id ?? s.school_class_id;
        return String(classVal) === String(classId);
      });
      setStudents(filtered);

      const attRes = await API.get(`/attendance/?date=${selectedDate}`);
      const existing = attRes.data.results || attRes.data;
      const defaults = {};
      filtered.forEach((s) => {
        const record = existing.find(
          (a) => String(a.student) === String(s.id) || String(a.student_id) === String(s.id)
        );
        defaults[s.id] = record ? record.status : "present";
      });
      setAttendance(defaults);
    } catch (err) {
      setError("Failed to load students.");
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchSummary = async (classId) => {
    if (!classId) return;
    setLoadingSummary(true);
    try {
      // Fetch all students in class
      const studRes = await API.get("/students/");
      const allStudents = studRes.data.results || studRes.data;
      const classStudents = allStudents.filter((s) => {
        const classVal = s.school_class ?? s.class_id ?? s.school_class_id;
        return String(classVal) === String(classId);
      });

      // Fetch all attendance records for this class
      const attRes = await API.get(`/attendance/?school_class=${classId}`);
      const records = attRes.data.results || attRes.data;

      // Compute per-student stats
      const summary = classStudents.map((student) => {
        const studentRecords = records.filter(
          (a) => String(a.student) === String(student.id)
        );
        const total   = studentRecords.length;
        const present = studentRecords.filter((a) => a.status === "present").length;
        const absent  = studentRecords.filter((a) => a.status === "absent").length;
        const late    = studentRecords.filter((a) => a.status === "late").length;
        const rate    = total > 0 ? Math.round(((present + late) / total) * 100) : null;
        return { student, total, present, absent, late, rate };
      });

      setSummaryData(summary);
    } catch (err) {
      setError("Failed to load attendance summary.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleClassChange = (e) => {
    const classId = e.target.value;
    setSelectedClass(classId);
    setStudents([]); setAttendance({});
    setSummaryData([]);
    setError(""); setSuccess("");
  };

  const handleStatusChange = (studentId, newStatus) => {
    setAttendance((prev) => ({ ...prev, [studentId]: newStatus }));
  };

  const submitAttendance = async () => {
    setError(""); setSuccess("");
    if (!selectedClass || !selectedDate) { setError("Please select both a class and a date."); return; }
    if (students.length === 0) { setError("No students to save attendance for."); return; }
    setSaving(true);
    try {
      const payload = Object.keys(attendance).map((studentId) => ({
        student: studentId,
        school_class: selectedClass,
        date: selectedDate,
        status: attendance[studentId],
      }));
      await Promise.all(payload.map((record) => API.post("/attendance/", record)));
      setSuccess("Attendance saved successfully.");
      if (activeTab === "Student Summary") fetchSummary(selectedClass);
    } catch (err) {
      const detail = err.response?.data?.detail ||
        Object.values(err.response?.data || {}).flat().join(" ") ||
        "Error saving attendance.";
      setError(detail);
    } finally {
      setSaving(false);
    }
  };

  const counts = Object.values(attendance).reduce(
    (acc, s) => ({ ...acc, [s]: (acc[s] || 0) + 1 }), {}
  );

  const getRateColor = (rate) => {
    if (rate === null) return "text-gray-400";
    if (rate >= 80) return "text-green-600 font-semibold";
    if (rate >= 60) return "text-yellow-600 font-semibold";
    return "text-red-600 font-semibold";
  };

  const getRateBar = (rate) => {
    if (rate === null) return "bg-gray-200";
    if (rate >= 80) return "bg-green-500";
    if (rate >= 60) return "bg-yellow-400";
    return "bg-red-500";
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Attendance</h1>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded">{success}</div>}

      {/* Controls */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <select value={selectedClass} onChange={handleClassChange} className="border p-2 rounded min-w-[160px]">
          <option value="">Select Class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* Tabs */}
      {selectedClass && (
        <div className="flex border-b mb-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
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

      {/* ── TAB 1: Mark Attendance ── */}
      {activeTab === "Mark Attendance" && (
        <>
          {loadingStudents && <p className="text-gray-500 mb-4">Loading students...</p>}
          {!loadingStudents && selectedClass && students.length === 0 && (
            <p className="text-red-500 mb-4">No students found for this class.</p>
          )}

          {students.length > 0 && (
            <>
              {/* Summary bar */}
              <div className="flex gap-4 mb-4 text-sm font-medium">
                <span className="text-green-700">Present: {counts.present || 0}</span>
                <span className="text-red-600">Absent: {counts.absent || 0}</span>
                <span className="text-yellow-600">Late: {counts.late || 0}</span>
                <span className="text-gray-500">Total: {students.length}</span>
              </div>

              <table className="w-full border rounded shadow">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Student</th>
                    <th className="p-2 text-left">Admission No</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr key={student.id} className={`border-t transition-colors ${ROW_HIGHLIGHT[attendance[student.id]] || "hover:bg-gray-50"}`}>
                      <td className="p-2 text-gray-400 text-sm">{index + 1}</td>
                      <td className="p-2 font-medium">{getStudentName(student)}</td>
                      <td className="p-2 text-gray-500 text-sm">{student.admission_number || "-"}</td>
                      <td className="p-2">
                        <div className="flex gap-2 justify-center">
                          {STATUS_OPTIONS.map(({ value, label, active, inactive }) => (
                            <button
                              key={value}
                              onClick={() => handleStatusChange(student.id, value)}
                              className={`px-3 py-1 rounded text-sm transition-all ${
                                attendance[student.id] === value ? `${active} text-white` : inactive
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                onClick={submitAttendance}
                disabled={saving}
                className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save Attendance"}
              </button>
            </>
          )}
        </>
      )}

      {/* ── TAB 2: Student Summary ── */}
      {activeTab === "Student Summary" && (
        <>
          {!selectedClass && (
            <p className="text-gray-500">Select a class to view attendance summary.</p>
          )}

          {loadingSummary && <p className="text-gray-500">Loading summary...</p>}

          {!loadingSummary && summaryData.length > 0 && (
            <table className="w-full border rounded shadow">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Student</th>
                  <th className="p-2 text-center text-green-700">Present</th>
                  <th className="p-2 text-center text-red-600">Absent</th>
                  <th className="p-2 text-center text-yellow-600">Late</th>
                  <th className="p-2 text-center">Total Days</th>
                  <th className="p-2 text-center">Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.map(({ student, present, absent, late, total, rate }, index) => (
                  <tr key={student.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 text-gray-400 text-sm">{index + 1}</td>
                    <td className="p-2 font-medium">{getStudentName(student)}</td>
                    <td className="p-2 text-center text-green-700 font-semibold">{present}</td>
                    <td className="p-2 text-center text-red-600 font-semibold">{absent}</td>
                    <td className="p-2 text-center text-yellow-600 font-semibold">{late}</td>
                    <td className="p-2 text-center text-gray-600">{total}</td>
                    <td className="p-2 text-center">
                      {rate === null ? (
                        <span className="text-gray-400 text-sm">No records</span>
                      ) : (
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getRateBar(rate)}`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className={`text-sm ${getRateColor(rate)}`}>{rate}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loadingSummary && selectedClass && summaryData.length === 0 && (
            <p className="text-gray-500">No attendance records found for this class yet.</p>
          )}
        </>
      )}
    </div>
  );
};

export default Attendance;