import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { assignmentSignals, featureCards } from "../data/sampleData";

export default function DashboardView({ onNavigateTab }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await api.getDashboardOverview();
        setStats(data);
      } catch (err) {
        console.warn("Could not load dashboard stats:", err.message);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="dashboard-container">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">Waygood Candidate Evaluation Platform</p>
          <h1>End-to-end study abroad intelligence.</h1>
          <p className="hero-text">
            Discover accredited global university degree programs, compute weighted AI
            recommendations based on student budget and test scores, and manage multi-stage
            application workflows with real-time state machine validation.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => onNavigateTab("discovery")}>
              Explore Catalog →
            </button>
            <button className="btn-secondary" onClick={() => onNavigateTab("recommendations")}>
              View Recommendations →
            </button>
          </div>
        </div>

        <div className="hero-panel">
          <p className="panel-label">Platform Capabilities</p>
          <ul>
            {assignmentSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="metrics-strip">
        <div className="metric-tile">
          <span className="metric-tile-title">Global Universities</span>
          <strong className="metric-tile-val">
            {loading ? "..." : stats?.totalUniversities || "5+"}
          </strong>
          <span className="metric-tile-sub">Accredited partner institutions</span>
        </div>
        <div className="metric-tile">
          <span className="metric-tile-title">Available Programs</span>
          <strong className="metric-tile-val">
            {loading ? "..." : stats?.totalPrograms || "8+"}
          </strong>
          <span className="metric-tile-sub">Undergraduate & Master's options</span>
        </div>
        <div className="metric-tile">
          <span className="metric-tile-title">Total Applications</span>
          <strong className="metric-tile-val">
            {loading ? "..." : stats?.totalApplications || "2+"}
          </strong>
          <span className="metric-tile-sub">Active workflow submissions</span>
        </div>
        <div className="metric-tile">
          <span className="metric-tile-title">Performance</span>
          <strong className="metric-tile-val">&lt; 10ms</strong>
          <span className="metric-tile-sub">Redis cached discovery & aggregation</span>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Production Areas</p>
          <h2>Key engineering features in this implementation</h2>
        </div>
        <div className="card-grid">
          {featureCards.map((card) => (
            <div key={card.title} className="info-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
