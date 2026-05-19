import React from "react";

const ResultsTab = ({ students = [], selectedSubject = "", selectedClassLevel = "", scores = {}, breakdowns = {}, existingIds = {}, saving = false, deleting = false, filledCount = 0, onOpenModal = () => {}, onDelete = () => {}, onSubmit = () => {} }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800">Results — {selectedSubject || selectedClassLevel}</h3>
        <div className="text-sm text-slate-500">Filled: {filledCount}</div>
      </div>

      {students.length === 0 ? (
        <div className="text-sm text-slate-500">No students available.</div>
      ) : (
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="w-2/5">Student</th>
              <th>CA</th>
              <th>Exams</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const sc = scores?.[s.id] ?? {};
              return (
                <tr key={s.id} className="border-t">
                  <td className="py-2">{s.student_name || s.name}</td>
                  <td className="py-2">{sc?.ca ?? "—"}</td>
                  <td className="py-2">{sc?.exams ?? "—"}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button onClick={() => onOpenModal({ type: "ca", studentId: s.id, studentName: s.student_name })} className="text-xs text-blue-600">Edit CA</button>
                      <button onClick={() => onOpenModal({ type: "exams", studentId: s.id, studentName: s.student_name })} className="text-xs text-blue-600">Edit Exams</button>
                      <button onClick={() => onDelete(s.id)} disabled={deleting} className="text-xs text-red-600">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button onClick={onSubmit} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">
          {saving ? "Saving…" : `Save ${filledCount} Result${filledCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
};

export default ResultsTab;
