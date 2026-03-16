import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { logout, getUser } from "../services/auth";
import API from "../services/api";
import {
  FaTachometerAlt,
  FaUserGraduate,
  FaChalkboardTeacher,
  FaSchool,
  FaClipboardList,
  FaCalendarCheck,
  FaBullhorn,
  FaMoneyBill,
  FaChartBar,
  FaSignOutAlt,
  FaUserPlus,
  FaBook,
  FaWallet,
  FaUserShield,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";

const NAV_SECTIONS = [
  {
    heading: "Overview",
    items: [
      { name: "Dashboard",       path: "/admin",                icon: FaTachometerAlt },
    ],
  },
  {
    heading: "People",
    items: [
      { name: "Students",        path: "/admin/students",        icon: FaUserGraduate      },
      { name: "Teachers",        path: "/admin/teachers",        icon: FaChalkboardTeacher },
      { name: "Admissions",      path: "/admin/admissions",      icon: FaUserPlus          },
    ],
  },
  {
    heading: "Academics",
    items: [
      { name: "Classes",         path: "/admin/classes",         icon: FaSchool        },
      { name: "Subjects",        path: "/admin/subjects",        icon: FaBook          },
      { name: "Results",         path: "/admin/results",         icon: FaClipboardList },
      { name: "Attendance",      path: "/admin/attendance",      icon: FaCalendarCheck },
      { name: "Reports",         path: "/admin/reports",         icon: FaChartBar      },
    ],
  },
  {
    heading: "Finance",
    items: [
      { name: "Fees",            path: "/admin/fees",            icon: FaMoneyBill },
      { name: "Accounts",        path: "/admin/accounts",        icon: FaWallet    },
    ],
  },
  {
    heading: "Communication",
    items: [
      { name: "Announcements",   path: "/admin/announcements",   icon: FaBullhorn },
    ],
  },
  {
    heading: "System",
    items: [
      { name: "Admin Approvals", path: "/admin/admin-approvals", icon: FaUserShield, badgeKey: "approvals" },
    ],
  },
];

const Sidebar = ({ collapsed, onToggle }) => {
  const user = getUser();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get("/admin-approvals/");
        setPendingCount((res.data.results ?? res.data).length);
      } catch {}
    };
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  const badges = { approvals: pendingCount };

  return (
    <aside className={`relative flex flex-col bg-gray-900 text-white min-h-screen shadow-xl transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>

      {/* ── Brand ── */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-700/60 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow">
          <span className="text-xs font-extrabold text-white">LS</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight truncate">Leading Stars</p>
            <p className="text-xs text-gray-400 leading-tight">Academy</p>
          </div>
        )}
      </div>

      {/* ── Collapse toggle ── */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 w-6 h-6 bg-gray-700 hover:bg-blue-600 rounded-full flex items-center justify-center text-white shadow transition-colors z-10"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <FaChevronRight className="text-[10px]" /> : <FaChevronLeft className="text-[10px]" />}
      </button>

      {/* ── User pill ── */}
      {!collapsed && (
        <div className="mx-3 mt-4 mb-2 px-3 py-2.5 bg-gray-800 rounded-xl flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {user?.username?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">{user?.username}</p>
            <p className="text-[10px] text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5 scrollbar-thin scrollbar-thumb-gray-700">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading}>
            {!collapsed && (
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-1.5">
                {section.heading}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon  = item.icon;
                const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                // Dashboard uses `end` so /admin/students doesn't also highlight it
                const isEnd = item.path === "/admin";

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={isEnd}
                    title={collapsed ? item.name : undefined}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-400 hover:bg-gray-800 hover:text-white"
                      } ${collapsed ? "justify-center" : ""}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={`flex-shrink-0 text-base ${isActive ? "text-white" : "text-gray-400 group-hover:text-white"}`} />

                        {!collapsed && (
                          <span className="truncate font-medium">{item.name}</span>
                        )}

                        {badge > 0 && (
                          <span className={`absolute flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-amber-400 text-gray-900 leading-none ${
                            collapsed ? "-top-1 -right-1" : "right-2 top-1/2 -translate-y-1/2"
                          }`}>
                            {badge > 9 ? "9+" : badge}
                          </span>
                        )}

                        {collapsed && (
                          <span className="absolute left-full ml-3 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg transition-opacity">
                            {item.name}
                            {badge > 0 && <span className="ml-1.5 bg-amber-400 text-gray-900 text-[10px] font-bold px-1.5 rounded-full">{badge}</span>}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Logout ── */}
      <div className={`p-3 border-t border-gray-700/60 ${collapsed ? "flex justify-center" : ""}`}>
        <button
          onClick={logout}
          title={collapsed ? "Sign Out" : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-red-600/20 hover:text-red-400 transition-all group w-full text-sm ${
            collapsed ? "justify-center w-auto" : ""
          }`}
        >
          <FaSignOutAlt className="flex-shrink-0 text-base group-hover:text-red-400" />
          {!collapsed && <span className="font-medium">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;