import { useEffect, useState, useCallback } from "react";
import { getUser, logout } from "../../services/auth";
import API from "../../services/api";
import AnnouncementsFeed from "../AnnouncementsFeed";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const TERMS = [
  { value: "term1", label: "Term 1" },
  { value: "term2", label: "Term 2" },
  { value: "term3", label: "Term 3" },
];

const GRADE_COLORS = {
  "1":  "bg-emerald-100 text-emerald-800",
  "2":  "bg-emerald-50  text-emerald-700",
  "3":  "bg-blue-100    text-blue-800",
  "4":  "bg-cyan-100    text-cyan-800",
  "5":  "bg-yellow-100  text-yellow-800",
  "6":  "bg-orange-100  text-orange-800",
  "7":  "bg-red-100     text-red-700",
  "8":  "bg-red-200     text-red-800",
  "9":  "bg-red-300     text-red-900",
  "A":  "bg-emerald-100 text-emerald-800",
  "B":  "bg-emerald-50  text-emerald-700",
  "C":  "bg-blue-100    text-blue-800",
  "D":  "bg-cyan-100    text-cyan-800",
  "E2": "bg-orange-100  text-orange-800",
  "E3": "bg-red-100     text-red-700",
  "E4": "bg-red-200     text-red-800",
  "E5": "bg-red-300     text-red-900",
};

const TABS = [
  { key: "Results",       icon: "📊", label: "Results"       },
  { key: "Progress",      icon: "📈", label: "Progress"      },
  { key: "Report Card",   icon: "📄", label: "Report Card"   },
  { key: "Fees",          icon: "💳", label: "Fees"          },
  { key: "Announcements", icon: "📢", label: "Announcements" },
];

const SUBJECT_PALETTE = [
  "#3b82f6","#10b981","#f59e0b","#ef4444",
  "#8b5cf6","#06b6d4","#f97316","#84cc16",
  "#ec4899","#6366f1",
];

// ─────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────

const GradeBadge = ({ grade }) => {
  const cls = GRADE_COLORS[grade] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${cls}`}>
      {grade ?? "—"}
    </span>
  );
};

const RemarkBadge = ({ grade, remark }) => {
  const cls = GRADE_COLORS[grade] || "bg-slate-100 text-slate-500";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${cls}`}>
      {remark ?? "—"}
    </span>
  );
};

const KpiCard = ({ label, value, sub, color = "text-blue-700", bg = "bg-white" }) => (
  <div className={`${bg} rounded-2xl border border-slate-100 shadow-sm px-5 py-4 text-center`}>
    <p className={`text-2xl font-black tracking-tight ${color}`}>{value ?? "—"}</p>
    {sub && <p className="text-xs text-blue-400 font-medium mt-0.5">{sub}</p>}
    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
  </div>
);

const Alert = ({ message, onDismiss }) => {
  if (!message) return null;
  return (
    <div className="mb-5 flex items-center justify-between px-4 py-3 rounded-xl border bg-red-50 border-red-200 text-red-700 text-sm">
      <span>⚠ {message}</span>
      <button onClick={onDismiss} className="ml-4 text-lg leading-none opacity-50 hover:opacity-100">×</button>
    </div>
  );
};

const EmptyState = ({ icon, title, sub }) => (
  <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">
    <div className="text-5xl mb-3">{icon}</div>
    <p className="font-medium text-slate-500">{title}</p>
    {sub && <p className="text-xs mt-1">{sub}</p>}
  </div>
);

const Th = ({ children, center }) => (
  <th className={`px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide ${center ? "text-center" : "text-left"}`}>
    {children}
  </th>
);

// ─────────────────────────────────────────────
// Charts
// ─────────────────────────────────────────────

const TrendArrow = ({ current, previous }) => {
  if (previous == null || current == null) return <span className="text-slate-300 text-xs">—</span>;
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return <span className="text-slate-400 text-xs">→ same</span>;
  if (diff > 0) return <span className="text-emerald-600 text-xs font-semibold">▲ +{diff.toFixed(1)}</span>;
  return <span className="text-red-500 text-xs font-semibold">▼ {diff.toFixed(1)}</span>;
};

const SubjectLineChart = ({ subject, data, color }) => {
  const W = 280, H = 100, PAD = 16;
  const scores = data.map((d) => d.score);
  const min    = Math.max(0,   Math.min(...scores) - 10);
  const max    = Math.min(100, Math.max(...scores) + 10);
  const range  = max - min || 1;
  const pts    = data.map((d, i) => ({
    x: PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2),
    y: PAD + (1 - (d.score - min) / range) * (H - PAD * 2),
    score: d.score, term: d.term,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = pts.length > 0
    ? `${pathD} L ${pts[pts.length-1].x} ${H-PAD} L ${pts[0].x} ${H-PAD} Z`
    : "";
  const latest   = scores[scores.length - 1];
  const previous = scores.length > 1 ? scores[scores.length - 2] : null;
  const diff     = previous != null ? latest - previous : null;
  const trendColor = diff == null || Math.abs(diff) < 0.5 ? "text-slate-400"
    : diff > 0 ? "text-emerald-600" : "text-red-500";
  const trendLabel = diff == null || Math.abs(diff) < 0.5 ? ""
    : diff > 0 ? `▲ +${diff.toFixed(1)}` : `▼ ${diff.toFixed(1)}`;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex justify-between items-start mb-2">
        <p className="font-semibold text-slate-800 text-sm leading-tight">{subject}</p>
        <div className="text-right">
          <p className="text-xl font-black text-blue-700">{latest}</p>
          {trendLabel && <p className={`text-xs font-bold ${trendColor}`}>{trendLabel}</p>}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
        {areaD && <path d={areaD} fill={color} fillOpacity="0.08" />}
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={PAD} y1={PAD + t*(H-PAD*2)} x2={W-PAD} y2={PAD + t*(H-PAD*2)}
            stroke="#e5e7eb" strokeWidth="1" />
        ))}
        {pts.length > 1 && (
          <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="white" stroke={color} strokeWidth="2.5" />
            <text x={p.x} y={H-2} textAnchor="middle" fontSize="9" fill="#9ca3af">
              {TERMS.find(t => t.value === p.term)?.label.replace("Term ", "T")}
            </text>
            <text x={p.x} y={p.y-8} textAnchor="middle" fontSize="9" fill={color} fontWeight="700">
              {p.score}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex gap-2 mt-2 flex-wrap">
        {data.map((d, i) => (
          <span key={d.term} className="text-xs text-slate-400">
            {i > 0 && <span className="text-slate-200 mr-2">·</span>}
            {TERMS.find(t => t.value === d.term)?.label}: <b className="text-slate-700">{d.score}</b>
          </span>
        ))}
      </div>
    </div>
  );
};

const OverallTrendChart = ({ termData }) => {
  const W = 500, H = 120, PAD = 24;
  const avgs  = termData.map((d) => parseFloat(d.average) || 0);
  const min   = Math.max(0,   Math.min(...avgs) - 15);
  const max   = Math.min(100, Math.max(...avgs) + 15);
  const range = max - min || 1;
  const pts   = termData.map((d, i) => ({
    x: PAD + (i / Math.max(termData.length - 1, 1)) * (W - PAD * 2),
    y: PAD + (1 - ((parseFloat(d.average) || 0) - min) / range) * (H - PAD * 2),
    ...d,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = pts.length > 0
    ? `${pathD} L ${pts[pts.length-1].x} ${H-PAD} L ${pts[0].x} ${H-PAD} Z`
    : "";

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="font-bold text-slate-700 mb-4 text-sm">Overall Average — All Terms</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 110 }}>
        <defs>
          <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {areaD && <path d={areaD} fill="url(#heroGrad)" />}
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={PAD} y1={PAD + t*(H-PAD*2)} x2={W-PAD} y2={PAD + t*(H-PAD*2)}
            stroke="#f1f5f9" strokeWidth="1" />
        ))}
        {pts.length > 1 && (
          <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="6" fill="white" stroke="#3b82f6" strokeWidth="3" />
            <text x={p.x} y={H-4} textAnchor="middle" fontSize="10" fill="#94a3b8">{p.label}</text>
            <text x={p.x} y={p.y-10} textAnchor="middle" fontSize="11" fill="#3b82f6" fontWeight="700">{p.average}</text>
          </g>
        ))}
      </svg>
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
        {termData.map((d) => (
          <div key={d.term} className="text-center bg-slate-50 rounded-xl py-3 px-2 border border-slate-100">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{d.label}</p>
            <p className="font-black text-blue-700 text-xl">{d.average ?? "—"}</p>
            <p className="text-xs text-slate-400 mt-0.5">avg · <b className="text-slate-600">{d.total}</b> total</p>
            {d.position && <p className="text-xs text-slate-400 mt-0.5">Pos: <b className="text-slate-600">{d.position}</b></p>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Subject results table (shared)
// ─────────────────────────────────────────────

const SubjectTable = ({ report }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <Th>Subject</Th>
            <Th center>Re-Open</Th>
            <Th center>CA/MGT</Th>
            <Th center>Exams</Th>
            <Th center>Total</Th>
            {report.show_position && <Th center>Pos</Th>}
            <Th center>Grade</Th>
            <Th center>Remark</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {report.subjects?.map((sub, i) => (
            <tr key={i} className="hover:bg-blue-50/20 transition-colors">
              <td className="px-4 py-3 font-medium text-slate-800">{sub.subject}</td>
              <td className="px-4 py-3 text-center text-slate-500">{sub.reopen ?? "—"}</td>
              <td className="px-4 py-3 text-center text-slate-500">{sub.ca     ?? "—"}</td>
              <td className="px-4 py-3 text-center text-slate-500">{sub.exams  ?? "—"}</td>
              <td className="px-4 py-3 text-center font-black text-blue-700">{sub.score}</td>
              {report.show_position && (
                <td className="px-4 py-3 text-center text-slate-500 font-semibold">{sub.subject_position ?? "—"}</td>
              )}
              <td className="px-4 py-3 text-center"><GradeBadge grade={sub.grade} /></td>
              <td className="px-4 py-3 text-center"><RemarkBadge grade={sub.grade} remark={sub.remark} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

const StudentPortal = () => {
  const user = getUser();

  const [tab, setTab]                   = useState("Results");
  const [selectedTerm, setSelectedTerm] = useState("term1");
  const [report, setReport]             = useState(null);
  const [loading, setLoading]           = useState(false);
  const [allReports, setAllReports]     = useState({});
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [progressLoaded, setProgressLoaded]   = useState(false);
  const [fees, setFees]                 = useState([]);
  const [loadingFees, setLoadingFees]   = useState(false);
  const [error, setError]               = useState("");

  const fetchReport = useCallback(async (term) => {
    setLoading(true); setError(""); setReport(null);
    try {
      const r = await API.get(`/report/student/${user.student_id}/?term=${term}`);
      setReport(r.data);
    } catch { setError("No report found for this term."); }
    finally { setLoading(false); }
  }, [user.student_id]);

  const fetchAllReports = useCallback(async () => {
    if (progressLoaded) return;
    setLoadingProgress(true); setError("");
    const results = {};
    await Promise.all(TERMS.map(async ({ value }) => {
      try {
        const r = await API.get(`/report/student/${user.student_id}/?term=${value}`);
        results[value] = r.data;
      } catch {}
    }));
    setAllReports(results); setProgressLoaded(true); setLoadingProgress(false);
  }, [user.student_id, progressLoaded]);

  const fetchFees = useCallback(async () => {
    setLoadingFees(true); setError("");
    try {
      const r = await API.get(`/fees/?student=${user.student_id}`);
      setFees(r.data.results ?? r.data);
    } catch { setError("Failed to load fees."); }
    finally { setLoadingFees(false); }
  }, [user.student_id]);

  useEffect(() => { if (tab === "Results" || tab === "Report Card") fetchReport(selectedTerm); }, [tab, selectedTerm]);
  useEffect(() => { if (tab === "Progress") fetchAllReports(); }, [tab]);
  useEffect(() => { if (tab === "Fees") fetchFees(); }, [tab]);
  useEffect(() => { setError(""); }, [tab]);

  const downloadReport = async () => {
    try {
      const r = await API.get(`/report/student/${user.student_id}/pdf/?term=${selectedTerm}`, { responseType: "blob" });
      const link = document.createElement("a");
      link.href  = window.URL.createObjectURL(new Blob([r.data]));
      link.setAttribute("download", `report_${selectedTerm}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch { setError("Failed to download report."); }
  };

  // ── Progress derivations ─────────────────────────────────────────────────

  const subjectTrends = (() => {
    const map = {};
    TERMS.forEach(({ value: term }) => {
      const rep = allReports[term];
      if (!rep?.subjects) return;
      rep.subjects.forEach((sub) => {
        if (!map[sub.subject]) map[sub.subject] = [];
        map[sub.subject].push({ term, score: parseFloat(sub.score) || 0 });
      });
    });
    return map;
  })();

  const termSummary = TERMS
    .filter(({ value }) => allReports[value])
    .map(({ value, label }) => ({
      term: value, label,
      average:  allReports[value]?.average_score,
      total:    allReports[value]?.total_score,
      position: allReports[value]?.show_position ? allReports[value]?.position_formatted : null,
    }));

  const subjectNames = Object.keys(subjectTrends);

  const mostImproved = (() => {
    let best = null, bestDelta = -Infinity;
    Object.entries(subjectTrends).forEach(([name, pts]) => {
      if (pts.length < 2) return;
      const delta = pts[pts.length-1].score - pts[0].score;
      if (delta > bestDelta) { bestDelta = delta; best = { name, delta }; }
    });
    return best;
  })();

  const needsAttention = (() => {
    let worst = null, worstDelta = Infinity;
    Object.entries(subjectTrends).forEach(([name, pts]) => {
      if (pts.length < 2) return;
      const delta = pts[pts.length-1].score - pts[0].score;
      if (delta < worstDelta) { worstDelta = delta; worst = { name, delta }; }
    });
    return worst && worstDelta < 0 ? worst : null;
  })();

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user.photo ? (
              <img src={user.photo} alt="avatar"
                className="w-8 h-8 rounded-full object-cover border-2 border-slate-200 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {user.full_name?.[0] ?? "S"}
              </div>
            )}
            <div>
              <p className="font-bold text-slate-800 text-sm leading-tight">{user.full_name}</p>
              <p className="text-slate-400 text-xs">{user.admission_number} · {user.class}</p>
            </div>
          </div>

          {/* Desktop tabs */}
          <nav className="hidden sm:flex items-center gap-1">
            {TABS.map(({ key, icon, label }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === key ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}>
                <span>{icon}</span>
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </nav>

          <button onClick={logout}
            className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg">
            Sign out
          </button>
        </div>

        {/* Mobile tabs */}
        <div className="sm:hidden flex border-t border-slate-100 overflow-x-auto">
          {TABS.map(({ key, icon, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium border-b-2 transition-all min-w-[60px] ${
                tab === key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"
              }`}>
              <span className="text-lg">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── Term selector + actions bar ── */}
        {tab !== "Progress" && tab !== "Announcements" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 mb-6 flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Term</label>
              <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
                className="border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {tab === "Report Card" && report && (
              <button onClick={downloadReport}
                className="ml-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
                ⬇ Download PDF
              </button>
            )}
          </div>
        )}

        <Alert message={error} onDismiss={() => setError("")} />

        {/* ══════════════════════════════════════
            TAB: Results
        ══════════════════════════════════════ */}
        {tab === "Results" && (
          <>
            {loading && <div className="text-center text-slate-400 text-sm py-10">Loading results…</div>}
            {!loading && !report && <EmptyState icon="📭" title="No results found for this term" />}
            {!loading && report && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard label="Total Marks"   value={report.total_score}   />
                  <KpiCard label="Average"        value={report.average_score} />
                  <KpiCard
                    label="Position"
                    value={report.show_position ? report.position_formatted : "N/A"}
                    sub={report.show_position && report.out_of ? `out of ${report.out_of}` : null}
                  />
                  <KpiCard label="Overall Grade"  value={report.overall_grade} />
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-3.5 border-b-0">
                  <p className="font-bold text-slate-700 text-sm">
                    {TERMS.find((t) => t.value === selectedTerm)?.label} — Subject Results
                  </p>
                </div>
                <SubjectTable report={report} />
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════
            TAB: Progress
        ══════════════════════════════════════ */}
        {tab === "Progress" && (
          <>
            {loadingProgress && <div className="text-center text-slate-400 text-sm py-10">Loading progress data…</div>}
            {!loadingProgress && progressLoaded && subjectNames.length === 0 && (
              <EmptyState icon="📈" title="No results available yet to show progress" />
            )}
            {!loadingProgress && progressLoaded && subjectNames.length > 0 && (
              <div className="space-y-6">

                {/* Highlight cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {mostImproved && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
                      <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Most Improved 🏆</p>
                      <p className="font-bold text-slate-800">{mostImproved.name}</p>
                      <p className="text-emerald-600 text-sm font-semibold mt-0.5">▲ +{mostImproved.delta.toFixed(1)} points across terms</p>
                    </div>
                  )}
                  {needsAttention && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4">
                      <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest mb-1">Needs Attention ⚠️</p>
                      <p className="font-bold text-slate-800">{needsAttention.name}</p>
                      <p className="text-red-500 text-sm font-semibold mt-0.5">▼ {needsAttention.delta.toFixed(1)} points across terms</p>
                    </div>
                  )}
                </div>

                {/* Overall trend */}
                {termSummary.length > 0 && <OverallTrendChart termData={termSummary} />}

                {/* Comparison table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center">
                    <p className="font-bold text-slate-700 text-sm">Subject Comparison — All Terms</p>
                    <span className="text-xs text-slate-400">{subjectNames.length} subjects</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <Th>Subject</Th>
                          {TERMS.filter(({ value }) => allReports[value]).map(({ value, label }) => (
                            <Th key={value} center>{label}</Th>
                          ))}
                          <Th center>Trend</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {subjectNames.map((name, si) => {
                          const color    = SUBJECT_PALETTE[si % SUBJECT_PALETTE.length];
                          const pts      = subjectTrends[name];
                          const scoreMap = Object.fromEntries(pts.map((p) => [p.term, p.score]));
                          return (
                            <tr key={name} className="hover:bg-blue-50/20 transition-colors">
                              <td className="px-4 py-3 font-medium text-slate-800">
                                <span className="inline-flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                                  {name}
                                </span>
                              </td>
                              {TERMS.filter(({ value }) => allReports[value]).map(({ value }) => {
                                const score = scoreMap[value];
                                return (
                                  <td key={value} className="px-4 py-3 text-center">
                                    {score != null
                                      ? <span className="font-bold text-blue-700">{score}</span>
                                      : <span className="text-slate-300">—</span>}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-center">
                                <TrendArrow current={pts[pts.length-1]?.score} previous={pts.length > 1 ? pts[pts.length-2].score : null} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Per-subject charts */}
                <div>
                  <p className="font-bold text-slate-700 mb-4 text-sm">Subject Trends</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {subjectNames.map((name, i) => (
                      <SubjectLineChart key={name} subject={name}
                        data={subjectTrends[name]} color={SUBJECT_PALETTE[i % SUBJECT_PALETTE.length]} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════
            TAB: Report Card
        ══════════════════════════════════════ */}
        {tab === "Report Card" && (
          <>
            {loading && <div className="text-center text-slate-400 text-sm py-10">Loading report…</div>}
            {!loading && !report && <EmptyState icon="📄" title="No report card found for this term" />}
            {!loading && report && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard label="Total Marks"   value={report.total_score} />
                  <KpiCard label="Average"        value={report.average_score} />
                  <KpiCard
                    label="Position"
                    value={report.show_position ? report.position_formatted : "N/A"}
                    sub={report.show_position && report.out_of ? `out of ${report.out_of}` : null}
                  />
                  <KpiCard label="Overall Grade"  value={report.overall_grade} />
                </div>

                {/* Attendance */}
                {(report.attendance_total ?? 0) > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <p className="font-bold text-slate-700 text-sm mb-3">Attendance</p>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-500">Days Present</span>
                      <span className="font-bold text-slate-700">{report.attendance} / {report.attendance_total}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all ${
                        report.attendance_percent >= 80 ? "bg-emerald-500" :
                        report.attendance_percent >= 60 ? "bg-amber-400" : "bg-red-500"
                      }`} style={{ width: `${report.attendance_percent ?? 0}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 text-right">{report.attendance_percent}% attendance</p>
                  </div>
                )}

                {/* Teacher's Remarks */}
                {(report.conduct || report.interest || report.teacher_remark) && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                    <p className="font-bold text-slate-700 text-sm">Teacher's Remarks</p>
                    {report.conduct && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Conduct</span>
                        <span className="font-semibold text-blue-700">{report.conduct}</span>
                      </div>
                    )}
                    {report.interest && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Interest</span>
                        <span className="font-semibold text-blue-700">{report.interest}</span>
                      </div>
                    )}
                    {report.teacher_remark && (
                      <div className="mt-2 p-3 bg-slate-50 rounded-xl text-slate-600 italic text-sm border border-slate-100">
                        "{report.teacher_remark}"
                      </div>
                    )}
                  </div>
                )}

                {/* Subject table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-3.5 border-b-0">
                  <p className="font-bold text-slate-700 text-sm">Subject Breakdown</p>
                </div>
                <SubjectTable report={report} />
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════
            TAB: Fees
        ══════════════════════════════════════ */}
        {tab === "Fees" && (
          <>
            {loadingFees && <div className="text-center text-slate-400 text-sm py-10">Loading fees…</div>}
            {!loadingFees && fees.length === 0 && <EmptyState icon="💳" title="No fee records found" />}
            {!loadingFees && fees.length > 0 && (
              <div className="space-y-4">
                {fees.map((fee) => {
                  const isPaid    = fee.balance <= 0;
                  const isPartial = !isPaid && fee.paid > 0;
                  const pct       = fee.total_amount > 0 ? Math.min(100, Math.round((fee.paid / fee.total_amount) * 100)) : 0;
                  return (
                    <div key={fee.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                      <div className="flex justify-between items-center mb-4">
                        <p className="font-bold text-slate-700">{TERMS.find((t) => t.value === fee.term)?.label ?? fee.term}</p>
                        {isPaid
                          ? <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">✓ PAID</span>
                          : isPartial
                          ? <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">◑ PARTIAL</span>
                          : <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-bold">✕ UNPAID</span>
                        }
                      </div>

                      {fee.total_amount > 0 && (
                        <div className="mb-5">
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>{pct}% paid</span>
                            <span>GHS {Number(fee.paid).toLocaleString()} of {Number(fee.total_amount).toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5">
                            <div className={`h-2.5 rounded-full transition-all duration-500 ${isPaid ? "bg-emerald-500" : isPartial ? "bg-amber-400" : "bg-red-400"}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 text-sm">
                        {[
                          { label: "School Fees",   value: fee.amount        },
                          { label: "Book User Fee", value: fee.book_user_fee },
                          { label: "Workbook Fee",  value: fee.workbook_fee  },
                          { label: "Arrears",       value: fee.arrears       },
                        ].filter((r) => Number(r.value) > 0).map((r) => (
                          <div key={r.label} className="flex justify-between text-slate-500">
                            <span>{r.label}</span>
                            <span>GHS {Number(r.value).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold border-t border-slate-100 pt-2 mt-2 text-slate-700">
                          <span>Total</span>
                          <span>GHS {Number(fee.total_amount).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-medium text-emerald-600">
                          <span>Paid</span>
                          <span>GHS {Number(fee.paid).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-black text-red-600">
                          <span>Balance</span>
                          <span>GHS {Number(fee.balance).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════
            TAB: Announcements
        ══════════════════════════════════════ */}
        {tab === "Announcements" && <AnnouncementsFeed audience="students" />}

      </div>
    </div>
  );
};

export default StudentPortal;