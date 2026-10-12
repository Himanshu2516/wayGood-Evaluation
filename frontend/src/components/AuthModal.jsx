import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState("student");
  const [regBudget, setRegBudget] = useState("35000");
  const [regCountries, setRegCountries] = useState("US, UK, Canada");
  const [regField, setRegField] = useState("Computer Science");
  const [regIntake, setRegIntake] = useState("Fall 2025");
  const [regIelts, setRegIelts] = useState("7.0");

  if (!isOpen) return null;

  const handleQuickLogin = async (email, password) => {
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      onClose();
    } catch (err) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const preferredCountries = regCountries
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const fieldOfStudy = regField
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      await register({
        fullName: regFullName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        budget: Number(regBudget) || 0,
        preferredCountries,
        fieldOfStudy,
        intake: regIntake,
        ieltsScore: Number(regIelts) || 0,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{tab === "login" ? "Sign In to Waygood" : "Create an Account"}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="tab-switcher">
          <button
            className={`tab-btn ${tab === "login" ? "active" : ""}`}
            onClick={() => {
              setTab("login");
              setError("");
            }}
          >
            Sign In
          </button>
          <button
            className={`tab-btn ${tab === "register" ? "active" : ""}`}
            onClick={() => {
              setTab("register");
              setError("");
            }}
          >
            Register
          </button>
        </div>

        <div className="demo-credentials-box">
          <span className="demo-label">Quick Sign-In (Seeded Profiles):</span>
          <div className="demo-btn-group">
            <button
              type="button"
              className="demo-btn"
              disabled={loading}
              onClick={() => handleQuickLogin("aarav@example.com", "Candidate123!")}
            >
              Aarav (Student, UK/CS)
            </button>
            <button
              type="button"
              className="demo-btn"
              disabled={loading}
              onClick={() => handleQuickLogin("diya@example.com", "Candidate123!")}
            >
              Diya (Student, US/DA)
            </button>
            <button
              type="button"
              className="demo-btn counselor"
              disabled={loading}
              onClick={() => handleQuickLogin("counselor@example.com", "Candidate123!")}
            >
              Counselor (Admin Access)
            </button>
          </div>
        </div>

        {error && <div className="alert-box error">{error}</div>}

        {tab === "login" ? (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleRegisterSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="e.g. Maya Sharma"
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="maya@example.com"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Password (min 8 chars)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={regRole} onChange={(e) => setRegRole(e.target.value)}>
                  <option value="student">Student</option>
                  <option value="counselor">Counselor</option>
                </select>
              </div>
            </div>

            {regRole === "student" && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Annual Budget (USD)</label>
                    <input
                      type="number"
                      value={regBudget}
                      onChange={(e) => setRegBudget(e.target.value)}
                      placeholder="e.g. 35000"
                    />
                  </div>
                  <div className="form-group">
                    <label>IELTS Score (0 - 9)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="9"
                      value={regIelts}
                      onChange={(e) => setRegIelts(e.target.value)}
                      placeholder="e.g. 7.0"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Preferred Countries (comma separated)</label>
                    <input
                      type="text"
                      value={regCountries}
                      onChange={(e) => setRegCountries(e.target.value)}
                      placeholder="US, UK, Canada, Australia"
                    />
                  </div>
                  <div className="form-group">
                    <label>Target Intake</label>
                    <select value={regIntake} onChange={(e) => setRegIntake(e.target.value)}>
                      <option value="Fall 2025">Fall 2025</option>
                      <option value="Spring 2026">Spring 2026</option>
                      <option value="Fall 2026">Fall 2026</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Field of Study</label>
                  <input
                    type="text"
                    value={regField}
                    onChange={(e) => setRegField(e.target.value)}
                    placeholder="Computer Science, Business Analytics"
                  />
                </div>
              </>
            )}

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? "Creating account..." : "Complete Registration"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
