import React from "react";

const CharacterTab = ({ students = [], selectedClassName = "", selectedTerm = "", selectedYear = "", charAssess = {} }) => {
  const filledSummary = students.map((s) => {
    const forms = charAssess?.charForms?.[s.id] ?? null;
    const filled = forms ? Object.values(forms.areas ?? {}).filter((a) => a.score !== "").length : 0;
    return { id: s.id, name: s.student_name || s.name, filled };
  });

  const completedCount = filledSummary.filter((item) => item.filled > 0).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Character assessment</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">{selectedClassName || "Class"}</h3>
          <p className="text-sm text-slate-500">{selectedTerm} · {selectedYear}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">{completedCount} / {students.length} completed</p>
          <p className="text-xs text-slate-500">Student forms with at least one score.</p>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          No students available for character assessment.
        </div>
      ) : (
        <div className="grid gap-3">
          {filledSummary.map((student) => (
            <div key={student.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <p className="font-medium text-slate-800">{student.name}</p>
                <p className="text-xs text-slate-500">{student.filled === 0 ? "Not started" : "Assessment started"}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{student.filled}/6</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CharacterTab;
