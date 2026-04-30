export default function DarkStats() {
  const stats = [
    { label: "Current Balance", value: "₹ 45,107.84", icon: "💼", color: "#3b82f6" },
    { label: "Total Deposited (Buy)", value: "₹ 0.00", icon: "⬇️", color: "#22c55e" },
    { label: "Invite Earnings (L1)", value: "₹ 49.92", icon: "🎁", color: "#a855f7" },
    { label: "Total Withdrawn (Sell)", value: "₹ 4,992.00", icon: "⬆️", color: "#ef4444" },
  ];

  const rewards = [
    { label: "Today Buy Reward", value: "₹ 12.50", sub: "Overall: ₹ 238.00", icon: "🏆", color: "#f59e0b" },
    { label: "Today Sell Reward", value: "₹ 8.00", sub: "Overall: ₹ 142.00", icon: "💰", color: "#f59e0b" },
    { label: "Agent Earning", value: "₹ 320.00", sub: "Silver Tier — 5 active invitees", icon: "🥈", color: "#94a3b8" },
  ];

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      background: "#f1f5f9",
      minHeight: "100vh",
      padding: "0",
    }}>
      {/* Top Profile Header */}
      <div style={{
        background: "linear-gradient(135deg, #1e40af 0%, #0369a1 100%)",
        padding: "40px 20px 60px",
        color: "white",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700, border: "2px solid rgba(255,255,255,0.3)"
          }}>AT</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Atul Yadav</div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>+91 98765 43210</div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 11, background: "rgba(255,255,255,0.15)", padding: "2px 10px", borderRadius: 99 }}>ID #42</span>
              <span style={{ fontSize: 11, background: "rgba(34,197,94,0.3)", padding: "2px 10px", borderRadius: 99 }}>Trust 85</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 16px", marginTop: -32, position: "relative", zIndex: 10 }}>

        {/* Account Statistics — Current Light Style */}
        <div style={{
          background: "white",
          borderRadius: 16,
          padding: "16px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase" }}>
            Account Statistics
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                borderRadius: 12,
                padding: "12px",
                background: i === 0 ? "#eff6ff" : i === 1 ? "#f0fdf4" : i === 2 ? "#faf5ff" : "#fff1f2",
                border: `1px solid ${i === 0 ? "#bfdbfe" : i === 1 ? "#bbf7d0" : i === 2 ? "#e9d5ff" : "#fecdd3"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* View Details Button */}
          <div style={{
            marginTop: 12,
            background: "linear-gradient(135deg, #1e40af, #0369a1)",
            borderRadius: 10,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
          }}>
            <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>View Rewards & Full Stats</span>
            <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 18 }}>→</span>
          </div>
        </div>

        {/* ---- NEW DARK REWARDS PAGE PREVIEW ---- */}
        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10, paddingLeft: 4 }}>
          ↓ New Separate Page — Rewards &amp; Stats (Dark Theme)
        </div>

        {/* Dark Header Card */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          borderRadius: 20,
          padding: "20px",
          marginBottom: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "white", fontWeight: 700, fontSize: 16 }}>Welcome Atul Yadav</span>
              <span style={{ background: "#22c55e", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "white", fontWeight: 600 }}>✓</span>
            </div>
            <span style={{
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              borderRadius: 8, padding: "3px 12px", fontSize: 12, color: "white", fontWeight: 700,
            }}>🥈 Silver</span>
          </div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 12 }}>Total Rewards Earned</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ color: "#f59e0b", fontSize: 32, fontWeight: 800 }}>₹ 712.42</span>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
            <div>
              <div style={{ color: "#64748b", fontSize: 11 }}>Today</div>
              <div style={{ color: "#fbbf24", fontSize: 15, fontWeight: 700 }}>₹ 20.50</div>
            </div>
            <div style={{ width: 1, background: "#1e293b" }} />
            <div>
              <div style={{ color: "#64748b", fontSize: 11 }}>Agent Earned</div>
              <div style={{ color: "#94a3b8", fontSize: 15, fontWeight: 700 }}>₹ 320.00</div>
            </div>
            <div style={{ width: 1, background: "#1e293b" }} />
            <div>
              <div style={{ color: "#64748b", fontSize: 11 }}>Invite (L1)</div>
              <div style={{ color: "#a855f7", fontSize: 15, fontWeight: 700 }}>₹ 49.92</div>
            </div>
          </div>
        </div>

        {/* Today Rewards — Dark Cards */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {rewards.slice(0, 2).map((r, i) => (
            <div key={i} style={{
              flex: 1,
              background: "#0f172a",
              borderRadius: 16,
              padding: "14px",
              border: "1px solid #1e293b",
            }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{r.icon}</div>
              <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>{r.label}</div>
              <div style={{ color: "#f59e0b", fontSize: 20, fontWeight: 800 }}>{r.value}</div>
              <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>{r.sub}</div>
            </div>
          ))}
        </div>

        {/* Agent Earning Card */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 16,
          padding: "16px",
          border: "1px solid #334155",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 11 }}>Agent Earning</div>
            <div style={{ color: "#e2e8f0", fontSize: 22, fontWeight: 800, marginTop: 4 }}>₹ 320.00</div>
            <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>Silver Tier — 5 active invitees today</div>
          </div>
          <div style={{
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            width: 48, height: 48, borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>🥈</div>
        </div>

        {/* Buy / Sell History Tabs */}
        <div style={{
          background: "white",
          borderRadius: 16,
          padding: "16px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ background: "#1e40af", color: "white", borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600 }}>Buy History</div>
            <div style={{ background: "#f1f5f9", color: "#64748b", borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600 }}>Sell History</div>
          </div>
          {[
            { amount: "₹ 500", reward: "+₹ 5.00", time: "Today 2:30 PM", status: "Completed" },
            { amount: "₹ 1,000", reward: "+₹ 10.00", time: "Yesterday 5:15 PM", status: "Completed" },
          ].map((t, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: i === 0 ? "1px solid #f1f5f9" : "none",
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.amount}</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>{t.time}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>{t.reward}</div>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>{t.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
