import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import Navbar from "./components/Navbar.jsx";
import AuthModal from "./components/AuthModal.jsx";
import ApplyModal from "./components/ApplyModal.jsx";
import DiscoveryView from "./components/DiscoveryView.jsx";
import RecommendationsView from "./components/RecommendationsView.jsx";
import StudyPlanView from "./components/StudyPlanView.jsx";
import ApplicationsView from "./components/ApplicationsView.jsx";
import DashboardView from "./components/DashboardView.jsx";
import ProfileView from "./components/ProfileView.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

function AppContent() {
  const [activeTab, setActiveTab] = useState("discovery");
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [selectedProgramToApply, setSelectedProgramToApply] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleOpenApply = (program) => {
    setSelectedProgramToApply(program);
  };

  const handleApplicationSuccess = () => {
    showToast("Application submitted successfully! Viewing applications.");
    setActiveTab("applications");
  };

  return (
    <div className="app-shell">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {toastMessage && (
        <div className="global-toast">
          <span>{toastMessage}</span>
          <button className="toast-close" onClick={() => setToastMessage(null)}>
            ×
          </button>
        </div>
      )}

      <main className="page-shell">
        <ErrorBoundary key={activeTab}>
          {activeTab === "discovery" && (
            <DiscoveryView onApply={handleOpenApply} />
          )}

          {activeTab === "recommendations" && (
            <RecommendationsView
              onApply={handleOpenApply}
              onOpenAuth={() => setIsAuthOpen(true)}
            />
          )}

          {activeTab === "study-plan" && (
            <StudyPlanView
              onOpenAuth={() => setIsAuthOpen(true)}
              onNavigateDiscovery={() => setActiveTab("discovery")}
            />
          )}

          {activeTab === "applications" && (
            <ApplicationsView
              onOpenAuth={() => setIsAuthOpen(true)}
              onNavigateDiscovery={() => setActiveTab("discovery")}
            />
          )}

          {activeTab === "profile" && (
            <ProfileView onOpenAuth={() => setIsAuthOpen(true)} />
          )}

          {activeTab === "dashboard" && (
            <DashboardView onNavigateTab={setActiveTab} />
          )}
        </ErrorBoundary>
      </main>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <ApplyModal
        program={selectedProgramToApply}
        isOpen={Boolean(selectedProgramToApply)}
        onClose={() => setSelectedProgramToApply(null)}
        onSuccess={handleApplicationSuccess}
        onOpenAuth={() => {
          setSelectedProgramToApply(null);
          setIsAuthOpen(true);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
