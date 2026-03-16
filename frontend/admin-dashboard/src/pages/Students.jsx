import { useEffect, useState, useCallback, useRef } from "react";
import API from "../services/api";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const getStudentName = (s) =>
  s?.student_name ||
  (s?.first_name || s?.last_name
    ? `${s.first_name || ""} ${s.last_name || ""}`.trim()
    : "—");

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
};

const getInitials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

// ─────────────────────────────────────────────
// Small components
// ─────────────────────────────────────────────

const Toast = ({ message, type, onDismiss }) => {
  if (!message) return null;
  const s = type === "error"
    ? "bg-red-50 border-red-200 text-red-700"
    : "bg-emerald-50 border-emerald-200 text-emerald-700";
  return (
    <div className={`mb-4 flex items-center justify-between px-4 py-3 rounded-xl border text-sm ${s}`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-4 opacity-50 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
};

const Avatar = ({ student, size = "md" }) => {
  const name = getStudentName(student);
  const sz = size === "lg"
    ? "w-20 h-20 text-2xl"
    : size === "sm"
    ? "w-8 h-8 text-xs"
    : "w-10 h-10 text-sm";

  if (student.photo) {
    return (
      <img
        src={student.photo}
        alt={name}
        className={`${sz} rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0`}
      />
    );
  }
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm`}>
      {getInitials(name)}
    </div>
  );
};

const StatCard = ({ label, value, color = "text-blue-700" }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 text-center">
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    <p className="text-xs text-gray-400 mt-1">{label}</p>
  </div>
);

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-gray-400">{label}</label>
    {children}
  </div>
);

const inputCls =
  "border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-colors placeholder-gray-300";

// ─────────────────────────────────────────────
// Student detail slide-over panel
// ─────────────────────────────────────────────

const DetailPanel = ({ student, onClose, onEdit }) => {
  const name = getStudentName(student);
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-50 w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-6 py-6 text-white">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest">Student Profile</p>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors text-sm"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-4">
            <Avatar student={student} size="lg" />
            <div>
              <h3 className="font-bold text-xl leading-tight">{name}</h3>
              <p className="text-blue-200 text-xs mt-1 font-mono">{student.admission_number}</p>
              {student.class_name && (
                <span className="inline-block mt-2 bg-white/20 text-white text-xs px-2.5 py-1 rounded-full">
                  {student.class_name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-6 flex-1 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Parent / Guardian", value: student.parent_name },
              { label: "Date of Birth",     value: formatDate(student.date_of_birth) },
              { label: "Email",             value: student.email },
              { label: "Phone",             value: student.phone },
              { label: "Gender",            value: student.gender },
              { label: "Nationality",       value: student.nationality },
              { label: "Religion",          value: student.religion },
              { label: "Previous School",   value: student.previous_school },
            ].map(({ label, value }) =>
              value ? (
                <div key={label}>
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-gray-800">{value}</p>
                </div>
              ) : null
            )}
          </div>

          {student.address && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Address</p>
              <p className="text-sm font-medium text-gray-800">{student.address}</p>
            </div>
          )}

          {student.health_notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-600 mb-1">⚕ Health / Medical Notes</p>
              <p className="text-sm text-amber-800">{student.health_notes}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={() => { onEdit(student); onClose(); }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Edit Student
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Edit modal
// ─────────────────────────────────────────────

const EditModal = ({ student, onClose, onSaved, setError }) => {
  const [form, setForm] = useState({
    parent_name:    student.parent_name    || "",
    date_of_birth:  student.date_of_birth  || "",
    phone:          student.phone          || "",
    address:        student.address        || "",
    gender:         student.gender         || "",
    nationality:    student.nationality    || "",
    religion:       student.religion       || "",
    health_notes:   student.health_notes   || "",
    previous_school: student.previous_school || "",
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await API.put(`/students/${student.id}/`, form);
      onSaved({ ...student, ...form });
      onClose();
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        Object.values(err.response?.data || {}).flat().join(" ") ||
        "Error updating student.";
      setError(detail);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-50 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-800">Edit Student</h3>
            <p className="text-xs text-gray-400 mt-0.5">{getStudentName(student)}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors text-sm">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">

          <Field label="Parent / Guardian Name">
            <input name="parent_name" value={form.parent_name} onChange={handleChange}
              required placeholder="Full name" className={inputCls} />
          </Field>

          <Field label="Date of Birth">
            <input name="date_of_birth" type="date" value={form.date_of_birth}
              onChange={handleChange} required className={inputCls} />
          </Field>

          <Field label="Gender">
            <select name="gender" value={form.gender} onChange={handleChange} className={inputCls}>
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </Field>

          <Field label="Phone">
            <input name="phone" type="tel" value={form.phone} onChange={handleChange}
              placeholder="+233 xx xxx xxxx" className={inputCls} />
          </Field>

          <Field label="Nationality">
            <input name="nationality" value={form.nationality} onChange={handleChange}
              placeholder="e.g. Ghanaian" className={inputCls} />
          </Field>

          <Field label="Religion">
            <select name="religion" value={form.religion} onChange={handleChange} className={inputCls}>
              <option value="">Select</option>
              <option value="Christian">Christian</option>
              <option value="Muslim">Muslim</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </Field>

          <Field label="Previous School">
            <input name="previous_school" value={form.previous_school} onChange={handleChange}
              placeholder="Previous school name" className={inputCls} />
          </Field>

          <Field label="Address">
            <input name="address" value={form.address} onChange={handleChange}
              placeholder="Residential address" className={inputCls} />
          </Field>

          <div className="col-span-2">
            <Field label="Health / Medical Notes">
              <textarea name="health_notes" value={form.health_notes} onChange={handleChange}
                rows={2} placeholder="Allergies, conditions, etc."
                className={inputCls + " resize-none"} />
            </Field>
          </div>

          <div className="col-span-2 flex gap-3 pt-2 border-t border-gray-100">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

const Students = () => {
  const [students, setStudents]           = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editingStudent, setEditingStudent]   = useState(null);
  const [search, setSearch]               = useState("");
  const [filterClass, setFilterClass]     = useState("all");
  const [filterGender, setFilterGender]   = useState("all");
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [success, setSuccess]             = useState("");

  // ── Data ──────────────────────────────────

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/students/");
      setStudents(res.data.results ?? res.data);
    } catch {
      setError("Failed to load students. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const handleDelete = async (id) => {
    if (!window.confirm("Permanently delete this student?")) return;
    setError(""); setSuccess("");
    try {
      await API.delete(`/students/${id}/`);
      setSuccess("Student deleted successfully.");
      if (selectedStudent?.id === id) setSelectedStudent(null);
      if (editingStudent?.id === id) setEditingStudent(null);
      loadStudents();
    } catch {
      setError("Error deleting student.");
    }
  };

  const handleSaved = (updated) => {
    setStudents((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    if (selectedStudent?.id === updated.id) setSelectedStudent(updated);
    setSuccess("Student updated successfully.");
  };

  // ── Derived ────────────────────────────────

  const classes = [...new Set(students.map((s) => s.class_name).filter(Boolean))].sort();

  const filtered = students.filter((s) => {
    const term = search.toLowerCase();
    const matchSearch =
      !search ||
      getStudentName(s).toLowerCase().includes(term) ||
      (s.admission_number ?? "").toLowerCase().includes(term) ||
      (s.parent_name ?? "").toLowerCase().includes(term);
    const matchClass  = filterClass  === "all" || s.class_name  === filterClass;
    const matchGender = filterGender === "all" || s.gender      === filterGender;
    return matchSearch && matchClass && matchGender;
  });

  const stats = {
    total:  students.length,
    male:   students.filter((s) => s.gender === "Male").length,
    female: students.filter((s) => s.gender === "Female").length,
    classes: classes.length,
  };

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Student Management</h2>
          <p className="text-sm text-gray-400 mt-0.5">View and manage enrolled students</p>
        </div>
      </div>

      <Toast message={error}   type="error"   onDismiss={() => setError("")}   />
      <Toast message={success} type="success" onDismiss={() => setSuccess("")} />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Students" value={stats.total}   color="text-blue-700"   />
        <StatCard label="Male"           value={stats.male}    color="text-sky-600"    />
        <StatCard label="Female"         value={stats.female}  color="text-pink-600"   />
        <StatCard label="Classes"        value={stats.classes} color="text-violet-600" />
      </div>

      {/* ── Search & filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4 flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-400 block mb-1">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, admission no., parent…"
            className={inputCls + " w-full"}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1">Class</label>
          <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
            className={inputCls}>
            <option value="all">All classes</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1">Gender</label>
          <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}
            className={inputCls}>
            <option value="all">All genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        {(search || filterClass !== "all" || filterGender !== "all") && (
          <button
            onClick={() => { setSearch(""); setFilterClass("all"); setFilterGender("all"); }}
            className="text-xs text-blue-500 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Clear
          </button>
        )}

        <span className="text-xs text-gray-400 ml-auto self-center">
          {filtered.length} of {students.length} shown
        </span>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-14 text-gray-400">
            <p className="text-3xl mb-2">⏳</p>
            <p className="text-sm">Loading students…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <p className="text-3xl mb-2">🎓</p>
            <p className="text-sm">No students match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium">Student</th>
                  <th className="px-4 py-3 text-left font-medium">Admission No.</th>
                  <th className="px-4 py-3 text-left font-medium">Class</th>
                  <th className="px-4 py-3 text-left font-medium">Gender</th>
                  <th className="px-4 py-3 text-left font-medium">Parent / Guardian</th>
                  <th className="px-4 py-3 text-left font-medium">Date of Birth</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((student) => {
                  const name      = getStudentName(student);
                  const isActive  = selectedStudent?.id === student.id;

                  return (
                    <tr
                      key={student.id}
                      onClick={() => setSelectedStudent(isActive ? null : student)}
                      className={`hover:bg-blue-50/20 transition-colors cursor-pointer ${
                        isActive ? "bg-blue-50/40" : ""
                      }`}
                    >
                      {/* Student */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar student={student} size="sm" />
                          <span className="font-medium text-gray-800">{name}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {student.admission_number ?? "—"}
                      </td>

                      <td className="px-4 py-3 text-gray-600">
                        {student.class_name ?? "—"}
                      </td>

                      <td className="px-4 py-3">
                        {student.gender ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${
                            student.gender === "Male"
                              ? "bg-sky-50 text-sky-700 ring-sky-200"
                              : "bg-pink-50 text-pink-700 ring-pink-200"
                          }`}>
                            {student.gender === "Male" ? "♂" : "♀"} {student.gender}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-gray-600">
                        {student.parent_name ?? "—"}
                      </td>

                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(student.date_of_birth)}
                      </td>

                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedStudent(isActive ? null : student)}
                            className="bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-gray-100 hover:border-blue-200"
                          >
                            View
                          </button>
                          <button
                            onClick={() => setEditingStudent(student)}
                            className="bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-blue-100 hover:border-blue-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(student.id)}
                            className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-red-100 hover:border-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail slide-over ── */}
      {selectedStudent && (
        <DetailPanel
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onEdit={setEditingStudent}
        />
      )}

      {/* ── Edit modal ── */}
      {editingStudent && (
        <EditModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSaved={handleSaved}
          setError={setError}
        />
      )}

    </div>
  );
};

export default Students;