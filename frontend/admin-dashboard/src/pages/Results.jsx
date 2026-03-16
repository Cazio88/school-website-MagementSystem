import React, { useEffect, useState, useCallback } from "react";
import API from "../services/api";


const TERMS = [
  { value: "term1", label: "Term 1" },
  { value: "term2", label: "Term 2" },
  { value: "term3", label: "Term 3" },
];

// Covers all three grading systems
const GRADE_REMARK = {
  // Basic 7-9
  "1": { label: "HIGHEST",      bg: "bg-green-100   text-green-800"   },
  "2": { label: "HIGHER",       bg: "bg-emerald-100 text-emerald-800" },
  "3": { label: "HIGH",         bg: "bg-blue-100    text-blue-800"    },
  "4": { label: "HIGH AVERAGE", bg: "bg-cyan-100    text-cyan-800"    },
  "5": { label: "AVERAGE",      bg: "bg-yellow-100  text-yellow-800"  },
  "6": { label: "LOW AVERAGE",  bg: "bg-orange-100  text-orange-800"  },
  "7": { label: "LOW",          bg: "bg-red-100     text-red-700"     },
  "8": { label: "LOWER",        bg: "bg-red-200     text-red-800"     },
  "9": { label: "LOWEST",       bg: "bg-red-300     text-red-900"     },
  // Basic 1-6 and Nursery/KG
  "A":  { label: "EXCELLENT",      bg: "bg-green-100   text-green-800"   },
  "B":  { label: "VERY GOOD",      bg: "bg-emerald-100 text-emerald-800" },
  "C":  { label: "GOOD",           bg: "bg-blue-100    text-blue-800"    },
  "D":  { label: "HIGH AVERAGE",   bg: "bg-cyan-100    text-cyan-800"    },
  "E2": { label: "BELOW AVERAGE",  bg: "bg-orange-100  text-orange-800"  },
  "E3": { label: "LOW",            bg: "bg-red-100     text-red-700"     },
  "E4": { label: "LOWER",          bg: "bg-red-200     text-red-800"     },
  "E5": { label: "LOWEST",         bg: "bg-red-300     text-red-900"     },
};

const GRADE_SCALE_B79 = "90-100: 1 HIGHEST | 80-89: 2 HIGHER | 60-79: 3 HIGH | 55-59: 4 HIGH AVERAGE | 50-54: 5 AVERAGE | 45-49: 6 LOW AVERAGE | 40-44: 7 LOW | 35-39: 8 LOWER | 0-34: 9 LOWEST";
const GRADE_SCALE_B16 = "90-100: A EXCELLENT | 80-89: B VERY GOOD | 60-79: C GOOD | 55-59: D HIGH AVERAGE | 45-49: E2 BELOW AVERAGE | 40-44: E3 LOW | 35-39: E4 LOWER | 0-34: E5 LOWEST";

const computeScore = (reopen, ca, exams) => {
  const r = parseFloat(reopen) || 0;
  const c = parseFloat(ca)     || 0;
  const e = parseFloat(exams)  || 0;
  return Math.round((r + c + e) * 10) / 10;
};

const computeGrade = (score, level = "basic_7_9") => {
  if (level === "basic_7_9") {
    if (score >= 90) return "1";
    if (score >= 80) return "2";
    if (score >= 60) return "3";
    if (score >= 55) return "4";
    if (score >= 50) return "5";
    if (score >= 45) return "6";
    if (score >= 40) return "7";
    if (score >= 35) return "8";
    return "9";
  }
  // basic_1_6 and nursery_kg
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 60) return "C";
  if (score >= 55) return "D";
  if (score >= 45) return "E2";
  if (score >= 40) return "E3";
  if (score >= 35) return "E4";
  return "E5";
};

const getStudentName = (s) =>
  s?.student_name ||
  (s?.first_name ? `${s.first_name} ${s.last_name || ""}`.trim() : null) ||
  s?.admission_number ||
  "Unknown";

const TABS = ["Enter Results", "Class Summary"];

const Results = () => {
  const [tab, setTab]                         = useState("Enter Results");
  const [classes, setClasses]                 = useState([]);
  const [subjects, setSubjects]               = useState([]);
  const [students, setStudents]               = useState([]);
  const [selectedClass, setSelectedClass]     = useState("");
  const [selectedTerm, setSelectedTerm]       = useState("term1");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [classLevel, setClassLevel]           = useState("basic_7_9");
  const [scores, setScores]                   = useState({});
  const [saving, setSaving]                   = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState("");
  const [success, setSuccess]                 = useState("");
  const [summary, setSummary]                 = useState([]);
  const [loadingSummary, setLoadingSummary]   = useState(false);
  const [expandedStudent, setExpandedStudent] = useState(null);

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const fetchClasses = async () => {
    try {
      const r = await API.get("/classes/");
      setClasses(r.data.results || r.data);
    } catch {
      setError("Failed to load classes.");
    }
  };

  const fetchSubjects = async () => {
    try {
      const r = await API.get("/subjects/");
      setSubjects(r.data.results || r.data);
    } catch {
      setError("Failed to load subjects.");
    }
  };

  const fetchStudents = useCallback(async (classId) => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get(`/students/?school_class=${classId}`);
      setStudents(res.data.results || res.data);
    } catch {
      setError("Failed to load students.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExistingScores = useCallback(async () => {
    if (!selectedClass || !selectedTerm || !selectedSubject) return;
    try {
      const res = await API.get(
        `/results/?school_class=${selectedClass}&term=${selectedTerm}&subject=${selectedSubject}`
      );
      const records = res.data.results || res.data;
      const map = {};
      records.forEach((r) => {
        map[r.student] = { reopen: r.reopen, ca: r.ca, exams: r.exams };
      });
      setScores((prev) => {
        const next = { ...prev };
        students.forEach((s) => {
          if (!next[s.id]) {
            next[s.id] = map[s.id] || { reopen: "", ca: "", exams: "" };
          }
        });
        return next;
      });
    } catch {
      // non-fatal
    }
  }, [selectedClass, selectedTerm, selectedSubject, students]);

  const fetchSummary = useCallback(async () => {
    if (!selectedClass || !selectedTerm) return;
    setLoadingSummary(true);
    setError("");
    try {
      const res = await API.get(
        `/results/summary/?school_class=${selectedClass}&term=${selectedTerm}`
      );
      setSummary(res.data);
    } catch {
      setError("Failed to load summary.");
    } finally {
      setLoadingSummary(false);
    }
  }, [selectedClass, selectedTerm]);

  // ------------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------------

  useEffect(() => {
    fetchClasses();
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (selectedClass) fetchStudents(selectedClass);
  }, [selectedClass, fetchStudents]);

  useEffect(() => {
    if (selectedClass && selectedSubject && selectedTerm) loadExistingScores();
  }, [selectedClass, selectedSubject, selectedTerm, loadExistingScores]);

  useEffect(() => {
    if (tab === "Class Summary") fetchSummary();
  }, [tab, fetchSummary]);

  useEffect(() => {
    setError("");
    setSuccess("");
  }, [selectedClass, selectedTerm, selectedSubject, tab]);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handleClassChange = (e) => {
    const classId = e.target.value;
    setSelectedClass(classId);
    setScores({});
    setStudents([]);
    setSummary([]);
    setExpandedStudent(null);
    // Store the level of the selected class for grade computation
    const found = classes.find((c) => String(c.id) === String(classId));
    setClassLevel(found?.level || "basic_7_9");
  };

  const handleScoreChange = (studentId, field, value) => {
    const max     = field === "reopen" ? 20 : 40;
    const clamped = value === ""
      ? ""
      : Math.min(max, Math.max(0, parseFloat(value) || 0));
    setScores((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: clamped },
    }));
  };

  const submitResults = async () => {
    setError("");
    setSuccess("");
    if (!selectedClass || !selectedTerm || !selectedSubject) {
      setError("Please select class, term, and subject.");
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
    try {
      const res = await API.post("/results/bulk/", records);
      setSuccess(
        `Saved ${res.data.saved} result(s).` +
        (res.data.errors?.length ? ` ${res.data.errors.length} error(s).` : "")
      );
    } catch (err) {
      setError(err.response?.data?.detail || "Error saving results.");
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Derived state
  // ------------------------------------------------------------------

  const filledCount = Object.values(scores).filter(
    (v) => v?.reopen !== "" || v?.ca !== "" || v?.exams !== ""
  ).length;

  const gradeScale = classLevel === "basic_7_9" ? GRADE_SCALE_B79 : GRADE_SCALE_B16;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Results</h1>

      {error   && <div className="mb-4 p-3 bg-red-100   text-red-700   border border-red-300   rounded">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded">{success}</div>}

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select value={selectedClass} onChange={handleClassChange}
          className="border p-2 rounded min-w-[150px]">
          <option value="">Select Class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
          className="border p-2 rounded">
          {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {tab === "Enter Results" && (
          <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}
            className="border p-2 rounded min-w-[150px]">
            <option value="">Select Subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Tabs */}
      {selectedClass && (
        <div className="flex border-b mb-6">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* ── TAB 1: Enter Results ── */}
      {tab === "Enter Results" && (
        <>
          {loading && <p className="text-gray-500">Loading students...</p>}

          {!loading && selectedClass && !selectedSubject && (
            <p className="text-gray-400 italic">Select a subject to enter scores.</p>
          )}

          {!loading && selectedClass && selectedSubject && students.length === 0 && (
            <p className="text-red-500">No students found for this class.</p>
          )}

          {!loading && students.length > 0 && selectedSubject && (
            <>
              <div className="text-sm text-gray-500 mb-3">
                {filledCount} of {students.length} students filled
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border rounded shadow text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Student</th>
                      <th className="p-2 text-center text-blue-700">
                        RE-OPEN/RDA<br />
                        <span className="font-normal text-xs text-gray-400">20%</span>
                      </th>
                      <th className="p-2 text-center text-blue-700">
                        CA/MGT<br />
                        <span className="font-normal text-xs text-gray-400">40%</span>
                      </th>
                      <th className="p-2 text-center text-blue-700">
                        EXAMS<br />
                        <span className="font-normal text-xs text-gray-400">40%</span>
                      </th>
                      <th className="p-2 text-center font-bold">
                        TOTAL<br />
                        <span className="font-normal text-xs text-gray-400">100%</span>
                      </th>
                      <th className="p-2 text-center">GRADE</th>
                      <th className="p-2 text-center">REMARK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, i) => {
                      const s     = scores[student.id] || { reopen: "", ca: "", exams: "" };
                      const dirty = s.reopen !== "" || s.ca !== "" || s.exams !== "";
                      const total = computeScore(s.reopen, s.ca, s.exams);
                      const grade = dirty ? computeGrade(total, classLevel) : null;
                      const info  = grade ? GRADE_REMARK[grade] : null;

                      return (
                        <tr key={student.id} className="border-t hover:bg-gray-50">
                          <td className="p-2 text-gray-400">{i + 1}</td>
                          <td className="p-2 font-medium">{getStudentName(student)}</td>

                          {["reopen", "ca", "exams"].map((field) => (
                            <td key={field} className="p-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max={field === "reopen" ? 20 : 40}
                                step="0.5"
                                value={s[field]}
                                placeholder="0"
                                onChange={(e) => handleScoreChange(student.id, field, e.target.value)}
                                className="w-16 border rounded p-1 text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            </td>
                          ))}

                          <td className="p-2 text-center font-bold text-blue-700">
                            {dirty ? total : "—"}
                          </td>
                          <td className="p-2 text-center">
                            {grade
                              ? <span className={`px-2 py-0.5 rounded text-xs font-bold ${info?.bg}`}>{grade}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="p-2 text-center">
                            {info
                              ? <span className={`px-2 py-0.5 rounded text-xs ${info?.bg}`}>{info?.label}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Grade scale — shows correct scale for the selected class level */}
              <div className="mt-4 p-3 bg-gray-50 rounded border text-xs text-gray-500">
                <span className="font-semibold text-gray-700 mr-2">Grade Scale:</span>
                {gradeScale.split(" | ").map((item, i) => (
                  <span key={i}>{item}{i < gradeScale.split(" | ").length - 1 ? " \u00a0|\u00a0 " : ""}</span>
                ))}
              </div>

              <button
                onClick={submitResults}
                disabled={saving || filledCount === 0}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : `Save ${filledCount} Result${filledCount !== 1 ? "s" : ""}`}
              </button>
            </>
          )}
        </>
      )}

      {/* ── TAB 2: Class Summary ── */}
      {tab === "Class Summary" && (
        <>
          {!selectedClass && (
            <p className="text-gray-500">Select a class to view results summary.</p>
          )}
          {loadingSummary && <p className="text-gray-500">Loading summary...</p>}

          {!loadingSummary && summary.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border rounded shadow text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-center">Rank</th>
                    <th className="p-2 text-left">Student</th>
                    <th className="p-2 text-center">Subjects</th>
                    <th className="p-2 text-center">Total Score</th>
                    <th className="p-2 text-center">Average</th>
                    <th className="p-2 text-center">Grade</th>
                    <th className="p-2 text-center">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    // fix: key on Fragment so React can track both rows
                    <React.Fragment key={row.student_id}>
                      <tr
                        className="border-t hover:bg-gray-50 cursor-pointer"
                        onClick={() =>
                          setExpandedStudent(
                            expandedStudent === row.student_id ? null : row.student_id
                          )
                        }
                      >
                        <td className="p-2 text-center">
                          <span className={`font-bold ${
                            row.rank === 1 ? "text-yellow-500" :
                            row.rank === 2 ? "text-gray-400"   :
                            row.rank === 3 ? "text-orange-400" :
                                            "text-gray-500"
                          }`}>
                            #{row.rank}
                          </span>
                        </td>
                        <td className="p-2 font-medium">
                          <div>{row.student_name}</div>
                          <div className="text-xs text-gray-400">{row.admission_number}</div>
                        </td>
                        <td className="p-2 text-center text-gray-600">{row.subject_count}</td>
                        <td className="p-2 text-center font-semibold">{row.total_score}</td>
                        <td className="p-2 text-center">{row.average_score}</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${GRADE_REMARK[row.overall_grade]?.bg || "bg-gray-100 text-gray-600"}`}>
                            {row.overall_grade}
                          </span>
                        </td>
                        <td className="p-2 text-center text-blue-500 text-xs">
                          {expandedStudent === row.student_id ? "▲ Hide" : "▼ Show"}
                        </td>
                      </tr>

                      {expandedStudent === row.student_id && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="p-4">
                            <table className="w-full text-xs border rounded">
                              <thead className="bg-blue-50">
                                <tr>
                                  <th className="p-1 text-left">Subject</th>
                                  <th className="p-1 text-center">RE-OPEN</th>
                                  <th className="p-1 text-center">CA/MGT</th>
                                  <th className="p-1 text-center">EXAMS</th>
                                  <th className="p-1 text-center font-bold">TOTAL</th>
                                  <th className="p-1 text-center">POS</th>
                                  <th className="p-1 text-center">GRADE</th>
                                  <th className="p-1 text-center">REMARK</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.subjects.map((sub) => (
                                  <tr key={sub.subject_id} className="border-t">
                                    <td className="p-1 font-medium">{sub.subject_name}</td>
                                    <td className="p-1 text-center">{sub.reopen ?? "—"}</td>
                                    <td className="p-1 text-center">{sub.ca     ?? "—"}</td>
                                    <td className="p-1 text-center">{sub.exams  ?? "—"}</td>
                                    <td className="p1 text-center font-bold text-blue-700">{sub.score ?? "—"}</td>
                                    <td className="p-1 text-center">{sub.subject_position ?? "—"}</td>
                                    <td className="p-1 text-center">
                                      <span className={`px-1 rounded text-xs font-bold ${GRADE_REMARK[sub.grade]?.bg || "bg-gray-100 text-gray-600"}`}>
                                        {sub.grade ?? "—"}
                                      </span>
                                    </td>
                                    <td className="p-1 text-center">
                                      <span className={`px-1 rounded text-xs ${GRADE_REMARK[sub.grade]?.bg || ""}`}>
                                        {sub.remark ?? "—"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loadingSummary && selectedClass && summary.length === 0 && (
            <p className="text-gray-500">No results found for this class and term.</p>
          )}
        </>
      )}
    </div>
  );
};

export default Results;