import { useEffect, useState } from "react";
import { getContract } from "../utils/contract";

export default function ShieldScore() {
  const [score, setScore] = useState(0);

  const loadScore = async () => {
    const contract = await getContract();
    const value = await contract.shieldScore();
    setScore(Number(value));
  };

  useEffect(() => {
    loadScore();

    const interval = setInterval(loadScore, 5000); // auto refresh

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h3>🛡️ Shield Score: {score}</h3>
    </div>
  );
}