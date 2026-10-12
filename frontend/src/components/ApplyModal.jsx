import React, { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ApplyModal({ program, isOpen, onClose, onSuccess, onOpenAuth }) {
  const { user, isAuthenticated } = useAuth();
  const [intake, setIntake] = useState(program?.intake || "Fall 2025");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isOpen || !program) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.createApplication({
        programId: program._id,
        intake,
      });
      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
        setSuccess(false);
      }, 1400);
    } catch (err) {
      setError(err.message || "Failed to submit application");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card apply-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Apply to Program</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="program-summary-box">
          <div className="summary-title">{program.title}</div>
          <div className="summary-sub">
            {program.university?.name || program.universityName} • {program.country}
          </div>
          <div className="summary-tags">
            <span className="tag-pill">{program.degreeLevel || "Graduate"}</span>
            <span className="tag-pill">${(program.tuitionFeeUsd || 0).toLocaleString()} USD / yr</span>
            <span className="tag-pill">IELTS: {program.ieltsRequirement || "N/A"}</span>
          </div>
        </div>

        {error && <div className="alert-box error">{error}</div>}
        {success && (
          <div className="alert-box success">
            Application submitted successfully! Redirecting to applications...
          </div>
        )}

        {!isAuthenticated ? (
          <div className="unauth-apply-prompt">
            <p>You need to be signed in as a student to submit an application.</p>
            <button className="btn-primary" onClick={onOpenAuth}>
              Sign In to Continue
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="apply-form">
            <div className="form-group">
              <label>Applicant Profile</label>
              <div className="applicant-info">
                <strong>{user?.fullName || "Applicant"}</strong> ({user?.email || "No email"})
              </div>
            </div>

            <div className="form-group">
              <label>Select Target Intake</label>
              <select value={intake} onChange={(e) => setIntake(e.target.value)}>
                <option value="Fall 2025">Fall 2025</option>
                <option value="Spring 2026">Spring 2026</option>
                <option value="Fall 2026">Fall 2026</option>
              </select>
            </div>

            <p className="apply-note">
              Note: Submitting this application initiates stage <strong>Submitted</strong> on your
              application lifecycle. Duplicate applications for the same program and intake will be
              prevented.
            </p>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading || success}>
                {loading ? "Submitting..." : "Confirm & Submit Application"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
