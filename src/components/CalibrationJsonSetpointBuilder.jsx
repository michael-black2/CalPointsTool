import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Copy, RefreshCw, Link as LinkIcon } from "lucide-react";

// --- helpers ---
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function clampNumberOrEmpty(v, opts) {
  if (v === "" || v === "-" || v === ".") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return "";
  if (opts && opts.min != null && n < opts.min) return String(opts.min);
  if (opts && opts.max != null && n > opts.max) return String(opts.max);
  return String(n);
}

// ---- pure builder (used by UI + self-checks) ----
function buildPayload(systemId, groups) {
  const out = [];
  for (const g of groups) {
    const tVal = Number(g.temperature);
    if (!Number.isFinite(tVal)) continue;
    const setpoint = [{ system_id: systemId, parameter: "Temperature", nominal: tVal }];
    const humidityValues = (g.humidities || [])
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
  const [systemId, setSystemId] = useState("1");
  const [groups, setGroups] = useState([{ id: uid(), temperature: "", humidities: [] }]);
  const [compact, setCompact] = useState(true);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [testSummary, setTestSummary] = useState("");

  const outputRef = useRef(null);

  const parsedSystemId = useMemo(() => Number(systemId), [systemId]);

  const isFormValid = useMemo(() => {
    if (!Number.isFinite(parsedSystemId) || parsedSystemId <= 0) return false;
    for (const g of groups) {
      if (g.temperature === "") return false;
      const t = Number(g.temperature);
      if (!Number.isFinite(t)) return false;
      for (const h of g.humidities) {
        if (h.nominal === "") continue;
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
      return typeof raw === "string" ? raw : "[]";
    } catch {
      return "[]";
    }
  }, [payload, compact]);

  // --- Download link management (no programmatic clicks) ---
  const [downloadHref, setDownloadHref] = useState("");
  const [hrefType, setHrefType] = useState(null);

  useEffect(() => {
    let urlToRevoke = null;

    if (!isPayloadReady) {
      setDownloadHref("");
      setHrefType(null);
      return () => {};
    }

    try {
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      setDownloadHref(url);
      setHrefType("blob");
      urlToRevoke = url;
    } catch {
      try {
        const dataHref = "data:application/json;charset=utf-8," + encodeURIComponent(jsonString);
        setDownloadHref(dataHref);
        setHrefType("data");
      } catch {
        setDownloadHref("");
        setHrefType(null);
      }
    }

    return () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [jsonString, isPayloadReady]);

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
    } catch {}
    try {
      outputRef.current?.focus();
      outputRef.current?.select();
      setCopied(false);
      setErrorMsg("Clipboard blocked. Output selected—press Ctrl+C (Windows) or ⌘+C (Mac) to copy.");
    } catch {
      setErrorMsg("Copy failed. You can manually select the text and copy.");
    }
  }

  function loadSampleFromConversation() {
    setSystemId("1");
    setGroups([
      { id: uid(), temperature: "-95.0", humidities: [] },
      { id: uid(), temperature: "0.0", humidities: [] },
      { id: uid(), temperature: "140.0", humidities: [] },
      { id: uid(), temperature: "40.0", humidities: [{ id: uid(), nominal: "33.0" }, { id: uid(), nominal: "80.0" }] },
    ]);
  }

  function resetAll() {
    setSystemId("1");
    setGroups([{ id: uid(), temperature: "", humidities: [] }]);
    setErrorMsg("");
  }

  function runSelfChecks() {
    try {
      const t1 = buildPayload(1, [{ id: "a", temperature: "-95.0", humidities: [] }]);
      const ok1 = JSON.stringify(t1) === JSON.stringify([[{ system_id: 1, parameter: "Temperature", nominal: -95 }]]);

      const t2 = buildPayload(1, [{ id: "b", temperature: "40.0", humidities: [{ id: "h1", nominal: "33.0" }, { id: "h2", nominal: "80.0" }] }]);
      const ok2 = JSON.stringify(t2) === JSON.stringify([[{ system_id: 1, parameter: "Temperature", nominal: 40 }, { system_id: 1, parameter: "Humidity", nominal: 33 }, { system_id: 1, parameter: "Humidity", nominal: 80 }]]);

      const t3 = buildPayload(2, [{ id: "c", temperature: "40.0", humidities: [{ id: "h1", nominal: "" }] }]);
      const ok3 = JSON.stringify(t3) === JSON.stringify([[{ system_id: 2, parameter: "Temperature", nominal: 40 }]]);

      const t4 = buildPayload(3, [
        { id: "d1", temperature: "0.0", humidities: [] },
        { id: "d2", temperature: "40.0", humidities: [{ id: "h1", nominal: "33" }] },
      ]);
      const ok4 = JSON.stringify(t4) === JSON.stringify([
        [{ system_id: 3, parameter: "Temperature", nominal: 0 }],
        [{ system_id: 3, parameter: "Temperature", nominal: 40 }, { system_id: 3, parameter: "Humidity", nominal: 33 }],
      ]);

      const t5 = buildPayload(4, [{ id: "e", temperature: "25.0", humidities: [{ id: "x", nominal: "-5" }, { id: "y", nominal: "120" }, { id: "z", nominal: "50" }] }]);
      const ok5 = JSON.stringify(t5) === JSON.stringify([[{ system_id: 4, parameter: "Temperature", nominal: 25 }, { system_id: 4, parameter: "Humidity", nominal: 50 }]]);

      const t6 = buildPayload(5, [{ id: "f", temperature: "10", humidities: [{ id: "n", nominal: "abc" }, { id: "m", nominal: "75" }] }]);
      const ok6 = JSON.stringify(t6) === JSON.stringify([[{ system_id: 5, parameter: "Temperature", nominal: 10 }, { system_id: 5, parameter: "Humidity", nominal: 75 }]]);

      const results = [ok1, ok2, ok3, ok4, ok5, ok6];
      const passedCount = results.filter(Boolean).length;
      setTestSummary(passedCount === results.length ? `Self-checks passed (${passedCount}/${results.length}).` : `Self-checks failed (${passedCount}/${results.length}).`);
    } catch {
      setTestSummary("Self-checks crashed – see console for details.");
    }
  }

  useEffect(() => {
    runSelfChecks();
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
          onClick={() => setGroups((gs) => [...gs, { id: uid(), temperature: "20.0", humidities: [{ id: uid(), nominal: "60.0" }] }])}
        >
          <Plus className="mr-2 h-4 w-4" /> Quick add 20 °C / 60 %RH
        </Button>
        <Button
          variant="secondary"
          onClick={() => setGroups((gs) => [...gs, { id: uid(), temperature: "40.0", humidities: [{ id: uid(), nominal: "33.0" }] }])}
        >
          <Plus className="mr-2 h-4 w-4" /> Quick add 40 °C / 33 %RH
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
