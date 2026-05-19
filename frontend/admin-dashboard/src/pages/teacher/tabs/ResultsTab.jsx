import React from "react";

const ResultsTab = ({ students = [], selectedSubject = "", selectedClassLevel = "", scores = {}, breakdowns = {}, existingIds = {}, saving = false, deleting = false, filledCount = 0, onOpenModal = () => {}, onDelete = () => {}, onSubmit = () => {} }) => {
  const subjectLabel = selectedSubject ? selectedSubject : "Select a subject";
  const savedCount = Object.keys(existingIds).length;

  if (!selectedSubject) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
        <p className="text-sm font-semibold text-slate-900">Pick a subject to start entering results.</p>
        <p className="mt-2 text-sm text-slate-500">Choose a subject from the filter above, then enter CA and exam scores for each student.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Results</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">{subjectLabel}</h3>
          <p className="text-sm text-slate-500">{selectedClassLevel || "Class level"}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">Filled: {filledCount}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">Saved: {savedCount}</span>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          No students found for this class yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">CA</th>
                <th className="py-3 px-4">Exams</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, index) => {
                const sc = scores?.[s.id] ?? {};
                const rowFilled = sc.reopen !== "" || sc.ca !== "" || sc.exams !== "";
                return (
                  <tr key={s.id} className={`${index > 0 ? "border-t border-slate-100" : ""} ${rowFilled ? "bg-slate-50" : ""}`}>
                    <td className="py-4 px-4 text-slate-800">{s.student_name || s.name}</td>
                    <td className="py-4 px-4 text-slate-700">{sc.ca ?? "—"}</td>
                    <td className="py-4 px-4 text-slate-700">{sc.exams ?? "—"}</td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => onOpenModal({ type: "ca", studentId: s.id, studentName: s.student_name })} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                          Edit CA
                        </button>
                        <button onClick={() => onOpenModal({ type: "exams", studentId: s.id, studentName: s.student_name })} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                          Edit Exams
                        </button>
                        <button onClick={() => onDelete(s.id)} disabled={deleting} className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">
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

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Save scores once you’ve finished entering values for the selected subject and term.</p>
        <button onClick={onSubmit} disabled={saving} className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {saving ? "Saving…" : `Save ${filledCount} Result${filledCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
};

export default ResultsTab;
