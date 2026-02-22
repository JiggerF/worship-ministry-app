"use client";

import { useState, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ChordChart } from "@/lib/types/database";
import {
  ALL_KEYS,
  normalizeKey,
  semitonesBetween,
  parseChordSheet,
  type ParsedLine,
} from "@/lib/utils/transpose";

interface ChordSheetModalProps {
  /** All chord charts with file_urls for this song */
  charts: ChordChart[];
  songTitle: string;
  /** Called when the musician selects a target key — used for card-level feedback */
  onKeyChange?: (key: string) => void;
  /** The trigger element — wrapped in Dialog.Trigger */
  children: React.ReactNode;
}

export function ChordSheetModal({ charts, songTitle, onKeyChange, children }: ChordSheetModalProps) {
  const [open, setOpen] = useState(false);

  // Source: which chord chart document to fetch and display
  const [sourceChart, setSourceChart] = useState<ChordChart>(charts[0]);

  // Target: the key the musician wants to transpose to
  const [targetKey, setTargetKey] = useState(() => normalizeKey(charts[0].key));

  const [rawText, setRawText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const multipleCharts = charts.length > 1;

  // Fetch chord sheet text for the current sourceChart.
  // AbortController cancels in-flight requests on unmount or source change.
  useEffect(() => {
    if (!open || !sourceChart.file_url || rawText !== null) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/chord-sheet?url=${encodeURIComponent(sourceChart.file_url)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: { text?: string; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setRawText(data.text ?? '');
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, sourceChart.file_url, rawText]);

  // Switch source document — resets target key to the new source key and re-fetches
  const handleSourceChange = useCallback((chartId: string) => {
    const chart = charts.find((c) => c.id === chartId);
    if (!chart) return;
    setSourceChart(chart);
    setTargetKey(normalizeKey(chart.key));
    setRawText(null); // clears cache → useEffect re-fetches
  }, [charts]);

  const handleKeyChange = useCallback((key: string) => {
    setTargetKey(key);
    onKeyChange?.(key);
  }, [onKeyChange]);

  const semitones = semitonesBetween(normalizeKey(sourceChart.key), targetKey);
  const lines: ParsedLine[] = rawText
    ? parseChordSheet(rawText, semitones, targetKey)
    : [];

  // Shared HTML builder used by both Download and Print
  const buildHtml = useCallback((withAutoprint: boolean): string => {
    const title = `${songTitle} — Key of ${targetKey}`;
    const escapedTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const bodyLines = lines
      .map((line) => {
        if (line.type === 'empty') return '<div style="height:8px"></div>';
        const escaped = line.display
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        if (line.type === 'section') {
          return `<div style="font-weight:700;color:#374151;margin-top:16px">${escaped}</div>`;
        }
        if (line.type === 'chord') {
          return `<div style="color:#b45309;font-weight:600">${escaped}</div>`;
        }
        return `<div>${escaped}</div>`;
      })
      .join('\n');

    const autoPrintScript = withAutoprint
      ? `<script>window.onload = function(){ window.print(); }<\/script>`
      : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapedTitle}</title>
  <style>
    body { font-family: 'Courier New', Courier, monospace; font-size: 13px;
           line-height: 1.55; padding: 28px 36px; color: #111; }
    h1   { font-size: 15px; margin: 0 0 20px; }
    @media print { @page { margin: 18mm 20mm; } }
  </style>
</head>
<body>
  <h1>${escapedTitle}</h1>
  ${bodyLines}
  ${autoPrintScript}
</body>
</html>`;
  }, [lines, songTitle, targetKey]);

  // Download — saves a plain-text .txt file immediately; opens natively on iOS/Android
  const handleDownload = useCallback(() => {
    const title = `${songTitle} — Key of ${targetKey}`;
    const body = lines.map((line) => line.display).join('\n');
    const blob = new Blob([`${title}\n\n${body}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${songTitle} - Key of ${targetKey}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [lines, songTitle, targetKey]);

  // Print — opens a new tab and triggers the browser print dialog
  const handlePrint = useCallback(() => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildHtml(true));
    win.document.close();
  }, [buildHtml]);

  const sourceKey = normalizeKey(sourceChart.key);
  const semitoneLabel = (() => {
    if (semitones === 0) return null;
    const abs = Math.abs(semitones);
    const unit = abs === 1 ? 'semitone' : 'semitones';
    return semitones > 0 ? `up ${abs} ${unit}` : `down ${abs} ${unit}`;
  })();

  const handleRetry = useCallback(() => {
    setError(null);
    setRawText(null);
  }, []);

  // External link icon (reused in two places)
  const ExternalLinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />

        <Dialog.Content
          className="
            fixed z-50 flex flex-col bg-white
            inset-0
            sm:inset-auto sm:left-1/2 sm:top-1/2
            sm:-translate-x-1/2 sm:-translate-y-1/2
            sm:w-[680px] sm:max-h-[85vh]
            sm:rounded-xl sm:shadow-2xl
          "
        >
          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
            <div>
              <Dialog.Title className="text-base font-bold text-gray-900 leading-tight">
                {songTitle}
              </Dialog.Title>
              {/* Subtitle — "Original key: B↗" (single) or "Starting from: D↗" (multi) */}
              <p className="text-xs text-gray-400 mt-0.5">
                {multipleCharts ? 'Starting from:' : 'Original key:'}{' '}
                <a
                  href={sourceChart.file_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors inline-flex items-center gap-0.5"
                  title="Open source chord sheet"
                >
                  {sourceKey}
                  <ExternalLinkIcon />
                </a>
              </p>
            </div>
            <Dialog.Close className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-label="Close">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </Dialog.Close>
          </div>

          {/* ── Toolbar ── */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

              {/* Source selector — only shown when song has multiple chord docs */}
              {multipleCharts && (
                <div className="flex items-center gap-2">
                  <label htmlFor="source-select" className="text-xs font-medium text-gray-500 whitespace-nowrap">
                    Starting from
                  </label>
                  <select
                    id="source-select"
                    value={sourceChart.id}
                    onChange={(e) => handleSourceChange(e.target.value)}
                    className="px-2 py-1 text-sm font-semibold rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer"
                  >
                    {charts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.key}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target key selector */}
              <div className="flex items-center gap-2">
                <label htmlFor="key-select" className="text-xs font-medium text-gray-500 whitespace-nowrap">
                  Change key to
                </label>
                <select
                  id="key-select"
                  value={targetKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  className="px-2 py-1 text-sm font-semibold rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer"
                >
                  {ALL_KEYS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                {semitoneLabel && (
                  <span className="text-xs text-gray-400">{semitoneLabel}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Primary: Download — saves the file immediately to the device */}
              <button
                onClick={handleDownload}
                disabled={!rawText}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </button>

              {/* Secondary: Print — opens browser print dialog (for PDF via print) */}
              <button
                onClick={handlePrint}
                disabled={!rawText}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print
              </button>
            </div>
          </div>

          {/* ── Chord Sheet Content ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading && (
              <div className="flex items-center justify-center h-40 text-sm text-gray-400">
                Loading chord sheet…
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <p className="text-sm text-red-500 text-center px-4">
                  Could not load chord sheet. Check that the Google Doc is shared publicly.
                </p>
                <button
                  onClick={handleRetry}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && rawText !== null && (
              <div className="font-mono text-sm leading-relaxed">
                {lines.map((line, i) => {
                  if (line.type === 'empty') {
                    return <div key={i} className="h-3" />;
                  }
                  if (line.type === 'section') {
                    return (
                      <div key={i} className="font-bold text-gray-700 mt-4 mb-1">
                        {line.display}
                      </div>
                    );
                  }
                  if (line.type === 'chord') {
                    return (
                      <div key={i} className="text-amber-600 font-semibold whitespace-pre">
                        {line.display}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="text-gray-800 whitespace-pre">
                      {line.display}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
