import { useState, useEffect } from "react";

export default function Navbar() {
  const [account, setAccount] = useState(null);

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("MetaMask not installed");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      setAccount(accounts[0]);
      console.log("Connected:", accounts[0]);

    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  // Only check existing connection (no auto override)
  useEffect(() => {
    const checkWallet = async () => {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });

        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      }
    };

    checkWallet();
  }, []);

  return (
    <div style={{
      padding: "20px",
      display: "flex",
      justifyContent: "space-between",
      background: "#020617"
    }}>
      <h2>🛡️ PerpShield</h2>

      <button onClick={connectWallet}>
        {account
          ? `${account.slice(0, 6)}...${account.slice(-4)}`
          : "Connect Wallet"}
      </button>
    </div>
  );
}