import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ProfileView({ onOpenAuth }) {
  const { user, isAuthenticated, updateUser } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentEducation, setCurrentEducation] = useState("");
  const [gpa, setGpa] = useState("");
  const [budget, setBudget] = useState(35000);
  const [preferredCountries, setPreferredCountries] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [intake, setIntake] = useState("Fall 2025");
  const [ieltsScore, setIeltsScore] = useState(7.0);

  const [documents, setDocuments] = useState([]);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("transcripts");
  const [docNotes, setDocNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileBase64, setFileBase64] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const populateUserData = (u) => {
    if (!u) return;
    setFullName(u.fullName || "");
    setEmail(u.email || "");
    setPhone(u.phone || "");
    setCurrentEducation(u.currentEducation || "");
    setGpa(u.gpa || "");
    setBudget(u.budget || u.maxBudgetUsd || 35000);
    setPreferredCountries(
      Array.isArray(u.preferredCountries) && u.preferredCountries.length > 0
        ? u.preferredCountries.join(", ")
        : Array.isArray(u.targetCountries)
        ? u.targetCountries.join(", ")
        : "Canada, UK, US"
    );
    setFieldOfStudy(
      Array.isArray(u.fieldOfStudy) && u.fieldOfStudy.length > 0
        ? u.fieldOfStudy.join(", ")
        : Array.isArray(u.interestedFields)
        ? u.interestedFields.join(", ")
        : "Computer Science"
    );
    setIntake(u.intake || u.preferredIntake || "Fall 2025");
    setIeltsScore(u.ieltsScore || u.englishTest?.score || 7.0);
    setDocuments(Array.isArray(u.documents) ? u.documents : []);
  };

  useEffect(() => {
    if (user) {
      populateUserData(user);
    }
  }, [user]);

  const calculateCompletion = () => {
    let score = 0;
    if (fullName && email) score += 20;
    if (phone || currentEducation || gpa) score += 20;
    if (preferredCountries && budget > 0 && fieldOfStudy && intake) score += 30;
    if (ieltsScore > 0) score += 15;
    if (documents.length > 0) score += 15;
    return Math.min(score, 100);
  };

  const completionPct = calculateCompletion();

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const parsedCountries = preferredCountries
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const parsedFields = fieldOfStudy
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      const updated = await api.updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        currentEducation: currentEducation.trim(),
        gpa: gpa.trim(),
        budget: Number(budget) || 0,
        preferredCountries: parsedCountries,
        fieldOfStudy: parsedFields,
        intake,
        ieltsScore: Number(ieltsScore) || 0,
      });

      updateUser(updated);
      setSuccessMessage("Profile and study preferences updated successfully! Recommendations and AI study plans have rescored.");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      setErrorMessage(err.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit. Please upload a smaller document.");
      return;
    }

    setSelectedFile(file);
    if (!docTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setDocTitle(cleanName);
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      alert("Please provide a document title.");
      return;
    }
    if (!selectedFile) {
      alert("Please select a file to upload.");
      return;
    }

    setUploadingDoc(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const updatedUser = await api.uploadDocument({
        title: docTitle.trim(),
        documentType: docType,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type || "application/pdf",
        fileData: fileBase64 || "",
        notes: docNotes.trim(),
      });

      updateUser(updatedUser);
      setDocuments(Array.isArray(updatedUser?.documents) ? updatedUser.documents : []);
      setDocTitle("");
      setDocNotes("");
      setSelectedFile(null);
      setFileBase64("");
      setSuccessMessage(`Document "${selectedFile.name}" uploaded successfully.`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      setErrorMessage(err.message || "Failed to upload document.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId, title) => {
    if (!window.confirm(`Are you sure you want to remove "${title}"?`)) return;

    setDeletingDocId(docId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const updatedUser = await api.deleteDocument(docId);
      updateUser(updatedUser);
      setDocuments(Array.isArray(updatedUser?.documents) ? updatedUser.documents : []);
      setSuccessMessage("Document deleted successfully.");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setErrorMessage(err.message || "Failed to delete document.");
    } finally {
      setDeletingDocId(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getDocTypeLabel = (type) => {
    const map = {
      passport: "Passport",
      transcripts: "Transcripts",
      ielts_score_card: "IELTS / English Test",
      statement_of_purpose: "Statement of Purpose",
      letter_of_recommendation: "Letter of Recommendation",
      resume_cv: "Resume / CV",
      financial_statement: "Financial Solvency",
      other: "Other Document",
    };
    return map[type] || "Document";
  };

  if (!isAuthenticated) {
    return (
      <div className="profile-container">
        <div className="unauth-hero-banner">
          <div className="banner-copy">
            <h3>Sign in to manage your student profile and documents</h3>
            <p>
              Your profile preferences drive the 5-factor matching algorithm and provide the
              grounding context for Groq AI study plans.
            </p>
          </div>
          <button className="btn-primary" onClick={onOpenAuth}>
            Sign In with Demo Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header-card">
        <div className="profile-avatar-row">
          <div className="profile-avatar-large">
            {fullName ? fullName[0].toUpperCase() : "U"}
          </div>
          <div className="profile-identity">
            <h1 className="profile-user-name">{fullName || "Student Candidate"}</h1>
            <p className="profile-user-email">{email}</p>
            <div className="profile-badges-row">
              <span className="profile-role-badge">
                {user?.role === "counselor" ? "Admissions Counselor" : "International Student"}
              </span>
              <span className="profile-member-badge">
                Joined: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Active Session"}
              </span>
            </div>
          </div>
        </div>

        <div className="completion-meter-card">
          <div className="meter-header">
            <span>Profile Completeness</span>
            <strong>{completionPct}%</strong>
          </div>
          <div className="meter-bar-track">
            <div
              className="meter-bar-fill"
              style={{
                width: `${completionPct}%`,
                background:
                  completionPct === 100
                    ? "linear-gradient(90deg, #10b981, #059669)"
                    : completionPct >= 70
                    ? "linear-gradient(90deg, #4f46e5, #7c3aed)"
                    : "linear-gradient(90deg, #f59e0b, #d97706)",
              }}
            ></div>
          </div>
          <p className="meter-hint">
            {completionPct === 100
              ? "Complete! Ready for top-precision recommendations & Groq AI study plans."
              : "Complete your preferences and upload required documents to unlock full admission readiness."}
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="alert-box success" style={{ marginBottom: "20px" }}>
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="alert-box error" style={{ marginBottom: "20px" }}>
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="profile-grid">
        <div className="profile-column-main">
          <div className="profile-section-card">
            <div className="section-card-header">
              <h2>Personal & Academic Profile</h2>
              <p>Your academic background and contact details for university admissions.</p>
            </div>

            <form onSubmit={handleSaveProfile} className="profile-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aarav Malhotra"
                  />
                </div>
                <div className="form-group">
                  <label>Email Address (Account ID)</label>
                  <input type="email" value={email} disabled className="input-disabled" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Contact Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 019-2834"
                  />
                </div>
                <div className="form-group">
                  <label>Current / Prior Education</label>
                  <input
                    type="text"
                    value={currentEducation}
                    onChange={(e) => setCurrentEducation(e.target.value)}
                    placeholder="e.g. Bachelor of Computer Applications"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Undergraduate GPA / Academic %</label>
                  <input
                    type="text"
                    value={gpa}
                    onChange={(e) => setGpa(e.target.value)}
                    placeholder="e.g. 3.8 / 4.0 or 85%"
                  />
                </div>
                <div className="form-group">
                  <label>Official IELTS Score (0.0 to 9.0) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="9"
                    required
                    value={ieltsScore}
                    onChange={(e) => setIeltsScore(e.target.value)}
                  />
                </div>
              </div>

              <div className="section-sub-header">
                <h3>Study Abroad Matching Preferences</h3>
                <p>These values directly configure your 5-factor weighted algorithm score.</p>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Annual Tuition Budget (USD) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Target Intake Term *</label>
                  <select value={intake} onChange={(e) => setIntake(e.target.value)}>
                    <option value="Fall 2025">Fall 2025</option>
                    <option value="Spring 2026">Spring 2026</option>
                    <option value="Fall 2026">Fall 2026</option>
                    <option value="September">September</option>
                    <option value="January">January</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Preferred Destination Countries (comma-separated) *</label>
                <input
                  type="text"
                  required
                  value={preferredCountries}
                  onChange={(e) => setPreferredCountries(e.target.value)}
                  placeholder="Canada, United Kingdom, United States, UAE, Australia"
                />
              </div>

              <div className="form-group">
                <label>Target Fields of Study (comma-separated) *</label>
                <input
                  type="text"
                  required
                  value={fieldOfStudy}
                  onChange={(e) => setFieldOfStudy(e.target.value)}
                  placeholder="Computer Science, Data Science, Business Analytics"
                />
              </div>

              <div className="form-actions-bar">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingProfile}
                  style={{ minWidth: "180px" }}
                >
                  {savingProfile ? "Saving Profile..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="profile-column-side">
          <div className="profile-section-card">
            <div className="section-card-header">
              <h2>Required Documents Vault</h2>
              <p>Upload admissions credentials for applications and counselor review.</p>
            </div>

            <form onSubmit={handleUploadDocument} className="doc-upload-box">
              <div className="form-group">
                <label>Document Category *</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option value="transcripts">Academic Transcripts & Degree</option>
                  <option value="passport">Passport / International ID</option>
                  <option value="ielts_score_card">IELTS / TOEFL Score Card</option>
                  <option value="statement_of_purpose">Statement of Purpose (SOP)</option>
                  <option value="letter_of_recommendation">Letter of Recommendation (LOR)</option>
                  <option value="resume_cv">Curriculum Vitae (CV / Resume)</option>
                  <option value="financial_statement">Bank Solvency / Financial Proof</option>
                  <option value="other">Other Document</option>
                </select>
              </div>

              <div className="form-group">
                <label>Document Title *</label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Official University Transcripts"
                />
              </div>

              <div className="form-group">
                <label>Select File (PDF, PNG, JPG, DOCX - max 10MB) *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={handleFileChange}
                  className="file-input-field"
                />
                {selectedFile && (
                  <span className="file-selected-caption">
                    {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Notes / Counselor Memo (Optional)</label>
                <input
                  type="text"
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  placeholder="e.g. Attested copy from college registrar"
                />
              </div>

              <button
                type="submit"
                className="btn-secondary"
                disabled={uploadingDoc || !selectedFile}
                style={{ width: "100%", marginTop: "10px" }}
              >
                {uploadingDoc ? "Uploading Document..." : "Upload to Document Vault"}
              </button>
            </form>

            <div className="uploaded-docs-section">
              <h3 className="uploaded-docs-title">
                Uploaded Documents ({documents.length})
              </h3>

              {documents.length === 0 ? (
                <div className="empty-docs-box">
                  <p>No documents uploaded yet. Add your transcripts and passport above.</p>
                </div>
              ) : (
                <div className="docs-list">
                  {documents.map((doc) => (
                    <div key={doc._id} className="doc-item-card">
                      <div className="doc-item-main">
                        <div className="doc-item-header">
                          <span className="doc-type-pill">
                            {getDocTypeLabel(doc.documentType)}
                          </span>
                          <span className="doc-status-badge verified">
                            {doc.status || "uploaded"}
                          </span>
                        </div>
                        <h4 className="doc-item-title">{doc.title}</h4>
                        <p className="doc-item-meta">
                          {doc.fileName} • {formatFileSize(doc.fileSize)} •{" "}
                          {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : "Recent"}
                        </p>
                        {doc.notes && <p className="doc-item-notes">"{doc.notes}"</p>}
                      </div>

                      <div className="doc-item-actions">
                        {doc.fileData && (
                          <a
                            href={doc.fileData}
                            download={doc.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-doc-view"
                            title="Download or preview file"
                          >
                            View
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn-doc-delete"
                          onClick={() => handleDeleteDocument(doc._id, doc.title)}
                          disabled={deletingDocId === doc._id}
                          title="Delete document"
                        >
                          {deletingDocId === doc._id ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
