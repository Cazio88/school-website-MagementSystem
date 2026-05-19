import React from "react";

const CharacterTab = ({ students = [], selectedClassName = "", selectedTerm = "", selectedYear = "", charAssess = {} }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <h3 className="font-semibold text-slate-800 mb-3">Character Assessment — {selectedClassName}</h3>

      {students.length === 0 ? (
        <div className="text-sm text-slate-500">No students available.</div>
      ) : (
        <ul className="space-y-2 text-sm">
          {students.map((s) => {
            const forms = charAssess?.charForms?.[s.id] ?? null;
            const filled = forms ? Object.values(forms.areas ?? {}).filter((a) => a.score !== "").length : 0;
            return (
              <li key={s.id} className="flex items-center justify-between">
                <span>{s.student_name || s.name}</span>
                <span className="text-xs text-slate-500">Filled: {filled}/6</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CharacterTab;
