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
} from "react-icons/fa";

const StatCard = ({ label, value, icon, color, sub, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white shadow-sm rounded-xl p-5 flex items-center justify-between border-l-4 ${color} ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
  >
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
    <div className="text-3xl opacity-80">{icon}</div>
  </div>
);

const Dashboard = () => {
  const navigate   = useNavigate();
  const [stats, setStats]         = useState(null);
  const [feeStats, setFeeStats]   = useState(null);
  const [attStats, setAttStats]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
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
      setError("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center gap-3 text-red-600 bg-red-50 rounded-xl border border-red-200">
        <FaExclamationTriangle />
        <span>{error}</span>
      </div>
    );
  }

  const collectionRate = feeStats?.collection_rate ?? 0;
  const attPercent     = attStats?.total > 0
    ? Math.round((attStats.present / attStats.total) * 100)
    : null;

  return (
    <div className="p-6 space-y-8">

      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <button
          onClick={loadAll}
          className="text-xs text-blue-600 hover:underline"
        >
          ↺ Refresh
        </button>
      </div>

      {/* ── Section 1: School overview ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">School Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Students"
            value={stats?.total_students ?? 0}
            icon={<FaUserGraduate className="text-blue-500" />}
            color="border-blue-500"
            onClick={() => navigate("/students")}
          />
          <StatCard
            label="Total Teachers"
            value={stats?.total_teachers ?? 0}
            icon={<FaChalkboardTeacher className="text-green-500" />}
            color="border-green-500"
            onClick={() => navigate("/teachers")}
          />
          <StatCard
            label="Total Classes"
            value={stats?.total_classes ?? 0}
            icon={<FaSchool className="text-purple-500" />}
            color="border-purple-500"
            onClick={() => navigate("/classes")}
          />
          <StatCard
            label="Pending Admissions"
            value={stats?.pending_admissions ?? 0}
            icon={<FaClipboardCheck className="text-yellow-500" />}
            color="border-yellow-500"
            sub={`${stats?.approved_admissions ?? 0} approved`}
            onClick={() => navigate("/admissions")}
          />
        </div>
      </div>

      {/* ── Section 2: Finance + Attendance ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Finance & Attendance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          <StatCard
            label="Total Fees Collected"
            value={feeStats ? `GHS ${Number(feeStats.total_paid).toLocaleString()}` : "—"}
            icon={<FaMoneyBillWave className="text-emerald-500" />}
            color="border-emerald-500"
            sub={feeStats ? `GHS ${Number(feeStats.total_balance).toLocaleString()} outstanding` : ""}
            onClick={() => navigate("/accounts")}
          />

          <StatCard
            label="Collection Rate"
            value={feeStats ? `${collectionRate}%` : "—"}
            icon={<FaChartLine className="text-indigo-500" />}
            color="border-indigo-500"
            sub={feeStats ? `${feeStats.unpaid} unpaid · ${feeStats.partial} partial` : ""}
            onClick={() => navigate("/fees")}
          />

          <StatCard
            label="Today's Attendance"
            value={attStats ? `${attStats.present} / ${attStats.total}` : "—"}
            icon={<FaCalendarCheck className="text-orange-500" />}
            color="border-orange-500"
            sub={attPercent !== null ? `${attPercent}% present today` : "No data yet"}
            onClick={() => navigate("/attendance")}
          />

        </div>
      </div>

      {/* ── Section 3: Fee breakdown bar ── */}
      {feeStats && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Fee Collection Progress</h2>
          <div className="bg-white rounded-xl shadow-sm p-5 border">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 font-medium">Overall Collection</span>
              <span className="font-bold text-blue-600">{collectionRate}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-700 ${
                  collectionRate >= 80 ? "bg-green-500" :
                  collectionRate >= 50 ? "bg-yellow-400" : "bg-red-500"
                }`}
                style={{ width: `${collectionRate}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>Collected: GHS {Number(feeStats.total_paid).toLocaleString()}</span>
              <span>Total: GHS {Number(feeStats.total_billed).toLocaleString()}</span>
            </div>

            {/* Per-term breakdown */}
            {feeStats.term_breakdown?.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {feeStats.term_breakdown.map((t) => {
                  const pct = t.billed > 0 ? Math.round((t.paid / t.billed) * 100) : 0;
                  return (
                    <div key={t.term} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs font-semibold text-gray-600">{t.label}</p>
                      <p className="text-lg font-bold text-blue-600 mt-1">{pct}%</p>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div
                          className="h-1.5 rounded-full bg-blue-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        GHS {Number(t.paid).toLocaleString()} / {Number(t.billed).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 4: Quick actions ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Add Student",     path: "/admissions", color: "bg-blue-600   hover:bg-blue-700"   },
            { label: "Enter Results",   path: "/results",    color: "bg-purple-600 hover:bg-purple-700" },
            { label: "Mark Attendance", path: "/attendance", color: "bg-orange-500 hover:bg-orange-600" },
            { label: "Record Payment",  path: "/fees",       color: "bg-emerald-600 hover:bg-emerald-700"},
          ].map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className={`${action.color} text-white text-sm font-medium py-3 rounded-xl transition-colors`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;