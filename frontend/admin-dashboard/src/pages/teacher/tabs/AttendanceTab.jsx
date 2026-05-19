import React from "react";

const AttendanceTab = ({ students = [], loading = false, selectedClassName = "", attDate = "", attendance = {}, saving = false, onToggle = () => {}, onSave = () => {} }) => {
  if (loading) return <div className="p-4">Loading attendance…</div>;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800">Attendance — {selectedClassName}</h3>
        <div className="text-sm text-slate-500">Date: {attDate}</div>
      </div>

      {students.length === 0 ? (
        <div className="text-sm text-slate-500">No students to mark attendance for.</div>
      ) : (
        <ul className="space-y-2 text-sm">
          {students.map((s) => {
            const present = attendance?.[s.id] ?? false;
            return (
              <li key={s.id} className="flex items-center justify-between">
                <span>{s.student_name || s.name}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!present} onChange={() => onToggle(s.id)} />
                  <span className="text-xs text-slate-500">Present</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4">
        <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          {saving ? "Saving…" : "Save Attendance"}
        </button>
      </div>
    </div>
  );
};

export default AttendanceTab;
