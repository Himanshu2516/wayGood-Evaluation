import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const PIPELINE_STAGES = [
  { key: "submitted", label: "Submitted" },
  { key: "under-review", label: "Under Review" },
  { key: "offer-received", label: "Offer Received" },
  { key: "visa-processing", label: "Visa Processing" },
  { key: "enrolled", label: "Enrolled" },
];

const VALID_TRANSITIONS = {
  submitted: ["under-review"],
  "under-review": ["offer-received", "rejected"],
  "offer-received": ["visa-processing", "rejected"],
  "visa-processing": ["enrolled", "rejected"],
  enrolled: [],
  withdrawn: [],
  rejected: [],
};

export default function ApplicationsView({ onOpenAuth, onNavigateDiscovery }) {
  const { user, isAuthenticated, isCounselor } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  const [advanceModalApp, setAdvanceModalApp] = useState(null);
  const [selectedNextStatus, setSelectedNextStatus] = useState("");
  const [advanceNotes, setAdvanceNotes] = useState("");

  const fetchApplications = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getApplications();
      setApplications(data);
    } catch (err) {
      setError(err.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchApplications();
    }
  }, [isAuthenticated]);

  const handleWithdraw = async (applicationId) => {
    const confirmWithdraw = window.confirm(
      "Are you sure you want to withdraw this application? This is a terminal action."
    );
    if (!confirmWithdraw) return;

    setActionLoadingId(applicationId);
    try {
      await api.withdrawApplication(applicationId, "Withdrawn by student request");
      await fetchApplications();
    } catch (err) {
      alert(`Withdrawal failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenAdvanceModal = (app) => {
    const validNext = VALID_TRANSITIONS[app.status] || [];
    setAdvanceModalApp(app);
    setSelectedNextStatus(validNext[0] || "");
    setAdvanceNotes("");
  };

  const handleConfirmAdvance = async (e) => {
    e.preventDefault();
    if (!advanceModalApp || !selectedNextStatus) return;

    setActionLoadingId(advanceModalApp._id);
    try {
      await api.advanceApplicationStatus(
        advanceModalApp._id,
        selectedNextStatus,
        advanceNotes || "Advanced by counselor"
      );
      setAdvanceModalApp(null);
      await fetchApplications();
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredApplications = applications.filter((app) => {
    if (statusFilter === "all") return true;
    return app.status === statusFilter;
  });

  const getStageIndex = (status) => {
    return PIPELINE_STAGES.findIndex((s) => s.key === status);
  };

  return (
    <div className="applications-container">
      <div className="applications-header">
        <div>
          <h1 className="section-title">Application Lifecycle & Tracking</h1>
          <p className="section-subtitle">
            {isCounselor
              ? "Counselor Portal: Review, progress, or evaluate student applications across partner universities."
              : "Track your active university submissions, review progression history, or manage enrollment."}
          </p>
        </div>

        {isAuthenticated && (
          <button className="btn-secondary" onClick={fetchApplications} disabled={loading}>
            Refresh
          </button>
        )}
      </div>

      {!isAuthenticated && (
        <div className="unauth-hero-banner">
          <div className="banner-copy">
            <h3>Sign in to manage and track university applications</h3>
            <p>
              Log in with a student account to view submitted applications and timeline statuses,
              or with counselor credentials to evaluate student progressions.
            </p>
          </div>
          <button className="btn-primary" onClick={onOpenAuth}>
            Sign In with Demo Credentials
          </button>
        </div>
      )}

      {isAuthenticated && (
        <>
          <div className="status-filter-bar">
            {[
              { id: "all", label: "All Applications" },
              { id: "submitted", label: "Submitted" },
              { id: "under-review", label: "Under Review" },
              { id: "offer-received", label: "Offer Received" },
              { id: "visa-processing", label: "Visa Processing" },
              { id: "enrolled", label: "Enrolled" },
              { id: "withdrawn", label: "Withdrawn" },
              { id: "rejected", label: "Rejected" },
            ].map((f) => (
              <button
                key={f.id}
                className={`filter-pill ${statusFilter === f.id ? "active" : ""}`}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="alert-box error">
              <span>{error}</span>
              <button className="btn-retry" onClick={fetchApplications}>
                Retry
              </button>
            </div>
          )}

          {loading && (
            <div className="loading-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card-skeleton">
                  <div className="skeleton-bar title"></div>
                  <div className="skeleton-bar body"></div>
                </div>
              ))}
            </div>
          )}

          {!loading && (
            filteredApplications.length === 0 ? (
              <div className="empty-state">
                <p>No applications found in category "{statusFilter}".</p>
                <button className="btn-primary" onClick={onNavigateDiscovery}>
                  Discover & Apply to Programs
                </button>
              </div>
            ) : (
              <div className="applications-list">
                {filteredApplications.map((app) => {
                  const currentIdx = getStageIndex(app.status);
                  const isTerminal = app.status === "withdrawn" || app.status === "rejected";
                  const validNext = VALID_TRANSITIONS[app.status] || [];
                  const isHistoryOpen = expandedHistoryId === app._id;

                  return (
                    <div key={app._id} className="application-card">
                      <div className="app-card-top">
                        <div className="app-header-left">
                          <span className="country-badge">
                            {app.destinationCountry || app.program?.country || "Destination"}
                          </span>
                          <span className={`status-badge status-${app.status}`}>
                            {app.status.replace("-", " ").toUpperCase()}
                          </span>
                          {isCounselor && app.student && (
                            <span className="student-owner-badge">
                              Student: {app.student.fullName || app.student.email}
                            </span>
                          )}
                        </div>
                        <div className="app-header-right">
                          <span className="intake-badge">Intake: {app.intake}</span>
                        </div>
                      </div>

                      <div className="app-card-body">
                        <h3 className="app-program-title">
                          {app.program?.title || "Degree Program"}
                        </h3>
                        <p className="app-uni-name">
                          {app.university?.name || app.program?.universityName || "Partner University"}
                        </p>
                      </div>

                      {!isTerminal ? (
                        <div className="stepper-wrapper">
                          <div className="stepper-line">
                            <div
                              className="stepper-line-progress"
                              style={{
                                width: `${Math.max(0, (currentIdx / (PIPELINE_STAGES.length - 1)) * 100)}%`,
                              }}
                            ></div>
                          </div>

                          <div className="stepper-steps">
                            {PIPELINE_STAGES.map((stage, idx) => {
                              const isCompleted = idx < currentIdx;
                              const isCurrent = idx === currentIdx;

                              return (
                                <div
                                  key={stage.key}
                                  className={`step-item ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""}`}
                                >
                                  <div className="step-circle">
                                    {isCompleted ? "Done" : idx + 1}
                                  </div>
                                  <span className="step-label">{stage.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className={`terminal-alert-banner ${app.status}`}>
                          <span>
                            {app.status === "withdrawn"
                              ? "This application was withdrawn and closed."
                              : "This application was rejected."}
                          </span>
                        </div>
                      )}

                      <div className="app-actions-bar">
                        <div className="action-buttons-group">
                          {!isCounselor && !isTerminal && app.status !== "enrolled" && (
                            <button
                              className="btn-withdraw"
                              disabled={actionLoadingId === app._id}
                              onClick={() => handleWithdraw(app._id)}
                            >
                              Withdraw Application
                            </button>
                          )}

                          {isCounselor && validNext.length > 0 && (
                            <button
                              className="btn-advance"
                              disabled={actionLoadingId === app._id}
                              onClick={() => handleOpenAdvanceModal(app)}
                            >
                              Advance Status
                            </button>
                          )}
                        </div>

                        <button
                          className="btn-history-toggle"
                          onClick={() =>
                            setExpandedHistoryId(isHistoryOpen ? null : app._id)
                          }
                        >
                          {isHistoryOpen ? "Hide History" : `Status History (${app.statusHistory?.length || 1})`}
                        </button>
                      </div>

                      {isHistoryOpen && (
                        <div className="history-timeline-box">
                          <h4>Status Transition Timeline</h4>
                          <ul className="history-entries-list">
                            {(app.statusHistory || []).map((h, i) => (
                              <li key={i} className="history-entry">
                                <div className="history-marker"></div>
                                <div className="history-details">
                                  <div className="history-header-line">
                                    <strong className="history-status">
                                      {h.status?.replace("-", " ").toUpperCase()}
                                    </strong>
                                    <span className="history-role-pill">
                                      By: {h.changedByRole || "system"}
                                    </span>
                                    <span className="history-time">
                                      {h.changedAt
                                        ? new Date(h.changedAt).toLocaleString()
                                        : "Initial Submission"}
                                    </span>
                                  </div>
                                  {h.notes && <p className="history-notes">{h.notes}</p>}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {advanceModalApp && (
            <div className="modal-backdrop" onClick={() => setAdvanceModalApp(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Advance Application Status</h2>
                  <button
                    className="modal-close-btn"
                    onClick={() => setAdvanceModalApp(null)}
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleConfirmAdvance}>
                  <p className="advance-target-desc">
                    Program: <strong>{advanceModalApp.program?.title}</strong>
                    <br />
                    Current Status:{" "}
                    <span className="status-badge current">
                      {advanceModalApp.status}
                    </span>
                  </p>

                  <div className="form-group">
                    <label>Select Next Valid Transition</label>
                    <select
                      value={selectedNextStatus}
                      onChange={(e) => setSelectedNextStatus(e.target.value)}
                    >
                      {(VALID_TRANSITIONS[advanceModalApp.status] || []).map((s) => (
                        <option key={s} value={s}>
                          {s.replace("-", " ").toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Transition Notes (optional)</label>
                    <textarea
                      rows={3}
                      value={advanceNotes}
                      onChange={(e) => setAdvanceNotes(e.target.value)}
                      placeholder="e.g. Verified transcripts, offer letter received from university..."
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setAdvanceModalApp(null)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={actionLoadingId}>
                      {actionLoadingId ? "Updating..." : "Confirm Status Change"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
