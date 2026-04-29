import React, { useState } from "react";
import { createPortal } from "react-dom";

// Watch size comparison tool. Two case dimensions (width × length in
// mm) → side-by-side preview, stat boxes, and a print-to-scale sheet
// you can put on your wrist to gauge the comparison watch.
//
// Print scoping note: the print sheet is rendered via a React Portal
// to document.body so a global @media print rule can hide everything
// outside it. The rule lives in public/index.html keyed off the
// `size-compare-print-sheet-portal` class. When `printActive` is
// false the portal isn't in the DOM at all — print from any other
// page on the site is unaffected.

const DPI = 96;
const MM_PER_IN = 25.4;
const mmToPx = mm => (mm / MM_PER_IN) * DPI;

// Project blue used as the "owned watch" highlight; matches the
// existing primary-CTA color used elsewhere (Track button etc.).
const REF_COLOR = "#185FA5";
const REF_FILL  = "rgba(24,95,165,0.10)";
const REF_FILL_PRINT = "rgba(24,95,165,0.06)";

function dimDiffText(a, b) {
  const d = a - b;
  const sign = d > 0 ? "+" : (d < 0 ? "−" : "");
  return sign + Math.abs(d).toFixed(1) + " mm";
}

function dimPctText(a, b, longerWord, shorterWord) {
  if (!b) return "";
  const pct = ((a - b) / b) * 100;
  const abs = Math.abs(pct).toFixed(1);
  if (pct > 0.05) return abs + "% " + longerWord;
  if (pct < -0.05) return abs + "% " + shorterWord;
  return "identical";
}

function PreviewSingle({ w, h, color, dashed, gMaxW, gMaxH, fillAttr }) {
  const vbW = 200, vbH = 280, padding = 36;
  const scale = Math.min((vbW - padding * 2) / (gMaxW || 1), (vbH - padding * 2) / (gMaxH || 1));
  const cx = vbW / 2, cy = vbH / 2;
  const pxW = w * scale, pxH = h * scale;
  const x = cx - pxW / 2, y = cy - pxH / 2;
  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <rect x={x} y={y} width={pxW} height={pxH} rx={4}
        fill={fillAttr} stroke={color} strokeWidth={1.5}
        strokeDasharray={dashed ? "6 4" : undefined} />
      <text x={cx} y={y - 8} textAnchor="middle" fontSize={10}
        fill={color} fontFamily="sans-serif">
        {w.toFixed(1)} × {h.toFixed(1)} mm
      </text>
    </svg>
  );
}

function PreviewOverlay({ refW, refH, cmpW, cmpH, gMaxW, gMaxH, refColor, cmpColor }) {
  const vbW = 200, vbH = 280, padding = 36;
  const scale = Math.min((vbW - padding * 2) / (gMaxW || 1), (vbH - padding * 2) / (gMaxH || 1));
  const cx = vbW / 2, cy = vbH / 2;
  const refPxW = refW * scale, refPxH = refH * scale;
  const cmpPxW = cmpW * scale, cmpPxH = cmpH * scale;
  const refX = cx - refPxW / 2, refY = cy - refPxH / 2;
  const cmpX = cx - cmpPxW / 2, cmpY = cy - cmpPxH / 2;
  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <rect x={cmpX} y={cmpY} width={cmpPxW} height={cmpPxH} rx={4}
        fill="none" stroke={cmpColor} strokeWidth={1.5} strokeDasharray="6 4" />
      <rect x={refX} y={refY} width={refPxW} height={refPxH} rx={4}
        fill={REF_FILL} stroke={refColor} strokeWidth={1.5} />
    </svg>
  );
}

function PrintSheet({ refW, refH, cmpW, cmpH, refName, cmpName }) {
  // Print stage sizing: 7.5in × 5.6in to fit comfortably within the
  // letter-page printable area after default margins. Both watches
  // are rendered at 1:1 scale via mmToPx so a 50mm reference watch
  // measures 50mm on the printed sheet.
  const stagePxW = 7.5 * DPI;
  const stagePxH = 5.6 * DPI;
  const panelPxW = stagePxW / 3;
  const refPxW = mmToPx(refW), refPxH = mmToPx(refH);
  const cmpPxW = mmToPx(cmpW), cmpPxH = mmToPx(cmpH);
  const refCx = panelPxW * 0.5, cmpCx = panelPxW * 1.5, ovCx = panelPxW * 2.5;
  const cy = stagePxH / 2;
  const refX = refCx - refPxW / 2, refY = cy - refPxH / 2;
  const cmpX = cmpCx - cmpPxW / 2, cmpY = cy - cmpPxH / 2;
  const ovRefX = ovCx - refPxW / 2, ovRefY = cy - refPxH / 2;
  const ovCmpX = ovCx - cmpPxW / 2, ovCmpY = cy - cmpPxH / 2;
  const headerY = 22;
  const dimY = stagePxH - 14;

  // Calibration ruler: 50mm with major / minor / sub ticks.
  const totalMm = 50;
  const rulerWidthPx = mmToPx(totalMm);
  const rulerHeightPx = 32;
  const ticks = [];
  for (let i = 0; i <= totalMm; i++) {
    const x = mmToPx(i);
    let tickH = 4;
    if (i % 5 === 0) tickH = 8;
    if (i % 10 === 0) tickH = 12;
    ticks.push(
      <line key={`t${i}`} x1={x} y1={0} x2={x} y2={tickH}
        stroke="#000" strokeWidth={0.5} />
    );
    if (i % 10 === 0) {
      ticks.push(
        <text key={`l${i}`} x={x} y={22} textAnchor="middle"
          fontSize={8} fontFamily="sans-serif" fill="#000">{i}</text>
      );
    }
  }

  return (
    <div className="size-compare-print-sheet-portal" style={{
      position: "absolute", left: 0, top: 0,
      width: "7.5in", padding: "0.5in",
      color: "#000", background: "#fff",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={{ textAlign: "center", marginBottom: "0.2in" }}>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
          Watch size comparison
        </div>
        <div style={{ fontSize: 12, color: "#444" }}>
          {refName} ({refW.toFixed(1)} × {refH.toFixed(1)} mm) vs {cmpName} ({cmpW.toFixed(1)} × {cmpH.toFixed(1)} mm)
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", margin: "0.1in 0" }}>
        <svg width={stagePxW} height={stagePxH} viewBox={`0 0 ${stagePxW} ${stagePxH}`}>
          <line x1={panelPxW} y1={40} x2={panelPxW} y2={stagePxH - 32}
            stroke="#ccc" strokeWidth={0.4} strokeDasharray="3 3" />
          <line x1={panelPxW * 2} y1={40} x2={panelPxW * 2} y2={stagePxH - 32}
            stroke="#ccc" strokeWidth={0.4} strokeDasharray="3 3" />
          <text x={refCx} y={headerY} textAnchor="middle" fontSize={11}
            fontWeight={500} fill="#000" fontFamily="sans-serif">
            {refName} (owned)
          </text>
          <text x={cmpCx} y={headerY} textAnchor="middle" fontSize={11}
            fontWeight={500} fill="#000" fontFamily="sans-serif">
            {cmpName}
          </text>
          <text x={ovCx} y={headerY} textAnchor="middle" fontSize={11}
            fontWeight={500} fill="#000" fontFamily="sans-serif">
            Overlay
          </text>
          <rect x={refX} y={refY} width={refPxW} height={refPxH} rx={6}
            fill={REF_FILL_PRINT} stroke="#000" strokeWidth={1} />
          <rect x={cmpX} y={cmpY} width={cmpPxW} height={cmpPxH} rx={6}
            fill="none" stroke="#555" strokeWidth={1.2} strokeDasharray="5 3" />
          <rect x={ovCmpX} y={ovCmpY} width={cmpPxW} height={cmpPxH} rx={6}
            fill="none" stroke="#555" strokeWidth={1.2} strokeDasharray="5 3" />
          <rect x={ovRefX} y={ovRefY} width={refPxW} height={refPxH} rx={6}
            fill={REF_FILL_PRINT} stroke="#000" strokeWidth={1} />
          <text x={refCx} y={dimY} textAnchor="middle" fontSize={10} fill="#333"
            fontFamily="sans-serif">
            {refW.toFixed(1)} × {refH.toFixed(1)} mm
          </text>
          <text x={cmpCx} y={dimY} textAnchor="middle" fontSize={10} fill="#333"
            fontFamily="sans-serif">
            {cmpW.toFixed(1)} × {cmpH.toFixed(1)} mm
          </text>
          <text x={ovCx} y={dimY} textAnchor="middle" fontSize={10} fill="#333"
            fontFamily="sans-serif">
            Both centered
          </text>
        </svg>
      </div>
      <div style={{ margin: "0.15in 0 0.1in" }}>
        <div style={{ fontSize: 10, color: "#444", textAlign: "center", marginBottom: 4 }}>
          Calibration ruler. Measure with a real ruler before cutting.
        </div>
        <svg width={rulerWidthPx} height={rulerHeightPx}
          viewBox={`0 0 ${rulerWidthPx} ${rulerHeightPx}`}
          style={{ display: "block", margin: "0 auto" }}>
          <line x1={0} y1={0} x2={rulerWidthPx} y2={0} stroke="#000" strokeWidth={0.5} />
          {ticks}
          <text x={rulerWidthPx / 2} y={32} textAnchor="middle"
            fontSize={8} fontFamily="sans-serif" fill="#444">
            millimeters
          </text>
        </svg>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4in",
        fontSize: 11, marginTop: "0.15in", pageBreakInside: "avoid",
      }}>
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 12 }}>Print settings</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li>Paper: US Letter (8.5 × 11 in)</li>
            <li>Scale: 100% / Actual size (no fit-to-page)</li>
            <li>Orientation: Portrait</li>
            <li>Margins: Default</li>
          </ul>
        </div>
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 12 }}>Verify and use</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li>Check the 50 mm ruler with a real ruler</li>
            <li>Solid outline is the watch you own</li>
            <li>Dashed grey outline is the comparison watch</li>
            <li>Cut around either to lay on your wrist</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function SizeCompare({ onBack }) {
  const [refName, setRefName] = useState("Tank Must");
  const [refW, setRefW]       = useState("25.5");
  const [refH, setRefH]       = useState("33.7");
  const [cmpName, setCmpName] = useState("Tank Cintrée");
  const [cmpW, setCmpW]       = useState("20.5");
  const [cmpH, setCmpH]       = useState("42.5");
  const [printActive, setPrintActive] = useState(false);

  const refWN = parseFloat(refW) || 0;
  const refHN = parseFloat(refH) || 0;
  const cmpWN = parseFloat(cmpW) || 0;
  const cmpHN = parseFloat(cmpH) || 0;
  const gMaxW = Math.max(refWN, cmpWN);
  const gMaxH = Math.max(refHN, cmpHN);

  const refArea = refWN * refHN;
  const cmpArea = cmpWN * cmpHN;
  const areaPct = refArea ? ((cmpArea - refArea) / refArea) * 100 : 0;
  const areaSign = areaPct > 0 ? "+" : (areaPct < 0 ? "−" : "");

  const handlePrint = () => {
    // Mount the portal, give the browser a tick to render it, then
    // trigger print. window.print() is synchronous: control returns
    // here once the user closes the print dialog. Unmount the portal
    // afterward so it doesn't linger in the DOM.
    setPrintActive(true);
    setTimeout(() => {
      try { window.print(); } finally { setPrintActive(false); }
    }, 60);
  };

  const sectionCard = {
    background: "var(--card-bg)",
    border: "0.5px solid var(--border)",
    borderRadius: 12,
    padding: "16px 20px",
  };
  const inp = {
    background: "var(--surface)", color: "var(--text1)",
    border: "0.5px solid var(--border)",
    borderRadius: 6, padding: "6px 10px",
    fontSize: 14, fontFamily: "inherit", outline: "none",
  };
  const labelStyle = {
    fontSize: 13, color: "var(--text2)",
    margin: "0 0 8px", fontWeight: 500,
  };
  const dimRow = {
    display: "flex", gap: 8, alignItems: "center", marginBottom: 6,
  };
  const dimLabel = {
    fontSize: 13, color: "var(--text2)", width: 70,
  };
  const stat = {
    background: "var(--card-bg)", border: "0.5px solid var(--border)",
    borderRadius: 8, padding: "14px 16px",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 4px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        {onBack && (
          <button onClick={onBack} style={{
            border: "none", background: "transparent",
            color: "var(--text2)", fontFamily: "inherit",
            fontSize: 13, cursor: "pointer", padding: "4px 0",
          }}>← References</button>
        )}
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: "var(--text1)" }}>
        Watch size comparison
      </h1>
      <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 20px" }}>
        Compare any two watches by case dimensions. Print to scale on US Letter to lay on your wrist.
      </p>

      <div style={{ ...sectionCard, marginBottom: 16 }}>
        <div style={{
          display: "grid", gap: 24,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}>
          <div>
            <p style={labelStyle}>Reference (owned)</p>
            <input type="text" value={refName}
              onChange={e => setRefName(e.target.value)}
              style={{ ...inp, width: "100%", marginBottom: 10 }} />
            <div style={dimRow}>
              <label style={dimLabel}>Width</label>
              <input type="number" step="0.1" value={refW}
                onChange={e => setRefW(e.target.value)}
                style={{ ...inp, width: 80 }} />
              <span style={{ fontSize: 13, color: "var(--text2)" }}>mm</span>
            </div>
            <div style={dimRow}>
              <label style={dimLabel}>Length</label>
              <input type="number" step="0.1" value={refH}
                onChange={e => setRefH(e.target.value)}
                style={{ ...inp, width: 80 }} />
              <span style={{ fontSize: 13, color: "var(--text2)" }}>mm</span>
            </div>
          </div>
          <div>
            <p style={labelStyle}>Comparison watch</p>
            <input type="text" value={cmpName}
              onChange={e => setCmpName(e.target.value)}
              style={{ ...inp, width: "100%", marginBottom: 10 }} />
            <div style={dimRow}>
              <label style={dimLabel}>Width</label>
              <input type="number" step="0.1" value={cmpW}
                onChange={e => setCmpW(e.target.value)}
                style={{ ...inp, width: 80 }} />
              <span style={{ fontSize: 13, color: "var(--text2)" }}>mm</span>
            </div>
            <div style={dimRow}>
              <label style={dimLabel}>Length</label>
              <input type="number" step="0.1" value={cmpH}
                onChange={e => setCmpH(e.target.value)}
                style={{ ...inp, width: 80 }} />
              <span style={{ fontSize: 13, color: "var(--text2)" }}>mm</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button onClick={handlePrint} style={{
            background: REF_COLOR, color: "#fff", border: "none",
            padding: "8px 16px", borderRadius: 8,
            fontSize: 13, fontFamily: "inherit", fontWeight: 500,
            cursor: "pointer", flex: 1, minWidth: 180,
          }}>Print to scale (Letter)</button>
        </div>
      </div>

      <div style={{
        display: "grid", gap: 12, marginBottom: 16,
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      }}>
        <div style={stat}>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 4px" }}>Width difference</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: "var(--text1)" }}>
            {dimDiffText(cmpWN, refWN)}
          </p>
          <p style={{ fontSize: 12, color: "var(--text3)", margin: "4px 0 0" }}>
            {dimPctText(cmpWN, refWN, "wider", "narrower")}
          </p>
        </div>
        <div style={stat}>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 4px" }}>Length difference</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: "var(--text1)" }}>
            {dimDiffText(cmpHN, refHN)}
          </p>
          <p style={{ fontSize: 12, color: "var(--text3)", margin: "4px 0 0" }}>
            {dimPctText(cmpHN, refHN, "longer", "shorter")}
          </p>
        </div>
        <div style={stat}>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 4px" }}>Footprint</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: "var(--text1)" }}>
            {areaSign}{Math.abs(areaPct).toFixed(1)}%
          </p>
          <p style={{ fontSize: 12, color: "var(--text3)", margin: "4px 0 0" }}>
            total surface area
          </p>
        </div>
      </div>

      <div style={{ ...sectionCard }}>
        <div style={{
          display: "grid", gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        }}>
          <div>
            <p style={{ fontSize: 12, color: "var(--text2)", margin: "0 0 6px",
                        textAlign: "center", fontWeight: 500 }}>{refName || "Owned"}</p>
            <PreviewSingle w={refWN} h={refHN} color={REF_COLOR} dashed={false}
              gMaxW={gMaxW} gMaxH={gMaxH} fillAttr={REF_FILL} />
          </div>
          <div>
            <p style={{ fontSize: 12, color: "var(--text2)", margin: "0 0 6px",
                        textAlign: "center", fontWeight: 500 }}>{cmpName || "Comparison"}</p>
            <PreviewSingle w={cmpWN} h={cmpHN} color="var(--text2)" dashed={true}
              gMaxW={gMaxW} gMaxH={gMaxH} fillAttr="none" />
          </div>
          <div>
            <p style={{ fontSize: 12, color: "var(--text2)", margin: "0 0 6px",
                        textAlign: "center", fontWeight: 500 }}>Overlay</p>
            <PreviewOverlay refW={refWN} refH={refHN} cmpW={cmpWN} cmpH={cmpHN}
              gMaxW={gMaxW} gMaxH={gMaxH}
              refColor={REF_COLOR} cmpColor="var(--text2)" />
          </div>
        </div>
      </div>

      <p style={{
        fontSize: 12, color: "var(--text3)",
        margin: "12px 0 0", textAlign: "center",
      }}>
        On-screen preview is illustrative only. For accurate scale, print on US Letter at 100% (no scaling) and verify the 50 mm ruler.
      </p>

      {printActive && createPortal(
        <PrintSheet refW={refWN} refH={refHN} cmpW={cmpWN} cmpH={cmpHN}
          refName={refName || "Owned"} cmpName={cmpName || "Comparison"} />,
        document.body
      )}
    </div>
  );
}
