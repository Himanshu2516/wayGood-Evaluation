import React from "react";
import { useAuth } from "../context/AuthContext";

export default function Navbar({ activeTab, setActiveTab, onOpenAuth }) {
  const { user, isAuthenticated, isCounselor, logout } = useAuth();

  return (
    <header className="navbar-wrapper">
      <div className="navbar-inner">
        <div className="navbar-brand" onClick={() => setActiveTab("discovery")}>
          <div className="brand-logo">W</div>
          <div className="brand-text">
            <span className="brand-title">Waygood</span>
            <span className="brand-subtitle">Study Abroad Platform</span>
          </div>
        </div>

        <nav className="nav-links">
          <button
            className={`nav-btn ${activeTab === "discovery" ? "active" : ""}`}
            onClick={() => setActiveTab("discovery")}
          >
            Discovery
          </button>
          <button
            className={`nav-btn ${activeTab === "recommendations" ? "active" : ""}`}
            onClick={() => setActiveTab("recommendations")}
          >
            AI Recommendations
          </button>
          <button
            className={`nav-btn ${activeTab === "study-plan" ? "active" : ""}`}
            onClick={() => setActiveTab("study-plan")}
          >
            AI Study Plan
          </button>
          <button
            className={`nav-btn ${activeTab === "applications" ? "active" : ""}`}
            onClick={() => setActiveTab("applications")}
          >
            Applications
          </button>
          <button
            className={`nav-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            My Profile
          </button>
          <button
            className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Overview
          </button>
        </nav>

        <div className="nav-auth">
          {isAuthenticated ? (
            <div className="user-profile-badge">
              <div
                className="user-avatar"
                onClick={() => setActiveTab("profile")}
                style={{ cursor: "pointer" }}
                title="View My Profile"
              >
                {user?.fullName ? user.fullName[0].toUpperCase() : "U"}
              </div>
              <div
                className="user-details"
                onClick={() => setActiveTab("profile")}
                style={{ cursor: "pointer" }}
                title="View My Profile"
              >
                <span className="user-name">{user?.fullName || "User"}</span>
                <span className={`user-role-pill ${isCounselor ? "counselor" : "student"}`}>
                  {user?.role || "student"}
                </span>
              </div>
              <button className="btn-logout" onClick={logout} title="Sign Out">
                Sign Out
              </button>
            </div>
          ) : (
            <button className="btn-primary" onClick={onOpenAuth}>
              Sign In / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
