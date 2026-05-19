import React from "react";

const ReportsTab = ({ students = [], selectedClassName = "", selectedClass = "", selectedTerm = "", selectedYear = "" }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <h3 className="font-semibold text-slate-800 mb-3">Reports — {selectedClassName}</h3>

      <div className="text-sm text-slate-500 mb-3">Term: {selectedTerm} · Year: {selectedYear}</div>

      {students.length === 0 ? (
        <div className="text-sm text-slate-500">No students to generate reports for.</div>
      ) : (
        <ul className="text-sm space-y-2">
          {students.map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <span>{s.student_name || s.name}</span>
              <a href={`#reports-${s.id}`} className="text-xs text-blue-600">View report</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReportsTab;
