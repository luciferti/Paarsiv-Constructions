"use client";

import { FormEvent, useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { sendNotification } from "@/lib/api/notifications";
import { generateSiteSummary, getSiteSummary } from "@/lib/api/summary";
import { SiteAISummary } from "@/lib/types/summary";
import { timeAgo } from "@/lib/utils/date";

export function AISummaryPanel({ siteId }: { siteId: string }) {
  const [summary, setSummary] = useState<SiteAISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => {
    getSiteSummary(siteId)
      .then((data) => setSummary(data))
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 404)) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      })
      .finally(() => setLoading(false));
  }, [siteId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const data = await generateSiteSummary(siteId);
      setSummary(data);
      setSendResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!summary || !recipientPhone) return;

    setSending(true);
    setSendResult(null);
    try {
      const notification = await sendNotification({
        site_id: siteId,
        recipient_name: recipientName || null,
        recipient_phone: recipientPhone,
        message: summary.summary_text,
      });
      setSendResult(
        notification.status === "logged"
          ? "Logged (no WhatsApp credentials configured — see Notifications page)"
          : `Sent via ${notification.provider_used}`
      );
    } catch (err) {
      setSendResult(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  if (loading) return null;

  return (
    <div className="ai-summary-panel">
      <div className="ai-summary-header">
        <h2 className="form-section-title">AI Daily Summary</h2>
        <button type="button" className="button-primary" onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating…" : summary ? "Regenerate" : "Generate Summary"}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {summary ? (
        <>
          <pre className="ai-summary-text">{summary.summary_text}</pre>
          <p className="field-hint">
            Generated {timeAgo(summary.generated_at)} from {summary.source_report_count} report(s)
            using {summary.model_used}.
          </p>

          <form onSubmit={handleSend} className="whatsapp-send-form">
            <div className="form-grid form-grid-2">
              <div className="form-field">
                <label htmlFor="wa-name">Recipient Name (optional)</label>
                <input
                  id="wa-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="wa-phone">WhatsApp Number</label>
                <input
                  id="wa-phone"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="+15551234567"
                />
              </div>
            </div>
            <button type="submit" className="button-primary" disabled={sending || !recipientPhone}>
              {sending ? "Sending…" : "Send WhatsApp Update"}
            </button>
            {sendResult && <p className="field-hint">{sendResult}</p>}
          </form>
        </>
      ) : (
        !error && (
          <p className="empty-state">
            No summary yet. Generate one from this site&apos;s recent daily reports.
          </p>
        )
      )}
    </div>
  );
}
