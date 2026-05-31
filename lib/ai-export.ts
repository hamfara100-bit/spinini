/**
 * AI Export utilities — generate downloadable content from AI results.
 * Web: creates a Blob download link.
 * Native: falls back to sharing via Linking (expo-sharing not required).
 */

import { Platform, Alert } from "react-native";
import { AIResultFormat } from "./data/types";

// ─── Format helpers ───────────────────────────────────────────────────────────

export const FORMAT_META: Record<AIResultFormat, { label: string; emoji: string; ext: string; mime: string; color: string }> = {
  report:  { label: "Report",    emoji: "📋", ext: "txt",  mime: "text/plain",        color: "#6366F1" },
  csv:     { label: "Spreadsheet", emoji: "📊", ext: "csv",  mime: "text/csv",         color: "#10B981" },
  pdf:     { label: "PDF",       emoji: "📄", ext: "html", mime: "text/html",          color: "#EF4444" },
  form:    { label: "Form",      emoji: "📝", ext: "txt",  mime: "text/plain",         color: "#F59E0B" },
  note:    { label: "Note",      emoji: "🗒️", ext: "txt",  mime: "text/plain",         color: "#8B5CF6" },
};

// ─── Download (web) ───────────────────────────────────────────────────────────

function webDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Convert markdown to printable HTML ──────────────────────────────────────

function markdownToHtml(md: string, title: string): string {
  const body = md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6}
h1,h2,h3{color:#7C5CFF}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#7C5CFF;color:#fff}
tr:nth-child(even){background:#f9f9f9}</style></head>
<body><h1>${title}</h1><p>${body}</p></body></html>`;
}

// ─── Public download function ─────────────────────────────────────────────────

export function downloadResult(title: string, content: string, format: AIResultFormat) {
  const meta = FORMAT_META[format];
  const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = `famkids_${safeTitle}_${new Date().toISOString().slice(0, 10)}.${meta.ext}`;

  if (Platform.OS === "web") {
    if (format === "pdf") {
      const html = markdownToHtml(content, title);
      webDownload(filename, html, "text/html");
      // Also trigger print dialog for PDF
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(markdownToHtml(content, title));
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
      }
    } else {
      webDownload(filename, content, meta.mime);
    }
  } else {
    // Native — show content in an alert with copy hint
    Alert.alert(
      `Download: ${title}`,
      "Content is ready. Long-press the text below to copy it, then paste into your preferred app.",
      [{ text: "OK" }]
    );
  }
}

// ─── AI prompt builder for result generation ──────────────────────────────────

export function buildResultSystemPrompt(format: AIResultFormat, familyContext: string): string {
  const formatInstructions: Record<AIResultFormat, string> = {
    csv: `Output ONLY a valid CSV (comma-separated values). First row = column headers. No preamble, no explanation, no markdown fences. Just raw CSV data.`,
    pdf: `Output a well-structured markdown report with headers (##), bullet points, and tables where appropriate. Use clear sections.`,
    report: `Output a well-structured markdown report with headers (##), bullet points, and summary sections. Be thorough and organized.`,
    form: `Output the form as labeled fields, one per line, in this format:
Field Name: _______________
Use sections with ## headers. Include all relevant fields for the requested form type.`,
    note: `Output clean, organized notes in markdown format with bullet points and headers where useful.`,
  };

  return `You are Spinini AI content generator. Generate the requested content using the family data below.
${formatInstructions[format]}

Family data:
${familyContext}

Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;
}

// ─── Detect format from user request ─────────────────────────────────────────

export function detectFormat(text: string): AIResultFormat {
  const t = text.toLowerCase();
  if (/excel|csv|spreadsheet|sheet/.test(t)) return "csv";
  if (/pdf|print|printable|document/.test(t)) return "pdf";
  if (/form|template|fillable/.test(t)) return "form";
  if (/note|summary|quick/.test(t)) return "note";
  return "report";
}

// ─── Detect if a message is a "generate content" request ─────────────────────

export function isContentRequest(text: string): boolean {
  return /\b(create|generate|make|build|write|give me|show me|export|download|save)\b.*\b(report|chart|csv|excel|sheet|pdf|form|summary|list|plan|schedule|template)\b/i.test(text);
}
