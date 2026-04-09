import { useState } from "react";
import { FaUser, FaLock, FaUserShield, FaChalkboardTeacher, FaUserGraduate, FaClock } from "react-icons/fa";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../services/auth";

const ROLES = [
  { value: "admin",   label: "Admin",   icon: <FaUserShield />,        hint: "Use your username"         },
  { value: "teacher", label: "Teacher", icon: <FaChalkboardTeacher />, hint: "Use your Teacher ID"       },
  { value: "student", label: "Student", icon: <FaUserGraduate />,      hint: "Use your Admission Number" },
];

const Login = () => {
  const navigate                              = useNavigate();
  const [role, setRole]                       = useState("admin");
  const [username, setUsername]               = useState("");
  const [password, setPassword]               = useState("");
  const [error, setError]                     = useState("");
  const [pendingApproval, setPendingApproval] = useState(false);
  const [loading, setLoading]                 = useState(false);

  const selectedRole = ROLES.find((r) => r.value === role);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setUsername("");
    setError("");
    setPendingApproval(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setPendingApproval(false);
    setLoading(true);
    try {
      const user = await login(username, password);
      if      (user.role === "admin")   navigate("/admin");
      else if (user.role === "teacher") navigate("/teacher");
      else if (user.role === "student") navigate("/student");
      else navigate("/");
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.error === "pending_approval") {
        setPendingApproval(true);
      } else {
        setError(errData?.error || errData?.message || "Invalid credentials. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen">

      {/* ── Left branding panel ── */}
      <div className="hidden md:flex w-1/2 bg-gradient-to-br from-blue-800 to-blue-600 text-white items-center justify-center p-12">
        <div className="text-center">
          <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl font-extrabold text-white">LS</span>
          </div>
          <h1 className="text-4xl font-extrabold mb-3">Leading Stars Academy</h1>
          <p className="text-blue-200 text-lg">Where Leaders Are Born</p>
          <div className="mt-10 space-y-3 text-left text-sm text-blue-100">
            <div className="flex items-center gap-3">
              <FaUserShield className="text-blue-300" />
              <span>Admins — full system access</span>
            </div>
            <div className="flex items-center gap-3">
              <FaChalkboardTeacher className="text-blue-300" />
              <span>Teachers — class, attendance & results</span>
            </div>
            <div className="flex items-center gap-3">
              <FaUserGraduate className="text-blue-300" />
              <span>Students — results, reports & fees</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right login panel ── */}
      <div className="flex w-full md:w-1/2 items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">

          <div className="flex justify-start mb-4">
  <Link to="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors">
    <span>←</span>
    <span>Back to Home</span>
  </Link>
</div>

<h2 className="text-2xl font-bold text-gray-800 text-center mb-1">Welcome Back</h2>
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-1">Welcome Back</h2>
          <p className="text-sm text-gray-400 text-center mb-6">Sign in to your portal</p>

          {/* ── Role selector ── */}
          <div className="flex mb-6 border rounded-xl overflow-hidden">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => handleRoleChange(r.value)}
                className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  role === r.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {r.icon}{r.label}
              </button>
            ))}
          </div>

          {/* ── Role hint ── */}
          <div className="mb-4 p-2.5 bg-blue-50 text-blue-700 rounded-lg text-xs flex items-center gap-2">
            {selectedRole?.icon}
            <span>{selectedRole?.hint}</span>
          </div>

          {/* ── Pending approval banner ── */}
          {pendingApproval && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-1">
                <FaClock className="flex-shrink-0" />
                Account Pending Approval
              </div>
              <p className="text-amber-600 text-xs leading-relaxed">
                Your admin account is awaiting approval by an existing administrator.
                Please contact your system administrator or try again after your account is approved.
              </p>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex items-center border border-gray-300 rounded-lg px-3 focus-within:ring-2 focus-within:ring-blue-500 transition">
              <FaUser className="text-gray-400 text-sm flex-shrink-0" />
              <input
                type="text"
                placeholder={
                  role === "student" ? "Admission Number" :
                  role === "teacher" ? "Teacher ID" : "Username"
                }
                className="w-full p-3 outline-none text-sm"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center border border-gray-300 rounded-lg px-3 focus-within:ring-2 focus-within:ring-blue-500 transition">
              <FaLock className="text-gray-400 text-sm flex-shrink-0" />
              <input
                type="password"
                placeholder="Password"
                className="w-full p-3 outline-none text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? "Signing in…" : `Sign in as ${selectedRole?.label}`}
            </button>
          </form>

          {role === "admin" && (
            <p className="text-center text-xs text-gray-400 mt-5">
              New admin?{" "}
              <Link to="/register" className="text-blue-600 hover:underline font-medium">
                Create an account
              </Link>
            </p>
          )}

        </div>
      </div>

    </div>
  );
};

export default Login;
