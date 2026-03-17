import { useEffect, useState } from "react";
import API from "../services/api";

const TERMS = [
  { value: "",      label: "All Terms" },
  { value: "term1", label: "Term 1"    },
  { value: "term2", label: "Term 2"    },
  { value: "term3", label: "Term 3"    },
];
const YEARS = [2026, 2025, 2024, 2023, 2022];
const TABS  = ["Dashboard", "Income Ledger", "Collection Report", "Defaulters"];
const fmt   = (n) => `GHS ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const Accounts = () => {
  const [tab, setTab]                     = useState("Dashboard");
  const [classes, setClasses]             = useState([]);
  const [selectedTerm, setSelectedTerm]   = useState("");
  const [selectedYear, setSelectedYear]   = useState(String(YEARS[0]));
  const [selectedClass, setSelectedClass] = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [dashboard, setDashboard]         = useState(null);
  const [ledger, setLedger]               = useState(null);
  const [collection, setCollection]       = useState([]);
  const [defaulters, setDefaulters]       = useState(null);

  useEffect(() => { fetchClasses(); }, []);
  useEffect(() => {
    setError("");
    if (tab === "Dashboard")         fetchDashboard();
    if (tab === "Income Ledger")     fetchLedger();
    if (tab === "Collection Report") fetchCollection();
    if (tab === "Defaulters")        fetchDefaulters();
  }, [tab, selectedTerm, selectedYear, selectedClass]);

  const fetchClasses = async () => {
    try { const r = await API.get("/classes/"); setClasses(r.data.results || r.data); }
    catch { setError("Failed to load classes."); }
  };

  const buildQuery = () => {
    const p = [];
    if (selectedTerm)  p.push(`term=${selectedTerm}`);
    if (selectedYear)  p.push(`year=${selectedYear}`);
    if (selectedClass) p.push(`school_class=${selectedClass}`);
    return p.length ? `?${p.join("&")}` : "";
  };

  const fetchDashboard  = async () => { setLoading(true); try { const r = await API.get(`/accounts/dashboard/${buildQuery()}`);  setDashboard(r.data);  } catch { setError("Failed to load dashboard.");        } finally { setLoading(false); } };
  const fetchLedger     = async () => { setLoading(true); try { const r = await API.get(`/accounts/ledger/${buildQuery()}`);     setLedger(r.data);     } catch { setError("Failed to load ledger.");           } finally { setLoading(false); } };
  const fetchCollection = async () => { setLoading(true); try { const r = await API.get(`/accounts/collection/${buildQuery()}`); setCollection(r.data); } catch { setError("Failed to load collection report."); } finally { setLoading(false); } };
  const fetchDefaulters = async () => { setLoading(true); try { const r = await API.get(`/accounts/defaulters/${buildQuery()}`); setDefaulters(r.data); } catch { setError("Failed to load defaulters.");        } finally { setLoading(false); } };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accounts</h1>
          <p className="text-sm text-slate-500 mt-0.5">Financial overview, ledger and fee collection reports</p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            <span>⚠</span> {error}
            <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
          <div className="flex flex-wrap gap-3">
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
              className="border border-slate-200 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
              className="border border-slate-200 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
              className="border border-slate-200 p-2.5 rounded-lg text-sm min-w-[150px] focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${tab === t ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-16 text-slate-400">
            <div className="animate-spin text-3xl mb-2">⟳</div>
            <p className="text-sm">Loading...</p>
          </div>
        )}

        {/* ── Dashboard ── */}
        {tab === "Dashboard" && dashboard && !loading && (
          <div className="space-y-6">

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Billed",    value: fmt(dashboard.total_billed),     color: "text-slate-800",  bg: "bg-white"       },
                { label: "Total Collected", value: fmt(dashboard.total_paid),       color: "text-emerald-600",bg: "bg-emerald-50"  },
                { label: "Outstanding",     value: fmt(dashboard.total_balance),    color: "text-red-600",    bg: "bg-red-50"      },
                { label: "Collection Rate", value: `${dashboard.collection_rate}%`, color: "text-blue-600",   bg: "bg-blue-50"     },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl border border-slate-200 p-4 shadow-sm`}>
                  <div className={`text-2xl font-bold tracking-tight ${s.color}`}>{s.value}</div>
                  <div className="text-xs font-medium text-slate-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Status badges */}
            <div className="flex gap-3 text-sm flex-wrap">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-medium">{dashboard.fully_paid} Fully Paid</span>
              <span className="px-3 py-1 bg-amber-100   text-amber-800   rounded-full font-medium">{dashboard.partial} Partial</span>
              <span className="px-3 py-1 bg-red-100     text-red-700     rounded-full font-medium">{dashboard.unpaid} Unpaid</span>
            </div>

            {/* Term breakdown */}
            <div>
              <h3 className="font-semibold text-slate-700 mb-3">Term Breakdown</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {dashboard.term_breakdown.map((t) => {
                  const rate = t.billed > 0 ? Math.round((t.paid / t.billed) * 100) : 0;
                  return (
                    <div key={t.term} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                      <div className="font-semibold text-blue-700 mb-3">{t.label}</div>
                      <div className="space-y-1.5 text-sm">
                        {[
                          { label: "Billed",      value: fmt(t.billed),  color: "text-slate-700"  },
                          { label: "Collected",   value: fmt(t.paid),    color: "text-emerald-600" },
                          { label: "Outstanding", value: fmt(t.balance), color: "text-red-600"     },
                        ].map((row) => (
                          <div key={row.label} className="flex justify-between">
                            <span className="text-slate-400">{row.label}</span>
                            <span className={`font-medium ${row.color}`}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 w-full bg-slate-200 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-400" : "bg-red-500"}`}
                          style={{ width: `${rate}%` }} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1 text-right">{rate}% collected</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent payments — uses flat fields from backend */}
            <div>
              <h3 className="font-semibold text-slate-700 mb-3">Recent Payments</h3>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {dashboard.recent_transactions.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No recent transactions.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {["Student", "Class", "Term", "Amount", "Note", "Recorded By", "Date"].map((h) => (
                          <th key={h} className={`p-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${h === "Student" ? "text-left" : "text-center"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dashboard.recent_transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <div className="font-medium text-slate-800">{t.student_name}</div>
                            <div className="text-xs text-slate-400">{t.admission_number}</div>
                          </td>
                          <td className="p-3 text-center text-slate-600">{t.class}</td>
                          <td className="p-3 text-center text-slate-600">{t.term}</td>
                          <td className="p-3 text-center font-bold text-emerald-600">{fmt(t.amount)}</td>
                          <td className="p-3 text-center text-slate-400 text-xs italic">{t.note || "—"}</td>
                          <td className="p-3 text-center text-slate-500">{t.recorded_by}</td>
                          <td className="p-3 text-center text-slate-400 text-xs">{t.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Income Ledger ── */}
        {tab === "Income Ledger" && ledger && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 max-w-sm">
              <div className="bg-emerald-50 rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="text-2xl font-bold text-emerald-600">{fmt(ledger.total_collected)}</div>
                <div className="text-xs text-slate-500 mt-1">Total Collected</div>
              </div>
              <div className="bg-blue-50 rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="text-2xl font-bold text-blue-600">{ledger.count}</div>
                <div className="text-xs text-slate-500 mt-1">Transactions</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {ledger.transactions.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">No transactions found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {["Student", "Class", "Term", "Amount", "Note", "Recorded By", "Date & Time"].map((h) => (
                          <th key={h} className={`p-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${h === "Student" ? "text-left" : "text-center"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledger.transactions.map((t, i) => (
                        <tr key={t.id} className={`hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                          <td className="p-3">
                            <div className="font-medium text-slate-800">{t.student_name}</div>
                            <div className="text-xs text-slate-400">{t.admission_number}</div>
                          </td>
                          <td className="p-3 text-center text-slate-600">{t.class}</td>
                          <td className="p-3 text-center text-slate-600">{t.term}</td>
                          <td className="p-3 text-center font-bold text-emerald-600">{fmt(t.amount)}</td>
                          <td className="p-3 text-center text-slate-400 text-xs italic">{t.note || "—"}</td>
                          <td className="p-3 text-center text-slate-500">{t.recorded_by}</td>
                          <td className="p-3 text-center text-slate-400 text-xs">{t.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Collection Report ── */}
        {tab === "Collection Report" && !loading && (
          <div className="space-y-4">
            {collection.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-4xl mb-2">📊</div>
                <p>No data found for the selected filters.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {["Class", "Students", "Total Billed", "Total Paid", "Outstanding", "Fully Paid", "Unpaid", "Collection Rate"].map((h) => (
                          <th key={h} className={`p-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${h === "Class" ? "text-left" : "text-center"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {collection.map((row, i) => (
                        <tr key={row.class_id} className={`hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                          <td className="p-3 font-medium text-slate-800">{row.class_name}</td>
                          <td className="p-3 text-center text-slate-600">{row.total_students}</td>
                          <td className="p-3 text-center text-slate-700">{fmt(row.total_billed)}</td>
                          <td className="p-3 text-center font-medium text-emerald-600">{fmt(row.total_paid)}</td>
                          <td className="p-3 text-center font-medium text-red-500">{fmt(row.total_balance)}</td>
                          <td className="p-3 text-center text-emerald-600">{row.fully_paid}</td>
                          <td className="p-3 text-center text-red-500">{row.unpaid}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-200 rounded-full h-2">
                                <div className={`h-2 rounded-full transition-all ${row.collection_rate >= 80 ? "bg-emerald-500" : row.collection_rate >= 50 ? "bg-amber-400" : "bg-red-500"}`}
                                  style={{ width: `${row.collection_rate}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-slate-600 w-10 text-right">{row.collection_rate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Defaulters ── */}
        {tab === "Defaulters" && defaulters && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 max-w-sm">
              <div className="bg-red-50 rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="text-2xl font-bold text-red-600">{fmt(defaulters.total_outstanding)}</div>
                <div className="text-xs text-slate-500 mt-1">Total Outstanding</div>
              </div>
              <div className="bg-amber-50 rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="text-2xl font-bold text-amber-600">{defaulters.count}</div>
                <div className="text-xs text-slate-500 mt-1">Students with Balance</div>
              </div>
            </div>

            {defaulters.defaulters.length === 0 ? (
              <div className="text-center py-10 text-emerald-600 font-medium">
                🎉 No defaulters found for the selected filters.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {["Student", "Class", "Term", "Total", "Paid", "Balance", "Arrears"].map((h) => (
                          <th key={h} className={`p-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${h === "Student" ? "text-left" : "text-center"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {defaulters.defaulters.map((d, i) => (
                        <tr key={`${d.student_id}-${d.term}`} className={`hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                          <td className="p-3">
                            <div className="font-medium text-slate-800">{d.student_name}</div>
                            <div className="text-xs text-slate-400">{d.admission_number}</div>
                          </td>
                          <td className="p-3 text-center text-slate-600">{d.class}</td>
                          <td className="p-3 text-center text-slate-600">{d.term}</td>
                          <td className="p-3 text-center font-medium text-slate-700">{fmt(d.total_amount)}</td>
                          <td className="p-3 text-center text-emerald-600">{fmt(d.paid)}</td>
                          <td className="p-3 text-center font-bold text-red-600">{fmt(d.balance)}</td>
                          <td className="p-3 text-center text-amber-600">{Number(d.arrears) > 0 ? fmt(d.arrears) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default Accounts;