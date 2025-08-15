import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Copy, RefreshCw, Link as LinkIcon } from "lucide-react";

/**
 * Calibration JSON Setpoint Builder
 *
 * Debug Fixes (sandbox-safe):
 * - Removed programmatic <a>.click() download (blocked in some sandboxes).
 * - Now we PRE-GENERATE a download HREF and render a visible <a download> link the user clicks.
 *   • Prefer Blob + object URL; fall back to data: URI if Blob/URL are unavailable.
 *   • Properly revoke object URLs on change/unmount.
 * - Clipboard copy: try navigator.clipboard; if blocked, focus & select the output
 *   textarea and prompt the user to press Ctrl/Cmd+C (no throw).
 * - Guard actions behind validity checks; surface friendly error messages.
 * - Added more self-checks (tests) without altering existing ones.
 */

// --- helpers ---
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function clampNumberOrEmpty(v: string, opts?: { min?: number; max?: number }) {
  if (v === "" || v === "-" || v === ".") return ""; // allow editing edge states
  const n = Number(v);
  if (Number.isNaN(n)) return "";
  if (opts?.min != null && n < opts.min) return String(opts.min);
  if (opts?.max != null && n > opts.max) return String(opts.max);
  return String(n);
}

// Types
interface THumidity { id: string; nominal: string; }
interface TGroup { id: string; temperature: string; humidities: THumidity[]; }

// ---- pure builder (used by UI + self-checks) ----
function buildPayload(systemId: number, groups: TGroup[]) {
  const out: Array<Array<{ system_id: number; parameter: "Temperature" | "Humidity"; nominal: number }>> = [];
  for (const g of groups) {
    const tVal = Number(g.temperature);
    if (!Number.isFinite(tVal)) continue; // skip invalid rows silently
    const setpoint: Array<{ system_id: number; parameter: "Temperature" | "Humidity"; nominal: number }> = [
      { system_id: systemId, parameter: "Temperature", nominal: tVal },
    ];
    const humidityValues = g.humidities
      .map((h) => h.nominal)
      .filter((v) => v !== "")
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
    for (const rh of humidityValues) {
      setpoint.push({ system_id: systemId, parameter: "Humidity", nominal: rh });
    }
    out.push(setpoint);
  }
  return out;
}

export default function CalibrationJsonSetpointBuilder() {
  const [systemId, setSystemId] = useState<string>("1");
  const [groups, setGroups] = useState<TGroup[]>([
    { id: uid(), temperature: "", humidities: [] },
  ]);
  const [compact, setCompact] = useState(true);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [testSummary, setTestSummary] = useState<string>("");

  const outputRef = useRef<HTMLTextAreaElement | null>(null);

  const parsedSystemId = useMemo(() => Number(systemId), [systemId]);

  const isFormValid = useMemo(() => {
    if (!Number.isFinite(parsedSystemId) || parsedSystemId <= 0) return false;
    for (const g of groups) {
      if (g.temperature === "") return false;
      const t = Number(g.temperature);
      if (!Number.isFinite(t)) return false;
      for (const h of g.humidities) {
        if (h.nominal === "") continue; // allow empty RH slots
        const rh = Number(h.nominal);
        if (!Number.isFinite(rh)) return false;
        if (rh < 0 || rh > 100) return false;
      }
    }
    return true;
  }, [groups, parsedSystemId]);

  const payload = useMemo(() => buildPayload(parsedSystemId, groups), [parsedSystemId, groups]);
  const isPayloadReady = useMemo(() => isFormValid && payload.length > 0, [isFormValid, payload]);

  const jsonString = useMemo(() => {
    try {
      const raw = compact ? JSON.stringify(payload) : JSON.stringify(payload, null, 2);
      return typeof raw === "string" ? raw : "[]"; // always return string
    } catch (e) {
      console.error("JSON stringify failed", e);
      return "[]";
    }
  }, [payload, compact]);

  // --- Download link management (no programmatic clicks) ---
  const [downloadHref, setDownloadHref] = useState<string>("");
  const [hrefType, setHrefType] = useState<"blob" | "data" | null>(null);

  useEffect(() => {
    let urlToRevoke: string | null = null;

    if (!isPayloadReady) {
      setDownloadHref("");
      setHrefType(null);
      return () => {};
    }

    // Try Blob → object URL first
    try {
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      setDownloadHref(url);
      setHrefType("blob");
      urlToRevoke = url;
    } catch (err) {
      console.warn("Blob/ObjectURL creation failed, using data: URI fallback", err);
      try {
        const dataHref = "data:application/json;charset=utf-8," + encodeURIComponent(jsonString);
        setDownloadHref(dataHref);
        setHrefType("data");
      } catch (err2) {
        console.error("Failed to prepare any download href", err2);
        setDownloadHref("");
        setHrefType(null);
      }
    }

    return () => {
      // Cleanup object URL if we created one
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke);
      }
    };
  }, [jsonString, isPayloadReady]);

  // --- copy ---
  async function handleCopy() {
    setErrorMsg("");
    if (!isPayloadReady) {
      setErrorMsg("Complete at least one valid setpoint before copying.");
      return;
    }
    const textToCopy = jsonString;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
        return;
      }
    } catch (e) {
      console.warn("navigator.clipboard.writeText failed; using select-all prompt", e);
    }

    // Fallback: focus + select the textarea; user presses Ctrl/Cmd+C
    try {
      outputRef.current?.focus();
      outputRef.current?.select();
      setCopied(false);
      setErrorMsg("Clipboard blocked. Output selected—press Ctrl+C (Windows) or ⌘+C (Mac) to copy.");
    } catch (e) {
      console.error("Selection fallback failed", e);
      setErrorMsg("Copy failed. You can manually select the text and copy.");
    }
  }

  function loadSampleFromConversation() {
    setSystemId("1");
    setGroups([
      { id: uid(), temperature: "-95.0", humidities: [] },
      { id: uid(), temperature: "0.0", humidities: [] },
      { id: uid(), temperature: "140.0", humidities: [] },
      {
        id: uid(),
        temperature: "40.0",
        humidities: [
          { id: uid(), nominal: "33.0" },
          { id: uid(), nominal: "80.0" },
        ],
      },
    ]);
  }

  function resetAll() {
    setSystemId("1");
    setGroups([{ id: uid(), temperature: "", humidities: [] }]);
    setErrorMsg("");
  }

  // ---- self-checks (tests) ----
  function runSelfChecks() {
    try {
      // Existing tests (unchanged)
      const t1Groups: TGroup[] = [ { id: "a", temperature: "-95.0", humidities: [] } ];
      const t1 = buildPayload(1, t1Groups);
      const expect1 = [[{ system_id: 1, parameter: "Temperature", nominal: -95 }]];
      const ok1 = JSON.stringify(t1) === JSON.stringify(expect1);

      const t2Groups: TGroup[] = [ { id: "b", temperature: "40.0", humidities: [ { id: "h1", nominal: "33.0" }, { id: "h2", nominal: "80.0" } ] } ];
      const t2 = buildPayload(1, t2Groups);
      const expect2 = [[
        { system_id: 1, parameter: "Temperature", nominal: 40 },
        { system_id: 1, parameter: "Humidity", nominal: 33 },
        { system_id: 1, parameter: "Humidity", nominal: 80 },
      ]];
      const ok2 = JSON.stringify(t2) === JSON.stringify(expect2);

      const t3Groups: TGroup[] = [ { id: "c", temperature: "40.0", humidities: [ { id: "h1", nominal: "" } ] } ]; // empty RH ignored
      const t3 = buildPayload(2, t3Groups);
      const expect3 = [[{ system_id: 2, parameter: "Temperature", nominal: 40 }]];
      const ok3 = JSON.stringify(t3) === JSON.stringify(expect3);

      // New tests (added)
      // t4: multiple groups, mixed temperature-only and with humidities
      const t4Groups: TGroup[] = [
        { id: "d1", temperature: "0.0", humidities: [] },
        { id: "d2", temperature: "40.0", humidities: [ { id: "h1", nominal: "33" } ] },
      ];
      const t4 = buildPayload(3, t4Groups);
      const expect4 = [
        [ { system_id: 3, parameter: "Temperature", nominal: 0 } ],
        [ { system_id: 3, parameter: "Temperature", nominal: 40 }, { system_id: 3, parameter: "Humidity", nominal: 33 } ],
      ];
      const ok4 = JSON.stringify(t4) === JSON.stringify(expect4);

      // t5: out-of-range humidities are dropped; valid stays
      const t5Groups: TGroup[] = [ { id: "e", temperature: "25.0", humidities: [ { id: "x", nominal: "-5" }, { id: "y", nominal: "120" }, { id: "z", nominal: "50" } ] } ];
      const t5 = buildPayload(4, t5Groups);
      const expect5 = [[
        { system_id: 4, parameter: "Temperature", nominal: 25 },
        { system_id: 4, parameter: "Humidity", nominal: 50 },
      ]];
      const ok5 = JSON.stringify(t5) === JSON.stringify(expect5);

      // t6: non-numeric humidity is ignored
      const t6Groups: TGroup[] = [ { id: "f", temperature: "10", humidities: [ { id: "n", nominal: "abc" }, { id: "m", nominal: "75" } ] } ];
      const t6 = buildPayload(5, t6Groups);
      const expect6 = [[
        { system_id: 5, parameter: "Temperature", nominal: 10 },
        { system_id: 5, parameter: "Humidity", nominal: 75 },
      ]];
      const ok6 = JSON.stringify(t6) === JSON.stringify(expect6);

      const results = [ok1, ok2, ok3, ok4, ok5, ok6];
      const passedCount = results.filter(Boolean).length;
      setTestSummary(passedCount === results.length ? `Self-checks passed (${passedCount}/${results.length}).` : `Self-checks failed (${passedCount}/${results.length}).`);
    } catch (e) {
      console.error(e);
      setTestSummary("Self-checks crashed – see console for details.");
    }
  }

  useEffect(() => {
    // Run once on mount so the user sees immediate status
    runSelfChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filename = `calibration_setpoints_system_${parsedSystemId}.json`;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Calibration JSON Setpoint Builder</h1>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Label htmlFor="compact">Compact JSON</Label>
            <Switch id="compact" checked={compact} onCheckedChange={setCompact} />
          </div>
          <Button variant="outline" onClick={loadSampleFromConversation}>
            <RefreshCw className="mr-2 h-4 w-4" /> Load sample
          </Button>
          <Button variant="ghost" onClick={resetAll}>
            Reset
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-md border border-red-400 bg-red-50 px-4 py-2 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Global Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="systemId">System ID</Label>
            <Input
              id="systemId"
              type="number"
              min={1}
              value={systemId}
              onChange={(e) => setSystemId(clampNumberOrEmpty(e.target.value, { min: 1 }))}
              placeholder="1"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {groups.map((g, gi) => (
          <Card key={g.id} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Setpoint Group #{gi + 1}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setGroups((gs) => gs.filter((row) => row.id !== g.id))} aria-label="Remove group">
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1 md:col-span-1">
                <Label>Temperature (°C)</Label>
                <Input
                  type="number"
                  value={g.temperature}
                  onChange={(e) => setGroups((gs) => gs.map((row) => row.id === g.id ? { ...row, temperature: clampNumberOrEmpty(e.target.value) } : row))}
                  placeholder="e.g., 40"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Humidity set(s) (%RH)</Label>
                  <Button variant="outline" size="sm" onClick={() => setGroups((gs) => gs.map((row) => row.id === g.id ? { ...row, humidities: [...row.humidities, { id: uid(), nominal: "" }] } : row))}>
                    <Plus className="mr-2 h-4 w-4" /> Add humidity
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {g.humidities.length === 0 && (
                    <p className="text-sm text-muted-foreground">No humidity values – this setpoint will be Temperature-only.</p>
                  )}
                  {g.humidities.map((h) => (
                    <div key={h.id} className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={h.nominal}
                        onChange={(e) => {
                          const v = clampNumberOrEmpty(e.target.value, { min: 0, max: 100 });
                          setGroups((gs) => gs.map((row) => row.id === g.id ? { ...row, humidities: row.humidities.map((hh) => hh.id === h.id ? { ...hh, nominal: v } : hh) } : row));
                        }}
                        placeholder="e.g., 33"
                      />
                      <Button variant="ghost" size="icon" onClick={() => setGroups((gs) => gs.map((row) => row.id === g.id ? { ...row, humidities: row.humidities.filter((hh) => hh.id !== h.id) } : row))} aria-label="Remove RH">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setGroups((gs) => [...gs, { id: uid(), temperature: "", humidities: [] }])}>
          <Plus className="mr-2 h-4 w-4" /> Add setpoint group
        </Button>
        <Button
          variant="secondary"
          onClick={() => setGroups((gs) => [...gs, { id: uid(), temperature: "40.0", humidities: [{ id: uid(), nominal: "33.0" }] }])}
        >
          <Plus className="mr-2 h-4 w-4" /> Quick add 40 °C / 33 %RH
        </Button>
        <Button
          variant="secondary"
          onClick={() => setGroups((gs) => [...gs, { id: uid(), temperature: "40.0", humidities: [{ id: uid(), nominal: "33.0" }, { id: uid(), nominal: "80.0" }] }])}
        >
          <Plus className="mr-2 h-4 w-4" /> Quick add 40 °C / 33 & 80 %RH
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Output JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            ref={outputRef}
            value={jsonString}
            readOnly
            className="font-mono text-sm h-52"
          />
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3 items-center">
          <Button onClick={handleCopy} disabled={!isPayloadReady}>
            <Copy className="mr-2 h-4 w-4" /> {copied ? "Copied!" : "Copy"}
          </Button>

          {/* Download link rendered as an actual <a> (no programmatic click) */}
          <a
            href={isPayloadReady && downloadHref ? downloadHref : undefined}
            download={filename}
            aria-disabled={!isPayloadReady || !downloadHref}
            className={`${(!isPayloadReady || !downloadHref) ? "pointer-events-none opacity-50" : ""} inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted`}
            title={isPayloadReady ? (hrefType === "blob" ? "Save JSON (blob)" : hrefType === "data" ? "Save JSON (data URI)" : "Save JSON") : "Please complete required fields"}
          >
            <LinkIcon className="mr-2 h-4 w-4" /> Download .json
          </a>

          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className={isPayloadReady ? "text-green-600" : "text-red-600"}>
              {isPayloadReady ? "Valid – ready to export" : "Please complete required fields"}
            </span>
          </div>
        </CardFooter>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Self-checks</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">{testSummary}</div>
          <Button variant="outline" onClick={runSelfChecks}>Run self-checks</Button>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        <p>
          Format: A list of setpoints. Each setpoint is an array: one Temperature object and
          zero or more Humidity objects. Keys: {`{system_id, parameter:"Temperature"|"Humidity", nominal:number}`}
        </p>
      </div>
    </div>
  );
}
