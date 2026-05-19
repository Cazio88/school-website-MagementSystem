import React from "react";
import { StatusPill } from "../Ui";

const AttendanceTab = ({ students = [], loading = false, selectedClassName = "", attDate = "", attendance = {}, saving = false, onToggle = () => {}, onSave = () => {} }) => {
  if (loading) return <div className="p-4 text-sm text-slate-500">Loading attendance…</div>;

  const statusCounts = {
    present: Object.values(attendance).filter((status) => status === "present").length,
    absent: Object.values(attendance).filter((status) => status === "absent").length,
    late: Object.values(attendance).filter((status) => status === "late").length,
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Attendance</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">{selectedClassName || "Class"}</h3>
          <p className="text-sm text-slate-500">Date: {attDate}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-2xl bg-emerald-50 px-3 py-3 text-emerald-700">
            <div className="text-xs uppercase tracking-[0.24em]">Present</div>
            <div className="text-lg font-semibold">{statusCounts.present}</div>
          </div>
          <div className="rounded-2xl bg-red-50 px-3 py-3 text-red-700">
            <div className="text-xs uppercase tracking-[0.24em]">Absent</div>
            <div className="text-lg font-semibold">{statusCounts.absent}</div>
          </div>
          <div className="rounded-2xl bg-amber-50 px-3 py-3 text-amber-700">
            <div className="text-xs uppercase tracking-[0.24em]">Late</div>
            <div className="text-lg font-semibold">{statusCounts.late}</div>
          </div>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          No students available to mark attendance.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {students.map((s) => {
            const status = attendance?.[s.id] ?? "present";
            return (
              <div key={s.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-slate-800">{s.student_name || s.name}</p>
                  <p className="text-sm text-slate-500">ID: {s.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={status} />
                  <button
                    type="button"
                    onClick={() => onToggle(s.id)}
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 hover:text-blue-800"
                  >
                    Cycle status
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Toggle status to set Present, Absent, or Late for each student.</p>
        <button onClick={onSave} disabled={saving} className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {saving ? "Saving…" : "Save Attendance"}
        </button>
      </div>
    </div>
  );
};

export default AttendanceTab;
