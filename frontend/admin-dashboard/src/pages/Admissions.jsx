import { useEffect, useState, useRef, useCallback } from "react";
import API from "../services/api";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const EMPTY_FORM = {
  first_name:    "",
  last_name:     "",
  gender:        "",
  date_of_birth: "",
  nationality:   "",
  religion:      "",
  parent_name:   "",
  parent_gender: "",
  relationship:  "",
  email:         "",
  phone:         "",
  alt_phone:     "",
  address:       "",
  applied_class: "",
  previous_school: "",
  health_notes:  "",
  photo:         null,
};

const GENDERS       = ["Male", "Female"];
const RELATIONSHIPS = ["Father", "Mother", "Guardian", "Other"];
const RELIGIONS     = ["Christian", "Muslim", "Other", "Prefer not to say"];

const STATUS_STYLES = {
  pending:  { pill: "bg-amber-50  text-amber-700  ring-amber-200",  dot: "bg-amber-400",  label: "Pending"  },
  approved: { pill: "bg-green-50  text-green-700  ring-green-200",  dot: "bg-green-500",  label: "Approved" },
  rejected: { pill: "bg-red-50    text-red-700    ring-red-200",    dot: "bg-red-500",    label: "Rejected" },
};

// ─────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────

const Field = ({ label, required, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-gray-500">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls =
  "border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-colors placeholder-gray-300";

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

const StatusPill = ({ status }) => {
  const st = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${st.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
      {st.label}
    </span>
  );
};

const SectionHeading = ({ icon, title }) => (
  <div className="flex items-center gap-2 col-span-full mt-2 mb-1">
    <span className="text-base">{icon}</span>
    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</p>
    <div className="flex-1 h-px bg-gray-100" />
  </div>
);

const StatCard = ({ label, value, color = "text-blue-700" }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 text-center">
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    <p className="text-xs text-gray-400 mt-1">{label}</p>
  </div>
);

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

const Admissions = () => {
  const [admissions, setAdmissions] = useState([]);
  const [classes, setClasses]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [showForm, setShowForm]     = useState(false);

  // Search / filter
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClass, setFilterClass]   = useState("all");

  // Expanded row for detail view
  const [expandedId, setExpandedId] = useState(null);

  const [form, setForm]       = useState(EMPTY_FORM);
  const fileInputRef          = useRef(null);
  const photoPreviewUrl       = useRef(null);

  // ─────────────────────────────────────
  // Data fetching
  // ─────────────────────────────────────

  const loadAdmissions = useCallback(async () => {
    try {
      const res = await API.get("/admissions/");
      setAdmissions(res.data.results ?? res.data);
    } catch {
      setError("Failed to load admissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClasses = useCallback(async () => {
    try {
      const res = await API.get("/classes/");
      setClasses(res.data.results ?? res.data);
    } catch {}
  }, []);

  useEffect(() => {
    loadAdmissions();
    loadClasses();
  }, [loadAdmissions, loadClasses]);

  // Revoke object URL on unmount / photo change
  useEffect(() => {
    return () => {
      if (photoPreviewUrl.current) URL.revokeObjectURL(photoPreviewUrl.current);
    };
  }, [form.photo]);

  // ─────────────────────────────────────
  // Form handlers
  // ─────────────────────────────────────

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "photo") {
      if (photoPreviewUrl.current) URL.revokeObjectURL(photoPreviewUrl.current);
      const file = files[0] ?? null;
      photoPreviewUrl.current = file ? URL.createObjectURL(file) : null;
      setForm((p) => ({ ...p, photo: file }));
    } else {
      setForm((p) => ({ ...p, [name]: value }));
    }
  };

  const resetForm = () => {
    if (photoPreviewUrl.current) {
      URL.revokeObjectURL(photoPreviewUrl.current);
      photoPreviewUrl.current = null;
    }
    setForm(EMPTY_FORM);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submitAdmission = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const fd = new FormData();
      const fields = [
        "first_name", "last_name", "gender", "date_of_birth",
        "nationality", "religion", "parent_name", "parent_gender",
        "relationship", "email", "phone", "alt_phone",
        "address", "applied_class", "previous_school", "health_notes",
      ];
      fields.forEach((f) => fd.append(f, form[f] ?? ""));
      fd.append("student_name", `${form.first_name.trim()} ${form.last_name.trim()}`);
      if (form.photo) fd.append("photo", form.photo);

      await API.post("/admissions/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccess("Admission submitted successfully!");
      resetForm();
      setShowForm(false);
      loadAdmissions();
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        Object.values(err.response?.data || {}).flat().join(" ") ||
        "Error submitting admission.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────
  // Actions
  // ─────────────────────────────────────

  const approveAdmission = async (admission) => {
    setError(""); setSuccess("");
    try {
      await API.patch(`/admissions/${admission.id}/`, { status: "approved" });
      setSuccess("Admission approved — student account created.");
      loadAdmissions();
    } catch { setError("Error approving admission."); }
  };

  const rejectAdmission = async (admission) => {
    setError("");
    try {
      await API.patch(`/admissions/${admission.id}/`, { status: "rejected" });
      loadAdmissions();
    } catch { setError("Error rejecting admission."); }
  };

  const deleteAdmission = async (id) => {
    if (!window.confirm("Permanently delete this application?")) return;
    setError(""); setSuccess("");
    try {
      await API.delete(`/admissions/${id}/`);
      setSuccess("Admission deleted.");
      if (expandedId === id) setExpandedId(null);
      loadAdmissions();
    } catch { setError("Error deleting admission."); }
  };

  // ─────────────────────────────────────
  // Derived / filtered list
  // ─────────────────────────────────────

  const filtered = admissions.filter((a) => {
    const name = a.first_name && a.last_name
      ? `${a.first_name} ${a.last_name}`
      : a.student_name ?? "";
    const matchSearch =
      !search ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      (a.admission_number ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (a.parent_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    const matchClass  = filterClass  === "all" || String(a.applied_class) === String(filterClass);
    return matchSearch && matchStatus && matchClass;
  });

  const stats = {
    total:    admissions.length,
    pending:  admissions.filter((a) => a.status === "pending").length,
    approved: admissions.filter((a) => a.status === "approved").length,
    rejected: admissions.filter((a) => a.status === "rejected").length,
  };

  const previewSrc = photoPreviewUrl.current;

  // ─────────────────────────────────────
  // Render
  // ─────────────────────────────────────

  if (loading) return (
    <div className="p-8 text-center text-gray-400">
      <p className="text-3xl mb-2">📋</p>
      <p className="text-sm">Loading admissions…</p>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Student Admissions</h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage applications and enrolments</p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setError(""); setSuccess(""); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-all ${
            showForm
              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {showForm ? "✕ Cancel" : "+ New Application"}
        </button>
      </div>

      <Toast message={error}   type="error"   onDismiss={() => setError("")}   />
      <Toast message={success} type="success" onDismiss={() => setSuccess("")} />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Applications" value={stats.total}    color="text-blue-700"   />
        <StatCard label="Pending"             value={stats.pending}  color="text-amber-600"  />
        <StatCard label="Approved"            value={stats.approved} color="text-green-600"  />
        <StatCard label="Rejected"            value={stats.rejected} color="text-red-600"    />
      </div>

      {/* ── Application form ── */}
      {showForm && (
        <form
          onSubmit={submitAdmission}
          encType="multipart/form-data"
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6"
        >
          <h3 className="font-bold text-gray-700 mb-5 text-base">New Application</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* ── Student information ── */}
            <SectionHeading icon="🎓" title="Student Information" />

            <Field label="First Name" required>
              <input name="first_name" placeholder="e.g. Kwame" value={form.first_name}
                onChange={handleChange} required className={inputCls} />
            </Field>

            <Field label="Last Name" required>
              <input name="last_name" placeholder="e.g. Mensah" value={form.last_name}
                onChange={handleChange} required className={inputCls} />
            </Field>

            <Field label="Gender" required>
              <select name="gender" value={form.gender} onChange={handleChange} required className={inputCls}>
                <option value="">Select gender</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>

            <Field label="Date of Birth" required>
              <input name="date_of_birth" type="date" value={form.date_of_birth}
                onChange={handleChange} required className={inputCls} />
            </Field>

            <Field label="Nationality">
              <input name="nationality" placeholder="e.g. Ghanaian" value={form.nationality}
                onChange={handleChange} className={inputCls} />
            </Field>

            <Field label="Religion">
              <select name="religion" value={form.religion} onChange={handleChange} className={inputCls}>
                <option value="">Select religion</option>
                {RELIGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>

            <Field label="Applying for Class" required>
              <select name="applied_class" value={form.applied_class}
                onChange={handleChange} required className={inputCls}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            <Field label="Previous School">
              <input name="previous_school" placeholder="Previous school name (if any)"
                value={form.previous_school} onChange={handleChange} className={inputCls} />
            </Field>

            <Field label="Health / Medical Notes">
              <input name="health_notes" placeholder="Allergies, conditions, etc."
                value={form.health_notes} onChange={handleChange} className={inputCls} />
            </Field>

            {/* ── Parent / Guardian ── */}
            <SectionHeading icon="👨‍👩‍👧" title="Parent / Guardian" />

            <Field label="Parent / Guardian Name" required>
              <input name="parent_name" placeholder="Full name" value={form.parent_name}
                onChange={handleChange} required className={inputCls} />
            </Field>

            <Field label="Gender">
              <select name="parent_gender" value={form.parent_gender}
                onChange={handleChange} className={inputCls}>
                <option value="">Select gender</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>

            <Field label="Relationship to Student">
              <select name="relationship" value={form.relationship}
                onChange={handleChange} className={inputCls}>
                <option value="">Select relationship</option>
                {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>

            <Field label="Email Address" required>
              <input name="email" type="email" placeholder="parent@email.com"
                value={form.email} onChange={handleChange} required className={inputCls} />
            </Field>

            <Field label="Primary Phone" required>
              <input name="phone" type="tel" placeholder="+233 xx xxx xxxx"
                value={form.phone} onChange={handleChange} required className={inputCls} />
            </Field>

            <Field label="Alternative Phone">
              <input name="alt_phone" type="tel" placeholder="+233 xx xxx xxxx"
                value={form.alt_phone} onChange={handleChange} className={inputCls} />
            </Field>

            <Field label="Residential Address" required>
              <input name="address" placeholder="House / street / area"
                value={form.address} onChange={handleChange} required className={inputCls} />
            </Field>

            {/* ── Photo ── */}
            <SectionHeading icon="📷" title="Student Photo" />

            <div className="col-span-full flex items-center gap-4">
              <div className="flex-1">
                <Field label="Upload Photo (optional)">
                  <input ref={fileInputRef} type="file" name="photo" accept="image/*"
                    onChange={handleChange}
                    className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm w-full file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs file:font-medium hover:file:bg-blue-100 cursor-pointer" />
                </Field>
              </div>
              {previewSrc ? (
                <img src={previewSrc} alt="Preview"
                  className="w-20 h-20 rounded-xl object-cover border-2 border-blue-100 shadow-sm flex-shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 flex-shrink-0">
                  <span className="text-2xl">👤</span>
                </div>
              )}
            </div>

          </div>

          {/* Form actions */}
          <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100">
            <button type="submit" disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm">
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
            <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Search & filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4 flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-medium text-gray-400 block mb-1">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, admission no., parent…"
            className={inputCls + " w-full"}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1">Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className={inputCls}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1">Class</label>
          <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
            className={inputCls}>
            <option value="all">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {(search || filterStatus !== "all" || filterClass !== "all") && (
          <button
            onClick={() => { setSearch(""); setFilterStatus("all"); setFilterClass("all"); }}
            className="text-xs text-blue-500 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto self-center">
          {filtered.length} of {admissions.length} shown
        </span>
      </div>

      {/* ── Admissions table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm">No applications match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium">Admission ID</th>
                  <th className="px-4 py-3 text-left font-medium">Student</th>
                  <th className="px-4 py-3 text-left font-medium">Gender</th>
                  <th className="px-4 py-3 text-left font-medium">Parent / Guardian</th>
                  <th className="px-4 py-3 text-left font-medium">Class</th>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((a) => {
                  const studentName = a.first_name && a.last_name
                    ? `${a.first_name} ${a.last_name}`
                    : a.student_name ?? "—";
                  const isExpanded = expandedId === a.id;

                  return (
                    <>
                      <tr
                        key={a.id}
                        className="hover:bg-blue-50/20 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {a.admission_number ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {a.photo ? (
                              <img src={a.photo} alt=""
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-100" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                                {studentName[0]}
                              </div>
                            )}
                            <span className="font-medium text-gray-800">{studentName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{a.gender ?? "—"}</td>
                        <td className="px-4 py-3">
                          <p className="text-gray-800">{a.parent_name ?? "—"}</p>
                          {a.relationship && (
                            <p className="text-xs text-gray-400">{a.relationship}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {a.applied_class_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{a.phone ?? "—"}</td>
                        <td className="px-4 py-3">
                          <StatusPill status={a.status} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {a.status === "pending" && (
                              <>
                                <button
                                  onClick={() => approveAdmission(a)}
                                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => rejectAdmission(a)}
                                  className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => deleteAdmission(a.id)}
                              className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-red-100 hover:border-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded detail row ── */}
                      {isExpanded && (
                        <tr key={`${a.id}-detail`} className="bg-slate-50/60">
                          <td colSpan={8} className="px-6 py-5">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">

                              <div>
                                <p className="text-xs text-gray-400 mb-0.5">Date of Birth</p>
                                <p className="font-medium text-gray-700">{a.date_of_birth ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-0.5">Nationality</p>
                                <p className="font-medium text-gray-700">{a.nationality ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-0.5">Religion</p>
                                <p className="font-medium text-gray-700">{a.religion ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-0.5">Email</p>
                                <p className="font-medium text-gray-700 break-all">{a.email ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-0.5">Alt. Phone</p>
                                <p className="font-medium text-gray-700">{a.alt_phone ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-0.5">Address</p>
                                <p className="font-medium text-gray-700">{a.address ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-0.5">Previous School</p>
                                <p className="font-medium text-gray-700">{a.previous_school ?? "—"}</p>
                              </div>
                              {a.health_notes && (
                                <div className="col-span-2">
                                  <p className="text-xs text-gray-400 mb-0.5">Health / Medical Notes</p>
                                  <p className="font-medium text-gray-700">{a.health_notes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admissions;