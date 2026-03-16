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
  "1":  "bg-green-100   text-green-800",
  "2":  "bg-emerald-100 text-emerald-800",
  "3":  "bg-blue-100    text-blue-800",
  "4":  "bg-cyan-100    text-cyan-800",
  "5":  "bg-yellow-100  text-yellow-800",
  "6":  "bg-orange-100  text-orange-800",
  "7":  "bg-red-100     text-red-700",
  "8":  "bg-red-200     text-red-800",
  "9":  "bg-red-300     text-red-900",
  "A":  "bg-green-100   text-green-800",
  "B":  "bg-emerald-100 text-emerald-800",
  "C":  "bg-blue-100    text-blue-800",
  "D":  "bg-cyan-100    text-cyan-800",
  "E2": "bg-orange-100  text-orange-800",
  "E3": "bg-red-100     text-red-700",
  "E4": "bg-red-200     text-red-800",
  "E5": "bg-red-300     text-red-900",
};

const TABS = [
  { key: "Results",     icon: "📊" },
  { key: "Progress",    icon: "📈" },
  { key: "Report Card", icon: "📄" },
  { key: "Fees",          icon: "💰" },
  { key: "Announcements", icon: "📢" },
];

// Subject colours for the progress chart lines
const SUBJECT_PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
  "#ec4899", "#6366f1",
];

// ─────────────────────────────────────────────
// Small reusable components
// ─────────────────────────────────────────────

const GradeBadge = ({ grade }) => {
  const cls = GRADE_COLORS[grade] || "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${cls}`}>
      {grade ?? "—"}
    </span>
  );
};

const StatCard = ({ label, value, sub, color = "text-blue-700" }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 text-center">
    <p className={`text-2xl font-bold ${color}`}>{value ?? "—"}</p>
    {sub && <p className="text-xs text-blue-400 font-medium mt-0.5">{sub}</p>}
    <p className="text-xs text-gray-400 mt-1">{label}</p>
  </div>
);

const Toast = ({ message, type, onDismiss }) => {
  if (!message) return null;
  const s = type === "error"
    ? "bg-red-50 border-red-200 text-red-700"
    : "bg-emerald-50 border-emerald-200 text-emerald-700";
  return (
    <div className={`mb-4 flex items-center justify-between px-4 py-3 rounded-lg border text-sm ${s}`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-4 opacity-50 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
};

// ─────────────────────────────────────────────
// Progress chart — pure SVG, no dependencies
// ─────────────────────────────────────────────

const TrendArrow = ({ current, previous }) => {
  if (previous == null || current == null) return <span className="text-gray-300 text-xs">—</span>;
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return <span className="text-gray-400 text-xs font-medium">→ same</span>;
  if (diff > 0) return (
    <span className="text-emerald-600 text-xs font-semibold">▲ +{diff.toFixed(1)}</span>
  );
  return <span className="text-red-500 text-xs font-semibold">▼ {diff.toFixed(1)}</span>;
};

const SubjectLineChart = ({ subject, data, color }) => {
  // data: [{ term, score }]  — up to 3 points
  const W = 280, H = 100, PAD = 16;
  const scores = data.map((d) => d.score);
  const min    = Math.max(0,   Math.min(...scores) - 10);
  const max    = Math.min(100, Math.max(...scores) + 10);
  const range  = max - min || 1;

  const pts = data.map((d, i) => ({
    x: PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2),
    y: PAD + (1 - (d.score - min) / range) * (H - PAD * 2),
    score: d.score,
    term: d.term,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = pts.length > 0
    ? `${pathD} L ${pts[pts.length - 1].x} ${H - PAD} L ${pts[0].x} ${H - PAD} Z`
    : "";

  const latest   = scores[scores.length - 1];
  const previous = scores.length > 1 ? scores[scores.length - 2] : null;
  const diff     = previous != null ? latest - previous : null;
  const trendColor = diff == null || Math.abs(diff) < 0.5
    ? "text-gray-400"
    : diff > 0 ? "text-emerald-600" : "text-red-500";
  const trendLabel = diff == null || Math.abs(diff) < 0.5
    ? ""
    : diff > 0 ? `▲ +${diff.toFixed(1)}` : `▼ ${diff.toFixed(1)}`;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex justify-between items-start mb-2">
        <p className="font-semibold text-gray-800 text-sm leading-tight">{subject}</p>
        <div className="text-right">
          <p className="text-xl font-bold text-blue-700">{latest}</p>
          {trendLabel && <p className={`text-xs font-semibold ${trendColor}`}>{trendLabel}</p>}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
        {/* Area fill */}
        {areaD && (
          <path d={areaD} fill={color} fillOpacity="0.08" />
        )}
        {/* Gridlines */}
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={PAD} y1={PAD + t * (H - PAD * 2)}
            x2={W - PAD} y2={PAD + t * (H - PAD * 2)}
            stroke="#e5e7eb" strokeWidth="1"
          />
        ))}
        {/* Line */}
        {pts.length > 1 && (
          <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Points */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="white" stroke={color} strokeWidth="2.5" />
            <text x={p.x} y={H - 2} textAnchor="middle" fontSize="9" fill="#9ca3af">
              {TERMS.find(t => t.value === p.term)?.label.replace("Term ", "T")}
            </text>
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill={color} fontWeight="600">
              {p.score}
            </text>
          </g>
        ))}
      </svg>

      {/* Mini term row */}
      <div className="flex gap-1 mt-2 flex-wrap">
        {data.map((d) => (
          <span key={d.term} className="text-xs text-gray-400">
            {TERMS.find(t => t.value === d.term)?.label}: <b className="text-gray-700">{d.score}</b>
          </span>
        )).reduce((acc, el, i) => [...acc, ...(i > 0 ? [<span key={`sep${i}`} className="text-gray-200 text-xs">·</span>] : []), el], [])}
      </div>
    </div>
  );
};

// Overall average trend — larger hero chart
const OverallTrendChart = ({ termData }) => {
  // termData: [{ term, label, average, total, position }]
  const W = 500, H = 120, PAD = 24;
  const avgs  = termData.map((d) => parseFloat(d.average) || 0);
  const min   = Math.max(0,   Math.min(...avgs) - 15);
  const max   = Math.min(100, Math.max(...avgs) + 15);
  const range = max - min || 1;

  const pts = termData.map((d, i) => ({
    x: PAD + (i / Math.max(termData.length - 1, 1)) * (W - PAD * 2),
    y: PAD + (1 - ((parseFloat(d.average) || 0) - min) / range) * (H - PAD * 2),
    ...d,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = pts.length > 0
    ? `${pathD} L ${pts[pts.length - 1].x} ${H - PAD} L ${pts[0].x} ${H - PAD} Z`
    : "";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="font-semibold text-gray-700 mb-3 text-sm">Overall Average — All Terms</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 110 }}>
        <defs>
          <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {areaD && <path d={areaD} fill="url(#heroGrad)" />}
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={PAD} y1={PAD + t * (H - PAD * 2)} x2={W - PAD} y2={PAD + t * (H - PAD * 2)}
            stroke="#f3f4f6" strokeWidth="1" />
        ))}
        {pts.length > 1 && (
          <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="6" fill="white" stroke="#3b82f6" strokeWidth="3" />
            <text x={p.x} y={H - 4} textAnchor="middle" fontSize="10" fill="#9ca3af">{p.label}</text>
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="11" fill="#3b82f6" fontWeight="700">{p.average}</text>
          </g>
        ))}
      </svg>

      <div className="grid grid-cols-3 gap-3 mt-3">
        {termData.map((d) => (
          <div key={d.term} className="text-center border border-gray-100 rounded-lg py-2 px-3">
            <p className="text-xs text-gray-400">{d.label}</p>
            <p className="font-bold text-blue-700 text-base">{d.average ?? "—"}</p>
            <p className="text-xs text-gray-400">avg · <b className="text-gray-600">{d.total}</b> total</p>
            {d.position && (
              <p className="text-xs text-gray-400 mt-0.5">
                Pos: <b className="text-gray-600">{d.position}</b>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

const StudentPortal = () => {
  const user = getUser();

  const [tab, setTab]                   = useState("Results");
  const [selectedTerm, setSelectedTerm] = useState("term1");

  // Per-term report
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(false);

  // All-terms data for Progress tab
  const [allReports, setAllReports]         = useState({});   // { term1: report, term2: report, ... }
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [progressLoaded, setProgressLoaded]   = useState(false);

  // Fees
  const [fees, setFees]             = useState([]);
  const [loadingFees, setLoadingFees] = useState(false);

  const [error, setError]     = useState("");

  // ─────────────────────────────────────
  // Fetchers
  // ─────────────────────────────────────

  const fetchReport = useCallback(async (term) => {
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const res = await API.get(`/report/student/${user.student_id}/?term=${term}`);
      setReport(res.data);
    } catch {
      setError("No report found for this term.");
    } finally {
      setLoading(false);
    }
  }, [user.student_id]);

  const fetchAllReports = useCallback(async () => {
    if (progressLoaded) return;
    setLoadingProgress(true);
    setError("");
    const results = {};
    await Promise.all(
      TERMS.map(async ({ value }) => {
        try {
          const res = await API.get(`/report/student/${user.student_id}/?term=${value}`);
          results[value] = res.data;
        } catch {
          // Term has no data — leave it absent
        }
      })
    );
    setAllReports(results);
    setProgressLoaded(true);
    setLoadingProgress(false);
  }, [user.student_id, progressLoaded]);

  const fetchFees = useCallback(async () => {
    setLoadingFees(true);
    setError("");
    try {
      const res = await API.get(`/fees/?student=${user.student_id}`);
      setFees(res.data.results ?? res.data);
    } catch {
      setError("Failed to load fees.");
    } finally {
      setLoadingFees(false);
    }
  }, [user.student_id]);

  // ─────────────────────────────────────
  // Effects
  // ─────────────────────────────────────

  useEffect(() => {
    if (tab === "Results" || tab === "Report Card") fetchReport(selectedTerm);
  }, [tab, selectedTerm]);

  useEffect(() => {
    if (tab === "Progress") fetchAllReports();
  }, [tab]);

  useEffect(() => {
    if (tab === "Fees") fetchFees();
  }, [tab]);

  useEffect(() => { setError(""); }, [tab]);

  // ─────────────────────────────────────
  // PDF download
  // ─────────────────────────────────────

  const downloadReport = async () => {
    try {
      const res = await API.get(
        `/report/student/${user.student_id}/pdf/?term=${selectedTerm}`,
        { responseType: "blob" }
      );
      const link = document.createElement("a");
      link.href  = window.URL.createObjectURL(new Blob([res.data]));
      link.setAttribute("download", `report_${selectedTerm}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("Failed to download report.");
    }
  };

  // ─────────────────────────────────────
  // Progress data derivation
  // ─────────────────────────────────────

  // Build per-subject trend: { subjectName: [{ term, score }] }
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

  // Overall term summary for the hero chart
  const termSummary = TERMS
    .filter(({ value }) => allReports[value])
    .map(({ value, label }) => ({
      term:     value,
      label,
      average:  allReports[value]?.average_score,
      total:    allReports[value]?.total_score,
      position: allReports[value]?.show_position
        ? allReports[value]?.position_formatted
        : null,
    }));

  // Most improved subject (largest positive delta from first to last available term)
  const mostImproved = (() => {
    let best = null, bestDelta = -Infinity;
    Object.entries(subjectTrends).forEach(([name, pts]) => {
      if (pts.length < 2) return;
      const delta = pts[pts.length - 1].score - pts[0].score;
      if (delta > bestDelta) { bestDelta = delta; best = { name, delta }; }
    });
    return best;
  })();

  // Needs attention — largest negative delta
  const needsAttention = (() => {
    let worst = null, worstDelta = Infinity;
    Object.entries(subjectTrends).forEach(([name, pts]) => {
      if (pts.length < 2) return;
      const delta = pts[pts.length - 1].score - pts[0].score;
      if (delta < worstDelta) { worstDelta = delta; worst = { name, delta }; }
    });
    return worst && worstDelta < 0 ? worst : null;
  })();

  const subjectNames = Object.keys(subjectTrends);

  // ─────────────────────────────────────
  // Render
  // ─────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-800 text-white px-6 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {user.photo ? (
              <img src={user.photo} alt="avatar"
                className="w-9 h-9 rounded-full object-cover border-2 border-white/50" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                {user.full_name?.[0] ?? "S"}
              </div>
            )}
            <div>
              <p className="font-semibold text-sm leading-tight">{user.full_name}</p>
              <p className="text-blue-200 text-xs">{user.admission_number} · {user.class}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs text-blue-200 hover:text-white border border-blue-500/50 hover:border-white/50 px-3 py-1.5 rounded-lg transition-all"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── Top controls ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-5 flex gap-3 flex-wrap items-center">
          {tab !== "Progress" && (
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">Term</label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {TERMS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}

          {tab === "Report Card" && report && (
            <button
              onClick={downloadReport}
              className="ml-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              ⬇ Download PDF
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-200 mb-5 gap-1">
          {TABS.map(({ key, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                tab === key
                  ? "border-blue-600 text-blue-600 bg-blue-50/60"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{icon}</span>{key}
            </button>
          ))}
        </div>

        <Toast message={error} type="error" onDismiss={() => setError("")} />

        {/* ══════════════════════════════════════
            TAB 1: Results
        ══════════════════════════════════════ */}
        {tab === "Results" && (
          <>
            {loading && <p className="text-center text-gray-400 text-sm py-8">Loading results…</p>}

            {!loading && report && (
              <div className="space-y-4">
                {/* Stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Total Marks"   value={report.total_score}   />
                  <StatCard label="Average"        value={report.average_score} />
                  <StatCard
                    label="Position"
                    value={report.show_position ? report.position_formatted : "N/A"}
                    sub={report.show_position && report.out_of ? `out of ${report.out_of}` : null}
                  />
                  <StatCard label="Overall Grade"  value={report.overall_grade}
                    color={GRADE_COLORS[report.overall_grade]?.split(" ")[1] || "text-blue-700"} />
                </div>

                {/* Subject table */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <p className="font-semibold text-gray-700 text-sm">
                      {TERMS.find((t) => t.value === selectedTerm)?.label} — Subject Results
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-4 py-3 text-left font-medium">Subject</th>
                          <th className="px-4 py-3 text-center font-medium">Re-Open</th>
                          <th className="px-4 py-3 text-center font-medium">CA/MGT</th>
                          <th className="px-4 py-3 text-center font-medium">Exams</th>
                          <th className="px-4 py-3 text-center font-bold">Total</th>
                          {report.show_position && <th className="px-4 py-3 text-center font-medium">Pos</th>}
                          <th className="px-4 py-3 text-center font-medium">Grade</th>
                          <th className="px-4 py-3 text-center font-medium">Remark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {report.subjects?.map((sub, i) => (
                          <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-800">{sub.subject}</td>
                            <td className="px-4 py-3 text-center text-gray-600">{sub.reopen ?? "—"}</td>
                            <td className="px-4 py-3 text-center text-gray-600">{sub.ca     ?? "—"}</td>
                            <td className="px-4 py-3 text-center text-gray-600">{sub.exams  ?? "—"}</td>
                            <td className="px-4 py-3 text-center font-bold text-blue-700">{sub.score}</td>
                            {report.show_position && (
                              <td className="px-4 py-3 text-center text-gray-500">{sub.subject_position ?? "—"}</td>
                            )}
                            <td className="px-4 py-3 text-center"><GradeBadge grade={sub.grade} /></td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-md text-xs ${GRADE_COLORS[sub.grade] || "bg-gray-100 text-gray-600"}`}>
                                {sub.remark}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {!loading && !report && (
              <div className="text-center py-14 text-gray-400 bg-white rounded-xl border border-gray-100 shadow-sm">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-sm">No results found for this term.</p>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════
            TAB 2: Progress
        ══════════════════════════════════════ */}
        {tab === "Progress" && (
          <>
            {loadingProgress && (
              <p className="text-center text-gray-400 text-sm py-8">Loading progress data…</p>
            )}

            {!loadingProgress && progressLoaded && subjectNames.length === 0 && (
              <div className="text-center py-14 text-gray-400 bg-white rounded-xl border border-gray-100 shadow-sm">
                <p className="text-4xl mb-3">📈</p>
                <p className="text-sm">No results available yet to show progress.</p>
              </div>
            )}

            {!loadingProgress && progressLoaded && subjectNames.length > 0 && (
              <div className="space-y-5">

                {/* ── Highlight cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mostImproved && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-4">
                      <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">
                        Most Improved 🏆
                      </p>
                      <p className="font-bold text-gray-800">{mostImproved.name}</p>
                      <p className="text-emerald-600 text-sm font-semibold mt-0.5">
                        ▲ +{mostImproved.delta.toFixed(1)} points across terms
                      </p>
                    </div>
                  )}
                  {needsAttention && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4">
                      <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">
                        Needs Attention ⚠️
                      </p>
                      <p className="font-bold text-gray-800">{needsAttention.name}</p>
                      <p className="text-red-500 text-sm font-semibold mt-0.5">
                        ▼ {needsAttention.delta.toFixed(1)} points across terms
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Overall trend hero chart ── */}
                {termSummary.length > 0 && <OverallTrendChart termData={termSummary} />}

                {/* ── Term-by-term comparison table ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                    <p className="font-semibold text-gray-700 text-sm">Subject Comparison — All Terms</p>
                    <span className="text-xs text-gray-400">{subjectNames.length} subjects</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-4 py-3 text-left font-medium">Subject</th>
                          {TERMS.filter(({ value }) => allReports[value]).map(({ value, label }) => (
                            <th key={value} className="px-4 py-3 text-center font-medium">{label}</th>
                          ))}
                          <th className="px-4 py-3 text-center font-medium">Trend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {subjectNames.map((name, si) => {
                          const color  = SUBJECT_PALETTE[si % SUBJECT_PALETTE.length];
                          const pts    = subjectTrends[name];
                          const first  = pts[0]?.score;
                          const last   = pts[pts.length - 1]?.score;

                          // Build a score map keyed by term for easy lookup
                          const scoreMap = Object.fromEntries(pts.map((p) => [p.term, p.score]));

                          return (
                            <tr key={name} className="hover:bg-blue-50/20 transition-colors">
                              <td className="px-4 py-3 font-medium text-gray-800">
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ background: color }}
                                  />
                                  {name}
                                </span>
                              </td>
                              {TERMS.filter(({ value }) => allReports[value]).map(({ value }) => {
                                const score = scoreMap[value];
                                return (
                                  <td key={value} className="px-4 py-3 text-center">
                                    {score != null
                                      ? <span className="font-semibold text-blue-700">{score}</span>
                                      : <span className="text-gray-300">—</span>}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-center">
                                <TrendArrow current={last} previous={pts.length > 1 ? pts[pts.length - 2].score : null} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Per-subject line charts ── */}
                <div>
                  <p className="font-semibold text-gray-700 mb-3 text-sm">Subject Trends</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {subjectNames.map((name, i) => (
                      <SubjectLineChart
                        key={name}
                        subject={name}
                        data={subjectTrends[name]}
                        color={SUBJECT_PALETTE[i % SUBJECT_PALETTE.length]}
                      />
                    ))}
                  </div>
                </div>

              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════
            TAB 3: Report Card
        ══════════════════════════════════════ */}
        {tab === "Report Card" && (
          <>
            {loading && <p className="text-center text-gray-400 text-sm py-8">Loading report…</p>}

            {!loading && report && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Total Marks"   value={report.total_score} />
                  <StatCard label="Average"        value={report.average_score} />
                  <StatCard
                    label="Position"
                    value={report.show_position ? report.position_formatted : "N/A"}
                    sub={report.show_position && report.out_of ? `out of ${report.out_of}` : null}
                  />
                  <StatCard label="Overall Grade"  value={report.overall_grade} />
                </div>

                {/* Attendance */}
                {(report.attendance_total ?? 0) > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <p className="font-semibold text-gray-700 text-sm mb-3">Attendance</p>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">Days Present</span>
                      <span className="font-semibold text-gray-800">
                        {report.attendance} / {report.attendance_total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          report.attendance_percent >= 80 ? "bg-green-500" :
                          report.attendance_percent >= 60 ? "bg-yellow-400" : "bg-red-500"
                        }`}
                        style={{ width: `${report.attendance_percent ?? 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 text-right">
                      {report.attendance_percent}% attendance
                    </p>
                  </div>
                )}

                {/* Teacher's Remarks */}
                {(report.conduct || report.interest || report.teacher_remark) && (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
                    <p className="font-semibold text-gray-700 text-sm">Teacher's Remarks</p>
                    {report.conduct && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Conduct</span>
                        <span className="font-medium text-blue-700">{report.conduct}</span>
                      </div>
                    )}
                    {report.interest && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Interest</span>
                        <span className="font-medium text-blue-700">{report.interest}</span>
                      </div>
                    )}
                    {report.teacher_remark && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg text-gray-600 italic text-sm border border-gray-100">
                        "{report.teacher_remark}"
                      </div>
                    )}
                  </div>
                )}

                {/* Full subject table in report card */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <p className="font-semibold text-gray-700 text-sm">Subject Breakdown</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-4 py-3 text-left font-medium">Subject</th>
                          <th className="px-4 py-3 text-center font-medium">Re-Open</th>
                          <th className="px-4 py-3 text-center font-medium">CA/MGT</th>
                          <th className="px-4 py-3 text-center font-medium">Exams</th>
                          <th className="px-4 py-3 text-center font-bold">Total</th>
                          {report.show_position && <th className="px-4 py-3 text-center font-medium">Pos</th>}
                          <th className="px-4 py-3 text-center font-medium">Grade</th>
                          <th className="px-4 py-3 text-center font-medium">Remark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {report.subjects?.map((sub, i) => (
                          <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-800">{sub.subject}</td>
                            <td className="px-4 py-3 text-center text-gray-600">{sub.reopen ?? "—"}</td>
                            <td className="px-4 py-3 text-center text-gray-600">{sub.ca     ?? "—"}</td>
                            <td className="px-4 py-3 text-center text-gray-600">{sub.exams  ?? "—"}</td>
                            <td className="px-4 py-3 text-center font-bold text-blue-700">{sub.score}</td>
                            {report.show_position && (
                              <td className="px-4 py-3 text-center text-gray-500">{sub.subject_position ?? "—"}</td>
                            )}
                            <td className="px-4 py-3 text-center"><GradeBadge grade={sub.grade} /></td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-md text-xs ${GRADE_COLORS[sub.grade] || "bg-gray-100 text-gray-600"}`}>
                                {sub.remark}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {!loading && !report && (
              <div className="text-center py-14 text-gray-400 bg-white rounded-xl border border-gray-100 shadow-sm">
                <p className="text-4xl mb-3">📄</p>
                <p className="text-sm">No report card found for this term.</p>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════
            TAB 4: Fees
        ══════════════════════════════════════ */}
        {tab === "Fees" && (
          <>
            {loadingFees && <p className="text-center text-gray-400 text-sm py-8">Loading fees…</p>}

            {!loadingFees && fees.length === 0 && (
              <div className="text-center py-14 text-gray-400 bg-white rounded-xl border border-gray-100 shadow-sm">
                <p className="text-4xl mb-3">💰</p>
                <p className="text-sm">No fee records found.</p>
              </div>
            )}

            {!loadingFees && fees.length > 0 && (
              <div className="space-y-4">
                {fees.map((fee) => {
                  const isPaid    = fee.balance <= 0;
                  const isPartial = !isPaid && fee.paid > 0;
                  return (
                    <div key={fee.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                      <div className="flex justify-between items-center mb-4">
                        <p className="font-semibold text-gray-700">
                          {TERMS.find((t) => t.value === fee.term)?.label ?? fee.term}
                        </p>
                        {isPaid
                          ? <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">PAID</span>
                          : isPartial
                          ? <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">PARTIAL</span>
                          : <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">UNPAID</span>
                        }
                      </div>

                      {/* Payment progress bar */}
                      {fee.total_amount > 0 && (
                        <div className="mb-4">
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${isPaid ? "bg-green-500" : isPartial ? "bg-yellow-400" : "bg-red-400"}`}
                              style={{ width: `${Math.min(100, (fee.paid / fee.total_amount) * 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1 text-right">
                            {Math.round((fee.paid / fee.total_amount) * 100)}% paid
                          </p>
                        </div>
                      )}

                      <div className="space-y-2 text-sm">
                        {[
                          { label: "School Fees",   value: fee.amount },
                          { label: "Book User Fee", value: fee.book_user_fee },
                          { label: "Workbook Fee",  value: fee.workbook_fee },
                          { label: "Arrears",       value: fee.arrears },
                        ].filter((r) => Number(r.value) > 0).map((r) => (
                          <div key={r.label} className="flex justify-between text-gray-500">
                            <span>{r.label}</span>
                            <span>GHS {Number(r.value).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-semibold border-t border-gray-100 pt-2 mt-1 text-gray-800">
                          <span>Total</span>
                          <span>GHS {Number(fee.total_amount).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-green-600 font-medium">
                          <span>Paid</span>
                          <span>GHS {Number(fee.paid).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-red-600 font-bold">
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
            TAB 5: Announcements
        ══════════════════════════════════════ */}
        {tab === "Announcements" && (
          <AnnouncementsFeed audience="students" />
        )}

      </div>
    </div>
  );
};

export default StudentPortal;