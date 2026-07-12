"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import GlobalNav from "@/app/components/GlobalNav";
import Footer from "@/app/components/Footer";

type PipelineLog = {
  ocr_method?: string;
  ocr_confidence?: number;
  ocr_char_count?: number;
  ai_model?: string;
  processing_method?: string;
  decision_reason?: string;
  stages?: Array<{ name: string; status: string; detail?: string; timestamp?: string }>;
};

type Notice = {
  id: string;
  title: string;
  category: string;
  audience: string[];
  summary: string;
  whatsapp_message?: string;
  processing_method?: string;
  sent?: boolean;
  created_at: string;
  pipeline_log?: PipelineLog;
  // from scraped_notices join
  source_url?: string;
  pdf_url?: string;
  publish_date?: string;
  scrape_status?: string;
};

type FilterStatus = "all" | "sent" | "pending" | "failed";

export default function HistoryPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notices");
      const data = await res.json();
      if (data.notices) {
        setNotices(data.notices);
      } else if (data.warning) {
        setError(data.warning);
        setNotices([]);
      }
    } catch (err) {
      setError("Failed to load notices. Check your Supabase connection.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSent = async (notice: Notice) => {
    setUpdatingId(notice.id);
    try {
      const res = await fetch("/api/notices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notice.id, sent: !notice.sent }),
      });
      if (res.ok) {
        setNotices((prev) =>
          prev.map((n) => (n.id === notice.id ? { ...n, sent: !notice.sent } : n))
        );
        if (selectedNotice?.id === notice.id) {
          setSelectedNotice((prev) => prev ? { ...prev, sent: !prev.sent } : null);
        }
      }
    } catch {
      // silent fail
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = notices.filter((n) => {
    if (filter === "all") return true;
    if (filter === "sent") return n.sent === true;
    if (filter === "pending") return !n.sent && n.processing_method;
    if (filter === "failed") return !n.processing_method;
    return true;
  });

  const stats = {
    total: notices.length,
    sent: notices.filter((n) => n.sent).length,
    pending: notices.filter((n) => !n.sent && n.processing_method).length,
    failed: notices.filter((n) => !n.processing_method).length,
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const getProcessingBadge = (method?: string) => {
    if (!method) return { label: "Unknown", cls: "" };
    if (method.includes("vision")) return { label: "Vision Path", cls: "tag-yellow" };
    return { label: "Text Path", cls: "tag-green" };
  };

  const getStageIcon = (status: string) => {
    if (status === "done") return { icon: "✓", color: "#34c759" };
    if (status === "error") return { icon: "✕", color: "#ff3b30" };
    if (status === "active") return { icon: "●", color: "#0071e3" };
    return { icon: "○", color: "#d2d2d7" };
  };

  return (
    <div style={styles.page}>
      <GlobalNav />

      {/* Sub-nav */}
      <div style={styles.subNav}>
        <div style={styles.subNavInner}>
          <nav style={styles.breadcrumb}>
            <Link href="/" style={styles.breadcrumbLink}>Home</Link>
            <span style={styles.breadcrumbSep}>›</span>
            <span style={styles.breadcrumbActive}>Notice History</span>
          </nav>
        </div>
      </div>

      <main style={styles.main}>
        {/* Page Header */}
        <div style={styles.pageHeader}>
          <h1 style={styles.pageTitle}>Notice History</h1>
          <p style={styles.pageSubtitle}>
            Track every notice through the AI pipeline — from scrape to processing to delivery.
          </p>
          <button onClick={fetchNotices} className="btn-secondary btn-sm" style={{ marginTop: "16px" }}>
            ↻ Refresh
          </button>
        </div>

        {/* Stats Row */}
        <div style={styles.statsRow}>
          {[
            { label: "Total Notices", value: stats.total, color: "var(--color-carbon)" },
            { label: "Sent", value: stats.sent, color: "#34c759" },
            { label: "Pending Send", value: stats.pending, color: "#ff9500" },
            { label: "Failed / Unknown", value: stats.failed, color: "#ff3b30" },
          ].map((s, i) => (
            <div key={i} style={styles.statCard}>
              <span style={{ ...styles.statValue, color: s.color }}>{s.value}</span>
              <span style={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div style={styles.filterRow}>
          {(["all", "sent", "pending", "failed"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterBtn,
                ...(filter === f ? styles.filterBtnActive : {}),
              }}
            >
              {f === "all" ? `All (${stats.total})` :
               f === "sent" ? `Sent (${stats.sent})` :
               f === "pending" ? `Pending (${stats.pending})` :
               `Failed (${stats.failed})`}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={styles.loadingState}>
            <div style={styles.loadingSpinner} />
            <p style={styles.loadingText}>Loading notices…</p>
          </div>
        ) : error ? (
          <div style={styles.errorBanner}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#ff3b30" strokeWidth="1.5"/>
              <path d="M12 8v5M12 16h.01" stroke="#ff3b30" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p>{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                  stroke="#d2d2d7" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
                  stroke="#d2d2d7" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={styles.emptyTitle}>No notices found</p>
            <p style={styles.emptyDesc}>
              {filter === "all"
                ? "Upload a PDF from the Admin page to get started."
                : `No notices with status "${filter}".`}
            </p>
            <Link href="/admin/notices" className="btn-primary btn-sm" style={{ marginTop: "16px" }}>
              Upload Notice
            </Link>
          </div>
        ) : (
          <div style={{ ...styles.layout, gridTemplateColumns: selectedNotice ? "1fr 420px" : "1fr" }}>

            {/* Notice list */}
            <div style={styles.listCol}>
              {filtered.map((notice) => {
                const badge = getProcessingBadge(notice.processing_method);
                const isSelected = selectedNotice?.id === notice.id;
                return (
                  <div
                    key={notice.id}
                    style={{
                      ...styles.noticeCard,
                      ...(isSelected ? styles.noticeCardSelected : {}),
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedNotice(isSelected ? null : notice)}
                  >
                    <div style={styles.noticeCardTop}>
                      <div style={styles.noticeCardMeta}>
                        <span className={`tag ${badge.cls}`}>{badge.label}</span>
                        {notice.category && (
                          <span className="tag tag-blue">{notice.category}</span>
                        )}
                        <span className={`tag ${notice.sent ? "tag-green" : "tag-yellow"}`}>
                          {notice.sent ? "✓ Sent" : "⏳ Pending"}
                        </span>
                      </div>
                      <button
                        className={notice.sent ? "btn-secondary btn-xs" : "btn-primary btn-xs"}
                        onClick={(e) => { e.stopPropagation(); toggleSent(notice); }}
                        disabled={updatingId === notice.id}
                        style={{ flexShrink: 0 }}
                      >
                        {updatingId === notice.id ? "…" : notice.sent ? "Mark Unsent" : "Mark Sent"}
                      </button>
                    </div>

                    <h3 style={styles.noticeCardTitle}>{notice.title || "Untitled Notice"}</h3>
                    {notice.summary && (
                      <p style={styles.noticeCardSummary}>
                        {notice.summary.length > 120
                          ? notice.summary.slice(0, 120) + "…"
                          : notice.summary}
                      </p>
                    )}

                    <div style={styles.noticeCardFooter}>
                      <span style={styles.noticeCardDate}>
                        {formatDate(notice.created_at)}
                      </span>
                      {notice.processing_method && (
                        <span style={styles.noticeCardMethod}>{notice.processing_method}</span>
                      )}
                      <span style={styles.noticeCardArrow}>
                        {isSelected ? "↑ Collapse" : "↓ Pipeline details"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pipeline detail panel */}
            {selectedNotice && (
              <div style={styles.detailPanel}>
                <div style={styles.detailHeader}>
                  <h2 style={styles.detailTitle}>Pipeline Track Record</h2>
                  <button
                    onClick={() => setSelectedNotice(null)}
                    style={styles.closeBtn}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <h3 style={styles.detailNoticeName}>{selectedNotice.title || "Untitled Notice"}</h3>

                {/* Pipeline Summary */}
                {selectedNotice.pipeline_log ? (
                  <>
                    <div style={styles.pipelineSummaryGrid}>
                      {[
                        { label: "OCR Method", value: selectedNotice.pipeline_log.ocr_method || "—" },
                        { label: "Confidence", value: selectedNotice.pipeline_log.ocr_confidence != null ? `${selectedNotice.pipeline_log.ocr_confidence}%` : "—" },
                        { label: "Char Count", value: selectedNotice.pipeline_log.ocr_char_count?.toLocaleString() || "—" },
                        { label: "AI Model", value: selectedNotice.pipeline_log.ai_model || "—" },
                        { label: "Path", value: selectedNotice.pipeline_log.processing_method || "—" },
                      ].map((item, i) => (
                        <div key={i} style={styles.pipelineSummaryItem}>
                          <span style={styles.pipelineSummaryLabel}>{item.label}</span>
                          <span style={styles.pipelineSummaryValue}>{item.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Stage timeline */}
                    {selectedNotice.pipeline_log.stages && selectedNotice.pipeline_log.stages.length > 0 && (
                      <div style={{ marginTop: "20px" }}>
                        <p style={styles.sectionLabel}>Processing Stages</p>
                        <div style={styles.timeline}>
                          {selectedNotice.pipeline_log.stages.map((stage, i) => {
                            const s = getStageIcon(stage.status);
                            return (
                              <div key={i} style={styles.timelineItem}>
                                <div style={styles.timelineLeft}>
                                  <div style={{ ...styles.timelineDot, background: s.color }}>
                                    <span style={{ fontSize: "10px", fontWeight: 700, color: "white" }}>{s.icon}</span>
                                  </div>
                                  {i < (selectedNotice.pipeline_log?.stages?.length ?? 0) - 1 && (
                                    <div style={styles.timelineLine} />
                                  )}
                                </div>
                                <div style={styles.timelineContent}>
                                  <div style={styles.timelineTop}>
                                    <p style={styles.stageName}>{stage.name}</p>
                                    {stage.timestamp && (
                                      <span style={styles.stageTime}>
                                        {new Date(stage.timestamp).toLocaleTimeString()}
                                      </span>
                                    )}
                                  </div>
                                  {stage.detail && <p style={styles.stageDetail}>{stage.detail}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={styles.noPipelineLog}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="#d2d2d7" strokeWidth="1.5"/>
                      <path d="M12 8v4M12 16h.01" stroke="#d2d2d7" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <p style={styles.noPipelineText}>
                      No pipeline log stored for this notice.
                      Notices processed before pipeline tracking was enabled won&apos;t have detailed logs.
                    </p>
                  </div>
                )}

                <hr style={{ borderTop: "1px solid #d2d2d7", margin: "20px 0" }} />

                {/* Full notice info */}
                <div>
                  <p style={styles.sectionLabel}>Full Details</p>

                  <div style={styles.detailRow}>
                    <span style={styles.detailKey}>Category</span>
                    <span style={styles.detailVal}>{selectedNotice.category || "—"}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailKey}>Audience</span>
                    <span style={styles.detailVal}>{selectedNotice.audience?.join(", ") || "—"}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailKey}>Sent</span>
                    <span style={{ ...styles.detailVal, color: selectedNotice.sent ? "#1a7a3a" : "#8a5500" }}>
                      {selectedNotice.sent ? "Yes" : "No"}
                    </span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailKey}>Created</span>
                    <span style={styles.detailVal}>{formatDate(selectedNotice.created_at)}</span>
                  </div>
                  {selectedNotice.pdf_url && (
                    <div style={styles.detailRow}>
                      <span style={styles.detailKey}>PDF URL</span>
                      <a href={selectedNotice.pdf_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: "var(--text-caption)", color: "var(--color-link-blue)", wordBreak: "break-all" }}>
                        View PDF ↗
                      </a>
                    </div>
                  )}
                </div>

                {selectedNotice.summary && (
                  <div style={{ marginTop: "16px" }}>
                    <p style={styles.sectionLabel}>Summary</p>
                    <p style={styles.detailText}>{selectedNotice.summary}</p>
                  </div>
                )}

                {selectedNotice.whatsapp_message && (
                  <div style={{ marginTop: "16px" }}>
                    <p style={styles.sectionLabel}>WhatsApp Message</p>
                    <pre style={styles.whatsappBox}>{selectedNotice.whatsapp_message}</pre>
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => navigator.clipboard.writeText(selectedNotice.whatsapp_message || "")}
                      >
                        Copy
                      </button>
                      <button
                        className="btn-primary btn-sm"
                        style={{ background: "#25d366" }}
                        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(selectedNotice.whatsapp_message || "")}`)}
                      >
                        Share on WhatsApp
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: "20px", display: "flex", gap: "8px" }}>
                  <button
                    className={selectedNotice.sent ? "btn-secondary btn-sm" : "btn-primary btn-sm"}
                    onClick={() => toggleSent(selectedNotice)}
                    disabled={updatingId === selectedNotice.id}
                  >
                    {updatingId === selectedNotice.id
                      ? "Updating…"
                      : selectedNotice.sent
                      ? "Mark as Unsent"
                      : "Mark as Sent"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "var(--surface-canvas)",
    display: "flex",
    flexDirection: "column",
  },
  subNav: {
    borderBottom: "1px solid #d2d2d7",
    background: "white",
  },
  subNavInner: {
    maxWidth: "var(--page-max-width)",
    margin: "0 auto",
    padding: "10px 24px",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  breadcrumbLink: {
    fontSize: "var(--text-caption)",
    color: "var(--color-link-blue)",
    textDecoration: "none",
  },
  breadcrumbSep: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
  },
  breadcrumbActive: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
  },
  main: {
    flex: 1,
    maxWidth: "var(--page-max-width)",
    margin: "0 auto",
    padding: "40px 24px 64px",
    width: "100%",
  },
  pageHeader: {
    marginBottom: "32px",
  },
  pageTitle: {
    fontFamily: "var(--font-sf-pro-display)",
    fontSize: "var(--text-heading)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    letterSpacing: "var(--tracking-heading)",
    lineHeight: "var(--leading-heading)",
    marginBottom: "12px",
  },
  pageSubtitle: {
    fontSize: "var(--text-subheading)",
    fontWeight: "var(--font-weight-light)",
    color: "var(--color-ash)",
    letterSpacing: "var(--tracking-subheading)",
    lineHeight: "var(--leading-subheading)",
    maxWidth: "600px",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "32px",
  },
  statCard: {
    background: "white",
    border: "1px solid #d2d2d7",
    borderRadius: "var(--radius-cards)",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  statValue: {
    fontFamily: "var(--font-sf-pro-display)",
    fontSize: "var(--text-heading)",
    fontWeight: "var(--font-weight-semibold)",
    letterSpacing: "var(--tracking-heading)",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
    letterSpacing: "var(--tracking-caption)",
  },
  filterRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  filterBtn: {
    padding: "6px 16px",
    borderRadius: "var(--radius-full)",
    border: "1px solid #d2d2d7",
    background: "white",
    color: "var(--color-ash)",
    fontSize: "var(--text-caption)",
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontFamily: "var(--font-sf-pro-text)",
    letterSpacing: "var(--tracking-caption)",
  },
  filterBtnActive: {
    border: "1px solid var(--color-apple-blue)",
    background: "rgba(0,113,227,0.08)",
    color: "var(--color-apple-blue)",
  },
  loadingState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "80px 24px",
    gap: "16px",
  },
  loadingSpinner: {
    width: "32px",
    height: "32px",
    border: "2px solid #d2d2d7",
    borderTopColor: "var(--color-apple-blue)",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
  loadingText: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-ash)",
  },
  errorBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "16px 20px",
    background: "rgba(255,59,48,0.05)",
    border: "1px solid rgba(255,59,48,0.2)",
    borderRadius: "var(--radius-cards)",
    fontSize: "var(--text-body-sm)",
    color: "#a00000",
  },
  emptyState: {
    textAlign: "center",
    padding: "80px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  emptyIcon: {
    width: "72px",
    height: "72px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "white",
    border: "1px solid #d2d2d7",
    borderRadius: "var(--radius-cards)",
    marginBottom: "20px",
  },
  emptyTitle: {
    fontSize: "var(--text-subheading)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    marginBottom: "8px",
  },
  emptyDesc: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-ash)",
    maxWidth: "360px",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "24px",
    alignItems: "start",
  },
  listCol: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  noticeCard: {
    background: "white",
    border: "1px solid #d2d2d7",
    borderRadius: "var(--radius-cards)",
    padding: "20px 24px",
    transition: "border-color 0.15s ease, transform 0.1s ease",
  },
  noticeCardSelected: {
    borderColor: "var(--color-apple-blue)",
    background: "rgba(0,113,227,0.02)",
  },
  noticeCardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "10px",
  },
  noticeCardMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    flex: 1,
  },
  noticeCardTitle: {
    fontFamily: "var(--font-sf-pro-display)",
    fontSize: "var(--text-heading-sm)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    letterSpacing: "var(--tracking-heading-sm)",
    lineHeight: "var(--leading-heading-sm)",
    marginBottom: "8px",
  },
  noticeCardSummary: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-ash)",
    lineHeight: 1.6,
    letterSpacing: "var(--tracking-body-sm)",
    marginBottom: "12px",
  },
  noticeCardFooter: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  noticeCardDate: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
  },
  noticeCardMethod: {
    fontSize: "var(--text-caption)",
    color: "var(--color-graphite)",
    fontFamily: "monospace",
  },
  noticeCardArrow: {
    fontSize: "var(--text-caption)",
    color: "var(--color-link-blue)",
    marginLeft: "auto",
  },
  detailPanel: {
    background: "white",
    border: "1px solid #d2d2d7",
    borderRadius: "var(--radius-cards)",
    padding: "24px",
    position: "sticky",
    top: "72px",
    maxHeight: "calc(100vh - 100px)",
    overflowY: "auto",
  },
  detailHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  detailTitle: {
    fontFamily: "var(--font-sf-pro-display)",
    fontSize: "var(--text-subheading)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    letterSpacing: "var(--tracking-subheading)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "20px",
    color: "var(--color-ash)",
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
  },
  detailNoticeName: {
    fontSize: "var(--text-body-sm)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    marginBottom: "16px",
    lineHeight: 1.5,
  },
  pipelineSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "8px",
  },
  pipelineSummaryItem: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "10px 12px",
    background: "var(--surface-canvas)",
    borderRadius: "var(--radius-cards)",
    border: "1px solid #d2d2d7",
  },
  pipelineSummaryLabel: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
    letterSpacing: "var(--tracking-caption)",
  },
  pipelineSummaryValue: {
    fontSize: "var(--text-body-sm)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
  },
  noPipelineLog: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "14px",
    background: "var(--surface-canvas)",
    borderRadius: "var(--radius-cards)",
    border: "1px solid #d2d2d7",
  },
  noPipelineText: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-ash)",
    lineHeight: 1.6,
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
  },
  timelineItem: {
    display: "flex",
    gap: "10px",
  },
  timelineLeft: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flexShrink: 0,
  },
  timelineDot: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: "1px",
    flex: 1,
    background: "#d2d2d7",
    margin: "3px 0",
    minHeight: "12px",
  },
  timelineContent: {
    paddingBottom: "14px",
    flex: 1,
  },
  timelineTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  stageName: {
    fontSize: "var(--text-body-sm)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
  },
  stageTime: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
    flexShrink: 0,
  },
  stageDetail: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
    marginTop: "3px",
    lineHeight: 1.5,
  },
  sectionLabel: {
    fontSize: "var(--text-caption)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-ash)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: "10px",
  },
  detailRow: {
    display: "flex",
    gap: "12px",
    padding: "8px 0",
    borderBottom: "1px solid var(--surface-canvas)",
  },
  detailKey: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
    width: "80px",
    flexShrink: 0,
    letterSpacing: "var(--tracking-caption)",
  },
  detailVal: {
    fontSize: "var(--text-caption)",
    color: "var(--color-carbon)",
    flex: 1,
  },
  detailText: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-carbon)",
    lineHeight: 1.6,
  },
  whatsappBox: {
    fontSize: "var(--text-caption)",
    color: "#1a3a1a",
    lineHeight: 1.7,
    padding: "12px",
    background: "#f0fdf4",
    borderRadius: "var(--radius-cards)",
    border: "1px solid rgba(37,211,102,0.25)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily: "var(--font-sf-pro-text)",
  },
};


