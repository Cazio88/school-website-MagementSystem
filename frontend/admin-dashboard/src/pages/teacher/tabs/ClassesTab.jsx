import React from "react";

const ClassesTab = ({ students = [], loading = false, selectedClassName = "", selectedTerm = "" }) => {
  if (loading) return <div className="p-4">Loading students…</div>;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <h3 className="font-semibold text-slate-800 mb-3">{selectedClassName || "Class"} — {selectedTerm}</h3>
      {students.length === 0 ? (
        <div className="text-sm text-slate-500">No students in this class.</div>
      ) : (
        <ul className="text-sm text-slate-700 space-y-2">
          {students.map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <span>{s.student_name || s.name || `Student ${s.id}`}</span>
              <span className="text-xs text-slate-400">ID: {s.id}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ClassesTab;
