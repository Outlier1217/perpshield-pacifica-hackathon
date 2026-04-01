import { useState } from "react";
import { ethers } from "ethers";
import { getContract } from "../utils/contract";

export default function VaultCard() {
  const [amount, setAmount] = useState("");

  const deposit = async () => {
    const contract = await getContract();

    const tx = await contract.deposit(
      ethers.parseUnits(amount, 18)
    );

    await tx.wait();

    alert("Deposit successful 🚀");
  };

  const withdraw = async () => {
    const contract = await getContract();

    const tx = await contract.withdraw(
      ethers.parseUnits(amount, 18)
    );

    await tx.wait();

    alert("Withdraw successful 💸");
  };

  const harvest = async () => {
    const contract = await getContract();
    const tx = await contract.harvest();
    await tx.wait();

    alert("Harvest done 🌾");
  };

  const rebalance = async () => {
    const contract = await getContract();
    const tx = await contract.rebalance();
    await tx.wait();

    alert("Rebalanced 🔄");
  };

  return (
    <div style={{
      padding: "20px",
      background: "#1e293b",
      borderRadius: "12px",
      maxWidth: "400px",
      margin: "auto"
    }}>
      <h3>💰 Vault Actions</h3>

      <input
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <div>
        <button onClick={deposit}>Deposit</button>
        <button onClick={withdraw}>Withdraw</button>
      </div>

      <div>
        <button onClick={harvest}>Harvest</button>
        <button onClick={rebalance}>Rebalance</button>
      </div>
    </div>
  );
}