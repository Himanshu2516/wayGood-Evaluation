import React, { useState, useEffect } from "react";
import { api } from "../api/client";

export default function DiscoveryView({ onApply }) {
  const [activeType, setActiveType] = useState("programs");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [programs, setPrograms] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });

  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [degreeLevel, setDegreeLevel] = useState("");
  const [field, setField] = useState("");
  const [intake, setIntake] = useState("");
  const [maxTuition, setMaxTuition] = useState("");
  const [hasScholarship, setHasScholarship] = useState(false);
  const [studentIelts, setStudentIelts] = useState("");
  const [sortBy, setSortBy] = useState("tuition-asc");
  const [page, setPage] = useState(1);

  const fetchPrograms = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit: 6,
        q: search || undefined,
        country: country || undefined,
        degreeLevel: degreeLevel || undefined,
        field: field || undefined,
        intake: intake || undefined,
        maxTuition: maxTuition || undefined,
        hasScholarship: hasScholarship ? "true" : undefined,
        studentIelts: studentIelts || undefined,
        sort: sortBy,
      };

      const res = await api.getPrograms(params);
      setPrograms(res.programs);
      setMeta(res.meta);
    } catch (err) {
      setError(err.message || "Failed to load programs");
    } finally {
      setLoading(false);
    }
  };

  const fetchUniversities = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit: 6,
        q: search || undefined,
        country: country || undefined,
        hasScholarship: hasScholarship ? "true" : undefined,
        sort: sortBy === "rank-asc" ? "qsRank" : "name",
      };

      const res = await api.getUniversities(params);
      setUniversities(res.universities);
      setMeta(res.meta);
    } catch (err) {
      setError(err.message || "Failed to load universities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeType === "programs") {
      fetchPrograms();
    } else {
      fetchUniversities();
    }
  }, [activeType, page, country, degreeLevel, field, intake, maxTuition, hasScholarship, studentIelts, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    if (activeType === "programs") fetchPrograms();
    else fetchUniversities();
  };

  const handleResetFilters = () => {
    setSearch("");
    setCountry("");
    setDegreeLevel("");
    setField("");
    setIntake("");
    setMaxTuition("");
    setHasScholarship(false);
    setStudentIelts("");
    setSortBy(activeType === "programs" ? "tuition-asc" : "rank-asc");
    setPage(1);
  };

  return (
    <div className="discovery-container">
      <div className="discovery-header">
        <div>
          <h1 className="section-title">Explore Universities & Programs</h1>
          <p className="section-subtitle">
            Search verified study-abroad degree options across top global partner institutions.
          </p>
        </div>
        <div className="type-toggle-pill">
          <button
            className={`toggle-option ${activeType === "programs" ? "active" : ""}`}
            onClick={() => {
              setActiveType("programs");
              setPage(1);
            }}
          >
            Programs ({activeType === "programs" ? meta.total || 0 : "Catalog"})
          </button>
          <button
            className={`toggle-option ${activeType === "universities" ? "active" : ""}`}
            onClick={() => {
              setActiveType("universities");
              setPage(1);
            }}
          >
            Universities ({activeType === "universities" ? meta.total || 0 : "Institutions"})
          </button>
        </div>
      </div>

      <div className="filter-panel">
        <form className="search-row" onSubmit={handleSearchSubmit}>
          <div className="search-input-wrapper">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                activeType === "programs"
                  ? "Search by program title, degree, or university name..."
                  : "Search by university name, city, or country..."
              }
            />
          </div>
          <button type="submit" className="btn-primary">
            Search
          </button>
          <button type="button" className="btn-secondary" onClick={handleResetFilters}>
            Reset Filters
          </button>
        </form>

        <div className="filters-grid">
          <div className="filter-item">
            <label>Country</label>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Countries</option>
              <option value="UK">United Kingdom</option>
              <option value="US">United States</option>
              <option value="Canada">Canada</option>
              <option value="Australia">Australia</option>
              <option value="Germany">Germany</option>
              <option value="Ireland">Ireland</option>
            </select>
          </div>

          {activeType === "programs" && (
            <>
              <div className="filter-item">
                <label>Degree Level</label>
                <select
                  value={degreeLevel}
                  onChange={(e) => {
                    setDegreeLevel(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Levels</option>
                  <option value="Undergraduate">Undergraduate</option>
                  <option value="Postgraduate">Postgraduate</option>
                  <option value="Master's">Master's</option>
                </select>
              </div>

              <div className="filter-item">
                <label>Field of Study</label>
                <select
                  value={field}
                  onChange={(e) => {
                    setField(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Fields</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Business Analytics">Business Analytics</option>
                  <option value="Data Science">Data Science</option>
                  <option value="Software Engineering">Software Engineering</option>
                  <option value="Management">Management</option>
                </select>
              </div>

              <div className="filter-item">
                <label>Intake</label>
                <select
                  value={intake}
                  onChange={(e) => {
                    setIntake(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Intakes</option>
                  <option value="Fall 2025">Fall 2025</option>
                  <option value="Spring 2026">Spring 2026</option>
                  <option value="Fall 2026">Fall 2026</option>
                </select>
              </div>

              <div className="filter-item">
                <label>Max Tuition (USD)</label>
                <input
                  type="number"
                  placeholder="e.g. 30000"
                  value={maxTuition}
                  onChange={(e) => {
                    setMaxTuition(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="filter-item">
                <label>My IELTS Score</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="9"
                  placeholder="e.g. 6.5"
                  value={studentIelts}
                  onChange={(e) => {
                    setStudentIelts(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </>
          )}

          <div className="filter-item">
            <label>Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
            >
              {activeType === "programs" ? (
                <>
                  <option value="tuition-asc">Tuition: Low to High</option>
                  <option value="tuition-desc">Tuition: High to Low</option>
                  <option value="title-asc">Title: A to Z</option>
                </>
              ) : (
                <>
                  <option value="rank-asc">QS Ranking: Top First</option>
                  <option value="name-asc">Name: A to Z</option>
                </>
              )}
            </select>
          </div>

          <div className="filter-checkbox-item">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hasScholarship}
                onChange={(e) => {
                  setHasScholarship(e.target.checked);
                  setPage(1);
                }}
              />
              <span>Scholarship Available Only</span>
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-box error">
          <span>{error}</span>
          <button className="btn-retry" onClick={activeType === "programs" ? fetchPrograms : fetchUniversities}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card-skeleton">
              <div className="skeleton-bar title"></div>
              <div className="skeleton-bar sub"></div>
              <div className="skeleton-bar body"></div>
            </div>
          ))}
        </div>
      ) : activeType === "programs" ? (
        programs.length === 0 ? (
          <div className="empty-state">
            <p>No study programs match your current filters.</p>
            <button className="btn-secondary" onClick={handleResetFilters}>
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="catalog-grid">
            {programs.map((program) => (
              <div key={program._id} className="program-card">
                <div className="card-top">
                  <div className="country-badge">{program.country}</div>
                  {program.scholarshipAvailable && (
                    <div className="scholarship-badge">Scholarship Available</div>
                  )}
                </div>

                <h3 className="program-title">{program.title}</h3>
                <p className="university-name">
                  {program.university?.name || program.universityName}
                </p>

                <div className="program-metrics">
                  <div className="metric">
                    <span className="metric-label">Tuition Fee</span>
                    <strong className="metric-val">
                      ${(program.tuitionFeeUsd || 0).toLocaleString()} <small>/ yr</small>
                    </strong>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Degree Level</span>
                    <strong className="metric-val">{program.degreeLevel}</strong>
                  </div>
                </div>

                <div className="card-chips">
                  <span className="chip">Field: {program.field}</span>
                  <span className="chip">Intake: {program.intake}</span>
                  <span className="chip">IELTS: {program.ieltsRequirement || "None"}</span>
                </div>

                <div className="card-actions">
                  <button className="btn-apply" onClick={() => onApply(program)}>
                    Apply Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        universities.length === 0 ? (
          <div className="empty-state">
            <p>No universities found matching your search criteria.</p>
            <button className="btn-secondary" onClick={handleResetFilters}>
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="catalog-grid">
            {universities.map((uni) => (
              <div key={uni._id} className="university-card">
                <div className="card-top">
                  <span className="country-badge">{uni.country}</span>
                  {uni.qsWorldRanking && (
                    <span className="qs-badge">QS Rank #{uni.qsWorldRanking}</span>
                  )}
                </div>

                <h3 className="university-title">{uni.name}</h3>
                <p className="university-location">
                  {uni.city ? `${uni.city}, ` : ""}
                  {uni.country}
                </p>

                <div className="university-metrics">
                  <div className="metric">
                    <span className="metric-label">Popularity</span>
                    <strong className="metric-val">{uni.popularityScore || "N/A"}/100</strong>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Scholarships</span>
                    <strong className="metric-val">
                      {uni.scholarshipAvailable ? "Available" : "Standard"}
                    </strong>
                  </div>
                </div>

                <p className="university-desc">
                  {uni.description || "Leading higher-education partner with accredited globally recognized degree programs."}
                </p>
              </div>
            ))}
          </div>
        )
      )}

      {meta.totalPages > 1 && (
        <div className="pagination-bar">
          <button
            className="pagination-btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            Previous
          </button>
          <span className="page-indicator">
            Page {meta.page} of {meta.totalPages} ({meta.total} results)
          </span>
          <button
            className="pagination-btn"
            disabled={page >= meta.totalPages || loading}
            onClick={() => setPage((p) => Math.min(p + 1, meta.totalPages))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
