import { useState } from "react";
import { VaultProvider, useVault } from "./contexts/VaultContext";
import Layout from "./components/common/Layout";
import VaultDashboard from "./pages/VaultDashboard";
import Positions from "./pages/Positions";
import Bounties from "./pages/Bounties";
import Profile from "./pages/Profile";
import { S } from "./components/styles/S";

function AppContent() {
  const [activeTab, setActiveTab] = useState("vault");
  const { account } = useVault();

  // Add global styles
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #060810; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        input:focus { border-color: rgba(56,189,248,0.5) !important; box-shadow: 0 0 0 3px rgba(56,189,248,0.08); }
        textarea:focus { border-color: rgba(56,189,248,0.5) !important; outline: none; }
        @keyframes slideIn { from { transform: translateX(40px); opacity:0; } to { transform: translateX(0); opacity:1; } }
        .tab-btn { transition: all 0.2s; }
        .tab-btn:hover { color: #38bdf8 !important; }
        .btn-hover:hover:not(:disabled) { filter: brightness(1.2); transform: translateY(-1px); }
        .card-hover:hover { border-color: rgba(56,189,248,0.35) !important; }
      `}</style>
      
      <div style={S.app}>
        <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
          {activeTab === "vault" && <VaultDashboard />}
          {activeTab === "positions" && <Positions />}
          {activeTab === "bounties" && <Bounties />}
          {activeTab === "profile" && <Profile />}
        </Layout>
      </div>
    </>
  );
}

function App() {
  return (
    <VaultProvider>
      <AppContent />
    </VaultProvider>
  );
}

export default App;