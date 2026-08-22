"use client";

import React, { useState, useEffect } from "react";
import GlobalNav from "../components/GlobalNav";
import Footer from "../components/Footer";

type DashboardData = {
  stats: {
    totalScraped: number;
    pendingNotices: number;
    deadLinks: number;
    sentMessages: number;
    upcomingDeadlines: number;
  };
  aiUsage: {
    models: Record<string, number>;
    estimatedTokensUsed: number;
    tokenLimit: number;
  };
  activityFeed: Array<{
    id: string;
    type: string;
    title: string;
    timestamp: string;
    status: string;
    detail?: string;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch dashboard data");
      setData(json as DashboardData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "#f5f5f7", fontFamily: "var(--font-sf-pro-text), sans-serif", color: "#1d1d1f" }}>
      <GlobalNav />
      
      <main style={{ flex: 1, padding: "40px 20px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <h1 style={{ fontFamily: "var(--font-sf-pro-display), sans-serif", fontSize: "32px", fontWeight: 600, marginBottom: "32px", color: "#1d1d1f" }}>
          Dashboard
        </h1>

        {loading && !data ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px" }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid #d2d2d7", borderTop: "3px solid #0071e3", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
            <style>
              {`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
            </style>
          </div>
        ) : error && !data ? (
          <div style={{ color: "#d93025", padding: "20px", border: "1px solid #d2d2d7", borderRadius: "8px", backgroundColor: "#fff" }}>
            Error loading dashboard: {error}
          </div>
        ) : data ? (
          <>
            {/* Top Metric Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "32px" }}>
              <MetricCard title="Total Scraped" value={data.stats.totalScraped} />
              <MetricCard title="Pending Send" value={data.stats.pendingNotices} />
              <MetricCard title="Dead Links" value={data.stats.deadLinks} />
              <MetricCard title="Sent Messages" value={data.stats.sentMessages} />
              <MetricCard title="Upcoming Deadlines" value={data.stats.upcomingDeadlines} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
              {/* AI Limits & Usage Card */}
              <div style={{ backgroundColor: "#fff", border: "1px solid #d2d2d7", borderRadius: "8px", padding: "24px" }}>
                <h2 style={{ fontFamily: "var(--font-sf-pro-display), sans-serif", fontSize: "20px", fontWeight: 600, marginBottom: "20px", color: "#1d1d1f" }}>
                  AI Limits & Usage
                </h2>
                
                <div style={{ marginBottom: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px" }}>
                    <span style={{ color: "#707070" }}>Tokens Used</span>
                    <span style={{ fontWeight: 500 }}>{data.aiUsage.estimatedTokensUsed.toLocaleString()} / {data.aiUsage.tokenLimit.toLocaleString()}</span>
                  </div>
                  
                  {(() => {
                    const percent = Math.min((data.aiUsage.estimatedTokensUsed / data.aiUsage.tokenLimit) * 100, 100);
                    const isWarning = percent > 80;
                    return (
                      <div style={{ width: "100%", height: "8px", backgroundColor: "#f5f5f7", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ 
                          width: `${percent}%`, 
                          height: "100%", 
                          backgroundColor: isWarning ? "#d93025" : "#0071e3",
                          borderRadius: "4px",
                          transition: "width 0.3s ease"
                        }}></div>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#707070", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Model Breakdown
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {Object.entries(data.aiUsage.models).map(([model, count]) => (
                      <div key={model} style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", paddingBottom: "12px", borderBottom: "1px solid #f5f5f7" }}>
                        <span>{model}</span>
                        <span style={{ fontWeight: 500 }}>{count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* GitHub-Style Activity Feed */}
              <div style={{ backgroundColor: "#fff", border: "1px solid #d2d2d7", borderRadius: "8px", padding: "24px" }}>
                <h2 style={{ fontFamily: "var(--font-sf-pro-display), sans-serif", fontSize: "20px", fontWeight: 600, marginBottom: "20px", color: "#1d1d1f" }}>
                  Activity Feed
                </h2>
                
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {data.activityFeed.map((item, index) => {
                    const isLast = index === data.activityFeed.length - 1;
                    
                    let iconColor = "#707070";
                    let Icon = (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                      </svg>
                    );
                    
                    if (item.type === "scrape") {
                      iconColor = "#0071e3"; // Apple Blue
                      Icon = (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                      );
                    } else if (item.type === "process_job") {
                      iconColor = "#bf4080"; // Purple
                      Icon = (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3"></circle>
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                      );
                    } else if (item.type === "notice_sent") {
                      iconColor = "#34a853"; // Green
                      Icon = (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"></line>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                      );
                    } else if (item.type === "deadline") {
                      iconColor = "#fbbc05"; // Yellow
                      Icon = (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                      );
                    }

                    return (
                      <div key={item.id} style={{ display: "flex", position: "relative", paddingBottom: isLast ? "0" : "24px" }}>
                        {!isLast && (
                          <div style={{ position: "absolute", left: "15px", top: "32px", bottom: "0", width: "1px", backgroundColor: "#d2d2d7" }}></div>
                        )}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", zIndex: 1, width: "100%" }}>
                          <div style={{ 
                            width: "32px", 
                            height: "32px", 
                            borderRadius: "50%", 
                            backgroundColor: "#f5f5f7", 
                            border: `1px solid ${iconColor}`,
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            color: iconColor,
                            flexShrink: 0
                          }}>
                            {Icon}
                          </div>
                          
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                              <h4 style={{ fontSize: "14px", fontWeight: 500, margin: 0, color: "#1d1d1f" }}>
                                {item.title}
                              </h4>
                              <span style={{ fontSize: "12px", color: "#707070", whiteSpace: "nowrap", marginLeft: "12px" }}>
                                {item.timestamp}
                              </span>
                            </div>
                            {item.detail && (
                              <p style={{ fontSize: "13px", color: "#707070", margin: 0, lineHeight: "1.4" }}>
                                {item.detail}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </main>
      
      <Footer />
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ 
      backgroundColor: "#fff", 
      border: "1px solid #d2d2d7", 
      borderRadius: "8px", 
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    }}>
      <h3 style={{ 
        fontSize: "14px", 
        fontWeight: 500, 
        color: "#707070", 
        marginBottom: "8px",
        margin: 0
      }}>
        {title}
      </h3>
      <div style={{ 
        fontFamily: "var(--font-sf-pro-display), sans-serif", 
        fontSize: "32px", 
        fontWeight: 600, 
        color: "#1d1d1f" 
      }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
