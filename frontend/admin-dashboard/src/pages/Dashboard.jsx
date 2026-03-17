import { useEffect, useState } from "react";
import { getDashboard } from "../services/dashboardService";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import {
  FaUserGraduate,
  FaChalkboardTeacher,
  FaSchool,
  FaClipboardCheck,
  FaMoneyBillWave,
  FaCalendarCheck,
  FaChartLine,
  FaExclamationTriangle,
  FaArrowRight,
  FaSync,
} from "react-icons/fa";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ghs = (n) => `GHS ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;

const rateColor = (pct) =>
  pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-500";

const rateText = (pct) =>
  pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";

// ── Sub-components ────────────────────────────────────────────────────────────

const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />
);

const KpiCard = ({ label, value, sub, icon, accent, onClick, index = 0 }) => (
  <div
    onClick={onClick}
    style={{ animationDelay: `${index * 60}ms` }}
    className={`
      group relative bg-white rounded-2xl p-5 border border-slate-100 shadow-sm
      overflow-hidden transition-all duration-200
      ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}
      animate-fade-in
    `}
  >
    <div className={`absolute top-0 left-0 right-0 h-0.5 ${accent}`} />
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
        <p className="text-3xl font-black text-slate-800 leading-none tracking-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-2 leading-relaxed">{sub}</p>}
      </div>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ml-3 bg-slate-50">
        {icon}
      </div>
    </div>
    {onClick && (
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-blue-500 transition-colors">
        <span>View</span>
        <FaArrowRight className="text-[10px] group-hover:translate-x-0.5 transition-transform" />
      </div>
    )}
  </div>
);

const SectionLabel = ({ children }) => (
  <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">{children}</h2>
);

const ProgressBar = ({ value, className = "" }) => (
  <div className={`w-full bg-slate-100 rounded-full h-2 overflow-hidden ${className}`}>
    <div
      className={`h-2 rounded-full transition-all duration-700 ease-out ${rateColor(value)}`}
      style={{ width: `${Math.min(value, 100)}%` }}
    />
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats]           = useState(null);
  const [feeStats, setFeeStats]     = useState(null);
  const [attStats, setAttStats]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => { loadAll(); }, []);

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [dashRes, feeRes, attRes] = await Promise.allSettled([
        getDashboard(),
        API.get("/accounts/dashboard/"),
        API.get(`/attendance/?date=${today}`),
      ]);

      if (dashRes.status === "fulfilled") setStats(dashRes.value);
      if (feeRes.status  === "fulfilled") setFeeStats(feeRes.value.data);
      if (attRes.status  === "fulfilled") {
        const records = attRes.value.data.results || attRes.value.data;
        const present = records.filter((r) => r.status === "present" || r.status === "late").length;
        setAttStats({ present, total: records.length });
      }
    } catch {
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const collectionRate = feeStats?.collection_rate ?? 0;
  const attPercent = attStats?.total > 0
    ? Math.round((attStats.present / attStats.total) * 100)
    : null;

  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 p-5 text-red-700 bg-red-50 rounded-2xl border border-red-200">
          <FaExclamationTriangle className="text-xl flex-shrink-0" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-red-500 mt-0.5">{error}</p>
          </div>
          <button onClick={() => loadAll()} className="ml-auto text-sm font-medium text-red-600 hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">{dateStr}</p>
          </div>
          <button
            onClick={() => loadAll(true)}
            disabled={refreshing}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-40 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm"
          >
            <FaSync className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── Section 1: School overview ── */}
        <section>
          <SectionLabel>School Overview</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard index={0}
              label="Total Students"
              value={stats?.total_students ?? 0}
              icon={<FaUserGraduate className="text-blue-500" />}
              accent="bg-blue-500"
              onClick={() => navigate("/admin/students")}
            />
            <KpiCard index={1}
              label="Total Teachers"
              value={stats?.total_teachers ?? 0}
              icon={<FaChalkboardTeacher className="text-emerald-500" />}
              accent="bg-emerald-500"
              onClick={() => navigate("/admin/teachers")}
            />
            <KpiCard index={2}
              label="Total Classes"
              value={stats?.total_classes ?? 0}
              icon={<FaSchool className="text-violet-500" />}
              accent="bg-violet-500"
              onClick={() => navigate("/admin/classes")}
            />
            <KpiCard index={3}
              label="Pending Admissions"
              value={stats?.pending_admissions ?? 0}
              icon={<FaClipboardCheck className="text-amber-500" />}
              accent="bg-amber-500"
              sub={`${stats?.approved_admissions ?? 0} approved this year`}
              onClick={() => navigate("/admin/admissions")}
            />
          </div>
        </section>

        {/* ── Section 2: Finance + Attendance ── */}
        <section>
          <SectionLabel>Finance & Attendance</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard index={0}
              label="Fees Collected"
              value={feeStats ? ghs(feeStats.total_paid) : "—"}
              icon={<FaMoneyBillWave className="text-emerald-500" />}
              accent="bg-emerald-500"
              sub={feeStats ? `${ghs(feeStats.total_balance)} outstanding` : ""}
              onClick={() => navigate("/admin/accounts")}
            />
            <KpiCard index={1}
              label="Collection Rate"
              value={feeStats ? `${collectionRate}%` : "—"}
              icon={<FaChartLine className="text-indigo-500" />}
              accent="bg-indigo-500"
              sub={feeStats ? `${feeStats.fully_paid} paid · ${feeStats.partial} partial · ${feeStats.unpaid} unpaid` : ""}
              onClick={() => navigate("/admin/fees")}
            />
            <KpiCard index={2}
              label="Today's Attendance"
              value={attStats ? `${attStats.present} / ${attStats.total}` : "—"}
              icon={<FaCalendarCheck className="text-orange-500" />}
              accent="bg-orange-500"
              sub={attPercent !== null ? `${attPercent}% present today` : "No records yet"}
              onClick={() => navigate("/admin/attendance")}
            />
          </div>
        </section>

        {/* ── Section 3: Fee collection progress ── */}
        {feeStats && (
          <section>
            <SectionLabel>Fee Collection Progress</SectionLabel>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">Overall</span>
                  <span className={`text-sm font-black ${rateText(collectionRate)}`}>{collectionRate}%</span>
                </div>
                <ProgressBar value={collectionRate} />
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>Collected: {ghs(feeStats.total_paid)}</span>
                  <span>Billed: {ghs(feeStats.total_billed)}</span>
                </div>
              </div>

              {feeStats.term_breakdown?.length > 0 && (
                <div className="grid grid-cols-3 gap-4 pt-5 border-t border-slate-100">
                  {feeStats.term_breakdown.map((t) => {
                    const pct = t.billed > 0 ? Math.round((t.paid / t.billed) * 100) : 0;
                    return (
                      <div key={t.term} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-600">{t.label}</span>
                          <span className={`text-xs font-bold ${rateText(pct)}`}>{pct}%</span>
                        </div>
                        <ProgressBar value={pct} />
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>{ghs(t.paid)}</span>
                          <span>{ghs(t.billed)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-100">
                {[
                  { label: `${feeStats.fully_paid} Fully Paid`, bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
                  { label: `${feeStats.partial} Partial`,       bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400"  },
                  { label: `${feeStats.unpaid} Unpaid`,         bg: "bg-red-50",     text: "text-red-600",     dot: "bg-red-500"    },
                ].map((b) => (
                  <span key={b.label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${b.bg} ${b.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Section 4: Quick actions ── */}
        <section>
          <SectionLabel>Quick Actions</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Add Student",     path: "/admin/admissions", from: "from-blue-600",    to: "to-blue-500",    icon: "🎓" },
              { label: "Enter Results",   path: "/admin/results",    from: "from-violet-600",  to: "to-violet-500",  icon: "📝" },
              { label: "Mark Attendance", path: "/admin/attendance", from: "from-orange-500",  to: "to-amber-400",   icon: "✅" },
              { label: "Record Payment",  path: "/admin/fees",       from: "from-emerald-600", to: "to-emerald-500", icon: "💳" },
            ].map((a, i) => (
              <button
                key={a.path}
                onClick={() => navigate(a.path)}
                style={{ animationDelay: `${i * 50}ms` }}
                className={`
                  group relative bg-gradient-to-br ${a.from} ${a.to}
                  text-white rounded-2xl p-4 text-left
                  hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200
                  overflow-hidden animate-fade-in
                `}
              >
                <div className="text-2xl mb-2">{a.icon}</div>
                <p className="text-sm font-bold">{a.label}</p>
                <FaArrowRight className="absolute bottom-4 right-4 text-white/40 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all text-xs" />
              </button>
            ))}
          </div>
        </section>

      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.35s ease both; }
      `}</style>
    </div>
  );
};

export default Dashboard;