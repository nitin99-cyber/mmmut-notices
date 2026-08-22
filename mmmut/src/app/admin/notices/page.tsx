"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import GlobalNav from "@/app/components/GlobalNav";
import Footer from "@/app/components/Footer";

type PipelineStage = {
  name: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
  timestamp?: string;
};

type PipelineLog = {
  ocr_method?: string;
  ocr_confidence?: number;
  ocr_char_count?: number;
  ai_model?: string;
  processing_method?: string;
  decision_reason?: string;
  stages: PipelineStage[];
};

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

// Type for notices fetched from Supabase via /api/notices
type NoticeRecord = {
  id: string;
  title: string | null;
  category: string | null;
  audience: string[] | string | null;
  summary: string | null;
  whatsapp_message: string | null;
  processing_method: string | null;
  pdf_url: string | null;
  is_large_notice: boolean | null;
  page_count: number | null;
  sent: boolean | null;
  created_at: string;
  pipeline_log?: {
    ai_model?: string;
    stages?: PipelineStage[];
  } | null;
};

export default function AdminNoticesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [pipelineLog, setPipelineLog] = useState<PipelineLog>({ stages: [] });
  const [copied, setCopied] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<{ sending: boolean; message?: string; success?: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reminder generator state
  const [reminderInput, setReminderInput] = useState("");
  const [isGeneratingReminder, setIsGeneratingReminder] = useState(false);
  const [generatedReminder, setGeneratedReminder] = useState("");
  const [reminderCopied, setReminderCopied] = useState(false);
  const [reminderDelivery, setReminderDelivery] = useState<string | null>(null);

  // Notices tracking list state
  const [notices, setNotices] = useState<NoticeRecord[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [noticesError, setNoticesError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishResults, setPublishResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);

  const fetchNotices = useCallback(async () => {
    setNoticesLoading(true);
    setNoticesError(null);
    try {
      const res = await fetch("/api/notices");
      const data = await res.json();
      if (data.success) {
        setNotices(data.data ?? []);
      } else {
        setNoticesError(data.error || "Failed to load notices.");
      }
    } catch {
      setNoticesError("Network error loading notices.");
    } finally {
      setNoticesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  // Refresh notices list after a new notice is successfully processed
  useEffect(() => {
    if (result?.success && result.pipeline?.database?.saved) {
      fetchNotices();
    }
  }, [result, fetchNotices]);

  const handlePublish = async (noticeId: string, force = false) => {
    setPublishingId(noticeId);
    try {
      const res = await fetch("/api/notices/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: noticeId, force }),
      });
      const data = await res.json();
      setPublishResults((prev) => ({
        ...prev,
        [noticeId]: {
          success: data.success,
          message: data.success ? "✓ Broadcasted!" : `✕ ${data.error}`,
        },
      }));
      if (data.success) {
        setNotices((prev) =>
          prev.map((n) => (n.id === noticeId ? { ...n, sent: true } : n))
        );
      }
    } catch {
      setPublishResults((prev) => ({
        ...prev,
        [noticeId]: { success: false, message: "✕ Network error" },
      }));
    } finally {
      setPublishingId(null);
    }
  };

  const handleBroadcastToWhatsApp = async (noticeId?: string, force: boolean = false) => {
    if (!noticeId) {
      alert("Please ensure the notice is saved in the database before broadcasting.");
      return;
    }
    setBroadcastStatus({ sending: true });
    try {
      const res = await fetch("/api/notices/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: noticeId, force }),
      });
      const data = await res.json();
      if (data.success) {
        setBroadcastStatus({
          sending: false,
          success: true,
          message: "✓ Broadcasted to WhatsApp Channel successfully!",
        });
      } else {
        setBroadcastStatus({
          sending: false,
          success: false,
          message: `❌ ${data.error || "Failed to broadcast"}`,
        });
      }
    } catch (err: any) {
      setBroadcastStatus({
        sending: false,
        success: false,
        message: `❌ ${err.message || "Network error"}`,
      });
    }
  };


  const addStage = (stage: PipelineStage) => {
    setPipelineLog((prev) => ({
      ...prev,
      stages: [...prev.stages.filter((s) => s.name !== stage.name), stage],
    }));
  };

  const updateStage = (name: string, update: Partial<PipelineStage>) => {
    setPipelineLog((prev) => ({
      ...prev,
      stages: prev.stages.map((s) => (s.name === name ? { ...s, ...update } : s)),
    }));
  };

  const handleFile = (f: File) => {
    if (f.type === "application/pdf" || f.name.endsWith(".pdf")) {
      setFile(f);
      setResult(null);
      setPipelineLog({ stages: [] });
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
    setPipelineLog({ stages: [] });

    // Stage 1: Upload
    addStage({ name: "Upload PDF", status: "active", timestamp: new Date().toISOString() });

    try {
      await new Promise((r) => setTimeout(r, 400));
      updateStage("Upload PDF", { status: "done", detail: file.name });

      // Stage 2: OCR
      addStage({ name: "OCR Processing (EasyOCR)", status: "active", detail: "Extracting text from PDF...", timestamp: new Date().toISOString() });

      const ocrFormData = new FormData();
      ocrFormData.append("file", file);

      const ocrRes = await fetch("/api/ocr", { method: "POST", body: ocrFormData });
      const ocrData = await ocrRes.json();

      if (!ocrData.success) {
        updateStage("OCR Processing (EasyOCR)", { status: "error", detail: ocrData.error || "OCR Failed" });
        setResult(ocrData);
        setProcessing(false);
        return;
      }

      const pOcr = ocrData.ocr;
      const pDecision = ocrData.decision;

      updateStage("OCR Processing (EasyOCR)", {
        status: "done",
        detail: pOcr
          ? `${pOcr.confidence}% confidence · ${pOcr.character_count} chars · Method: ${pOcr.method}`
          : "OCR Unavailable — falling back to Vision",
      });

      setPipelineLog((prev) => ({
        ...prev,
        ocr_method: pOcr?.method,
        ocr_confidence: pOcr?.confidence,
        ocr_char_count: pOcr?.character_count,
        decision_reason: pDecision?.reason,
      }));

      setResult({
        success: true,
        pipeline: {
          ocr: pOcr,
          decision: pDecision,
          notice: {} as never,
          database: {} as never,
        },
      });

      // Stage 3: Decision Engine
      addStage({ name: "Decision Engine", status: "active", timestamp: new Date().toISOString() });
      await new Promise((r) => setTimeout(r, 500));
      updateStage("Decision Engine", {
        status: "done",
        detail: pDecision.use_vision
          ? "→ Vision Path selected (OCR confidence too low)"
          : "→ Text Path selected (OCR confidence sufficient)",
      });

      // Stage 4: AI Processing
      addStage({
        name: "AI Processing (Gemini)",
        status: "active",
        detail: "Translating, categorizing, summarizing...",
        timestamp: new Date().toISOString(),
      });

      const aiFormData = new FormData();
      if (pDecision.use_vision) aiFormData.append("file", file);
      aiFormData.append("useVision", String(pDecision.use_vision));
      if (pOcr?.text) aiFormData.append("ocrText", pOcr.text);
      if (pOcr?.image_base64) aiFormData.append("imageBase64", pOcr.image_base64);
      aiFormData.append("pageCount", String(pOcr?.page_count || 1));

      const aiRes = await fetch("/api/ai", { method: "POST", body: aiFormData });
      const aiData = await aiRes.json();

      if (!aiData.success) {
        updateStage("AI Processing (Gemini)", {
          status: "error",
          detail: aiData.details || aiData.error || "AI processing failed",
        });
        setResult({
          success: false,
          error: aiData.error,
          details: aiData.details,
          pipeline: { ocr: pOcr, decision: pDecision } as never,
        });
        setProcessing(false);
        return;
      }

      const pNotice = aiData.notice;
      const pDb = aiData.database;

      updateStage("AI Processing (Gemini)", {
        status: "done",
        detail: `${pNotice.processing_method?.includes("vision") ? "Vision" : "Text"} path · Category: ${pNotice.category} · ${pNotice.audience?.length} audience group(s)`,
      });

      setPipelineLog((prev) => ({
        ...prev,
        ai_model: pNotice.processing_method?.includes("gemini") ? "Gemini" : "Groq",
        processing_method: pNotice.processing_method,
      }));

      // Stage 5: Database Save
      addStage({
        name: "Save to Database",
        status: pDb.saved ? "done" : "error",
        detail: pDb.saved ? `Saved · ID: ${pDb.id}` : pDb.error || "Not saved",
        timestamp: new Date().toISOString(),
      });

      setResult({
        success: true,
        pipeline: { ocr: pOcr, decision: pDecision, notice: pNotice, database: pDb },
      });
    } catch (err) {
      addStage({
        name: "Error",
        status: "error",
        detail: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      });
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
    setPipelineLog({ stages: [] });
    if (inputRef.current) inputRef.current.value = "";
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateReminder = async () => {
    if (!reminderInput.trim()) return;
    setIsGeneratingReminder(true);
    setGeneratedReminder("");
    setReminderDelivery(null);
    try {
      const res = await fetch("/api/generate-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: reminderInput }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedReminder(data.message);
        const delivery = data.delivery;
        setReminderDelivery(
          `Email: ${delivery?.email_sent ? "sent" : "not sent"} · WhatsApp: ${delivery?.whatsapp_sent ? "sent" : delivery?.whatsapp_error || "not sent"}`
        );
      } else {
        alert("Failed to generate reminder: " + data.error);
      }
    } catch (err) {
      alert("Network error: " + err);
    } finally {
      setIsGeneratingReminder(false);
    }
  };

  const copyReminder = () => {
    navigator.clipboard.writeText(generatedReminder);
    setReminderCopied(true);
    setTimeout(() => setReminderCopied(false), 2000);
  };

  const getStageIcon = (status: PipelineStage["status"]) => {
    if (status === "done") return "✓";
    if (status === "error") return "✕";
    if (status === "active") return "●";
    return "○";
  };

  const getStageColor = (status: PipelineStage["status"]) => {
    if (status === "done") return "#34c759";
    if (status === "error") return "#ff3b30";
    if (status === "active") return "#0071e3";
    return "#d2d2d7";
  };

  return (
    <div style={styles.page}>
      <GlobalNav />

      {/* Sub-nav breadcrumb */}
      <div style={styles.subNav}>
        <div style={styles.subNavInner}>
          <nav style={styles.breadcrumb}>
            <Link href="/" style={styles.breadcrumbLink}>Home</Link>
            <span style={styles.breadcrumbSep}>›</span>
            <span style={styles.breadcrumbActive}>Admin · Notice Processor</span>
          </nav>
        </div>
      </div>

      <main style={styles.main}>
        {/* Page Header */}
        <div style={styles.pageHeader}>
          <h1 style={styles.pageTitle}>Notice Processor</h1>
          <p style={styles.pageSubtitle}>
            Upload a Hindi notice PDF. The system extracts text via EasyOCR, evaluates quality,
            then uses Gemini AI to translate, categorize, and summarize.
          </p>
        </div>

        <div style={styles.grid}>
          {/* Left column */}
          <div style={styles.leftCol}>

            {/* Upload Card */}
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Upload Notice PDF</h2>
              <div
                style={{
                  ...styles.dropzone,
                  ...(isDragging ? styles.dropzoneActive : {}),
                  ...(file ? styles.dropzoneHasFile : {}),
                }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                {file ? (
                  <div style={styles.fileInfo}>
                    <div style={styles.fileIconWrap}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#0066cc" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M14 2v6h6" stroke="#0066cc" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div>
                      <p style={styles.fileName}>{file.name}</p>
                      <p style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB · PDF</p>
                    </div>
                  </div>
                ) : (
                  <div style={styles.dropzoneContent}>
                    <div style={styles.uploadIconWrap}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#0066cc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <p style={styles.dropzoneText}>Drop your PDF here, or click to browse</p>
                    <p style={styles.dropzoneHint}>Only .pdf files accepted</p>
                  </div>
                )}
              </div>

              <div style={styles.actions}>
                <button
                  onClick={processNotice}
                  disabled={!file || processing}
                  className="btn-primary"
                  style={{ opacity: (!file || processing) ? 0.4 : 1, cursor: (!file || processing) ? "not-allowed" : "pointer" }}
                >
                  {processing ? (
                    <>
                      <span style={styles.spinner} />
                      Processing…
                    </>
                  ) : "Process Notice"}
                </button>
                {file && !processing && (
                  <button onClick={resetForm} className="btn-secondary">
                    Clear
                  </button>
                )}
              </div>
            </section>

            {/* Short Reminder Generator Card */}
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Short Reminder Generator</h2>
              <p style={styles.cardDesc}>Quickly generate a standardized WhatsApp reminder from simple text.</p>
              
              <textarea
                style={styles.textArea}
                rows={3}
                placeholder="e.g. Last date to pay fee and do course selection is 27th July 2026"
                value={reminderInput}
                onChange={(e) => setReminderInput(e.target.value)}
                disabled={isGeneratingReminder}
              />
              
              <div style={{ ...styles.actions, marginTop: "12px" }}>
                <button
                  onClick={generateReminder}
                  disabled={!reminderInput.trim() || isGeneratingReminder}
                  className="btn-primary"
                  style={{ opacity: (!reminderInput.trim() || isGeneratingReminder) ? 0.4 : 1, cursor: (!reminderInput.trim() || isGeneratingReminder) ? "not-allowed" : "pointer" }}
                >
                  {isGeneratingReminder ? (
                    <>
                      <span style={styles.spinner} />
                      Generating…
                    </>
                  ) : "Generate Reminder (Groq)"}
                </button>
              </div>

              {generatedReminder && (
                <div style={{ marginTop: "16px" }}>
                  <div style={styles.resultHeader}>
                    <h3 style={styles.resultTitle}>Generated Message</h3>
                    <button onClick={copyReminder} style={styles.copyBtn}>
                      {reminderCopied ? "Copied!" : "Copy Text"}
                    </button>
                  </div>
                  <pre style={styles.preBlock}>{generatedReminder}</pre>
                  {reminderDelivery && (
                    <p style={{ ...styles.cardDesc, margin: "8px 0 0" }}>{reminderDelivery}</p>
                  )}
                </div>
              )}
            </section>
            
            {/* Pipeline Track Record */}
            {pipelineLog.stages.length > 0 && (
              <section style={styles.card}>
                <h2 style={styles.cardTitle}>AI Pipeline Track Record</h2>
                <p style={styles.cardDesc}>Full processing audit trail for this notice</p>

                {/* Summary badges */}
                {(pipelineLog.ocr_method || pipelineLog.processing_method) && (
                  <div style={styles.pipelineSummary}>
                    {pipelineLog.ocr_method && (
                      <span className="tag tag-blue">OCR: {pipelineLog.ocr_method}</span>
                    )}
                    {pipelineLog.ocr_confidence !== undefined && (
                      <span className="tag tag-blue">{pipelineLog.ocr_confidence}% confidence</span>
                    )}
                    {pipelineLog.ocr_char_count !== undefined && (
                      <span className="tag">{pipelineLog.ocr_char_count.toLocaleString()} chars</span>
                    )}
                    {pipelineLog.processing_method && (
                      <span className={`tag ${pipelineLog.processing_method.includes("vision") ? "tag-yellow" : "tag-green"}`}>
                        {pipelineLog.processing_method.includes("vision") ? "Vision Path" : "Text Path"}
                      </span>
                    )}
                    {pipelineLog.ai_model && (
                      <span className="tag tag-blue">Model: {pipelineLog.ai_model}</span>
                    )}
                  </div>
                )}

                {/* Stages timeline */}
                <div style={styles.timeline}>
                  {pipelineLog.stages.map((stage, i) => (
                    <div key={i} style={styles.timelineItem}>
                      <div style={styles.timelineLeft}>
                        <div style={{
                          ...styles.timelineDot,
                          background: getStageColor(stage.status),
                          color: "white",
                          animation: stage.status === "active" ? "pulse 1.5s infinite" : "none",
                        }}>
                          <span style={{ fontSize: "10px", fontWeight: 600 }}>{getStageIcon(stage.status)}</span>
                        </div>
                        {i < pipelineLog.stages.length - 1 && <div style={styles.timelineLine} />}
                      </div>
                      <div style={styles.timelineContent}>
                        <div style={styles.timelineHeader}>
                          <p style={styles.stageName}>{stage.name}</p>
                          {stage.timestamp && (
                            <span style={styles.stageTime}>
                              {new Date(stage.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        {stage.detail && (
                          <p style={styles.stageDetail}>{stage.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right column — Results */}
          <div style={styles.rightCol}>

            {/* OCR Results */}
            {result?.success && result.pipeline?.ocr && (
              <section style={styles.card}>
                <h2 style={styles.cardTitle}>OCR Analysis</h2>
                <div style={styles.statsGrid}>
                  {[
                    { value: `${result.pipeline.ocr.confidence}%`, label: "Confidence", color: result.pipeline.ocr.confidence > 70 ? "#34c759" : "#ff9500" },
                    { value: result.pipeline.ocr.character_count.toLocaleString(), label: "Characters" },
                    { value: result.pipeline.ocr.method, label: "Method" },
                    { value: result.pipeline.decision.use_vision ? "Vision" : "Text", label: "AI Path",
                      color: result.pipeline.decision.use_vision ? "#ff9500" : "#34c759" },
                  ].map((stat, i) => (
                    <div key={i} style={styles.statBox}>
                      <span style={{ ...styles.statValue, color: stat.color || "var(--color-carbon)" }}>{stat.value}</span>
                      <span style={styles.statLabel}>{stat.label}</span>
                    </div>
                  ))}
                </div>
                <div style={styles.decisionBanner}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                    <circle cx="12" cy="12" r="10" stroke="#0066cc" strokeWidth="1.5"/>
                    <path d="M12 8v4M12 16h.01" stroke="#0066cc" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p style={styles.decisionText}>{result.pipeline.decision.reason}</p>
                </div>
                {result.pipeline.ocr.text_preview && (
                  <div style={styles.previewBox}>
                    <p style={styles.previewLabel}>Extracted Text Preview</p>
                    <p style={styles.previewText}>{result.pipeline.ocr.text_preview}…</p>
                  </div>
                )}
              </section>
            )}

            {/* No OCR */}
            {result?.success && result.pipeline && !result.pipeline.ocr && (
              <section style={styles.card}>
                <h2 style={styles.cardTitle}>OCR Analysis</h2>
                <div style={styles.decisionBanner}>
                  <p style={styles.decisionText}>
                    {result.pipeline.decision?.reason || "OCR service unavailable → falling back to Gemini Vision"}
                  </p>
                </div>
              </section>
            )}

            {/* Processed Notice */}
            {result?.success && result.pipeline?.notice?.title && (
              <section style={styles.card}>
                <h2 style={styles.cardTitle}>Processed Notice</h2>

                <div style={styles.noticeTitleBox}>
                  <h3 style={styles.noticeTitle}>{result.pipeline.notice.title}</h3>
                </div>

                <div style={styles.tagRow}>
                  <span className="tag tag-blue">{result.pipeline.notice.category}</span>
                  <span className={`tag ${result.pipeline.notice.processing_method?.includes("vision") ? "tag-yellow" : "tag-green"}`}>
                    {result.pipeline.notice.processing_method?.includes("vision") ? "Vision Path" : "Text Path"}
                  </span>
                  <span className="tag">{result.pipeline.notice.processing_method}</span>
                </div>

                {/* Audience */}
                <div style={styles.noticeSection}>
                  <h3 style={styles.sectionLabel}>Target Audience</h3>
                  <div style={styles.audienceGrid}>
                    {result.pipeline.notice.audience?.map((a, i) => (
                      <span key={i} className="tag">{a}</span>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div style={styles.noticeSection}>
                  <h3 style={styles.sectionLabel}>Summary</h3>
                  <p style={styles.sectionText}>{result.pipeline.notice.summary}</p>
                </div>

                {/* Important Dates */}
                {result.pipeline.notice.important_dates?.length > 0 && (
                  <div style={styles.noticeSection}>
                    <h3 style={styles.sectionLabel}>Important Dates</h3>
                    <div style={styles.datesList}>
                      {result.pipeline.notice.important_dates.map((d, i) => (
                        <div key={i} style={styles.dateItem}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                            <rect x="3" y="4" width="18" height="18" rx="2" stroke="#0066cc" strokeWidth="1.5"/>
                            <path d="M16 2v4M8 2v4M3 10h18" stroke="#0066cc" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          <span style={styles.dateText}>{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* English Translation */}
                <div style={styles.noticeSection}>
                  <h3 style={styles.sectionLabel}>English Translation</h3>
                  <div style={styles.translationBox}>{result.pipeline.notice.english_translation}</div>
                </div>

                {/* WhatsApp Preview */}
                {result.pipeline.notice.whatsapp_message && (
                  <div style={styles.noticeSection}>
                    <h3 style={styles.sectionLabel}>WhatsApp Preview & Distribution</h3>
                    <div style={styles.whatsappCard}>
                      <pre style={styles.whatsappText}>{result.pipeline.notice.whatsapp_message}</pre>
                      
                      {broadcastStatus?.message && (
                        <div
                          style={{
                            padding: "8px 12px",
                            borderRadius: "6px",
                            marginBottom: "10px",
                            fontSize: "13px",
                            fontWeight: 500,
                            background: broadcastStatus.success ? "rgba(37, 211, 102, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: broadcastStatus.success ? "#25d366" : "#ef4444",
                            border: `1px solid ${broadcastStatus.success ? "#25d366" : "#ef4444"}`,
                          }}
                        >
                          {broadcastStatus.message}
                        </div>
                      )}

                      <div style={styles.whatsappActions}>
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => copyToClipboard(result.pipeline?.notice.whatsapp_message || "")}
                        >
                          {copied ? "✓ Copied" : "Copy Message"}
                        </button>
                        <button
                          className="btn-secondary btn-sm"
                          style={{ borderColor: "#25d366", color: "#25d366" }}
                          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(result.pipeline?.notice.whatsapp_message || "")}`)}
                        >
                          Open in Web
                        </button>
                        <button
                          className="btn-primary btn-sm"
                          style={{
                            background: "#25d366",
                            opacity: broadcastStatus?.sending ? 0.7 : 1,
                            cursor: broadcastStatus?.sending ? "not-allowed" : "pointer",
                          }}
                          disabled={broadcastStatus?.sending}
                          onClick={() => handleBroadcastToWhatsApp(result.pipeline?.database?.id)}
                        >
                          {broadcastStatus?.sending ? "Broadcasting..." : "🚀 Broadcast to Channel (OpenWA)"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Original Hindi */}
                {result.pipeline.notice.original_hindi_text && (
                  <div style={styles.noticeSection}>
                    <details>
                      <summary style={styles.detailsSummary}>View Original Hindi Text (OCR)</summary>
                      <pre style={styles.hindiText}>{result.pipeline.notice.original_hindi_text}</pre>
                    </details>
                  </div>
                )}
              </section>
            )}

            {/* Database Status */}
            {result?.success && result.pipeline?.database?.saved !== undefined && (
              <section style={{
                ...styles.card,
                borderColor: result.pipeline.database.saved ? "rgba(52,199,89,0.4)" : "rgba(255,59,48,0.3)",
                background: result.pipeline.database.saved ? "rgba(52,199,89,0.04)" : "rgba(255,59,48,0.04)",
              }}>
                <div style={styles.dbRow}>
                  <span style={{ fontSize: "18px" }}>{result.pipeline.database.saved ? "✓" : "✕"}</span>
                  <div>
                    <p style={{ ...styles.stageName, color: result.pipeline.database.saved ? "#1a7a3a" : "#a00000" }}>
                      {result.pipeline.database.saved ? "Saved to Database" : "Not Saved"}
                    </p>
                    <p style={styles.stageDetail}>
                      {result.pipeline.database.saved
                        ? `ID: ${result.pipeline.database.id}`
                        : result.pipeline.database.error}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Error */}
            {result && !result.success && (
              <section style={{ ...styles.card, borderColor: "rgba(255,59,48,0.3)" }}>
                <h2 style={{ ...styles.cardTitle, color: "#a00000" }}>Processing Error</h2>
                <p style={styles.sectionText}>{result.error}</p>
                {result.details && <pre style={styles.hindiText}>{result.details}</pre>}
              </section>
            )}

            {/* Empty state */}
            {!result && pipelineLog.stages.length === 0 && (
              <section style={{ ...styles.card, textAlign: "center", padding: "48px 24px" }}>
                <div style={styles.emptyIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#d2d2d7" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#d2d2d7" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p style={styles.emptyTitle}>No results yet</p>
                <p style={styles.emptyDesc}>Upload a PDF and click Process Notice to see results here</p>
              </section>
            )}
          </div>
        </div>

        {/* ── All Processed Notices Tracking Table ── */}
        <section style={{ marginTop: "48px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <h2 style={{ ...styles.cardTitle, margin: 0, fontSize: "20px" }}>All Processed Notices</h2>
              <p style={{ ...styles.cardDesc, margin: "4px 0 0" }}>
                Full history of all notices saved to the database · {notices.length} total
              </p>
            </div>
            <button
              onClick={fetchNotices}
              className="btn-secondary"
              style={{ fontSize: "13px", padding: "6px 14px" }}
              disabled={noticesLoading}
            >
              {noticesLoading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>

          {noticesError && (
            <div style={{ padding: "12px 16px", background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.3)", borderRadius: "8px", color: "#a00000", fontSize: "14px", marginBottom: "16px" }}>
              {noticesError}
            </div>
          )}

          {noticesLoading && notices.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#86868b", fontSize: "14px" }}>Loading notices…</div>
          ) : notices.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#86868b", fontSize: "14px" }}>No notices in database yet.</div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid #d2d2d7", background: "#fff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f5f5f7", borderBottom: "1px solid #d2d2d7" }}>
                    {["Title", "Category", "AI Model", "Pages", "Sent", "Created", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#1d1d1f", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notices.map((n, idx) => {
                    const isExpanded = expandedNoticeId === n.id;
                    const pub = publishResults[n.id];
                    const modelLabel = n.pipeline_log?.ai_model || n.processing_method || "—";
                    const isGroq = modelLabel.startsWith("groq");
                    const isVision = modelLabel.includes("vision");
                    return (
                      <React.Fragment key={n.id}>
                        <tr
                          key={n.id}
                          style={{ borderBottom: "1px solid #f0f0f0", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}
                        >
                          {/* Title */}
                          <td style={{ padding: "10px 14px", maxWidth: "260px" }}>
                            <p style={{ margin: 0, fontWeight: 500, color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {n.title || "Untitled"}
                            </p>
                            {n.summary && (
                              <p style={{ margin: "2px 0 0", color: "#86868b", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {n.summary.substring(0, 80)}…
                              </p>
                            )}
                          </td>
                          {/* Category */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            <span className="tag tag-blue" style={{ fontSize: "11px" }}>{n.category || "—"}</span>
                          </td>
                          {/* AI Model */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            <span className={`tag ${isGroq ? "tag-yellow" : isVision ? "tag-yellow" : "tag-green"}`} style={{ fontSize: "11px" }}>
                              {modelLabel}
                            </span>
                          </td>
                          {/* Pages */}
                          <td style={{ padding: "10px 14px", color: "#86868b", whiteSpace: "nowrap" }}>
                            {n.page_count ?? "—"}{n.is_large_notice ? " 📋" : ""}
                          </td>
                          {/* Sent status */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            <span style={{
                              display: "inline-block", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600,
                              background: n.sent ? "rgba(52,199,89,0.12)" : "rgba(255,149,0,0.12)",
                              color: n.sent ? "#1a7a3a" : "#8a5500",
                            }}>
                              {n.sent ? "✓ Sent" : "Draft"}
                            </span>
                          </td>
                          {/* Created */}
                          <td style={{ padding: "10px 14px", color: "#86868b", whiteSpace: "nowrap", fontSize: "12px" }}>
                            {new Date(n.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          {/* Actions */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              {/* Expand WhatsApp preview */}
                              <button
                                className="btn-secondary btn-sm"
                                style={{ fontSize: "11px", padding: "4px 10px" }}
                                onClick={() => setExpandedNoticeId(isExpanded ? null : n.id)}
                              >
                                {isExpanded ? "▲ Hide" : "▼ Preview"}
                              </button>
                              {/* PDF link */}
                              {n.pdf_url && (
                                <a href={n.pdf_url} target="_blank" rel="noopener noreferrer"
                                  className="btn-secondary btn-sm"
                                  style={{ fontSize: "11px", padding: "4px 10px", textDecoration: "none", color: "inherit" }}
                                >
                                  PDF
                                </a>
                              )}
                              {/* Publish button */}
                              <button
                                className="btn-primary btn-sm"
                                style={{
                                  fontSize: "11px", padding: "4px 10px",
                                  background: n.sent ? "#34c759" : "#25d366",
                                  opacity: publishingId === n.id ? 0.6 : 1,
                                  cursor: publishingId === n.id ? "not-allowed" : "pointer",
                                }}
                                disabled={publishingId === n.id}
                                onClick={() => handlePublish(n.id)}
                                title={n.sent ? "Re-broadcast to WhatsApp" : "Broadcast to WhatsApp Channel"}
                              >
                                {publishingId === n.id ? "…" : n.sent ? "Re-send" : "Publish"}
                              </button>
                            </div>
                            {/* Publish result feedback */}
                            {pub && (
                              <p style={{ margin: "4px 0 0", fontSize: "11px", color: pub.success ? "#1a7a3a" : "#a00000", fontWeight: 500 }}>
                                {pub.message}
                              </p>
                            )}
                          </td>
                        </tr>
                        {/* Expanded WhatsApp preview row */}
                        {isExpanded && (
                          <tr key={`${n.id}-expand`} style={{ background: "#f5f5f7" }}>
                            <td colSpan={7} style={{ padding: "12px 16px" }}>
                              <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: "12px", color: "#86868b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                WhatsApp Message Preview
                              </p>
                              <pre style={{ margin: 0, padding: "12px", background: "#fff", border: "1px solid #d2d2d7", borderRadius: "6px", fontSize: "12px", lineHeight: "1.6", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "200px", overflowY: "auto" }}>
                                {n.whatsapp_message || "No WhatsApp message generated."}
                              </pre>
                              {n.whatsapp_message && (
                                <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                                  <button
                                    className="btn-secondary btn-sm"
                                    style={{ fontSize: "11px" }}
                                    onClick={() => { navigator.clipboard.writeText(n.whatsapp_message!); }}
                                  >
                                    Copy
                                  </button>
                                  <a
                                    href={`https://wa.me/?text=${encodeURIComponent(n.whatsapp_message)}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="btn-secondary btn-sm"
                                    style={{ fontSize: "11px", textDecoration: "none", color: "#25d366", borderColor: "#25d366" }}
                                  >
                                    Open in WhatsApp Web
                                  </a>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>


      <Footer />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.95); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
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
    marginBottom: "40px",
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
    maxWidth: "680px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
    alignItems: "start",
  },
  leftCol: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  rightCol: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  card: {
    background: "white",
    border: "1px solid #d2d2d7",
    borderRadius: "var(--radius-cards)",
    padding: "24px",
  },
  cardTitle: {
    fontFamily: "var(--font-sf-pro-display)",
    fontSize: "var(--text-heading-sm)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    letterSpacing: "var(--tracking-heading-sm)",
    marginBottom: "8px",
  },
  cardDesc: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-ash)",
    marginBottom: "16px",
    letterSpacing: "var(--tracking-body-sm)",
  },
  dropzone: {
    border: "1.5px dashed #d2d2d7",
    borderRadius: "var(--radius-inputs)",
    padding: "40px 24px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
    background: "var(--surface-canvas)",
    marginBottom: "20px",
  },
  dropzoneActive: {
    borderColor: "var(--color-apple-blue)",
    background: "rgba(0,113,227,0.04)",
  },
  dropzoneHasFile: {
    borderColor: "rgba(52,199,89,0.5)",
    borderStyle: "solid",
    background: "rgba(52,199,89,0.04)",
  },
  dropzoneContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  uploadIconWrap: {
    width: "48px",
    height: "48px",
    borderRadius: "var(--radius-cards)",
    background: "rgba(0,102,204,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "8px",
  },
  dropzoneText: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-carbon)",
    fontWeight: "var(--font-weight-regular)",
  },
  dropzoneHint: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
  },
  fileInfo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
  },
  fileIconWrap: {
    width: "40px",
    height: "40px",
    borderRadius: "var(--radius-cards)",
    background: "rgba(0,102,204,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  fileName: {
    fontSize: "var(--text-body-sm)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    margin: 0,
  },
  fileSize: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
    margin: 0,
  },
  actions: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  spinner: {
    display: "inline-block",
    width: "14px",
    height: "14px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "white",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
  pipelineSummary: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "20px",
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
  },
  timelineItem: {
    display: "flex",
    gap: "12px",
  },
  timelineLeft: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  timelineDot: {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  timelineLine: {
    width: "1px",
    flex: 1,
    background: "#d2d2d7",
    margin: "4px 0",
    minHeight: "16px",
  },
  timelineContent: {
    paddingBottom: "16px",
    flex: 1,
  },
  timelineHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  stageName: {
    fontSize: "var(--text-body-sm)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    margin: 0,
  },
  stageTime: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
    flexShrink: 0,
  },
  stageDetail: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
    marginTop: "4px",
    lineHeight: 1.5,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginBottom: "16px",
  },
  statBox: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "14px",
    background: "var(--surface-canvas)",
    borderRadius: "var(--radius-cards)",
    border: "1px solid #d2d2d7",
  },
  statValue: {
    fontSize: "var(--text-heading-sm)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    letterSpacing: "var(--tracking-heading-sm)",
    lineHeight: 1,
    fontFamily: "var(--font-sf-pro-display)",
  },
  statLabel: {
    fontSize: "var(--text-caption)",
    color: "var(--color-ash)",
    letterSpacing: "var(--tracking-caption)",
  },
  decisionBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "12px 14px",
    background: "rgba(0,102,204,0.05)",
    borderRadius: "var(--radius-cards)",
    border: "1px solid rgba(0,102,204,0.15)",
    marginBottom: "12px",
  },
  decisionText: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-link-blue)",
    lineHeight: 1.5,
  },
  previewBox: {
    background: "var(--surface-canvas)",
    borderRadius: "var(--radius-cards)",
    padding: "14px",
    border: "1px solid #d2d2d7",
  },
  previewLabel: {
    fontSize: "var(--text-caption)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-ash)",
    marginBottom: "6px",
    letterSpacing: "var(--tracking-caption)",
  },
  previewText: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-carbon)",
    lineHeight: 1.6,
  },
  noticeTitleBox: {
    marginBottom: "16px",
  },
  noticeTitle: {
    fontFamily: "var(--font-sf-pro-display)",
    fontSize: "var(--text-subheading)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-carbon)",
    letterSpacing: "var(--tracking-subheading)",
    lineHeight: "var(--leading-subheading)",
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "20px",
  },
  noticeSection: {
    marginBottom: "20px",
  },
  sectionLabel: {
    fontSize: "var(--text-caption)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-ash)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: "8px",
  },
  sectionText: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-carbon)",
    lineHeight: 1.6,
    letterSpacing: "var(--tracking-body-sm)",
  },
  audienceGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  datesList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  dateItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    background: "var(--surface-canvas)",
    borderRadius: "var(--radius-cards)",
    border: "1px solid #d2d2d7",
  },
  dateText: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-carbon)",
  },
  translationBox: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-carbon)",
    lineHeight: 1.7,
    padding: "14px",
    background: "var(--surface-canvas)",
    borderRadius: "var(--radius-cards)",
    border: "1px solid #d2d2d7",
    letterSpacing: "var(--tracking-body-sm)",
  },
  whatsappCard: {
    background: "#f0fdf4",
    borderRadius: "var(--radius-cards)",
    border: "1px solid rgba(37,211,102,0.25)",
    overflow: "hidden",
  },
  whatsappText: {
    fontSize: "var(--text-body-sm)",
    color: "#1a3a1a",
    lineHeight: 1.7,
    padding: "14px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily: "var(--font-sf-pro-text)",
  },
  whatsappActions: {
    display: "flex",
    gap: "8px",
    padding: "12px 14px",
    borderTop: "1px solid rgba(37,211,102,0.15)",
    background: "rgba(37,211,102,0.06)",
  },
  detailsSummary: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-link-blue)",
    cursor: "pointer",
    padding: "8px 0",
    fontWeight: "var(--font-weight-semibold)",
  },
  hindiText: {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-carbon)",
    lineHeight: 1.7,
    padding: "14px",
    background: "var(--surface-canvas)",
    borderRadius: "var(--radius-cards)",
    border: "1px solid #d2d2d7",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily: "var(--font-sf-pro-text)",
    marginTop: "8px",
  },
  dbRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  emptyIcon: {
    margin: "0 auto 16px",
    width: "64px",
    height: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--surface-canvas)",
    borderRadius: "var(--radius-cards)",
    border: "1px solid #d2d2d7",
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
};