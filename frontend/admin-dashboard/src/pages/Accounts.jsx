import { useEffect, useState } from "react";
import API from "../services/api";

const TERMS = [
  { value: "",      label: "All Terms" },
  { value: "term1", label: "Term 1"    },
  { value: "term2", label: "Term 2"    },
  { value: "term3", label: "Term 3"    },
];

const TABS = ["Dashboard", "Income Ledger", "Collection Report", "Defaulters"];

const fmt = (n) => `GHS ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const Accounts = () => {
  const [tab, setTab]               = useState("Dashboard");
  const [classes, setClasses]       = useState([]);
  const [selectedTerm, setSelectedTerm]   = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  // Dashboard
  const [dashboard, setDashboard] = useState(null);

  // Ledger
  const [ledger, setLedger]       = useState(null);

  // Collection
  const [collection, setCollection] = useState([]);

  // Defaulters
  const [defaulters, setDefaulters] = useState(null);

  useEffect(() => { fetchClasses(); }, []);

  useEffect(() => {
    setError("");
    if (tab === "Dashboard")          fetchDashboard();
    if (tab === "Income Ledger")      fetchLedger();
    if (tab === "Collection Report")  fetchCollection();
    if (tab === "Defaulters")         fetchDefaulters();
  }, [tab, selectedTerm, selectedClass]);

  const fetchClasses = async () => {
    try {
      const res = await API.get("/classes/");
      setClasses(res.data.results || res.data);
    } catch { setError("Failed to load classes."); }
  };

  const buildQuery = () => {
    const params = [];
    if (selectedTerm)  params.push(`term=${selectedTerm}`);
    if (selectedClass) params.push(`school_class=${selectedClass}`);
    return params.length ? `?${params.join("&")}` : "";
  };

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/accounts/dashboard/${buildQuery()}`);
      setDashboard(res.data);
    } catch { setError("Failed to load dashboard."); }
    finally { setLoading(false); }
  };

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/accounts/ledger/${buildQuery()}`);
      setLedger(res.data);
    } catch { setError("Failed to load ledger."); }
    finally { setLoading(false); }
  };

  const fetchCollection = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/accounts/collection/${buildQuery()}`);
      setCollection(res.data);
    } catch { setError("Failed to load collection report."); }
    finally { setLoading(false); }
  };

  const fetchDefaulters = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/accounts/defaulters/${buildQuery()}`);
      setDefaulters(res.data);
    } catch { setError("Failed to load defaulters."); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Accounts</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded">{error}</div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
          className="border p-2 rounded">
          {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
          className="border p-2 rounded min-w-[150px]">
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}

      {/* ── TAB 1: Dashboard ── */}
      {tab === "Dashboard" && dashboard && !loading && (
        <div className="space-y-6">

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Billed",     value: fmt(dashboard.total_billed),   color: "text-gray-700"  },
              { label: "Total Collected",  value: fmt(dashboard.total_paid),     color: "text-green-600" },
              { label: "Outstanding",      value: fmt(dashboard.total_balance),  color: "text-red-600"   },
              { label: "Collection Rate",  value: `${dashboard.collection_rate}%`, color: "text-blue-600"  },
            ].map((s) => (
              <div key={s.label} className="border rounded p-4 bg-white shadow-sm">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Payment status */}
          <div className="flex gap-3 text-sm flex-wrap">
            <span className="px-3 py-1 bg-green-100  text-green-800  rounded-full">{dashboard.fully_paid} Fully Paid</span>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">{dashboard.partial}    Partial</span>
            <span className="px-3 py-1 bg-red-100    text-red-700    rounded-full">{dashboard.unpaid}     Unpaid</span>
          </div>

          {/* Term breakdown */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">Term Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {dashboard.term_breakdown.map((t) => (
                <div key={t.term} className="border rounded p-4 bg-white shadow-sm">
                  <div className="font-semibold text-blue-700 mb-2">{t.label}</div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Billed</span>
                      <span className="font-medium">{fmt(t.billed)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Collected</span>
                      <span className="font-medium text-green-600">{fmt(t.paid)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Outstanding</span>
                      <span className="font-medium text-red-600">{fmt(t.balance)}</span>
                    </div>
                  </div>
                  {/* Collection bar */}
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{ width: `${t.billed > 0 ? Math.round((t.paid / t.billed) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {t.billed > 0 ? Math.round((t.paid / t.billed) * 100) : 0}% collected
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent transactions */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">Recent Payments</h3>
            <div className="border rounded shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Student</th>
                    <th className="p-2 text-center">Term</th>
                    <th className="p-2 text-center">Amount</th>
                    <th className="p-2 text-center">Recorded By</th>
                    <th className="p-2 text-center">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recent_transactions.map((t) => (
                    <tr key={t.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 font-medium">{t.fee?.student_name || "-"}</td>
                      <td className="p-2 text-center">{t.fee?.term || "-"}</td>
                      <td className="p-2 text-center text-green-600 font-medium">{fmt(t.amount)}</td>
                      <td className="p-2 text-center text-gray-500">{t.recorded_by_name || "-"}</td>
                      <td className="p-2 text-center text-gray-400 text-xs">
                        {new Date(t.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ── TAB 2: Income Ledger ── */}
      {tab === "Income Ledger" && ledger && !loading && (
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="border rounded p-4 bg-white shadow-sm">
              <div className="text-2xl font-bold text-green-600">{fmt(ledger.total_collected)}</div>
              <div className="text-xs text-gray-500 mt-1">Total Collected</div>
            </div>
            <div className="border rounded p-4 bg-white shadow-sm">
              <div className="text-2xl font-bold text-blue-600">{ledger.count}</div>
              <div className="text-xs text-gray-500 mt-1">Transactions</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border rounded shadow text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Student</th>
                  <th className="p-2 text-center">Class</th>
                  <th className="p-2 text-center">Term</th>
                  <th className="p-2 text-center">Amount</th>
                  <th className="p-2 text-left">Note</th>
                  <th className="p-2 text-center">Recorded By</th>
                  <th className="p-2 text-center">Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {ledger.transactions.map((t, i) => (
                  <tr key={t.id} className={`border-t ${i % 2 === 0 ? "" : "bg-gray-50"}`}>
                    <td className="p-2">
                      <div className="font-medium">{t.student_name}</div>
                      <div className="text-xs text-gray-400">{t.admission_number}</div>
                    </td>
                    <td className="p-2 text-center text-gray-600">{t.class}</td>
                    <td className="p-2 text-center">{t.term}</td>
                    <td className="p-2 text-center text-green-600 font-bold">{fmt(t.amount)}</td>
                    <td className="p-2 text-gray-500 text-xs">{t.note || "-"}</td>
                    <td className="p-2 text-center text-gray-500">{t.recorded_by}</td>
                    <td className="p-2 text-center text-gray-400 text-xs">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ledger.transactions.length === 0 && (
            <p className="text-gray-500">No transactions found.</p>
          )}
        </div>
      )}

      {/* ── TAB 3: Collection Report ── */}
      {tab === "Collection Report" && !loading && (
        <div className="space-y-4">
          {collection.length === 0 && <p className="text-gray-500">No data found.</p>}
          <div className="overflow-x-auto">
            <table className="w-full border rounded shadow text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Class</th>
                  <th className="p-2 text-center">Students</th>
                  <th className="p-2 text-center">Total Billed</th>
                  <th className="p-2 text-center">Total Paid</th>
                  <th className="p-2 text-center">Outstanding</th>
                  <th className="p-2 text-center">Fully Paid</th>
                  <th className="p-2 text-center">Unpaid</th>
                  <th className="p-2 text-center">Collection Rate</th>
                </tr>
              </thead>
              <tbody>
                {collection.map((row, i) => (
                  <tr key={row.class_id} className={`border-t ${i % 2 === 0 ? "" : "bg-gray-50"}`}>
                    <td className="p-2 font-medium">{row.class_name}</td>
                    <td className="p-2 text-center">{row.total_students}</td>
                    <td className="p-2 text-center">{fmt(row.total_billed)}</td>
                    <td className="p-2 text-center text-green-600 font-medium">{fmt(row.total_paid)}</td>
                    <td className="p-2 text-center text-red-600 font-medium">{fmt(row.total_balance)}</td>
                    <td className="p-2 text-center text-green-600">{row.fully_paid}</td>
                    <td className="p-2 text-center text-red-600">{row.unpaid}</td>
                    <td className="p-2 text-center">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              row.collection_rate >= 80 ? "bg-green-500" :
                              row.collection_rate >= 50 ? "bg-yellow-400" : "bg-red-500"
                            }`}
                            style={{ width: `${row.collection_rate}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-10">{row.collection_rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: Defaulters ── */}
      {tab === "Defaulters" && defaulters && !loading && (
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="border rounded p-4 bg-white shadow-sm">
              <div className="text-2xl font-bold text-red-600">{fmt(defaulters.total_outstanding)}</div>
              <div className="text-xs text-gray-500 mt-1">Total Outstanding</div>
            </div>
            <div className="border rounded p-4 bg-white shadow-sm">
              <div className="text-2xl font-bold text-orange-600">{defaulters.count}</div>
              <div className="text-xs text-gray-500 mt-1">Students with Balance</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border rounded shadow text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Student</th>
                  <th className="p-2 text-center">Class</th>
                  <th className="p-2 text-center">Term</th>
                  <th className="p-2 text-center">Total</th>
                  <th className="p-2 text-center">Paid</th>
                  <th className="p-2 text-center">Balance</th>
                  <th className="p-2 text-center">Arrears</th>
                </tr>
              </thead>
              <tbody>
                {defaulters.defaulters.map((d, i) => (
                  <tr key={`${d.student_id}-${d.term}`} className={`border-t ${i % 2 === 0 ? "" : "bg-gray-50"}`}>
                    <td className="p-2">
                      <div className="font-medium">{d.student_name}</div>
                      <div className="text-xs text-gray-400">{d.admission_number}</div>
                    </td>
                    <td className="p-2 text-center text-gray-600">{d.class}</td>
                    <td className="p-2 text-center">{d.term}</td>
                    <td className="p-2 text-center font-medium">{fmt(d.total_amount)}</td>
                    <td className="p-2 text-center text-green-600">{fmt(d.paid)}</td>
                    <td className="p-2 text-center text-red-600 font-bold">{fmt(d.balance)}</td>
                    <td className="p-2 text-center text-orange-600">
                      {Number(d.arrears) > 0 ? fmt(d.arrears) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {defaulters.defaulters.length === 0 && (
            <p className="text-green-600 font-medium">🎉 No defaulters found for the selected filters.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Accounts;