import { useState, useEffect, useRef } from "react";
import { getUser, logout } from "../services/auth";
import API from "../services/api";

const timeGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const Topbar = ({ onMenuToggle, sidebarOpen }) => {
  const user = getUser();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const dropRef = useRef(null);
  const notifRef = useRef(null);

  // Load recent critical/urgent announcements as notifications
  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get("/announcements/?ordering=-created_at");
        const items = (res.data.results ?? res.data).slice(0, 8);
        setAnnouncements(items);
        setUnread(items.filter((a) => a.priority === "critical" || a.priority === "urgent").length);
      } catch {}
    };
    load();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current  && !dropRef.current.contains(e.target))  setDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initial = user?.username?.[0]?.toUpperCase() ?? "A";

  const PRIORITY_DOT = {
    critical: "bg-red-500",
    urgent:   "bg-amber-400",
    normal:   "bg-gray-300",
  };

  const timeAgo = (iso) => {
    const diff  = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (mins  < 1)  return "just now";
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <header className="h-16 bg-white border-b border-gray-100 shadow-sm flex items-center px-4 gap-3 z-30 sticky top-0">

      {/* ── Hamburger (mobile) ── */}
      {onMenuToggle && (
        <button
          onClick={onMenuToggle}
          className="lg:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-0.5 bg-gray-600 transition-all ${sidebarOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`block w-5 h-0.5 bg-gray-600 transition-all ${sidebarOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-gray-600 transition-all ${sidebarOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      )}

      {/* ── Brand / title ── */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-white text-xs font-bold">LSA</span>
        </div>
        <div className="hidden sm:block min-w-0">
          <p className="text-sm font-bold text-gray-800 leading-tight truncate">Admin Dashboard</p>
          <p className="text-xs text-gray-400 leading-tight">Leading Stars Academy</p>
        </div>
      </div>

      {/* ── Greeting (desktop) ── */}
      <div className="hidden md:block ml-4 flex-1 min-w-0">
        <p className="text-sm text-gray-500 truncate">
          {timeGreeting()},{" "}
          <span className="font-semibold text-gray-700">{user?.username ?? "Admin"}</span> 👋
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2">

        {/* ── Notifications ── */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen((v) => !v); setDropdownOpen(false); }}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
            aria-label="Notifications"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-9.33-4.991M9 17h6m-3 4a1 1 0 002 0m-2 0a1 1 0 01-2 0m2 0v-4" />
            </svg>
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-11 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <p className="font-semibold text-gray-800 text-sm">Announcements</p>
                {unread > 0 && (
                  <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full">
                    {unread} urgent
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                {announcements.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No announcements.</p>
                ) : (
                  announcements.map((a) => (
                    <div key={a.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-2.5">
                        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[a.priority] || "bg-gray-300"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 leading-snug truncate">{a.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{a.message}</p>
                          <p className="text-xs text-gray-300 mt-1">{timeAgo(a.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="w-px h-6 bg-gray-200" />

        {/* ── User menu ── */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => { setDropdownOpen((v) => !v); setNotifOpen(false); }}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0">
              {initial}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.username ?? "Admin"}</p>
              <p className="text-xs text-gray-400 leading-tight capitalize">{user?.role ?? "admin"}</p>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform hidden sm:block ${dropdownOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-11 w-52 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
              {/* User info header */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                <p className="text-sm font-semibold text-gray-800">{user?.username}</p>
                <p className="text-xs text-gray-400">{user?.email || "Administrator"}</p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors text-left">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors text-left">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
              </div>

              <div className="border-t border-gray-100 py-1">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;