"use client";

import { useState, useRef, useCallback } from "react";

type PipelineResult = {
  success: boolean;
  error?: string;
  details?: string;
  pipeline?: {
    ocr: {
      method: string;
      confidence: number;
      character_count: number;
      text_preview: string;
    };
    decision: {
      use_vision: boolean;
      reason: string;
    };
    notice: {
      title: string;
      category: string;
      audience: string[];
      summary: string;
      english_translation: string;
      important_dates: string[];
      whatsapp_message: string;
      processing_method: "gemini_text" | "gemini_vision" | "groq_text" | "groq_vision";
      original_hindi_text?: string;
    };
    database: {
      saved: boolean;
      id?: string;
      error?: string;
    };
  };
};

type Step = {
  label: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
};

export default function AdminNoticesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateStep = (index: number, update: Partial<Step>) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...update } : s))
    );
  };

  const handleFile = (f: File) => {
    if (f.type === "application/pdf" || f.name.endsWith(".pdf")) {
      setFile(f);
      setResult(null);
      setSteps([]);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, []);

  const processNotice = async () => {
    if (!file) return;

    setProcessing(true);
    setResult(null);

    const pipelineSteps: Step[] = [
      { label: "Uploading PDF", status: "active" },
      { label: "OCR Processing (EasyOCR)", status: "pending" },
      { label: "Decision Engine", status: "pending" },
      { label: "AI Processing (Gemini/Groq)", status: "pending" },
      { label: "Saving to Database", status: "pending" },
    ];
    setSteps(pipelineSteps);

    try {
      await new Promise((r) => setTimeout(r, 400));
      updateStep(0, { status: "done", detail: file.name });
      updateStep(1, { status: "active", detail: "Extracting text..." });

      // Step 1: OCR
      const ocrFormData = new FormData();
      ocrFormData.append("file", file);

      const ocrRes = await fetch("/api/ocr", {
        method: "POST",
        body: ocrFormData,
      });

      const ocrData = await ocrRes.json();

      if (!ocrData.success) {
        updateStep(1, { status: "error", detail: ocrData.error || "OCR Failed" });
        setResult(ocrData);
        setProcessing(false);
        return;
      }

      const pOcr = ocrData.ocr;
      const pDecision = ocrData.decision;

      updateStep(1, {
        status: "done",
        detail: `${pOcr.confidence}% confidence · ${pOcr.character_count} chars`,
      });

      // Update UI with partial result to show OCR and Decision immediately
      setResult({
        success: true,
        pipeline: {
          ocr: pOcr,
          decision: pDecision,
          notice: {} as any,
          database: {} as any,
        }
      });

      updateStep(2, { status: "active" });
      await new Promise((r) => setTimeout(r, 500)); // Short pause for visual effect

      updateStep(2, {
        status: "done",
        detail: pDecision.use_vision
          ? "→ Vision Path (OCR too weak)"
          : "→ Text Path (OCR good)",
      });

      updateStep(3, {
        status: "active",
        detail: "Translating, categorizing, summarizing...",
      });

      // Step 2: AI Processing
      const aiFormData = new FormData();
      if (pDecision.use_vision) {
        aiFormData.append("file", file);
      }
      aiFormData.append("useVision", String(pDecision.use_vision));
      aiFormData.append("ocrText", pOcr.text);
      if (pOcr.image_base64) {
        aiFormData.append("imageBase64", pOcr.image_base64);
      }

      const aiRes = await fetch("/api/ai", {
        method: "POST",
        body: aiFormData,
      });

      const aiData = await aiRes.json();

      if (!aiData.success) {
        updateStep(3, { status: "error", detail: aiData.details || aiData.error || "AI failed" });
        setResult({
          success: false,
          error: aiData.error,
          details: aiData.details,
          pipeline: { ocr: pOcr, decision: pDecision } as any
        });
        setProcessing(false);
        return;
      }

      const pNotice = aiData.notice;
      const pDb = aiData.database;

      updateStep(3, {
        status: "done",
        detail: `${pNotice.processing_method.includes("vision") ? "🔍 Vision" : "📝 Text"} · ${pNotice.category} · ${pNotice.audience.length} audience group(s)`,
      });

      updateStep(4, {
        status: pDb.saved ? "done" : "error",
        detail: pDb.saved ? `Saved (ID: ${pDb.id})` : pDb.error || "Not saved",
      });

      // Update UI with final result
      setResult({
        success: true,
        pipeline: {
          ocr: pOcr,
          decision: pDecision,
          notice: pNotice,
          database: pDb,
        }
      });

    } catch (err) {
      setResult({
        success: false,
        error: "Network error",
        details: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResult(null);
    setSteps([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <main style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>📄</span>
            <div>
              <h1 style={styles.logoTitle}>MMMUT Notice Platform</h1>
              <p style={styles.logoSubtitle}>Admin · Notice Processor</p>
            </div>
          </div>
          <a href="/" style={styles.homeLink}>
            ← Back to Home
          </a>
        </div>
      </header>

      <div style={styles.content}>
        {/* Upload Card */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Upload Notice PDF</h2>
          <p style={styles.cardDesc}>
            Upload a Hindi notice PDF. The system will extract text via EasyOCR,
            evaluate quality, then use <strong>different AI models</strong> to translate,
            categorize, identify audience, and summarize.
          </p>

          <div
            style={{
              ...styles.dropzone,
              ...(isDragging ? styles.dropzoneActive : {}),
              ...(file ? styles.dropzoneHasFile : {}),
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            {file ? (
              <div style={styles.fileInfo}>
                <span style={styles.fileIcon}>📎</span>
                <div>
                  <p style={styles.fileName}>{file.name}</p>
                  <p style={styles.fileSize}>
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ) : (
              <div style={styles.dropzoneContent}>
                <span style={styles.uploadIcon}>⬆️</span>
                <p style={styles.dropzoneText}>
                  Drop your PDF here, or click to browse
                </p>
                <p style={styles.dropzoneHint}>Only .pdf files accepted</p>
              </div>
            )}
          </div>

          <div style={styles.actions}>
            <button
              onClick={processNotice}
              disabled={!file || processing}
              style={{
                ...styles.btnPrimary,
                ...(!file || processing ? styles.btnDisabled : {}),
              }}
            >
              {processing ? "⏳ Processing..." : "🚀 Process Notice"}
            </button>

            {file && !processing && (
              <button onClick={resetForm} style={styles.btnSecondary}>
                Clear
              </button>
            )}
          </div>
        </section>

        {/* Pipeline Steps */}
        {steps.length > 0 && (
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Pipeline Progress</h2>
            <div style={styles.stepsContainer}>
              {steps.map((step, i) => (
                <div key={i} style={styles.step}>
                  <span
                    style={{
                      ...styles.stepIcon,
                      ...(step.status === "pending" ? styles.stepPending : {}),
                    }}
                  >
                    {step.status === "done"
                      ? "✅"
                      : step.status === "active"
                      ? "⚡"
                      : step.status === "error"
                      ? "❌"
                      : "⏸️"}
                  </span>
                  <div style={styles.stepContent}>
                    <p style={styles.stepLabel}>{step.label}</p>
                    {step.detail && (
                      <p style={styles.stepDetail}>{step.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Results */}
        {result && result.success && result.pipeline && (
          <>
            {/* OCR Results */}
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>📊 OCR Results</h2>
              <div style={styles.statsGrid}>
                <div style={styles.stat}>
                  <span style={styles.statValue}>
                    {result.pipeline.ocr.confidence}%
                  </span>
                  <span style={styles.statLabel}>Confidence</span>
                </div>
                <div style={styles.stat}>
                  <span style={styles.statValue}>
                    {result.pipeline.ocr.character_count.toLocaleString()}
                  </span>
                  <span style={styles.statLabel}>Characters</span>
                </div>
                <div style={styles.stat}>
                  <span style={styles.statValue}>
                    {result.pipeline.ocr.method}
                  </span>
                  <span style={styles.statLabel}>OCR Method</span>
                </div>
                <div style={styles.stat}>
                  <span
                    style={{
                      ...styles.statValue,
                      color:
                        result.pipeline.decision.use_vision
                          ? "#fbbf24"
                          : "#4ade80",
                    }}
                  >
                    {result.pipeline.decision.use_vision
                      ? "🔍 Vision"
                      : "📝 Text"}
                  </span>
                  <span style={styles.statLabel}>AI Path</span>
                </div>
              </div>

              <div style={styles.decisionBanner}>
                <span style={styles.decisionIcon}>
                  {result.pipeline.decision.use_vision ? "🔍" : "✨"}
                </span>
                <p style={styles.decisionText}>
                  {result.pipeline.decision.reason}
                </p>
              </div>

              <div style={styles.textPreview}>
                <h3 style={styles.previewTitle}>
                  OCR Extracted Text (Preview)
                </h3>
                <pre style={styles.previewText}>
                  {result.pipeline.ocr.text_preview}
                </pre>
              </div>
            </section>

            {/* Processed Notice */}
            {result.pipeline.notice?.title && (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>📋 Processed Notice</h2>

              {/* Title */}
              <div style={styles.noticeTitleBox}>
                <h3 style={styles.noticeTitle}>
                  {result.pipeline.notice.title}
                </h3>
              </div>

              {/* Category + Processing */}
              <div style={styles.tagRow}>
                <span style={styles.badge}>
                  📁 {result.pipeline.notice.category}
                </span>
                <span
                  style={{
                    ...styles.badge,
                    ...(result.pipeline.notice.processing_method?.includes("vision")
                      ? styles.badgeWarning
                      : styles.badgeSuccess),
                  }}
                >
                  {result.pipeline.notice.processing_method?.includes("vision")
                    ? "🔍 Vision Path"
                    : "📝 Text Path"}
                </span>
              </div>

              {/* Audience */}
              <div style={styles.noticeSection}>
                <h3 style={styles.sectionTitle}>🎯 Target Audience</h3>
                <div style={styles.audienceGrid}>
                  {result.pipeline.notice.audience.map((a, i) => (
                    <span key={i} style={styles.audienceTag}>
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div style={styles.noticeSection}>
                <h3 style={styles.sectionTitle}>📝 Summary</h3>
                <p style={styles.sectionText}>
                  {result.pipeline.notice.summary}
                </p>
              </div>

              {/* Important Dates */}
              {result.pipeline.notice.important_dates.length > 0 && (
                <div style={styles.noticeSection}>
                  <h3 style={styles.sectionTitle}>📅 Important Dates</h3>
                  <div style={styles.datesList}>
                    {result.pipeline.notice.important_dates.map((d, i) => (
                      <div key={i} style={styles.dateItem}>
                        <span style={styles.dateIcon}>📌</span>
                        <span style={styles.dateText}>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* English Translation */}
              <div style={styles.noticeSection}>
                <h3 style={styles.sectionTitle}>🌐 English Translation</h3>
                <div style={styles.translationBox}>
                  {result.pipeline.notice.english_translation}
                </div>
              </div>

              {/* WhatsApp Preview */}
              {result.pipeline.notice.whatsapp_message && (
                <div style={styles.noticeSection}>
                  <h3 style={styles.sectionTitle}>💬 WhatsApp Preview</h3>
                  <div style={styles.whatsappCard}>
                    <pre style={styles.whatsappText}>
                      {result.pipeline.notice.whatsapp_message}
                    </pre>
                    <div style={styles.whatsappActions}>
                      <button 
                        style={styles.btnSecondary}
                        onClick={() => navigator.clipboard.writeText(result.pipeline.notice.whatsapp_message)}
                      >
                        📋 Copy
                      </button>
                      <button 
                        style={styles.btnWhatsApp}
                        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(result.pipeline.notice.whatsapp_message)}`)}
                      >
                        📱 WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Original Hindi (if available) */}
              {result.pipeline.notice.original_hindi_text && (
                <div style={styles.noticeSection}>
                  <details>
                    <summary style={styles.detailsSummary}>
                      📜 View Original Hindi Text (OCR)
                    </summary>
                    <pre style={styles.hindiText}>
                      {result.pipeline.notice.original_hindi_text}
                    </pre>
                  </details>
                </div>
              )}
            </section>
            )}

            {/* Database Status */}
            {result.pipeline.database?.saved !== undefined && (
            <section
              style={{
                ...styles.card,
                ...(result.pipeline.database.saved
                  ? styles.cardSuccess
                  : styles.cardWarning),
              }}
            >
              <h2 style={styles.cardTitle}>
                {result.pipeline.database.saved ? "✅" : "⚠️"} Database
              </h2>
              <p style={styles.dbStatus}>
                {result.pipeline.database.saved
                  ? `Notice saved successfully with ID: ${result.pipeline.database.id}`
                  : `Not saved: ${result.pipeline.database.error}`}
              </p>
            </section>
            )}
          </>
        )}

        {/* Error State */}
        {result && !result.success && (
          <section style={{ ...styles.card, ...styles.cardError }}>
            <h2 style={styles.cardTitle}>❌ Error</h2>
            <p style={styles.errorText}>{result.error}</p>
            {result.details && (
              <pre style={styles.errorDetails}>{result.details}</pre>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

/* ── Inline styles ──────────────────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)",
    color: "#e2e8f0",
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    backdropFilter: "blur(12px)",
    background: "rgba(15, 15, 35, 0.8)",
    position: "sticky" as const,
    top: 0,
    zIndex: 50,
  },
  headerInner: {
    maxWidth: "960px",
    margin: "0 auto",
    padding: "16px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  logoIcon: {
    fontSize: "28px",
  },
  logoTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#fff",
    margin: 0,
  },
  logoSubtitle: {
    fontSize: "12px",
    color: "#94a3b8",
    margin: 0,
  },
  homeLink: {
    fontSize: "14px",
    color: "#818cf8",
    textDecoration: "none",
  },
  content: {
    maxWidth: "960px",
    margin: "0 auto",
    padding: "32px 24px 64px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "24px",
  },
  card: {
    background: "rgba(30, 30, 60, 0.6)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    padding: "28px",
    backdropFilter: "blur(8px)",
  },
  cardSuccess: {
    borderColor: "rgba(74, 222, 128, 0.3)",
    background: "rgba(30, 60, 40, 0.5)",
  },
  cardWarning: {
    borderColor: "rgba(251, 191, 36, 0.3)",
    background: "rgba(60, 50, 30, 0.5)",
  },
  cardError: {
    borderColor: "rgba(248, 113, 113, 0.3)",
    background: "rgba(60, 30, 30, 0.5)",
  },
  cardTitle: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#fff",
    marginTop: 0,
    marginBottom: "12px",
  },
  cardDesc: {
    fontSize: "14px",
    color: "#94a3b8",
    marginBottom: "20px",
    lineHeight: 1.6,
  },
  dropzone: {
    border: "2px dashed rgba(129, 140, 248, 0.3)",
    borderRadius: "12px",
    padding: "40px 24px",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "all 0.2s ease",
    background: "rgba(129, 140, 248, 0.04)",
  },
  dropzoneActive: {
    borderColor: "#818cf8",
    background: "rgba(129, 140, 248, 0.1)",
  },
  dropzoneHasFile: {
    borderColor: "rgba(74, 222, 128, 0.4)",
    background: "rgba(74, 222, 128, 0.06)",
  },
  dropzoneContent: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "8px",
  },
  uploadIcon: {
    fontSize: "32px",
  },
  dropzoneText: {
    fontSize: "15px",
    color: "#c7d2fe",
    margin: 0,
  },
  dropzoneHint: {
    fontSize: "12px",
    color: "#64748b",
    margin: 0,
  },
  fileInfo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
  },
  fileIcon: {
    fontSize: "24px",
  },
  fileName: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#fff",
    margin: 0,
  },
  fileSize: {
    fontSize: "12px",
    color: "#94a3b8",
    margin: 0,
  },
  actions: {
    display: "flex",
    gap: "12px",
    marginTop: "20px",
  },
  btnPrimary: {
    padding: "12px 28px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  btnSecondary: {
    padding: "12px 20px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "#94a3b8",
    fontSize: "14px",
    cursor: "pointer",
  },
  stepsContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  step: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "10px 14px",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.03)",
  },
  stepIcon: {
    fontSize: "18px",
    flexShrink: 0,
    marginTop: "2px",
  },
  stepPending: { opacity: 0.4 },
  stepContent: {},
  stepLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#e2e8f0",
    margin: 0,
  },
  stepDetail: {
    fontSize: "12px",
    color: "#94a3b8",
    margin: "2px 0 0 0",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },
  stat: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "16px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  statValue: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#c7d2fe",
  },
  statLabel: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "4px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  decisionBanner: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 16px",
    borderRadius: "10px",
    background: "rgba(129, 140, 248, 0.08)",
    border: "1px solid rgba(129, 140, 248, 0.15)",
    marginBottom: "16px",
  },
  decisionIcon: {
    fontSize: "20px",
    flexShrink: 0,
  },
  decisionText: {
    fontSize: "13px",
    color: "#c7d2fe",
    margin: 0,
    lineHeight: 1.5,
  },
  textPreview: {
    marginTop: "8px",
  },
  previewTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: "8px",
  },
  previewText: {
    fontSize: "13px",
    lineHeight: 1.6,
    color: "#cbd5e1",
    background: "rgba(0,0,0,0.3)",
    padding: "16px",
    borderRadius: "10px",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    maxHeight: "200px",
    overflow: "auto",
    margin: 0,
  },
  noticeTitleBox: {
    padding: "16px 20px",
    borderRadius: "12px",
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))",
    border: "1px solid rgba(129, 140, 248, 0.2)",
    marginBottom: "16px",
  },
  noticeTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#fff",
    margin: 0,
    lineHeight: 1.4,
  },
  whatsappCard: {
    background: "rgba(16, 185, 129, 0.05)",
    border: "1px solid rgba(16, 185, 129, 0.2)",
    borderRadius: "12px",
    padding: "16px",
    marginTop: "12px",
  },
  whatsappText: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#e2e8f0",
    whiteSpace: "pre-wrap" as const,
    fontFamily: "inherit",
    margin: "0 0 16px 0",
  },
  whatsappActions: {
    display: "flex",
    gap: "12px",
  },
  btnWhatsApp: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    background: "#25D366",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tagRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap" as const,
    marginBottom: "20px",
  },
  badge: {
    display: "inline-block",
    padding: "5px 14px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: 600,
    background: "rgba(129, 140, 248, 0.15)",
    color: "#a5b4fc",
  },
  badgeSuccess: {
    background: "rgba(74, 222, 128, 0.15)",
    color: "#4ade80",
  },
  badgeWarning: {
    background: "rgba(251, 191, 36, 0.15)",
    color: "#fbbf24",
  },
  audienceGrid: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
  },
  audienceTag: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 500,
    background: "rgba(56, 189, 248, 0.12)",
    color: "#7dd3fc",
    border: "1px solid rgba(56, 189, 248, 0.2)",
  },
  noticeSection: {
    marginTop: "20px",
  },
  sectionTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: "10px",
  },
  sectionText: {
    fontSize: "14px",
    lineHeight: 1.7,
    color: "#cbd5e1",
    background: "rgba(0,0,0,0.2)",
    padding: "16px",
    borderRadius: "10px",
    margin: 0,
  },
  datesList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  dateItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "8px",
    background: "rgba(251, 191, 36, 0.08)",
    border: "1px solid rgba(251, 191, 36, 0.15)",
  },
  dateIcon: {
    fontSize: "14px",
    flexShrink: 0,
  },
  dateText: {
    fontSize: "13px",
    color: "#fde68a",
    fontWeight: 500,
  },
  translationBox: {
    fontSize: "14px",
    lineHeight: 1.8,
    color: "#e2e8f0",
    background: "rgba(0,0,0,0.25)",
    padding: "20px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.06)",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    maxHeight: "400px",
    overflow: "auto",
  },
  detailsSummary: {
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600,
    color: "#94a3b8",
    padding: "8px 0",
  },
  hindiText: {
    fontSize: "13px",
    lineHeight: 1.6,
    color: "#94a3b8",
    background: "rgba(0,0,0,0.3)",
    padding: "16px",
    borderRadius: "10px",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    maxHeight: "300px",
    overflow: "auto",
    marginTop: "8px",
  },
  dbStatus: {
    fontSize: "14px",
    color: "#e2e8f0",
    margin: 0,
  },
  errorText: {
    fontSize: "15px",
    color: "#fca5a5",
    fontWeight: 600,
    margin: 0,
  },
  errorDetails: {
    fontSize: "12px",
    color: "#94a3b8",
    background: "rgba(0,0,0,0.3)",
    padding: "12px",
    borderRadius: "8px",
    marginTop: "12px",
    whiteSpace: "pre-wrap" as const,
  },
};