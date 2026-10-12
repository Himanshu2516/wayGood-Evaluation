import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function StudyPlanView({ onOpenAuth, onNavigateDiscovery }) {
  const { user, isAuthenticated } = useAuth();
  const [studyPlan, setStudyPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkedDocs, setCheckedDocs] = useState({});

  const fetchStudyPlan = async () => {
    setLoading(true);
    setError("");
    try {
      const plan = await api.generateStudyPlan({
        profile: user || {
          fullName: "Aspiring Candidate",
          budget: 35000,
          preferredCountries: ["United Kingdom", "United States", "Canada"],
          fieldOfStudy: ["Computer Science"],
          intake: "Fall 2025",
          ieltsScore: 7.0,
        },
      });
      setStudyPlan(plan);
    } catch (err) {
      setError(err.message || "Failed to generate AI study plan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudyPlan();
  }, [user?._id]);

  const toggleDoc = (docName) => {
    setCheckedDocs((prev) => ({
      ...prev,
      [docName]: !prev[docName],
    }));
  };

  return (
    <div className="study-plan-container">
      <div className="study-plan-header">
        <div>
          <h1 className="section-title">AI Study Abroad Strategic Plan</h1>
          <p className="section-subtitle">
            Synthesizes your academic preferences, budget, and test eligibility into a customized
            shortlist, multi-phase timeline, document checklist, and living expense breakdown.
          </p>
        </div>

        <div className="study-plan-header-actions">
          {(studyPlan?.meta || studyPlan?.metadata) && (
            <span className="ai-provider-badge">
              Generated via:{" "}
              <strong>
                {studyPlan.meta?.source === "groq"
                  ? `Groq (${studyPlan.meta.model || "openai/gpt-oss-120b"})`
                  : studyPlan.meta?.source === "groq-backup"
                  ? `Groq Backup (${studyPlan.meta.model || "llama-3.3-70b-versatile"})`
                  : studyPlan.meta?.source === "fallback" || studyPlan.metadata?.provider === "rule-based"
                  ? "Rule-Based Counselor Fallback"
                  : "AI Counselor Engine"}
              </strong>
            </span>
          )}
          <button className="btn-primary" onClick={fetchStudyPlan} disabled={loading}>
            {loading ? "Generating Plan..." : "Regenerate Study Plan"}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-box error">
          <span>{error}</span>
          <button className="btn-retry" onClick={fetchStudyPlan}>
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

      {!loading && studyPlan && (
        <div className="study-plan-content">
          {studyPlan.summary && (
            <div className="plan-summary-card" style={{ marginBottom: "2rem", padding: "1.25rem 1.5rem", borderRadius: "10px", background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
              <p style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.6, color: "#cbd5e1" }}>
                <strong>Strategic Overview:</strong> {studyPlan.summary}
              </p>
            </div>
          )}

          <section className="plan-section">
            <div className="section-heading">
              <p className="eyebrow">Strategic Selection</p>
              <h2>Program & University Shortlist</h2>
            </div>

            <div className="shortlist-grid">
              {(studyPlan.shortlist || []).map((item, idx) => (
                <div key={idx} className="shortlist-card">
                  <div className="shortlist-top">
                    <span className="country-badge">{item.country || "Partner Destination"}</span>
                    <span
                      className={`category-pill category-${(item.category || "target").toLowerCase()}`}
                    >
                      {item.category || "Target"}
                    </span>
                  </div>

                  <h3 className="shortlist-title">{item.programTitle}</h3>
                  <p className="shortlist-uni">{item.universityName || item.university}</p>

                  {(item.estimatedTuitionUsd || item.tuitionFeeUsd) && (
                    <div className="shortlist-tuition">
                      Est. Tuition:{" "}
                      <strong>${Number(item.estimatedTuitionUsd || item.tuitionFeeUsd).toLocaleString()} USD / yr</strong>
                    </div>
                  )}

                  {item.ieltsGap !== undefined && (
                    <div className="shortlist-gap" style={{ fontSize: "0.85rem", color: item.ieltsGap >= 0 ? "#10b981" : "#f59e0b", marginBottom: "0.5rem" }}>
                      IELTS Gap: <strong>{item.ieltsGap >= 0 ? `+${item.ieltsGap} (Meets req)` : `${item.ieltsGap} bands`}</strong>
                    </div>
                  )}

                  <p className="shortlist-rationale">{item.fitRationale || item.reason}</p>
                  {item.risk && (
                    <p className="shortlist-risk" style={{ fontSize: "0.85rem", color: "#f87171", marginTop: "0.5rem" }}>
                      <strong>Risk / Advisory:</strong> {item.risk}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="plan-section">
            <div className="section-heading">
              <p className="eyebrow">Step-By-Step Schedule</p>
              <h2>Preparation & Submission Timeline</h2>
            </div>

            <div className="timeline-phases-list">
              {(studyPlan.timeline || []).map((t, idx) => (
                <div key={idx} className="timeline-phase-card">
                  <div className="phase-marker-col">
                    <div className="phase-badge">{idx + 1}</div>
                  </div>
                  <div className="phase-content">
                    <div className="phase-header">
                      <h3 className="phase-title">{t.phase || t.month || `Phase ${idx + 1}`}</h3>
                      <span className="phase-timeframe">{t.timeframe || t.month}</span>
                    </div>
                    {t.milestone && (
                      <p className="phase-sub">{t.milestone}</p>
                    )}
                    <ul className="phase-actions-list">
                      {Array.isArray(t.actions) && t.actions.length > 0 ? (
                        t.actions.map((act, i) => <li key={i}>{act}</li>)
                      ) : t.task ? (
                        <li>{t.task}</li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="plan-two-col-grid">
            <section className="plan-section">
              <div className="section-heading">
                <p className="eyebrow">Application Dossier</p>
                <h2>Document Checklist</h2>
              </div>

              <div className="docs-checklist-card">
                <ul className="checklist-items">
                  {(studyPlan.documentsChecklist || []).map((doc, idx) => {
                    const docName = typeof doc === "string" ? doc : (doc.document || doc.name);
                    const docCategory = typeof doc === "object" && doc.category ? doc.category : "Required";
                    const docTips = typeof doc === "object" ? doc.tips : null;
                    const isChecked = Boolean(checkedDocs[docName]);
                    return (
                      <li
                        key={idx}
                        className={`doc-item ${isChecked ? "checked" : ""}`}
                        onClick={() => toggleDoc(docName)}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="doc-checkbox"
                        />
                        <div className="doc-info">
                          <div className="doc-main">
                            <span className="doc-name">{docName}</span>
                            <span className="doc-cat">{docCategory}</span>
                          </div>
                          {docTips && <p className="doc-tips">Tip: {docTips}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            <section className="plan-section">
              <div className="section-heading">
                <p className="eyebrow">Financial Projections</p>
                <h2>Budget & Cost Analysis</h2>
              </div>

              {typeof studyPlan.budgetNotes === "string" ? (
                <div className="budget-analysis-card">
                  <div className="budget-note-block">
                    <h4>Budget Alignment & Financial Advice</h4>
                    <p style={{ lineHeight: 1.6, color: "#cbd5e1" }}>{studyPlan.budgetNotes}</p>
                  </div>
                </div>
              ) : typeof studyPlan.budgetNotes === "object" && studyPlan.budgetNotes ? (
                <div className="budget-analysis-card">
                  <div className="budget-metrics-row">
                    <div className="b-metric">
                      <span>Est. Avg Tuition</span>
                      <strong>
                        ${(studyPlan.budgetNotes.estimatedAverageTuition || 0).toLocaleString()} USD
                      </strong>
                    </div>
                    <div className="b-metric">
                      <span>Est. Annual Living</span>
                      <strong>
                        ${(studyPlan.budgetNotes.estimatedAnnualLivingCost || 0).toLocaleString()} USD
                      </strong>
                    </div>
                    <div className="b-metric highlight">
                      <span>Total Annual Cost</span>
                      <strong>
                        ${(studyPlan.budgetNotes.totalAnnualEstimatedCost || 0).toLocaleString()} USD
                      </strong>
                    </div>
                  </div>

                  {studyPlan.budgetNotes.budgetFitAssessment && (
                    <div className="budget-note-block">
                      <h4>Budget Alignment Assessment</h4>
                      <p>{studyPlan.budgetNotes.budgetFitAssessment}</p>
                    </div>
                  )}

                  {studyPlan.budgetNotes.scholarshipAdvice && (
                    <div className="budget-note-block">
                      <h4>Scholarship Guidance</h4>
                      <p>{studyPlan.budgetNotes.scholarshipAdvice}</p>
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          </div>

          {Array.isArray(studyPlan.nextSteps) && studyPlan.nextSteps.length > 0 && (
            <section className="plan-section" style={{ marginTop: "2rem" }}>
              <div className="section-heading">
                <p className="eyebrow">Action Items</p>
                <h2>Immediate Next Steps</h2>
              </div>
              <div style={{ background: "#1e293b", padding: "1.5rem", borderRadius: "10px", border: "1px solid #334155" }}>
                <ol style={{ margin: 0, paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem", color: "#e2e8f0" }}>
                  {studyPlan.nextSteps.map((step, idx) => (
                    <li key={idx} style={{ lineHeight: 1.5 }}>
                      <strong>Step {idx + 1}:</strong> {step}
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
