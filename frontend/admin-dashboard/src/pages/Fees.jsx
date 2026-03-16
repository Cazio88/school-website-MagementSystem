import { useEffect, useState } from "react";
import API from "../services/api";

const TERMS = [
  { value: "term1", label: "Term 1" },
  { value: "term2", label: "Term 2" },
  { value: "term3", label: "Term 3" },
];

const STATUS_FILTERS = [
  { value: "",        label: "All"     },
  { value: "paid",    label: "Paid"    },
  { value: "partial", label: "Partial" },
  { value: "unpaid",  label: "Unpaid"  },
];

const statusBadge = (fee) => {
  if (fee.balance <= 0)
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">PAID</span>;
  if (fee.paid > 0)
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800">PARTIAL</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">UNPAID</span>;
};

const TABS = ["Fee Records", "Assign to Class", "Assign to Student"];

const emptyAssign = {
  amount: "", book_user_fee: "", workbook_fee: "", arrears: "",
};

const Fees = () => {
  const [tab, setTab]                           = useState("Fee Records");
  const [classes, setClasses]                   = useState([]);
  const [students, setStudents]                 = useState([]);
  const [selectedClass, setSelectedClass]       = useState("");
  const [selectedTerm, setSelectedTerm]         = useState("term1");
  const [statusFilter, setStatusFilter]         = useState("");
  const [summary, setSummary]                   = useState(null);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState("");
  const [success, setSuccess]                   = useState("");

  // Pay modal
  const [payingFee, setPayingFee]   = useState(null);
  const [payAmount, setPayAmount]   = useState("");
  const [paying, setPaying]         = useState(false);

  // Arrears modal
  const [arrearsFee, setArrearsFee]         = useState(null);
  const [arrearsAmount, setArrearsAmount]   = useState("");
  const [savingArrears, setSavingArrears]   = useState(false);

  // Assign class
  const [classAssign, setClassAssign] = useState({ ...emptyAssign });
  const [assigning, setAssigning]     = useState(false);

  // Assign student
  const [selectedStudent, setSelectedStudent]     = useState("");
  const [studentAssign, setStudentAssign]         = useState({ ...emptyAssign });
  const [assigningStudent, setAssigningStudent]   = useState(false);

  useEffect(() => { fetchClasses(); }, []);

  useEffect(() => {
    if (selectedClass) fetchStudents(selectedClass);
    else setStudents([]);
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass && selectedTerm) fetchSummary();
    else setSummary(null);
  }, [selectedClass, selectedTerm, statusFilter]);

  useEffect(() => {
    setError(""); setSuccess("");
  }, [tab, selectedClass, selectedTerm]);

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const fetchClasses = async () => {
    try {
      const res = await API.get("/classes/");
      setClasses(res.data.results || res.data);
    } catch { setError("Failed to load classes."); }
  };

  const fetchStudents = async (classId) => {
    try {
      const res  = await API.get(`/students/?school_class=${classId}`);
      const data = res.data.results || res.data;
      setStudents(data);
    } catch { setError("Failed to load students."); }
  };

  const fetchSummary = async () => {
    setLoading(true); setError("");
    try {
      const res = await API.get(
        `/fees/summary/?school_class=${selectedClass}&term=${selectedTerm}` +
        (statusFilter ? `&status=${statusFilter}` : "")
      );
      setSummary(res.data);
    } catch { setError("Failed to load fee records."); }
    finally { setLoading(false); }
  };

  // ------------------------------------------------------------------
  // Bill download helper
  // ------------------------------------------------------------------

  const downloadBill = async (url, filename) => {
    try {
      const res  = await API.get(url, { responseType: "blob" });
      const link = document.createElement("a");
      link.href  = window.URL.createObjectURL(new Blob([res.data]));
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("Fee assigned but bill could not be generated.");
    }
  };

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const submitPayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      setError("Enter a valid payment amount."); return;
    }
    setPaying(true); setError("");
    try {
      await API.post(`/fees/${payingFee.id}/pay/`, { amount: payAmount });
      setSuccess(`Payment of GHS ${payAmount} recorded for ${payingFee.student_name}.`);
      setPayingFee(null); setPayAmount("");
      fetchSummary();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to record payment.");
    } finally { setPaying(false); }
  };

  const submitArrears = async () => {
    if (arrearsAmount === "" || parseFloat(arrearsAmount) < 0) {
      setError("Enter a valid arrears amount."); return;
    }
    setSavingArrears(true); setError("");
    try {
      await API.post(`/fees/${arrearsFee.id}/add-arrears/`, { arrears: arrearsAmount });
      setSuccess(`Arrears updated for ${arrearsFee.student_name}.`);
      setArrearsFee(null); setArrearsAmount("");
      fetchSummary();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update arrears.");
    } finally { setSavingArrears(false); }
  };

  const submitClassAssign = async () => {
    if (!selectedClass || !selectedTerm || !classAssign.amount) {
      setError("Please select a class, term, and enter a fee amount."); return;
    }
    setAssigning(true); setError("");
    try {
      const res = await API.post("/fees/bulk-assign/", {
        school_class:  selectedClass,
        term:          selectedTerm,
        amount:        classAssign.amount,
        book_user_fee: classAssign.book_user_fee || 0,
        workbook_fee:  classAssign.workbook_fee  || 0,
      });
      setSuccess(`Done. ${res.data.created} created, ${res.data.updated} updated. Downloading bill...`);
      setClassAssign({ ...emptyAssign });
      fetchSummary();
      await downloadBill(
        `/fees/bill/class/?school_class=${selectedClass}&term=${selectedTerm}`,
        `class_bill_${selectedTerm}.pdf`,
      );
    } catch (err) {
      setError(err.response?.data?.error || "Failed to assign fees.");
    } finally { setAssigning(false); }
  };

  const submitStudentAssign = async () => {
    if (!selectedStudent || !selectedTerm || !studentAssign.amount) {
      setError("Please select a student, term, and enter a fee amount."); return;
    }
    setAssigningStudent(true); setError("");
    try {
      await API.post("/fees/assign-student/", {
        student:       selectedStudent,
        term:          selectedTerm,
        amount:        studentAssign.amount,
        book_user_fee: studentAssign.book_user_fee || 0,
        workbook_fee:  studentAssign.workbook_fee  || 0,
        arrears:       studentAssign.arrears       || 0,
      });
      setSuccess("Fee assigned successfully. Downloading bill...");
      const capturedStudent = selectedStudent;
      setStudentAssign({ ...emptyAssign });
      setSelectedStudent("");
      fetchSummary();
      await downloadBill(
        `/fees/bill/student/${capturedStudent}/?term=${selectedTerm}`,
        `bill_${capturedStudent}_${selectedTerm}.pdf`,
      );
    } catch (err) {
      setError(err.response?.data?.error || "Failed to assign fee.");
    } finally { setAssigningStudent(false); }
  };

  // ------------------------------------------------------------------
  // Derived state
  // ------------------------------------------------------------------

  const filteredRecords = (summary?.records || []).filter((fee) => {
    if (!statusFilter)              return true;
    if (statusFilter === "paid")    return fee.balance <= 0;
    if (statusFilter === "partial") return fee.paid > 0 && fee.balance > 0;
    if (statusFilter === "unpaid")  return Number(fee.paid) === 0;
    return true;
  });

  // ------------------------------------------------------------------
  // Shared fee form fields component
  // ------------------------------------------------------------------

  const FeeFormFields = ({ values, onChange, showArrears = false }) => (
    <div className="space-y-3">
      <div>
        <label className="text-sm text-gray-600 block mb-1">
          School Fees (GHS) <span className="text-red-500">*</span>
        </label>
        <input type="number" min="0" step="0.01" placeholder="e.g. 500"
          value={values.amount}
          onChange={(e) => onChange("amount", e.target.value)}
          className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-600 block mb-1">Book User Fee (GHS)</label>
          <input type="number" min="0" step="0.01" placeholder="0"
            value={values.book_user_fee}
            onChange={(e) => onChange("book_user_fee", e.target.value)}
            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1">Workbook Fee (GHS)</label>
          <input type="number" min="0" step="0.01" placeholder="0"
            value={values.workbook_fee}
            onChange={(e) => onChange("workbook_fee", e.target.value)}
            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>
      {showArrears && (
        <div>
          <label className="text-sm text-gray-600 block mb-1">Arrears (GHS)</label>
          <input type="number" min="0" step="0.01" placeholder="0"
            value={values.arrears}
            onChange={(e) => onChange("arrears", e.target.value)}
            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      )}
      <div className="p-3 bg-blue-50 rounded text-sm text-blue-700">
        Total: <b>GHS {(
          parseFloat(values.amount        || 0) +
          parseFloat(values.book_user_fee || 0) +
          parseFloat(values.workbook_fee  || 0) +
          parseFloat(values.arrears       || 0)
        ).toLocaleString()}</b>
      </div>
    </div>
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Fees</h1>

      {error   && <div className="mb-4 p-3 bg-red-100   text-red-700   border border-red-300   rounded">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded">{success}</div>}

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
          className="border p-2 rounded min-w-[150px]">
          <option value="">Select Class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
          className="border p-2 rounded">
          {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {tab === "Fee Records" && (
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="border p-2 rounded">
            {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Fee Records ── */}
      {tab === "Fee Records" && (
        <>
          {!selectedClass && <p className="text-gray-400 italic">Select a class to view fee records.</p>}
          {loading && <p className="text-gray-500">Loading...</p>}

          {summary && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {[
                  { label: "Total Expected", value: `GHS ${Number(summary.total_expected).toLocaleString()}`, color: "text-gray-700"  },
                  { label: "Total Paid",     value: `GHS ${Number(summary.total_paid).toLocaleString()}`,     color: "text-green-600" },
                  { label: "Outstanding",    value: `GHS ${Number(summary.total_balance).toLocaleString()}`,  color: "text-red-600"   },
                  { label: "Fully Paid",     value: `${summary.fully_paid} / ${summary.total_students}`,      color: "text-blue-600"  },
                ].map((stat) => (
                  <div key={stat.label} className="border rounded p-4 bg-white shadow-sm">
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Fee breakdown pills */}
              {(summary.total_books > 0 || summary.total_workbooks > 0 || summary.total_arrears > 0) && (
                <div className="flex gap-3 mb-4 text-xs flex-wrap">
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                    School Fees: GHS {Number(summary.total_fees).toLocaleString()}
                  </span>
                  {summary.total_books     > 0 && <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">Book User: GHS {Number(summary.total_books).toLocaleString()}</span>}
                  {summary.total_workbooks > 0 && <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">Workbooks: GHS {Number(summary.total_workbooks).toLocaleString()}</span>}
                  {summary.total_arrears   > 0 && <span className="px-3 py-1 bg-red-50  text-red-700  rounded-full">Arrears: GHS {Number(summary.total_arrears).toLocaleString()}</span>}
                </div>
              )}

              {/* Status badges */}
              <div className="flex gap-3 mb-4 text-sm">
                <span className="px-3 py-1 bg-green-100  text-green-800  rounded-full">{summary.fully_paid} Paid</span>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">{summary.partial} Partial</span>
                <span className="px-3 py-1 bg-red-100    text-red-700    rounded-full">{summary.unpaid} Unpaid</span>
              </div>
            </>
          )}

          {!loading && filteredRecords.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border rounded shadow text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Student</th>
                    <th className="p-2 text-center">Fees</th>
                    <th className="p-2 text-center">Books</th>
                    <th className="p-2 text-center">Workbook</th>
                    <th className="p-2 text-center">Arrears</th>
                    <th className="p-2 text-center font-bold">Total</th>
                    <th className="p-2 text-center">Paid</th>
                    <th className="p-2 text-center">Balance</th>
                    <th className="p-2 text-center">Status</th>
                    <th className="p-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((fee, i) => (
                    <tr key={fee.id} className={`border-t ${i % 2 === 0 ? "" : "bg-gray-50"}`}>
                      <td className="p-2">
                        <div className="font-medium">{fee.student_name}</div>
                        <div className="text-xs text-gray-400">{fee.admission_number}</div>
                      </td>
                      <td className="p-2 text-center">{Number(fee.amount).toLocaleString()}</td>
                      <td className="p-2 text-center">{Number(fee.book_user_fee).toLocaleString()}</td>
                      <td className="p-2 text-center">{Number(fee.workbook_fee).toLocaleString()}</td>
                      <td className="p-2 text-center text-red-600">{Number(fee.arrears).toLocaleString()}</td>
                      <td className="p-2 text-center font-bold">{Number(fee.total_amount).toLocaleString()}</td>
                      <td className="p-2 text-center text-green-600 font-medium">{Number(fee.paid).toLocaleString()}</td>
                      <td className="p-2 text-center text-red-600 font-medium">{Number(fee.balance).toLocaleString()}</td>
                      <td className="p-2 text-center">{statusBadge(fee)}</td>
                      <td className="p-2 text-center">
                        <div className="flex gap-1 justify-center flex-wrap">
                          {fee.balance > 0 && (
                            <button
                              onClick={() => { setPayingFee(fee); setPayAmount(""); setError(""); setSuccess(""); }}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors"
                            >
                              Pay
                            </button>
                          )}
                          <button
                            onClick={() => { setArrearsFee(fee); setArrearsAmount(fee.arrears); setError(""); setSuccess(""); }}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs transition-colors"
                          >
                            Arrears
                          </button>
                          <button
                            onClick={() => downloadBill(
                              `/fees/bill/student/${fee.student}/?term=${selectedTerm}`,
                              `bill_${fee.admission_number}_${selectedTerm}.pdf`,
                            )}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs transition-colors"
                          >
                            Bill
                          </button>
                          {fee.balance <= 0 && (
                            <span className="text-green-600 text-xs font-medium self-center">✓ Cleared</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && selectedClass && summary && filteredRecords.length === 0 && (
            <p className="text-gray-500 mt-4">No fee records found.</p>
          )}
        </>
      )}

      {/* ── TAB 2: Assign to Class ── */}
      {tab === "Assign to Class" && (
        <div className="max-w-md">
          <p className="text-sm text-gray-500 mb-4">
            Assign fees to all students in a class. Book user fee and workbook fee
            are typically only charged in Term 1. Arrears must be set per student.
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Class</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full border p-2 rounded">
                <option value="">Select Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Term</label>
              <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full border p-2 rounded">
                {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <FeeFormFields
              values={classAssign}
              onChange={(field, val) => setClassAssign((p) => ({ ...p, [field]: val }))}
              showArrears={false}
            />
            <button onClick={submitClassAssign} disabled={assigning}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded disabled:opacity-50 transition-colors">
              {assigning ? "Assigning..." : "Assign Fees to Entire Class"}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 3: Assign to Student ── */}
      {tab === "Assign to Student" && (
        <div className="max-w-md">
          <p className="text-sm text-gray-500 mb-4">
            Assign or update fees for a specific student, including any arrears.
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Class</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full border p-2 rounded">
                <option value="">Select Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Student</label>
              <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}
                disabled={!students.length}
                className="w-full border p-2 rounded disabled:opacity-50">
                <option value="">Select Student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.student_name || s.admission_number || "Unknown"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Term</label>
              <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full border p-2 rounded">
                {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <FeeFormFields
              values={studentAssign}
              onChange={(field, val) => setStudentAssign((p) => ({ ...p, [field]: val }))}
              showArrears={true}
            />
            <button onClick={submitStudentAssign} disabled={assigningStudent}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded disabled:opacity-50 transition-colors">
              {assigningStudent ? "Saving..." : "Assign Fee to Student"}
            </button>
          </div>
        </div>
      )}

      {/* ── Pay Modal ── */}
      {payingFee && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-bold mb-1">Record Payment</h2>
            <p className="text-sm text-gray-500 mb-1">{payingFee.student_name}</p>
            <div className="text-xs text-gray-400 mb-4 space-y-0.5">
              <div>Total: GHS {Number(payingFee.total_amount).toLocaleString()}</div>
              <div>Paid:  GHS {Number(payingFee.paid).toLocaleString()}</div>
              <div className="text-red-600 font-medium">
                Balance: GHS {Number(payingFee.balance).toLocaleString()}
              </div>
            </div>
            <label className="text-sm text-gray-600 block mb-1">Payment Amount (GHS)</label>
            <input type="number" min="0.01" step="0.01" max={payingFee.balance}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder={`Max: ${payingFee.balance}`}
              className="w-full border p-2 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={submitPayment} disabled={paying}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded disabled:opacity-50 transition-colors">
                {paying ? "Saving..." : "Confirm Payment"}
              </button>
              <button onClick={() => { setPayingFee(null); setPayAmount(""); }}
                className="flex-1 border py-2 rounded hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Arrears Modal ── */}
      {arrearsFee && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-bold mb-1">Update Arrears</h2>
            <p className="text-sm text-gray-500 mb-4">{arrearsFee.student_name}</p>
            <label className="text-sm text-gray-600 block mb-1">Arrears Amount (GHS)</label>
            <input type="number" min="0" step="0.01"
              value={arrearsAmount}
              onChange={(e) => setArrearsAmount(e.target.value)}
              placeholder="0"
              className="w-full border p-2 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={submitArrears} disabled={savingArrears}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded disabled:opacity-50 transition-colors">
                {savingArrears ? "Saving..." : "Update Arrears"}
              </button>
              <button onClick={() => { setArrearsFee(null); setArrearsAmount(""); }}
                className="flex-1 border py-2 rounded hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fees;