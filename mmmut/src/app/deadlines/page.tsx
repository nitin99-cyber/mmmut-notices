"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import GlobalNav from "@/app/components/GlobalNav";
import Footer from "@/app/components/Footer";

type Deadline = {
  id: string;
  title: string;
  description?: string;
  date: string;
  category: string;
  email_sent: boolean;
  whatsapp_sent: boolean;
  created_at: string;
};

type Category = "fee" | "exam" | "registration" | "other";

const CATEGORY_LABELS: Record<string, string> = {
  fee: "Fee",
  exam: "Exam",
  registration: "Registration",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  fee: "tag-red",
  exam: "tag-yellow",
  registration: "tag-blue",
  other: "",
};

export default function DeadlinesPage() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    category: "other" as Category,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeadlines();
  }, []);

  const fetchDeadlines = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/deadlines");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to load deadlines.");
        setDeadlines([]);
      } else if (Array.isArray(data.data)) {
        setDeadlines(data.data);
        if (data.meta?.warning) setError(data.meta.warning);
      } else if (data.meta?.warning) {
        setError(data.meta.warning);
        setDeadlines([]);
      }
    } catch {
      setError("Failed to load deadlines.");
    } finally {
      setLoading(false);
    }
  };

  const getDaysRemaining = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(dateStr);
    deadline.setHours(0, 0, 0, 0);
    return Math.round((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getUrgency = (days: number) => {
    if (days < 0) return { label: "Overdue", borderColor: "#ff3b30", bgColor: "rgba(255,59,48,0.04)", textColor: "#a00000" };
    if (days === 0) return { label: "Due Today", borderColor: "#ff3b30", bgColor: "rgba(255,59,48,0.06)", textColor: "#a00000" };
    if (days === 1) return { label: "Due Tomorrow", borderColor: "#ff9500", bgColor: "rgba(255,149,0,0.06)", textColor: "#8a5500" };
    if (days <= 7) return { label: `${days} days left`, borderColor: "#ff9500", bgColor: "rgba(255,149,0,0.04)", textColor: "#8a5500" };
    return { label: `${days} days left`, borderColor: "#d2d2d7", bgColor: "white", textColor: "#1a7a3a" };
  };

  const buildWhatsAppMessage = (dl: Deadline) => {
    const days = getDaysRemaining(dl.date);
    const dateStr = new Date(dl.date).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });
    if (days === 1) {
      return `⚠️ *REMINDER* ⚠️\n\nLast day to ${dl.title.toLowerCase()} is *${dateStr}* (tomorrow).\n\n${dl.description || ""}\n\nPlease complete before the deadline.\n\n— MMMUT Notice Platform`;
    }
    if (days === 0) {
      return `🔴 *URGENT* — Today is the last day!\n\n${dl.title} deadline: *${dateStr}*\n\n${dl.description || ""}\n\n— MMMUT Notice Platform`;
    }
    return `📅 *Upcoming Deadline*\n\n${dl.title}\nDate: *${dateStr}* (${days} days remaining)\n\n${dl.description || ""}\n\n— MMMUT Notice Platform`;
  };

  const markWhatsAppSent = async (dl: Deadline) => {
    setUpdatingId(dl.id);
    const msg = buildWhatsAppMessage(dl);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    try {
      const res = await fetch("/api/deadlines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dl.id, whatsapp_sent: true }),
      });
      if (!res.ok) throw new Error("Failed to update WhatsApp status");
      setDeadlines((prev) => prev.map((d) => d.id === dl.id ? { ...d, whatsapp_sent: true } : d));
    } catch {
      // silent
    } finally {
      setUpdatingId(null);
    }
  };

  const generateAiReminder = async (dl: Deadline) => {
    if (!confirm("This will use Groq AI to generate and send a WhatsApp/Email reminder. Proceed?")) return;
    
    setUpdatingId(dl.id + "_ai");
    try {
      const prompt = `Title: ${dl.title}\nDate: ${dl.date}\nDescription: ${dl.description || "N/A"}\nCategory: ${dl.category}`;
      const res = await fetch("/api/generate-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        alert("Failed to generate reminder: " + (data.error || "Unknown error"));
        return;
      }
      
      alert("AI Reminder Sent!\n\n" + data.message);
      
      // Update local state to mark as sent
      setDeadlines((prev) => prev.map((d) => d.id === dl.id ? { ...d, whatsapp_sent: true, email_sent: true } : d));
      
      // Also update in DB
      await fetch("/api/deadlines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dl.id, whatsapp_sent: true, email_sent: true }),
      });
    } catch (err: any) {
      alert("Error generating AI reminder: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const markEmailSent = async (id: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/deadlines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, email_sent: true }),
      });
      if (!res.ok) throw new Error("Failed to update email status");
      setDeadlines((prev) => prev.map((d) => d.id === id ? { ...d, email_sent: true } : d));
    } catch {
      // silent
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteDeadline = async (id: string) => {
    if (!confirm("Delete this deadline?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/deadlines?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete deadline");
      setDeadlines((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) {
      setFormError("Title and date are required.");
      return;
    }
    setFormSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/deadlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create deadline.");
      } else {
        setShowModal(false);
        setForm({ title: "", description: "", date: "", category: "other" });
        await fetchDeadlines();
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const sortedDeadlines = [...deadlines].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const upcoming = sortedDeadlines.filter((d) => getDaysRemaining(d.date) >= 0);
  const overdue = sortedDeadlines.filter((d) => getDaysRemaining(d.date) < 0);
  const emailTomorrow = sortedDeadlines.filter((d) => getDaysRemaining(d.date) === 1 && !d.email_sent);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={styles.page}>
      <GlobalNav />

      <div style={styles.subNav}>
        <div style={styles.subNavInner}>
          <nav style={styles.breadcrumb}>
            <Link href="/" style={styles.breadcrumbLink}>Home</Link>
            <span style={styles.breadcrumbSep}>›</span>
            <span style={styles.breadcrumbActive}>Deadlines</span>
          </nav>
        </div>
      </div>

      <main style={styles.main}>
        {/* Header */}
        <div style={styles.pageHeader}>
          <div style={styles.headerRow}>
            <div>
              <h1 style={styles.pageTitle}>Deadline Manager</h1>
              <p style={styles.pageSubtitle}>
                Track registrations, fees, and exam deadlines. Email alerts sent 1 day before.
              </p>
            </div>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              + Add Deadline
            </button>
          </div>
        </div>

        {/* Email alert banner */}
        {emailTomorrow.length > 0 && (
          <div style={styles.alertBanner}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                stroke="#8a5500" strokeWidth="1.5" strokeLinecap="round"/>
              <polyline points="22,6 12,13 2,6" stroke="#8a5500" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div>
              <p style={styles.alertTitle}>Email Alert Triggered</p>
              <p style={styles.alertText}>
                {emailTomorrow.length} deadline(s) are due tomorrow and require email alerts:&nbsp;
                <strong>{emailTomorrow.map((d) => d.title).join(", ")}</strong>
              </p>
            </div>
            <div style={styles.alertActions}>
              {emailTomorrow.map((d) => (
                <button
                  key={d.id}
                  className="btn-secondary btn-sm"
                  style={{ borderColor: "#8a5500", color: "#8a5500" }}
                  onClick={() => markEmailSent(d.id)}
                  disabled={updatingId === d.id}
                >
                  {updatingId === d.id ? "…" : `Mark "${d.title}" Email Sent`}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={styles.loadingState}>
            <div style={styles.loadingSpinner} />
            <p style={styles.loadingText}>Loading deadlines…</p>
          </div>
        ) : error ? (
          <div style={styles.errorBanner}>
            <p>{error}</p>
            <p style={{ fontSize: "var(--text-caption)", marginTop: "8px", opacity: 0.7 }}>
              Run the SQL migration to create the deadlines table in Supabase.
            </p>
          </div>
        ) : deadlines.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="#d2d2d7" strokeWidth="1.5"/>
                <path d="M16 2v4M8 2v4M3 10h18" stroke="#d2d2d7" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={styles.emptyTitle}>No deadlines yet</p>
            <p style={styles.emptyDesc}>Add your first deadline to start tracking.</p>
            <button onClick={() => setShowModal(true)} className="btn-primary" style={{ marginTop: "16px" }}>
              + Add First Deadline
            </button>
          </div>
        ) : (
          <>
            {/* Overdue */}
            {overdue.length > 0 && (
              <div style={{ marginBottom: "40px" }}>
                <h2 style={styles.sectionHeading}>Overdue ({overdue.length})</h2>
                <div style={styles.deadlineGrid}>
                  {overdue.map((dl) => (
                    <DeadlineCard
                      key={dl.id}
                      dl={dl}
                      days={getDaysRemaining(dl.date)}
                      urgency={getUrgency(getDaysRemaining(dl.date))}
                      formatDate={formatDate}
                      onWhatsApp={() => markWhatsAppSent(dl)}
                      onAiReminder={() => generateAiReminder(dl)}
                      onEmailSent={() => markEmailSent(dl.id)}
                      onDelete={() => deleteDeadline(dl.id)}
                      updatingId={updatingId}
                      deletingId={deletingId}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            <div>
              <h2 style={styles.sectionHeading}>Upcoming ({upcoming.length})</h2>
              {upcoming.length === 0 ? (
                <p style={{ fontSize: "var(--text-body-sm)", color: "var(--color-ash)", padding: "20px 0" }}>
                  No upcoming deadlines.
                </p>
              ) : (
                <div style={styles.deadlineGrid}>
                  {upcoming.map((dl) => (
                    <DeadlineCard
                      key={dl.id}
                      dl={dl}
                      days={getDaysRemaining(dl.date)}
                      urgency={getUrgency(getDaysRemaining(dl.date))}
                      formatDate={formatDate}
                      onWhatsApp={() => markWhatsAppSent(dl)}
                      onAiReminder={() => generateAiReminder(dl)}
                      onEmailSent={() => markEmailSent(dl.id)}
                      onDelete={() => deleteDeadline(dl.id)}
                      updatingId={updatingId}
                      deletingId={deletingId}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <Footer />

      {/* Add Deadline Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Add New Deadline</h2>
              <button onClick={() => setShowModal(false)} style={styles.closeBtn}>×</button>
            </div>

            <form onSubmit={submitForm} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Submit College Fee"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Additional details about this deadline…"
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={styles.formRow}>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.formLabel}>Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.formLabel}>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                  >
                    <option value="fee">Fee</option>
                    <option value="exam">Exam</option>
                    <option value="registration">Registration</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {formError && <p style={styles.formError}>{formError}</p>}

              <div style={styles.formActions}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? "Saving…" : "Add Deadline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// Deadline Card Component
function DeadlineCard({
  dl, days, urgency, formatDate,
  onWhatsApp, onAiReminder, onEmailSent, onDelete,
  updatingId, deletingId,
}: {
  dl: Deadline;
  days: number;
  urgency: { label: string; borderColor: string; bgColor: string; textColor: string };
  formatDate: (d: string) => string;
  onWhatsApp: () => void;
  onAiReminder: () => void;
  onEmailSent: () => void;
  onDelete: () => void;
  updatingId: string | null;
  deletingId: string | null;
}) {
  return (
    <div style={{
      ...cardStyles.card,
      borderColor: urgency.borderColor,
      background: urgency.bgColor,
    }}>
      <div style={cardStyles.cardTop}>
        <div style={cardStyles.badges}>
          <span className={`tag ${CATEGORY_COLORS[dl.category] || ""}`}>
            {CATEGORY_LABELS[dl.category] || dl.category}
          </span>
          <span style={{ ...cardStyles.urgencyLabel, color: urgency.textColor }}>
            {urgency.label}
          </span>
        </div>
        <button
          onClick={onDelete}
          style={cardStyles.deleteBtn}
          disabled={deletingId === dl.id}
          title="Delete deadline"
        >
          {deletingId === dl.id ? "…" : "×"}
        </button>
      </div>

      <h3 style={cardStyles.title}>{dl.title}</h3>
      {dl.description && <p style={cardStyles.desc}>{dl.description}</p>}

      <div style={cardStyles.dateRow}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="#707070" strokeWidth="1.5"/>
          <path d="M16 2v4M8 2v4M3 10h18" stroke="#707070" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={cardStyles.dateText}>{formatDate(dl.date)}</span>
      </div>

      {/* Alert badges */}
      <div style={cardStyles.statusRow}>
        <span className={`tag ${dl.email_sent ? "tag-green" : ""}`}
          style={{ opacity: dl.email_sent ? 1 : 0.5 }}>
          {dl.email_sent ? "✓ Email Sent" : "Email Pending"}
        </span>
        <span className={`tag ${dl.whatsapp_sent ? "tag-green" : ""}`}
          style={{ opacity: dl.whatsapp_sent ? 1 : 0.5 }}>
          {dl.whatsapp_sent ? "✓ WhatsApp Sent" : "WhatsApp Pending"}
        </span>
      </div>

      <div style={cardStyles.actions}>
        <button
          className="btn-secondary btn-sm"
          onClick={onWhatsApp}
          disabled={updatingId === dl.id || updatingId === dl.id + "_ai"}
          style={{ borderColor: "#25d366", color: "#1a7a3a" }}
        >
          {updatingId === dl.id ? "…" : "Share WhatsApp"}
        </button>
        <button
          className="btn-primary btn-sm"
          onClick={onAiReminder}
          disabled={updatingId === dl.id || updatingId === dl.id + "_ai"}
          style={{ background: "#7000e3", borderColor: "#7000e3", color: "white" }}
        >
          {updatingId === dl.id + "_ai" ? "Generating…" : "✨ AI Reminder (Groq)"}
        </button>
        {!dl.email_sent && days <= 1 && (
          <button
            className="btn-secondary btn-sm"
            onClick={onEmailSent}
            disabled={updatingId === dl.id || updatingId === dl.id + "_ai"}
          >
            {updatingId === dl.id ? "…" : "Mark Email Sent"}
          </button>
        )}
      </div>
    </div>
  );
}



const cardStyles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #d2d2d7",
    borderRadius: "var(--radius-cards)",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    transition: "transform 0.15s ease",
  },
  cardTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "8px",
  },
  badges: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    flex: 1,
  },
  urgencyLabel: {
    fontSize: "var(--text-caption)",
    fontWeight: "var(--font-weight-semibold)",
    letterSpacing: "var(--tracking-caption)",
  },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "var(--color-ash)",
    fontSize: "18px",
    cursor: "pointer",
    padding: "0 2px",
    lineHeight: 1,
    flexShrink: 0,
  },
  title: {
    fontFamily: "var(--font-sf-pro-display)",
    fontSize: "var(--text-subheading)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    letterSpacing: "var(--tracking-subheading)",
    lineHeight: "var(--leading-subheading)",
  },
  desc: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-ash)",
    lineHeight: 1.6,
    letterSpacing: "var(--tracking-body-sm)",
  },
  dateRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  dateText: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-graphite)",
    fontWeight: "var(--font-weight-semibold)",
  },
  statusRow: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
};

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
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "24px",
    flexWrap: "wrap",
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
    maxWidth: "500px",
  },
  alertBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "16px 20px",
    background: "rgba(255,149,0,0.07)",
    border: "1px solid rgba(255,149,0,0.3)",
    borderRadius: "var(--radius-cards)",
    marginBottom: "32px",
    flexWrap: "wrap",
  },
  alertTitle: {
    fontSize: "var(--text-body-sm)",
    fontWeight: "var(--font-weight-semibold)",
    color: "#8a5500",
    marginBottom: "4px",
  },
  alertText: {
    fontSize: "var(--text-body-sm)",
    color: "#8a5500",
    lineHeight: 1.5,
  },
  alertActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginLeft: "auto",
  },
  sectionHeading: {
    fontFamily: "var(--font-sf-pro-display)",
    fontSize: "var(--text-subheading)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    letterSpacing: "var(--tracking-subheading)",
    marginBottom: "16px",
  },
  deadlineGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "16px",
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
    padding: "20px 24px",
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
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    animation: "fadeIn 0.2s ease",
  },
  modal: {
    background: "white",
    border: "1px solid #d2d2d7",
    borderRadius: "var(--radius-lg-2)",
    padding: "32px",
    width: "100%",
    maxWidth: "520px",
    margin: "24px",
    animation: "slideUp 0.25s ease",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "24px",
  },
  modalTitle: {
    fontFamily: "var(--font-sf-pro-display)",
    fontSize: "var(--text-heading-sm)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    letterSpacing: "var(--tracking-heading-sm)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "24px",
    color: "var(--color-ash)",
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  formRow: {
    display: "flex",
    gap: "16px",
  },
  formLabel: {
    fontSize: "var(--text-caption)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-graphite)",
    letterSpacing: "var(--tracking-caption)",
  },
  formError: {
    fontSize: "var(--text-caption)",
    color: "#a00000",
    background: "rgba(255,59,48,0.06)",
    padding: "10px 14px",
    borderRadius: "var(--radius-inputs)",
    border: "1px solid rgba(255,59,48,0.2)",
  },
  formActions: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    marginTop: "8px",
  },
};
