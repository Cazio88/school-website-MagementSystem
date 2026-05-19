import React from "react";

const ReportsTab = ({ students = [], selectedClassName = "", selectedClass = "", selectedTerm = "", selectedYear = "" }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Reports</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">{selectedClassName || "Class"}</h3>
          <p className="text-sm text-slate-500">Term: {selectedTerm} · Year: {selectedYear}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {students.length === 0 ? "No reports available" : `${students.length} report${students.length !== 1 ? "s" : ""} ready`}
        </div>
      </div>

      {students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          No students are assigned to this class yet. Select a class to preview report cards.
        </div>
      ) : (
        <div className="grid gap-3">
          {students.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-slate-800">{s.student_name || s.name}</p>
                <p className="text-xs text-slate-500">ID: {s.id}</p>
              </div>
              <a href={`#reports-${s.id}`} className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700">
                View report
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportsTab;
