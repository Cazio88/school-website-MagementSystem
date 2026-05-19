import React from "react";
import { computeTotal, gradeFromTotal, getReopenBreakdown, getCABreakdown, getExamsBreakdown } from "../Helpers";

const ResultsTab = ({ students = [], selectedSubject = "", selectedClassLevel = "", scores = {}, breakdowns = {}, existingIds = {}, saving = false, deleting = false, filledCount = 0, onOpenModal = () => {}, onDelete = () => {}, onSubmit = () => {} }) => {
  const subjectLabel = selectedSubject ? selectedSubject : "Select a subject";
  const savedCount = Object.keys(existingIds).length;

  if (!selectedSubject) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
        <p className="text-sm font-semibold text-slate-900">Pick a subject to start entering results.</p>
        <p className="mt-2 text-sm text-slate-500">Choose a subject from the filter above, then enter CA, Re-Open, and exam scores for each student.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Results entry</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">{subjectLabel}</h3>
          <p className="text-sm text-slate-500">{selectedClassLevel || "Class level"} · enter values for the selected term and year</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">Filled: {filledCount}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">Saved: {savedCount}</span>
        </div>
      </div>

      <div className="res-legend mb-4">
        <span className="res-legend-item"><strong>Re-Open</strong> /20</span>
        <span className="res-legend-item"><strong>CA</strong> /40</span>
        <span className="res-legend-item"><strong>Exams</strong> /40</span>
        <span className="res-legend-item"><strong>Total</strong> /100</span>
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
                <th className="py-3 px-4">Re-Open</th>
                <th className="py-3 px-4">CA</th>
                <th className="py-3 px-4">Exams</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Grade</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, index) => {
                const sc = scores?.[s.id] ?? {};
                const rowFilled = sc.reopen !== "" || sc.ca !== "" || sc.exams !== "";
                const saved = Boolean(existingIds[s.id]);
                const total = computeTotal(sc.reopen, sc.ca, sc.exams);
                const grade = rowFilled ? gradeFromTotal(total, selectedClassLevel) : "—";
                const reopenBreak = getReopenBreakdown(breakdowns, s.id);
                const caBreak = getCABreakdown(breakdowns, s.id);
                const examsBreak = getExamsBreakdown(breakdowns, s.id);

                return (
                  <tr key={s.id} className={`${index > 0 ? "border-t border-slate-100" : ""} ${rowFilled ? "bg-slate-50" : ""}`}>
                    <td className="py-4 px-4 text-slate-800">
                      <div className="font-medium">{s.student_name || s.name}</div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {saved ? "Saved entry" : rowFilled ? "Draft entry" : "No entry yet"}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-700">
                      <div>{sc.reopen !== "" ? sc.reopen : "—"}</div>
                      {reopenBreak && <div className="text-[11px] text-slate-400 mt-1">{reopenBreak}</div>}
                    </td>
                    <td className="py-4 px-4 text-slate-700">
                      <div>{sc.ca !== "" ? sc.ca : "—"}</div>
                      {caBreak && <div className="text-[11px] text-slate-400 mt-1">{caBreak}</div>}
                    </td>
                    <td className="py-4 px-4 text-slate-700">
                      <div>{sc.exams !== "" ? sc.exams : "—"}</div>
                      {examsBreak && <div className="text-[11px] text-slate-400 mt-1">{examsBreak}</div>}
                    </td>
                    <td className="py-4 px-4 text-slate-900 font-semibold">{rowFilled ? total.toFixed(1) : "—"}</td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${rowFilled ? (saved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700") : "bg-slate-100 text-slate-500"}`}>
                        {rowFilled ? grade : "—"}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => onOpenModal({ type: "reopen", studentId: s.id, studentName: s.student_name })} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                          Reopen
                        </button>
                        <button onClick={() => onOpenModal({ type: "ca", studentId: s.id, studentName: s.student_name })} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                          CA
                        </button>
                        <button onClick={() => onOpenModal({ type: "exams", studentId: s.id, studentName: s.student_name })} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                          Exams
                        </button>
                        <button onClick={() => onDelete(s.id)} disabled={!saved || deleting} className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">
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
        <p className="text-sm text-slate-500">Click any score button to edit the score breakdown, then save once all entries are complete.</p>
        <button onClick={onSubmit} disabled={saving || filledCount === 0} className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {saving ? "Saving…" : `Save ${filledCount} Result${filledCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
};

export default ResultsTab;
