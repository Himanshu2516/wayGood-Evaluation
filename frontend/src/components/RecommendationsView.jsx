import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function RecommendationsView({ onApply, onOpenAuth }) {
  const { user, isAuthenticated, updateUser } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);

  const [editBudget, setEditBudget] = useState(user?.budget || 35000);
  const [editCountries, setEditCountries] = useState(
    Array.isArray(user?.preferredCountries)
      ? user.preferredCountries.join(", ")
      : "UK, US, Canada"
  );
  const [editField, setEditField] = useState(
    Array.isArray(user?.fieldOfStudy)
      ? user.fieldOfStudy.join(", ")
      : "Computer Science"
  );
  const [editIntake, setEditIntake] = useState(user?.intake || "Fall 2025");
  const [editIelts, setEditIelts] = useState(user?.ieltsScore || 7.0);
  const [savingPreferences, setSavingPreferences] = useState(false);

  const [aiInsights, setAiInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState("");

  const handleGenerateAiInsights = async () => {
    if (!isAuthenticated) return;
    setLoadingInsights(true);
    setInsightsError("");
    try {
      const res = await api.getRecommendationInsights();
      setAiInsights(res);
    } catch (err) {
      setInsightsError(err.message || "Failed to generate AI insights");
    } finally {
      setLoadingInsights(false);
    }
  };

  const fetchRecommendations = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getRecommendations(null, { limit: 8 });
      setRecommendations(Array.isArray(data) ? data : (data?.recommendations || []));
    } catch (err) {
      setError(err.message || "Failed to load program recommendations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchRecommendations();
      if (user) {
        setEditBudget(user.budget || 35000);
        setEditCountries(
          Array.isArray(user.preferredCountries)
            ? user.preferredCountries.join(", ")
            : "UK, US, Canada"
        );
        setEditField(
          Array.isArray(user.fieldOfStudy)
            ? user.fieldOfStudy.join(", ")
            : "Computer Science"
        );
        setEditIntake(user.intake || "Fall 2025");
        setEditIelts(user.ieltsScore || 7.0);
      }
    }
  }, [isAuthenticated, user?._id]);

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSavingPreferences(true);
    try {
      const preferredCountries = editCountries
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const fieldOfStudy = editField
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      const updated = await api.updateProfile({
        budget: Number(editBudget) || 0,
        preferredCountries,
        fieldOfStudy,
        intake: editIntake,
        ieltsScore: Number(editIelts) || 0,
      });

      updateUser(updated);
      setIsEditingPreferences(false);
      await fetchRecommendations();
    } catch (err) {
      alert(`Error updating profile: ${err.message}`);
    } finally {
      setSavingPreferences(false);
    }
  };

  const getScoreColorClass = (score) => {
    if (score >= 80) return "score-high";
    if (score >= 60) return "score-med";
    return "score-low";
  };

  return (
    <div className="recommendations-container">
      <div className="recommendations-header">
        <div>
          <h1 className="section-title">AI Personalized Recommendations</h1>
          <p className="section-subtitle">
            Ranked using MongoDB 5-factor weighted scoring: Country (30%), Budget (25%), Field (20%), Intake (15%), and IELTS (10%).
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {isAuthenticated && (
            <>
              <button
                className="btn-primary"
                style={{
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  border: "none",
                  color: "#ffffff"
                }}
                onClick={handleGenerateAiInsights}
                disabled={loadingInsights || recommendations.length === 0}
              >
                {loadingInsights ? "Generating Groq Insights..." : "Get AI Insights"}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setIsEditingPreferences((prev) => !prev)}
              >
                {isEditingPreferences ? "Close Editor" : "Edit My Preferences"}
              </button>
            </>
          )}
        </div>
      </div>

      {!isAuthenticated && (
        <div className="unauth-hero-banner">
          <div className="banner-copy">
            <h3>Sign in to calculate your personalized program matches</h3>
            <p>
              Recommendations calculate a custom affinity score based on your study destinations,
              budget constraints, test scores, and preferred start terms.
            </p>
          </div>
          <button className="btn-primary" onClick={onOpenAuth}>
            Sign In with Demo Account
          </button>
        </div>
      )}

      {isAuthenticated && (
        <>
          <div className="preferences-pill-bar">
            <span className="pref-label">Matching Criteria:</span>
            <span className="pref-pill">
              Budget: ${(Number(user?.budget) || 0).toLocaleString()} USD
            </span>
            <span className="pref-pill">
              Countries:{" "}
              {Array.isArray(user?.preferredCountries) && user.preferredCountries.length > 0
                ? user.preferredCountries.join(", ")
                : "Any"}
            </span>
            <span className="pref-pill">
              Fields:{" "}
              {Array.isArray(user?.fieldOfStudy) && user.fieldOfStudy.length > 0
                ? user.fieldOfStudy.join(", ")
                : "Any"}
            </span>
            <span className="pref-pill">Intake: {user?.intake || "Any"}</span>
            <span className="pref-pill">IELTS: {user?.ieltsScore ?? "N/A"}</span>
          </div>

          {isEditingPreferences && (
            <div className="edit-preferences-card">
              <h3>Update Profile Preferences to Rescore Recommendations</h3>
              <form onSubmit={handleSavePreferences}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Annual Budget (USD)</label>
                    <input
                      type="number"
                      value={editBudget}
                      onChange={(e) => setEditBudget(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>IELTS Score (0 - 9)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="9"
                      value={editIelts}
                      onChange={(e) => setEditIelts(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Preferred Countries (comma separated)</label>
                    <input
                      type="text"
                      value={editCountries}
                      onChange={(e) => setEditCountries(e.target.value)}
                      placeholder="UK, US, Canada"
                    />
                  </div>
                  <div className="form-group">
                    <label>Target Intake</label>
                    <select
                      value={editIntake}
                      onChange={(e) => setEditIntake(e.target.value)}
                    >
                      <option value="Fall 2025">Fall 2025</option>
                      <option value="Spring 2026">Spring 2026</option>
                      <option value="Fall 2026">Fall 2026</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Field(s) of Study</label>
                  <input
                    type="text"
                    value={editField}
                    onChange={(e) => setEditField(e.target.value)}
                    placeholder="Computer Science, Business Analytics"
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsEditingPreferences(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={savingPreferences}
                  >
                    {savingPreferences ? "Saving & Rescoring..." : "Save & Re-calculate Matches"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {aiInsights && (
        <div className="ai-insights-banner">
          <div className="ai-insights-banner-header">
            <div className="ai-insights-title">
              <span>AI Counselor Advice</span>
              <span className="ai-badge">
                {aiInsights.meta?.source || "groq"} ({aiInsights.meta?.model || "openai/gpt-oss-120b"})
              </span>
            </div>
          </div>
          <p className="ai-overall-text">{aiInsights.overallAdvice}</p>
        </div>
      )}

      {insightsError && (
        <div className="alert-box error" style={{ marginBottom: "16px" }}>
          <span>{insightsError}</span>
        </div>
      )}

      {error && (
        <div className="alert-box error">
          <span>{error}</span>
          <button className="btn-retry" onClick={fetchRecommendations}>
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="loading-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-skeleton">
              <div className="skeleton-bar title"></div>
              <div className="skeleton-bar body"></div>
              <div className="skeleton-bar sub"></div>
            </div>
          ))}
        </div>
      )}

      {!loading && isAuthenticated && (
        recommendations.length === 0 ? (
          <div className="empty-state">
            <p>No matching programs found. Try broadening your budget or preferred countries.</p>
          </div>
        ) : (
          <div className="recommendations-grid">
            {(Array.isArray(recommendations) ? recommendations : []).map((rec, index) => {
              const program = rec?.program || rec || {};
              const score = typeof rec?.score === "number" ? rec.score : 0;
              const reasons = Array.isArray(rec?.matchReasons) ? rec.matchReasons : [];
              const cardKey = program._id || rec?._id || `rec-${index}`;

              return (
                <div key={cardKey} className="recommendation-card">
                  <div className="rec-card-header">
                    <div className="rec-program-info">
                      <span className="country-badge">{program.country || "Global"}</span>
                      <h3 className="rec-title">{program.title || "Academic Program"}</h3>
                      <p className="rec-uni">
                        {program.university?.name || program.universityName || "Partner University"}
                      </p>
                    </div>

                    <div className={`score-badge ${getScoreColorClass(score)}`}>
                      <span className="score-number">{score}%</span>
                      <span className="score-caption">Match Score</span>
                    </div>
                  </div>

                  <div className="rec-metrics">
                    <div className="rec-metric">
                      <span>Tuition Fee</span>
                      <strong>${(Number(program.tuitionFeeUsd) || 0).toLocaleString()} USD / yr</strong>
                    </div>
                    <div className="rec-metric">
                      <span>Degree Level</span>
                      <strong>{program.degreeLevel || "Degree"}</strong>
                    </div>
                    <div className="rec-metric">
                      <span>Intake</span>
                      <strong>{program.intake || "Multiple"}</strong>
                    </div>
                  </div>

                  <div className="match-reasons-block">
                    <h4 className="match-reasons-title">Match Reasons ({reasons.length})</h4>
                    <ul className="reasons-list">
                      {reasons.map((reason, idx) => (
                        <li key={idx} className="reason-item">
                          <span className="reason-check">-</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {(() => {
                    const insight = aiInsights?.insights?.find(
                      (item) => item.programTitle?.toLowerCase().trim() === (program.title || "").toLowerCase().trim()
                    );
                    if (!insight) return null;
                    return (
                      <div className="rec-ai-card-block">
                        <div className="rec-ai-row rec-ai-fits">
                          <strong>Why it fits</strong>
                          <span>{insight.whyItFits}</span>
                        </div>
                        {insight.watchOut && (
                          <div className="rec-ai-row rec-ai-watchout">
                            <strong>Watch out</strong>
                            <span>{insight.watchOut}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="rec-actions">
                    <button className="btn-apply" onClick={() => onApply(program)}>
                      Apply to this Program
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
