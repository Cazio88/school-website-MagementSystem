import { useEffect, useState, useCallback, useRef } from "react";
import { getUser, logout } from "../../services/auth";
import API from "../../services/api";
import AnnouncementsFeed from "../AnnouncementsFeed";

/* ─────────────────────────────────────────────
   Global styles (injected once)
───────────────────────────────────────────── */
const PORTAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');

  :root {
    --navy:     #0a0f1e;
    --navy-2:   #111827;
    --navy-3:   #1e293b;
    --slate:    #334155;
    --muted:    #64748b;
    --dim:      #94a3b8;
    --line:     #e8ecf0;
    --surface:  #ffffff;
    --bg:       #f0f2f5;
    --blue:     #2563eb;
    --blue-l:   #eff6ff;
    --green:    #16a34a;
    --green-l:  #f0fdf4;
    --amber:    #d97706;
    --amber-l:  #fffbeb;
    --red:      #dc2626;
    --red-l:    #fef2f2;
  }

  .sp-root * { box-sizing: border-box; }
  .sp-root { font-family: 'Outfit', sans-serif; background: var(--bg); min-height: 100vh; color: var(--slate); }

  /* Header */
  .sp-header { background: var(--navy); position: sticky; top: 0; z-index: 40; }
  .sp-header-inner { max-width: 960px; margin: 0 auto; padding: 0 20px; height: 58px; display: flex; align-items: center; gap: 14px; }
  .sp-avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,.15); flex-shrink:0; }
  .sp-avatar-fallback { width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,#3b82f6,#6366f1); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; color:#fff; flex-shrink:0; }
  .sp-header-name { color: #fff; font-weight: 700; font-size: 14px; line-height: 1.2; }
  .sp-header-sub  { color: rgba(255,255,255,.4); font-size: 11.5px; font-family: 'DM Mono', monospace; }
  .sp-header-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .sp-btn-ghost { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1); color: rgba(255,255,255,.6); border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: 'Outfit', sans-serif; transition: all .15s; white-space: nowrap; }
  .sp-btn-ghost:hover { background: rgba(255,255,255,.12); color: #fff; }
  .sp-btn-danger { background: rgba(220,38,38,.12); border: 1px solid rgba(220,38,38,.2); color: #f87171; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: 'Outfit', sans-serif; transition: all .15s; }
  .sp-btn-danger:hover { background: rgba(220,38,38,.2); color: #fca5a5; }

  /* Desktop nav */
  .sp-nav { display: flex; gap: 2px; }
  .sp-nav-btn { display: flex; align-items: center; gap: 6px; padding: 6px 13px; border-radius: 8px; font-size: 13px; font-weight: 500; border: none; background: transparent; color: rgba(255,255,255,.45); cursor: pointer; font-family: 'Outfit', sans-serif; transition: all .15s; white-space: nowrap; }
  .sp-nav-btn:hover { color: rgba(255,255,255,.8); background: rgba(255,255,255,.06); }
  .sp-nav-btn-active { background: rgba(255,255,255,.1); color: #fff; font-weight: 600; }

  /* Mobile nav */
  .sp-mobile-nav { display: none; background: var(--navy-2); border-top: 1px solid rgba(255,255,255,.06); overflow-x: auto; scrollbar-width: none; }
  .sp-mobile-nav::-webkit-scrollbar { display: none; }
  .sp-mobile-nav-inner { display: flex; padding: 4px 12px 8px; gap: 4px; }
  .sp-mobile-btn { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 14px; border-radius: 8px; font-size: 10px; font-weight: 600; border: none; background: transparent; color: rgba(255,255,255,.4); cursor: pointer; font-family: 'Outfit', sans-serif; transition: all .15s; letter-spacing: .3px; text-transform: uppercase; }
  .sp-mobile-btn-active { background: rgba(255,255,255,.1); color: #fff; }

  @media (max-width: 700px) {
    .sp-nav { display: none; }
    .sp-mobile-nav { display: block; }
  }

  /* Body */
  .sp-body { max-width: 960px; margin: 0 auto; padding: 24px 20px 48px; }

  /* Term bar */
  .sp-term-bar { background: var(--surface); border-radius: 14px; border: 1px solid var(--line); padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .sp-field-label { font-size: 10.5px; font-weight: 700; color: var(--dim); text-transform: uppercase; letter-spacing: .6px; display: block; margin-bottom: 5px; }
  .sp-select { border: 1.5px solid var(--line); border-radius: 9px; padding: 8px 32px 8px 12px; font-size: 13.5px; font-family: 'Outfit', sans-serif; color: var(--navy-2); background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 10px center; appearance: none; outline: none; cursor: pointer; transition: border-color .15s; }
  .sp-select:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
  .sp-btn-pdf { margin-left: auto; background: var(--red); color: #fff; border: none; border-radius: 9px; padding: 9px 18px; font-size: 13px; font-weight: 600; font-family: 'Outfit', sans-serif; cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 7px; }
  .sp-btn-pdf:hover { background: #b91c1c; transform: translateY(-1px); }

  /* KPI grid */
  .sp-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
  @media (max-width: 600px) { .sp-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
  .sp-kpi { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 16px 14px; text-align: center; }
  .sp-kpi-value { font-size: 26px; font-weight: 900; color: var(--blue); letter-spacing: -1px; line-height: 1; font-family: 'DM Mono', monospace; }
  .sp-kpi-sub   { font-size: 11px; color: var(--blue); font-weight: 500; margin-top: 2px; }
  .sp-kpi-label { font-size: 10px; font-weight: 700; color: var(--dim); text-transform: uppercase; letter-spacing: .7px; margin-top: 5px; }

  /* Card */
  .sp-card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; margin-bottom: 14px; }
  .sp-card-head { padding: 14px 18px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; }
  .sp-card-title { font-weight: 700; font-size: 13.5px; color: var(--navy-2); }

  /* Table */
  .sp-table-wrap { overflow-x: auto; }
  .sp-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .sp-table thead tr { background: #f8fafc; }
  .sp-table thead th { padding: 10px 14px; font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .6px; white-space: nowrap; }
  .sp-table thead th.c { text-align: center; }
  .sp-table tbody tr { border-top: 1px solid #f1f5f9; transition: background .1s; }
  .sp-table tbody tr:hover { background: #f8faff; }
  .sp-table td { padding: 10px 14px; color: var(--slate); }
  .sp-table td.c { text-align: center; }
  .sp-score { font-weight: 800; color: var(--blue); font-family: 'DM Mono', monospace; }
  .sp-muted { color: var(--dim); }

  /* Grade/remark badges */
  .sp-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; font-family: 'DM Mono', monospace; }

  /* Alert */
  .sp-alert { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 11px; margin-bottom: 16px; font-size: 13.5px; border: 1px solid #fecaca; background: var(--red-l); color: var(--red); }

  /* Empty */
  .sp-empty { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 64px 20px; text-align: center; }
  .sp-empty-icon { font-size: 42px; margin-bottom: 12px; }
  .sp-empty h3 { font-weight: 700; color: var(--navy-2); margin: 0 0 5px; font-size: 15px; }
  .sp-empty p  { color: var(--dim); font-size: 13px; margin: 0; }

  /* Loading */
  .sp-loading { text-align: center; padding: 64px 20px; color: var(--dim); font-size: 13.5px; }
  .sp-spinner { width: 24px; height: 24px; border: 2.5px solid var(--line); border-top-color: var(--blue); border-radius: 50%; animation: sp-spin .65s linear infinite; margin: 0 auto 12px; }
  @keyframes sp-spin { to { transform: rotate(360deg); } }

  /* Attendance bar */
  .sp-progress-bar { height: 8px; border-radius: 99px; background: var(--line); overflow: hidden; margin-top: 6px; }
  .sp-progress-fill { height: 100%; border-radius: 99px; transition: width .5s ease; }

  /* Highlight cards */
  .sp-hl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  @media (max-width: 500px) { .sp-hl-grid { grid-template-columns: 1fr; } }
  .sp-hl { border-radius: 14px; padding: 16px 18px; border: 1px solid; }
  .sp-hl-green { background: var(--green-l); border-color: #bbf7d0; }
  .sp-hl-red   { background: var(--red-l);   border-color: #fecaca; }
  .sp-hl-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 4px; }
  .sp-hl-name  { font-weight: 700; font-size: 14px; color: var(--navy-2); }
  .sp-hl-delta { font-size: 13px; font-weight: 600; margin-top: 3px; }

  /* Overall trend summary cards */
  .sp-trend-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
  @media (max-width: 500px) { .sp-trend-cards { grid-template-columns: 1fr; } }
  .sp-trend-card { text-align: center; background: #f8fafc; border-radius: 10px; padding: 12px 8px; border: 1px solid var(--line); }

  /* Subject chart card */
  .sp-chart-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  @media (max-width: 540px) { .sp-chart-grid { grid-template-columns: 1fr; } }
  .sp-chart-card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; }

  /* Fee card */
  .sp-fee-card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px 20px; margin-bottom: 12px; }
  .sp-fee-row  { display: flex; justify-content: space-between; font-size: 13.5px; padding: 4px 0; color: var(--muted); }
  .sp-fee-total { border-top: 1px solid var(--line); margin-top: 8px; padding-top: 8px; font-weight: 700; color: var(--navy-2); }

  /* Password modal */
  .sp-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; animation: sp-fade-in .15s ease; }
  @keyframes sp-fade-in { from { opacity: 0; } to { opacity: 1; } }
  .sp-modal { background: #fff; border-radius: 18px; width: 100%; max-width: 420px; padding: 28px; box-shadow: 0 24px 64px rgba(0,0,0,.18); animation: sp-slide-up .2s ease; }
  @keyframes sp-slide-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .sp-modal-title { font-size: 18px; font-weight: 800; color: var(--navy); margin: 0 0 4px; }
  .sp-modal-sub { font-size: 13px; color: var(--dim); margin: 0 0 22px; }
  .sp-modal-field { margin-bottom: 14px; }
  .sp-modal-input { width: 100%; border: 1.5px solid var(--line); border-radius: 9px; padding: 10px 40px 10px 13px; font-size: 14px; font-family: 'Outfit', sans-serif; color: var(--navy-2); outline: none; transition: border-color .15s; background: #fff; }
  .sp-modal-input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
  .sp-modal-input-wrap { position: relative; }
  .sp-modal-eye { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--dim); padding: 2px; display: flex; align-items: center; }
  .sp-modal-eye:hover { color: var(--slate); }
  .sp-pw-strength { height: 4px; border-radius: 99px; margin-top: 6px; transition: all .3s; }
  .sp-pw-hint { font-size: 11px; color: var(--dim); margin-top: 4px; }
  .sp-modal-actions { display: flex; gap: 10px; margin-top: 20px; }
  .sp-btn-primary { flex: 1; background: var(--navy); color: #fff; border: none; border-radius: 9px; padding: 11px; font-size: 14px; font-weight: 600; font-family: 'Outfit', sans-serif; cursor: pointer; transition: all .15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .sp-btn-primary:hover:not(:disabled) { background: var(--navy-3); }
  .sp-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .sp-btn-secondary { background: var(--bg); color: var(--slate); border: 1.5px solid var(--line); border-radius: 9px; padding: 11px 18px; font-size: 14px; font-weight: 600; font-family: 'Outfit', sans-serif; cursor: pointer; transition: all .15s; }
  .sp-btn-secondary:hover { background: var(--line); }
  .sp-pw-success { background: var(--green-l); border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 9px; font-size: 13.5px; color: var(--green); font-weight: 500; margin-top: 4px; }
  .sp-pw-error { background: var(--red-l); border: 1px solid #fecaca; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: var(--red); margin-top: 8px; }

  /* Remarks section */
  .sp-remark-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f8fafc; font-size: 13.5px; }
  .sp-remark-row:last-child { border-bottom: none; }
  .sp-remark-quote { background: #f8fafc; border-left: 3px solid var(--blue); border-radius: 0 8px 8px 0; padding: 10px 14px; font-style: italic; color: var(--slate); font-size: 13.5px; margin-top: 8px; }

  /* Fees status badge */
  .sp-status-paid    { background: #dcfce7; color: #166534; border-radius: 20px; padding: 3px 10px; font-size: 11px; font-weight: 700; }
  .sp-status-partial { background: #fef9c3; color: #854d0e; border-radius: 20px; padding: 3px 10px; font-size: 11px; font-weight: 700; }
  .sp-status-unpaid  { background: #fee2e2; color: #991b1b; border-radius: 20px; padding: 3px 10px; font-size: 11px; font-weight: 700; }
`;

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const TERMS = [
  { value: "term1", label: "Term 1" },
  { value: "term2", label: "Term 2" },
  { value: "term3", label: "Term 3" },
];

const GRADE_COLORS = {
  "1":  { bg: "#dcfce7", color: "#166534" },
  "2":  { bg: "#d1fae5", color: "#065f46" },
  "3":  { bg: "#dbeafe", color: "#1e40af" },
  "4":  { bg: "#cffafe", color: "#164e63" },
  "5":  { bg: "#fef9c3", color: "#854d0e" },
  "6":  { bg: "#ffedd5", color: "#9a3412" },
  "7":  { bg: "#fee2e2", color: "#991b1b" },
  "8":  { bg: "#fecaca", color: "#7f1d1d" },
  "9":  { bg: "#fca5a5", color: "#450a0a" },
  "A":  { bg: "#dcfce7", color: "#166534" },
  "B":  { bg: "#d1fae5", color: "#065f46" },
  "C":  { bg: "#dbeafe", color: "#1e40af" },
  "D":  { bg: "#cffafe", color: "#164e63" },
  "E2": { bg: "#ffedd5", color: "#9a3412" },
  "E3": { bg: "#fee2e2", color: "#991b1b" },
  "E4": { bg: "#fecaca", color: "#7f1d1d" },
  "E5": { bg: "#fca5a5", color: "#450a0a" },
};

const SUBJECT_PALETTE = [
  "#2563eb","#16a34a","#d97706","#dc2626",
  "#7c3aed","#0891b2","#ea580c","#65a30d",
  "#db2777","#4f46e5",
];

const TABS = [
  { key: "Results",       icon: "📊", label: "Results"       },
  { key: "Progress",      icon: "📈", label: "Progress"      },
  { key: "Report Card",   icon: "📄", label: "Report Card"   },
  { key: "Fees",          icon: "💳", label: "Fees"          },
  { key: "Announcements", icon: "📢", label: "Announcements" },
];

/* ─────────────────────────────────────────────
   Password strength
───────────────────────────────────────────── */
function pwStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "transparent" };
  let s = 0;
  if (pw.length >= 8)             s++;
  if (/[A-Z]/.test(pw))           s++;
  if (/[0-9]/.test(pw))           s++;
  if (/[^A-Za-z0-9]/.test(pw))   s++;
  const map = [
    { label: "Too short",  color: "#f87171", w: "25%" },
    { label: "Weak",       color: "#fb923c", w: "40%" },
    { label: "Fair",       color: "#fbbf24", w: "60%" },
    { label: "Good",       color: "#34d399", w: "80%" },
    { label: "Strong",     color: "#16a34a", w: "100%" },
  ];
  return { score: s, ...map[Math.min(s, map.length - 1)] };
}

/* ─────────────────────────────────────────────
   Eye icon
───────────────────────────────────────────── */
const EyeIcon = ({ open }) => open ? (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

/* ─────────────────────────────────────────────
   Change Password Modal
───────────────────────────────────────────── */
const ChangePasswordModal = ({ onClose }) => {
  const [current, setCurrent]   = useState("");
  const [next, setNext]         = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showCur, setShowCur]   = useState(false);
  const [showNew, setShowNew]   = useState(false);
  const [showCon, setShowCon]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);

  const strength = pwStrength(next);
  const mismatch = confirm && next !== confirm;

  const handleSubmit = async () => {
    setError("");
    if (!current)               return setError("Enter your current password.");
    if (next.length < 8)        return setError("New password must be at least 8 characters.");
    if (next !== confirm)       return setError("New passwords do not match.");
    setSaving(true);
    try {
      await API.post("/auth/change-password/", {
        old_password: current,
        new_password: next,
      });
      setSuccess(true);
      setTimeout(onClose, 2200);
    } catch (e) {
      const data = e.response?.data;
      setError(
        data?.old_password?.[0] ||
        data?.new_password?.[0] ||
        data?.detail ||
        "Failed to change password. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sp-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sp-modal">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"18px" }}>
          <div>
            <p className="sp-modal-title">Change Password</p>
            <p className="sp-modal-sub">Keep your account secure with a strong password.</p>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:"20px", padding:"2px", lineHeight:1 }}>×</button>
        </div>

        {success ? (
          <div className="sp-pw-success">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Password changed successfully!
          </div>
        ) : (
          <>
            {/* Current password */}
            <div className="sp-modal-field">
              <label className="sp-field-label">Current Password</label>
              <div className="sp-modal-input-wrap">
                <input type={showCur ? "text" : "password"} className="sp-modal-input"
                  placeholder="Enter current password" value={current}
                  onChange={e => { setCurrent(e.target.value); setError(""); }} />
                <button className="sp-modal-eye" onClick={() => setShowCur(v => !v)}>
                  <EyeIcon open={showCur} />
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="sp-modal-field">
              <label className="sp-field-label">New Password</label>
              <div className="sp-modal-input-wrap">
                <input type={showNew ? "text" : "password"} className="sp-modal-input"
                  placeholder="Min. 8 characters" value={next}
                  onChange={e => { setNext(e.target.value); setError(""); }} />
                <button className="sp-modal-eye" onClick={() => setShowNew(v => !v)}>
                  <EyeIcon open={showNew} />
                </button>
              </div>
              {next && (
                <>
                  <div className="sp-pw-strength" style={{ background: strength.color, width: strength.w }} />
                  <p className="sp-pw-hint" style={{ color: strength.color }}>{strength.label}</p>
                </>
              )}
            </div>

            {/* Confirm */}
            <div className="sp-modal-field">
              <label className="sp-field-label">Confirm New Password</label>
              <div className="sp-modal-input-wrap">
                <input type={showCon ? "text" : "password"}
                  className="sp-modal-input"
                  style={ mismatch ? { borderColor:"#f87171" } : confirm && !mismatch ? { borderColor:"#34d399" } : {} }
                  placeholder="Repeat new password" value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError(""); }} />
                <button className="sp-modal-eye" onClick={() => setShowCon(v => !v)}>
                  <EyeIcon open={showCon} />
                </button>
              </div>
              {mismatch && <p className="sp-pw-hint" style={{ color:"#f87171" }}>Passwords don't match</p>}
            </div>

            {error && <div className="sp-pw-error">{error}</div>}

            <div className="sp-modal-actions">
              <button className="sp-btn-secondary" onClick={onClose}>Cancel</button>
              <button className="sp-btn-primary" onClick={handleSubmit} disabled={saving || mismatch}>
                {saving ? <><div style={{ width:"15px",height:"15px",border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"sp-spin .6s linear infinite" }}/> Saving…</> : "Update Password"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Grade badge
───────────────────────────────────────────── */
const GradeBadge = ({ grade }) => {
  const c = GRADE_COLORS[grade];
  return (
    <span className="sp-badge" style={ c ? { background: c.bg, color: c.color } : { background:"#f1f5f9", color:"#64748b" }}>
      {grade ?? "—"}
    </span>
  );
};

const RemarkBadge = ({ grade, remark }) => {
  const c = GRADE_COLORS[grade];
  return (
    <span className="sp-badge" style={ c ? { background: c.bg, color: c.color, fontWeight:500, fontFamily:"'Outfit',sans-serif" } : { background:"#f1f5f9", color:"#94a3b8" }}>
      {remark ?? "—"}
    </span>
  );
};

/* ─────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────── */
const KpiCard = ({ label, value, sub }) => (
  <div className="sp-kpi">
    <div className="sp-kpi-value">{value ?? "—"}</div>
    {sub && <div className="sp-kpi-sub">{sub}</div>}
    <div className="sp-kpi-label">{label}</div>
  </div>
);

/* ─────────────────────────────────────────────
   Subject table (shared between Results & Report)
───────────────────────────────────────────── */
const SubjectTable = ({ report }) => (
  <div className="sp-card">
    <div className="sp-table-wrap">
      <table className="sp-table">
        <thead>
          <tr>
            <th style={{textAlign:"left",padding:"10px 14px"}}>Subject</th>
            <th className="c">Re-Open</th>
            <th className="c">CA/MGT</th>
            <th className="c">Exams</th>
            <th className="c">Total</th>
            {report.show_position && <th className="c">Pos</th>}
            <th className="c">Grade</th>
            <th className="c">Remark</th>
          </tr>
        </thead>
        <tbody>
          {report.subjects?.map((sub, i) => (
            <tr key={i}>
              <td style={{fontWeight:"600",color:"#1e293b"}}>{sub.subject}</td>
              <td className="c sp-muted">{sub.reopen ?? "—"}</td>
              <td className="c sp-muted">{sub.ca     ?? "—"}</td>
              <td className="c sp-muted">{sub.exams  ?? "—"}</td>
              <td className="c sp-score">{sub.score}</td>
              {report.show_position && <td className="c" style={{fontWeight:"600",color:"#64748b"}}>{sub.subject_position ?? "—"}</td>}
              <td className="c"><GradeBadge grade={sub.grade} /></td>
              <td className="c"><RemarkBadge grade={sub.grade} remark={sub.remark} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   SVG Line Chart for subject trends
───────────────────────────────────────────── */
const SubjectLineChart = ({ subject, data, color }) => {
  const W = 280, H = 90, PAD = 18;
  const scores = data.map(d => d.score);
  const min    = Math.max(0,   Math.min(...scores) - 12);
  const max    = Math.min(100, Math.max(...scores) + 12);
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

  return (
    <div className="sp-chart-card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
        <p style={{ fontWeight:"700", fontSize:"13px", color:"#1e293b", margin:0 }}>{subject}</p>
        <div style={{ textAlign:"right" }}>
          <p style={{ fontFamily:"'DM Mono',monospace", fontWeight:"800", color:color, fontSize:"18px", margin:0, lineHeight:1 }}>{latest}</p>
          {diff != null && Math.abs(diff) >= 0.5 && (
            <p style={{ fontSize:"11px", fontWeight:"600", margin:0, color: diff > 0 ? "#16a34a" : "#dc2626" }}>
              {diff > 0 ? `▲ +${diff.toFixed(1)}` : `▼ ${diff.toFixed(1)}`}
            </p>
          )}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:76 }}>
        {areaD && <path d={areaD} fill={color} fillOpacity="0.07" />}
        {[0,.5,1].map(t => (
          <line key={t} x1={PAD} y1={PAD+t*(H-PAD*2)} x2={W-PAD} y2={PAD+t*(H-PAD*2)} stroke="#f1f5f9" strokeWidth="1"/>
        ))}
        {pts.length > 1 && <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4.5" fill="white" stroke={color} strokeWidth="2.5"/>
            <text x={p.x} y={H-2} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {TERMS.find(t => t.value === p.term)?.label.replace("Term ","T")}
            </text>
            <text x={p.x} y={p.y-8} textAnchor="middle" fontSize="9" fill={color} fontWeight="700">{p.score}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Overall Trend Chart
───────────────────────────────────────────── */
const OverallTrendChart = ({ termData }) => {
  const W = 480, H = 110, PAD = 24;
  const avgs  = termData.map(d => parseFloat(d.average) || 0);
  const min   = Math.max(0,   Math.min(...avgs) - 15);
  const max   = Math.min(100, Math.max(...avgs) + 15);
  const range = max - min || 1;
  const pts   = termData.map((d, i) => ({
    x: PAD + (i / Math.max(termData.length - 1, 1)) * (W - PAD * 2),
    y: PAD + (1 - ((parseFloat(d.average) || 0) - min) / range) * (H - PAD * 2),
    ...d,
  }));
  const pathD = pts.map((p, i) => `${i===0?"M":"L"} ${p.x} ${p.y}`).join(" ");
  const areaD = pts.length > 0
    ? `${pathD} L ${pts[pts.length-1].x} ${H-PAD} L ${pts[0].x} ${H-PAD} Z`
    : "";

  return (
    <div className="sp-card">
      <div className="sp-card-head"><span className="sp-card-title">Overall Average — All Terms</span></div>
      <div style={{ padding:"16px 18px 10px" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:100 }}>
          <defs>
            <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#2563eb" stopOpacity="0.15"/>
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {areaD && <path d={areaD} fill="url(#spGrad)"/>}
          {[0,.5,1].map(t => (
            <line key={t} x1={PAD} y1={PAD+t*(H-PAD*2)} x2={W-PAD} y2={PAD+t*(H-PAD*2)} stroke="#f1f5f9" strokeWidth="1"/>
          ))}
          {pts.length > 1 && <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>}
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="6" fill="white" stroke="#2563eb" strokeWidth="3"/>
              <text x={p.x} y={H-3} textAnchor="middle" fontSize="10" fill="#94a3b8">{p.label}</text>
              <text x={p.x} y={p.y-10} textAnchor="middle" fontSize="11" fill="#2563eb" fontWeight="700">{p.average}</text>
            </g>
          ))}
        </svg>
        <div className="sp-trend-cards">
          {termData.map(d => (
            <div key={d.term} className="sp-trend-card">
              <p style={{ fontSize:"10px",fontWeight:"700",color:"#94a3b8",textTransform:"uppercase",letterSpacing:".6px",margin:"0 0 4px" }}>{d.label}</p>
              <p style={{ fontFamily:"'DM Mono',monospace",fontWeight:"900",color:"#2563eb",fontSize:"22px",margin:"0 0 2px",lineHeight:1 }}>{d.average ?? "—"}</p>
              <p style={{ fontSize:"11px",color:"#94a3b8",margin:0 }}>avg · <b style={{color:"#475569"}}>{d.total}</b> total</p>
              {d.position && <p style={{ fontSize:"11px",color:"#94a3b8",margin:"2px 0 0" }}>Pos: <b style={{color:"#475569"}}>{d.position}</b></p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Empty / Loading
───────────────────────────────────────────── */
const Empty = ({ icon, title, sub }) => (
  <div className="sp-empty">
    <div className="sp-empty-icon">{icon}</div>
    <h3>{title}</h3>
    {sub && <p>{sub}</p>}
  </div>
);

const Loading = ({ text = "Loading…" }) => (
  <div className="sp-loading">
    <div className="sp-spinner"/>
    {text}
  </div>
);

/* ─────────────────────────────────────────────
   Main
───────────────────────────────────────────── */
const StudentPortal = () => {
  // Inject styles once
  useEffect(() => {
    if (document.getElementById("sp-styles")) return;
    const el = document.createElement("style");
    el.id = "sp-styles";
    el.textContent = PORTAL_STYLES;
    document.head.appendChild(el);
  }, []);

  const user = getUser();

  const [tab, setTab]                         = useState("Results");
  const [selectedTerm, setSelectedTerm]       = useState("term1");
  const [report, setReport]                   = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [allReports, setAllReports]           = useState({});
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [progressLoaded, setProgressLoaded]   = useState(false);
  const [fees, setFees]                       = useState([]);
  const [loadingFees, setLoadingFees]         = useState(false);
  const [error, setError]                     = useState("");
  const [showPwModal, setShowPwModal]         = useState(false);

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

  useEffect(() => { if (tab === "Results" || tab === "Report Card") fetchReport(selectedTerm); }, [tab, selectedTerm, fetchReport]);
  useEffect(() => { if (tab === "Progress") fetchAllReports(); }, [tab, fetchAllReports]);
  useEffect(() => { if (tab === "Fees") fetchFees(); }, [tab, fetchFees]);
  useEffect(() => { setError(""); }, [tab]);

  const downloadReport = async () => {
    try {
      const r = await API.get(`/report/student/${user.student_id}/pdf/?term=${selectedTerm}`, { responseType:"blob" });
      const link = document.createElement("a");
      link.href  = window.URL.createObjectURL(new Blob([r.data]));
      link.setAttribute("download", `report_${selectedTerm}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch { setError("Failed to download report."); }
  };

  /* ── Progress derived data ── */
  const subjectTrends = (() => {
    const map = {};
    TERMS.forEach(({ value: term }) => {
      const rep = allReports[term];
      if (!rep?.subjects) return;
      rep.subjects.forEach(sub => {
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

  /* ────────────────────────────────────────────
     Render
  ──────────────────────────────────────────── */
  return (
    <div className="sp-root">

      {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}

      {/* Header */}
      <header className="sp-header">
        <div className="sp-header-inner">
          {user.photo
            ? <img src={user.photo} alt="avatar" className="sp-avatar"/>
            : <div className="sp-avatar-fallback">{user.full_name?.[0] ?? "S"}</div>
          }
          <div>
            <div className="sp-header-name">{user.full_name}</div>
            <div className="sp-header-sub">{user.admission_number} · {user.class}</div>
          </div>

          {/* Desktop nav */}
          <nav className="sp-nav" style={{ marginLeft:"auto", marginRight:"12px" }}>
            {TABS.map(({ key, icon, label }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`sp-nav-btn ${tab === key ? "sp-nav-btn-active" : ""}`}>
                <span>{icon}</span>
                <span style={{ display:"none" }} className="md-inline">{label}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="sp-header-actions">
            <button className="sp-btn-ghost" onClick={() => setShowPwModal(true)}>
              🔑 Password
            </button>
            <button className="sp-btn-danger" onClick={logout}>Sign out</button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sp-mobile-nav">
          <div className="sp-mobile-nav-inner">
            {TABS.map(({ key, icon, label }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`sp-mobile-btn ${tab === key ? "sp-mobile-btn-active" : ""}`}>
                <span style={{ fontSize:"18px" }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="sp-body">

        {/* Term bar */}
        {tab !== "Progress" && tab !== "Announcements" && (
          <div className="sp-term-bar">
            <div>
              <label className="sp-field-label">Term</label>
              <select className="sp-select" value={selectedTerm}
                onChange={e => setSelectedTerm(e.target.value)}>
                {TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {tab === "Report Card" && report && (
              <button className="sp-btn-pdf" onClick={downloadReport}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download PDF
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="sp-alert">
            <span>⚠ {error}</span>
            <button onClick={() => setError("")} style={{ background:"none",border:"none",cursor:"pointer",color:"inherit",fontSize:"18px",opacity:.6,padding:"0 0 0 12px" }}>×</button>
          </div>
        )}

        {/* ══ Results ══ */}
        {tab === "Results" && (
          <>
            {loading && <Loading text="Loading results…"/>}
            {!loading && !report && <Empty icon="📭" title="No results found" sub="No data is available for this term yet."/>}
            {!loading && report && (
              <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                <div className="sp-kpi-grid">
                  <KpiCard label="Total Marks"  value={report.total_score}   />
                  <KpiCard label="Average"       value={report.average_score} />
                  <KpiCard label="Position"
                    value={report.show_position ? report.position_formatted : "N/A"}
                    sub={report.show_position && report.out_of ? `out of ${report.out_of}` : null}
                  />
                  <KpiCard label="Overall Grade" value={report.overall_grade} />
                </div>
                <div className="sp-card">
                  <div className="sp-card-head">
                    <span className="sp-card-title">
                      {TERMS.find(t => t.value === selectedTerm)?.label} — Subject Results
                    </span>
                    <span style={{ fontSize:"12px",color:"#94a3b8" }}>{report.subjects?.length ?? 0} subjects</span>
                  </div>
                </div>
                <SubjectTable report={report}/>
              </div>
            )}
          </>
        )}

        {/* ══ Progress ══ */}
        {tab === "Progress" && (
          <>
            {loadingProgress && <Loading text="Loading progress data…"/>}
            {!loadingProgress && progressLoaded && subjectNames.length === 0 && (
              <Empty icon="📈" title="No results yet" sub="Progress data will appear once results are entered."/>
            )}
            {!loadingProgress && progressLoaded && subjectNames.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>

                {/* Highlights */}
                <div className="sp-hl-grid">
                  {mostImproved && (
                    <div className="sp-hl sp-hl-green">
                      <p className="sp-hl-label" style={{ color:"#16a34a" }}>Most Improved 🏆</p>
                      <p className="sp-hl-name">{mostImproved.name}</p>
                      <p className="sp-hl-delta" style={{ color:"#16a34a" }}>▲ +{mostImproved.delta.toFixed(1)} pts across terms</p>
                    </div>
                  )}
                  {needsAttention && (
                    <div className="sp-hl sp-hl-red">
                      <p className="sp-hl-label" style={{ color:"#dc2626" }}>Needs Attention ⚠️</p>
                      <p className="sp-hl-name">{needsAttention.name}</p>
                      <p className="sp-hl-delta" style={{ color:"#dc2626" }}>▼ {needsAttention.delta.toFixed(1)} pts across terms</p>
                    </div>
                  )}
                </div>

                {termSummary.length > 0 && <OverallTrendChart termData={termSummary}/>}

                {/* Comparison table */}
                <div className="sp-card">
                  <div className="sp-card-head">
                    <span className="sp-card-title">Subject Comparison — All Terms</span>
                    <span style={{ fontSize:"12px",color:"#94a3b8" }}>{subjectNames.length} subjects</span>
                  </div>
                  <div className="sp-table-wrap">
                    <table className="sp-table">
                      <thead>
                        <tr>
                          <th style={{textAlign:"left",padding:"10px 14px"}}>Subject</th>
                          {TERMS.filter(({ value }) => allReports[value]).map(({ value, label }) => (
                            <th key={value} className="c">{label}</th>
                          ))}
                          <th className="c">Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjectNames.map((name, si) => {
                          const color    = SUBJECT_PALETTE[si % SUBJECT_PALETTE.length];
                          const pts      = subjectTrends[name];
                          const scoreMap = Object.fromEntries(pts.map(p => [p.term, p.score]));
                          const diff     = pts.length > 1 ? pts[pts.length-1].score - pts[pts.length-2].score : null;
                          return (
                            <tr key={name}>
                              <td>
                                <span style={{ display:"inline-flex",alignItems:"center",gap:"8px",fontWeight:"600",color:"#1e293b" }}>
                                  <span style={{ width:"8px",height:"8px",borderRadius:"50%",background:color,flexShrink:0 }}/>
                                  {name}
                                </span>
                              </td>
                              {TERMS.filter(({ value }) => allReports[value]).map(({ value }) => {
                                const score = scoreMap[value];
                                return (
                                  <td key={value} className="c">
                                    {score != null
                                      ? <span style={{ fontWeight:"700",color:"#2563eb",fontFamily:"'DM Mono',monospace" }}>{score}</span>
                                      : <span style={{ color:"#e2e8f0" }}>—</span>}
                                  </td>
                                );
                              })}
                              <td className="c">
                                {diff == null || Math.abs(diff) < 0.5
                                  ? <span style={{ color:"#94a3b8",fontSize:"12px" }}>→</span>
                                  : diff > 0
                                  ? <span style={{ color:"#16a34a",fontSize:"12px",fontWeight:"600" }}>▲ +{diff.toFixed(1)}</span>
                                  : <span style={{ color:"#dc2626",fontSize:"12px",fontWeight:"600" }}>▼ {diff.toFixed(1)}</span>
                                }
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
                  <p style={{ fontWeight:"700",color:"#1e293b",fontSize:"13.5px",marginBottom:"12px" }}>Subject Trends</p>
                  <div className="sp-chart-grid">
                    {subjectNames.map((name, i) => (
                      <SubjectLineChart key={name} subject={name}
                        data={subjectTrends[name]} color={SUBJECT_PALETTE[i % SUBJECT_PALETTE.length]}/>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </>
        )}

        {/* ══ Report Card ══ */}
        {tab === "Report Card" && (
          <>
            {loading && <Loading text="Loading report card…"/>}
            {!loading && !report && <Empty icon="📄" title="No report card found" sub="No data available for this term."/>}
            {!loading && report && (
              <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                <div className="sp-kpi-grid">
                  <KpiCard label="Total Marks"  value={report.total_score}   />
                  <KpiCard label="Average"       value={report.average_score} />
                  <KpiCard label="Position"
                    value={report.show_position ? report.position_formatted : "N/A"}
                    sub={report.show_position && report.out_of ? `out of ${report.out_of}` : null}
                  />
                  <KpiCard label="Overall Grade" value={report.overall_grade} />
                </div>

                {/* Attendance */}
                {(report.attendance_total ?? 0) > 0 && (
                  <div className="sp-card">
                    <div className="sp-card-head"><span className="sp-card-title">Attendance</span></div>
                    <div style={{ padding:"14px 18px" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",fontSize:"13.5px",marginBottom:"6px" }}>
                        <span style={{ color:"#64748b" }}>Days Present</span>
                        <span style={{ fontWeight:"700",color:"#1e293b",fontFamily:"'DM Mono',monospace" }}>
                          {report.attendance} / {report.attendance_total}
                        </span>
                      </div>
                      <div className="sp-progress-bar">
                        <div className="sp-progress-fill" style={{
                          width: `${report.attendance_percent ?? 0}%`,
                          background: (report.attendance_percent ?? 0) >= 80 ? "#16a34a"
                            : (report.attendance_percent ?? 0) >= 60 ? "#d97706" : "#dc2626"
                        }}/>
                      </div>
                      <p style={{ fontSize:"11.5px",color:"#94a3b8",textAlign:"right",marginTop:"5px" }}>
                        {report.attendance_percent}% attendance
                      </p>
                    </div>
                  </div>
                )}

                {/* Teacher's Remarks */}
                {(report.conduct || report.interest || report.teacher_remark) && (
                  <div className="sp-card">
                    <div className="sp-card-head"><span className="sp-card-title">Teacher's Remarks</span></div>
                    <div style={{ padding:"14px 18px" }}>
                      {report.conduct && (
                        <div className="sp-remark-row">
                          <span style={{ color:"#64748b",fontSize:"13.5px" }}>Conduct</span>
                          <span style={{ fontWeight:"600",color:"#2563eb",fontSize:"13.5px" }}>{report.conduct}</span>
                        </div>
                      )}
                      {report.interest && (
                        <div className="sp-remark-row">
                          <span style={{ color:"#64748b",fontSize:"13.5px" }}>Interest</span>
                          <span style={{ fontWeight:"600",color:"#2563eb",fontSize:"13.5px" }}>{report.interest}</span>
                        </div>
                      )}
                      {report.teacher_remark && (
                        <div className="sp-remark-quote">"{report.teacher_remark}"</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="sp-card">
                  <div className="sp-card-head"><span className="sp-card-title">Subject Breakdown</span></div>
                </div>
                <SubjectTable report={report}/>
              </div>
            )}
          </>
        )}

        {/* ══ Fees ══ */}
        {tab === "Fees" && (
          <>
            {loadingFees && <Loading text="Loading fee records…"/>}
            {!loadingFees && fees.length === 0 && <Empty icon="💳" title="No fee records found"/>}
            {!loadingFees && fees.length > 0 && fees.map(fee => {
              const isPaid    = fee.balance <= 0;
              const isPartial = !isPaid && fee.paid > 0;
              const pct       = fee.total_amount > 0 ? Math.min(100, Math.round((fee.paid / fee.total_amount) * 100)) : 0;
              return (
                <div key={fee.id} className="sp-fee-card">
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px" }}>
                    <p style={{ fontWeight:"700",fontSize:"15px",color:"#1e293b",margin:0 }}>
                      {TERMS.find(t => t.value === fee.term)?.label ?? fee.term}
                    </p>
                    {isPaid
                      ? <span className="sp-status-paid">✓ PAID</span>
                      : isPartial
                      ? <span className="sp-status-partial">◑ PARTIAL</span>
                      : <span className="sp-status-unpaid">✕ UNPAID</span>
                    }
                  </div>
                  {fee.total_amount > 0 && (
                    <div style={{ marginBottom:"14px" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",fontSize:"12px",color:"#94a3b8",marginBottom:"5px" }}>
                        <span>{pct}% paid</span>
                        <span>GHS {Number(fee.paid).toLocaleString()} of {Number(fee.total_amount).toLocaleString()}</span>
                      </div>
                      <div className="sp-progress-bar">
                        <div className="sp-progress-fill" style={{ width:`${pct}%`, background: isPaid?"#16a34a":isPartial?"#d97706":"#dc2626" }}/>
                      </div>
                    </div>
                  )}
                  {[
                    { label:"School Fees",   value:fee.amount        },
                    { label:"Book User Fee", value:fee.book_user_fee },
                    { label:"Workbook Fee",  value:fee.workbook_fee  },
                    { label:"Arrears",       value:fee.arrears       },
                  ].filter(r => Number(r.value) > 0).map(r => (
                    <div key={r.label} className="sp-fee-row">
                      <span>{r.label}</span>
                      <span>GHS {Number(r.value).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="sp-fee-row sp-fee-total">
                    <span>Total</span><span>GHS {Number(fee.total_amount).toLocaleString()}</span>
                  </div>
                  <div className="sp-fee-row" style={{ color:"#16a34a",fontWeight:"600" }}>
                    <span>Paid</span><span>GHS {Number(fee.paid).toLocaleString()}</span>
                  </div>
                  <div className="sp-fee-row" style={{ color:"#dc2626",fontWeight:"800",fontSize:"14px" }}>
                    <span>Balance</span><span>GHS {Number(fee.balance).toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ══ Announcements ══ */}
        {tab === "Announcements" && <AnnouncementsFeed audience="students"/>}

      </div>
    </div>
  );
};

export default StudentPortal;