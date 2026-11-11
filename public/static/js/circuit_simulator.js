// circuit_simulator.js
// Clean, Spacious, and High-Contrast Interactive Circuit & Filter Simulator
(function() {
    function initCircuitSimulator() {
        const schemCanvas = document.getElementById('circuit-schem-canvas');
        const scopeCanvas = document.getElementById('circuit-scope-canvas');
        if (!schemCanvas || !scopeCanvas) return;

        const schemCtx = schemCanvas.getContext('2d');
        const scopeCtx = scopeCanvas.getContext('2d');

        // Controls
        const topologySelect = document.getElementById('circuit-topology-select');
        const vInSlider = document.getElementById('circuit-vin-slider');
        const vInVal = document.getElementById('circuit-vin-val');
        const freqSlider = document.getElementById('circuit-freq-slider');
        const freqVal = document.getElementById('circuit-freq-val');
        const rSlider = document.getElementById('circuit-r-slider');
        const rVal = document.getElementById('circuit-r-val');
        const cSlider = document.getElementById('circuit-c-slider');
        const cVal = document.getElementById('circuit-c-val');

        // Action buttons
        const playBtn = document.getElementById('circuit-play-btn');
        const playIcon = document.getElementById('circuit-play-icon');
        const playText = document.getElementById('circuit-play-text');
        const resetBtn = document.getElementById('circuit-reset-btn');
        const setFcBtn = document.getElementById('circuit-set-fc-btn');
        const speedBtn = document.getElementById('circuit-speed-btn');
        const speedText = document.getElementById('circuit-speed-text');

        // Status badges & readouts
        const modeBadge = document.getElementById('circuit-mode-badge');
        const stateBadge = document.getElementById('circuit-state-badge');
        const calcFc = document.getElementById('circuit-calc-fc');
        const calcXc = document.getElementById('circuit-calc-xc');
        const calcZ = document.getElementById('circuit-calc-z');
        const calcCurrent = document.getElementById('circuit-calc-current');
        const calcVout = document.getElementById('circuit-calc-vout');
        const calcGain = document.getElementById('circuit-calc-gain');
        const calcGainSub = document.getElementById('circuit-calc-gain-sub');
        const calcFormula = document.getElementById('circuit-calc-formula');
        const calcExplanation = document.getElementById('circuit-calc-explanation');

        // HUD bottom metrics
        const hudIpeak = document.getElementById('circuit-hud-ipeak');
        const hudIrms = document.getElementById('circuit-hud-irms');
        const hudVout = document.getElementById('circuit-hud-vout');
        const hudPhase = document.getElementById('circuit-hud-phase');

        // Canvas footers
        const schemFooterVin = document.getElementById('schem-footer-vin');
        const schemFooterCurrent = document.getElementById('schem-footer-current');
        const schemFooterVout = document.getElementById('schem-footer-vout');
        const scopeFooterFreq = document.getElementById('scope-footer-freq');
        const scopeFooterGain = document.getElementById('scope-footer-gain');
        const scopeFooterPhase = document.getElementById('scope-footer-phase');

        // Simulation parameters
        let topology = 'lowpass'; // 'lowpass', 'highpass', 'ohms', 'bandpass'
        let vIn = 5.0; // Peak Volts
        let freqHz = 1000; // Hz
        let resistance = 1000; // Ohms (1k)
        let capacitance = 1e-7; // Farads (0.1 uF = 100 nF)
        let isPlaying = true;
        let animRafId = null;
        let visualPhase = 0;
        let electronPhase = 0;
        let speedMultiplier = 1.0; // 1.0 = Normal, 0.35 = Slow, 0.0 = Frozen

        function isDarkTheme() {
            return document.documentElement.getAttribute('data-bs-theme') === 'dark';
        }

        // Format helpers
        function formatEngineering(val, unit) {
            if (val >= 1e6) return `${(val / 1e6).toFixed(2)} M${unit}`;
            if (val >= 1e3) return `${(val / 1e3).toFixed(2)} k${unit}`;
            if (val >= 1) return `${val.toFixed(2)} ${unit}`;
            if (val >= 1e-3) return `${(val * 1e3).toFixed(2)} m${unit}`;
            if (val >= 1e-6) return `${(val * 1e6).toFixed(2)} µ${unit}`;
            if (val >= 1e-9) return `${(val * 1e9).toFixed(2)} n${unit}`;
            if (val >= 1e-12) return `${(val * 1e12).toFixed(2)} p${unit}`;
            return `${val.toExponential(2)} ${unit}`;
        }

        // Physics Calculation Engine
        function calculateState() {
            const omega = 2 * Math.PI * freqHz;
            let fc = 0;
            let Xc = 0;
            let Z = 0;
            let gain = 1.0;
            let phaseRad = 0;
            let vOutPeak = 0;
            let iPeak = 0;
            let iRms = 0;

            if (topology === 'lowpass') {
                fc = 1 / (2 * Math.PI * resistance * capacitance);
                Xc = 1 / (omega * capacitance);
                Z = Math.sqrt(resistance * resistance + Xc * Xc);
                gain = Xc / Z;
                phaseRad = -Math.atan(omega * resistance * capacitance);
                vOutPeak = vIn * gain;
                iPeak = vIn / Z;
                iRms = iPeak / Math.SQRT2;
            } else if (topology === 'highpass') {
                fc = 1 / (2 * Math.PI * resistance * capacitance);
                Xc = 1 / (omega * capacitance);
                Z = Math.sqrt(resistance * resistance + Xc * Xc);
                gain = resistance / Z;
                phaseRad = Math.atan(Xc / resistance);
                vOutPeak = vIn * gain;
                iPeak = vIn / Z;
                iRms = iPeak / Math.SQRT2;
            } else if (topology === 'ohms') {
                Xc = 0;
                const r2 = resistance;
                const r1 = 1000;
                Z = r1 + r2;
                gain = r2 / Z;
                fc = 0;
                phaseRad = 0;
                vOutPeak = vIn * gain;
                iPeak = vIn / Z;
                iRms = iPeak / Math.SQRT2;
            } else if (topology === 'bandpass') {
                fc = 1 / (2 * Math.PI * resistance * capacitance);
                Xc = 1 / (omega * capacitance);
                const ratio = freqHz / fc;
                gain = ratio / Math.sqrt(1 + ratio * ratio * 9);
                if (gain > 1) gain = 1;
                Z = Math.sqrt(resistance * resistance + Xc * Xc);
                phaseRad = Math.atan((1 - ratio * ratio) / (3 * ratio));
                vOutPeak = vIn * gain;
                iPeak = vIn / Z;
                iRms = iPeak / Math.SQRT2;
            }

            const gainDb = 20 * Math.log10(Math.max(1e-4, gain));
            const phaseDeg = phaseRad * (180 / Math.PI);

            return {
                omega,
                fc,
                Xc,
                Z,
                gain,
                gainDb,
                phaseRad,
                phaseDeg,
                vOutPeak,
                iPeak,
                iRms
            };
        }

        // Clean Canvas Pill Badge helper
        function drawPillBadge(ctx, text, x, y, bg, border, textColor, fontSize, isBold) {
            ctx.save();
            ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px "SourceSansPro", system-ui, sans-serif`;
            const metrics = ctx.measureText(text);
            const padX = 7;
            const padY = 3;
            const w = metrics.width + padX * 2;
            const h = fontSize + padY * 2;
            const r = h / 2;

            ctx.fillStyle = bg;
            ctx.strokeStyle = border;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, y);
            ctx.restore();
        }

        // Responsive resize
        function resizeCanvases() {
            const dpr = window.devicePixelRatio || 1;
            [schemCanvas, scopeCanvas].forEach(c => {
                const rect = c.getBoundingClientRect();
                const w = Math.floor(rect.width);
                const h = Math.floor(rect.height);
                if (c.width !== w * dpr || c.height !== h * dpr) {
                    c.width = w * dpr;
                    c.height = h * dpr;
                }
            });
            const ctx1 = schemCanvas.getContext('2d');
            const ctx2 = scopeCanvas.getContext('2d');
            ctx1.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
            drawAll();
        }

        // Canvas 1: Schematic Diagram with moving charge carriers (Clean, uncrowded layout)
        function drawSchematic() {
            const w = schemCanvas.getBoundingClientRect().width;
            const h = schemCanvas.getBoundingClientRect().height;
            const dark = isDarkTheme();
            const state = calculateState();

            schemCtx.clearRect(0, 0, w, h);

            // Subtle background grid
            schemCtx.save();
            schemCtx.strokeStyle = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)';
            schemCtx.lineWidth = 1;
            for (let x = 0; x <= w; x += 25) {
                schemCtx.beginPath();
                schemCtx.moveTo(x, 0);
                schemCtx.lineTo(x, h);
                schemCtx.stroke();
            }
            for (let y = 0; y <= h; y += 25) {
                schemCtx.beginPath();
                schemCtx.moveTo(0, y);
                schemCtx.lineTo(w, y);
                schemCtx.stroke();
            }
            schemCtx.restore();

            // Responsive Layout Geometry
            const padX = Math.max(35, Math.min(55, w * 0.12));
            const leftX = padX;
            const rightX = w - padX;
            const nodeX = leftX + (rightX - leftX) * 0.62;
            const topY = 60;
            const botY = h - 65;
            const srcCenterY = (topY + botY) / 2;
            const compCenterX = (leftX + nodeX) / 2;
            const compHalfW = Math.min(30, (nodeX - leftX) * 0.26);
            const shuntCenterY = (topY + botY) / 2;
            const shuntHalfH = Math.min(24, (botY - topY) * 0.20);

            const wireColor = dark ? '#94a3b8' : '#334155';

            // 1. Draw AC Voltage Source on Left
            const srcRadius = Math.min(22, (botY - topY) * 0.16);
            schemCtx.save();
            schemCtx.fillStyle = dark ? '#1e293b' : '#ffffff';
            schemCtx.beginPath();
            schemCtx.arc(leftX, srcCenterY, srcRadius, 0, Math.PI * 2);
            schemCtx.fill();
            schemCtx.strokeStyle = '#0d6efd';
            schemCtx.lineWidth = 2.8;
            schemCtx.stroke();

            // AC Sine symbol inside source
            schemCtx.strokeStyle = '#0d6efd';
            schemCtx.lineWidth = 2.2;
            schemCtx.beginPath();
            schemCtx.moveTo(leftX - srcRadius * 0.55, srcCenterY);
            schemCtx.bezierCurveTo(leftX - srcRadius * 0.28, srcCenterY - srcRadius * 0.55, leftX, srcCenterY - srcRadius * 0.55, leftX, srcCenterY);
            schemCtx.bezierCurveTo(leftX, srcCenterY + srcRadius * 0.55, leftX + srcRadius * 0.28, srcCenterY + srcRadius * 0.55, leftX + srcRadius * 0.55, srcCenterY);
            schemCtx.stroke();
            schemCtx.restore();

            // Text Label placed cleanly BELOW AC source circle (never touches top wire or resistor)
            drawPillBadge(
                schemCtx,
                `Vin: ${vIn.toFixed(1)}V`,
                leftX,
                srcCenterY + srcRadius + 16,
                dark ? '#1e3a8a' : '#eff6ff',
                '#3b82f6',
                '#1d4ed8',
                10.5,
                true
            );

            // 2. Loop & Output Wires
            schemCtx.strokeStyle = wireColor;
            schemCtx.lineWidth = 2.8;
            schemCtx.lineCap = 'round';
            schemCtx.lineJoin = 'round';

            // Top wire
            schemCtx.beginPath();
            schemCtx.moveTo(leftX, srcCenterY - srcRadius);
            schemCtx.lineTo(leftX, topY);
            schemCtx.lineTo(compCenterX - compHalfW, topY);
            schemCtx.moveTo(compCenterX + compHalfW, topY);
            schemCtx.lineTo(nodeX, topY);
            schemCtx.lineTo(rightX, topY);
            schemCtx.stroke();

            // Bottom wire
            schemCtx.beginPath();
            schemCtx.moveTo(leftX, srcCenterY + srcRadius);
            schemCtx.lineTo(leftX, botY);
            schemCtx.lineTo(rightX, botY);
            schemCtx.stroke();

            // Vertical shunt wires
            schemCtx.beginPath();
            schemCtx.moveTo(nodeX, topY);
            schemCtx.lineTo(nodeX, shuntCenterY - shuntHalfH);
            schemCtx.moveTo(nodeX, shuntCenterY + shuntHalfH);
            schemCtx.lineTo(nodeX, botY);
            schemCtx.stroke();

            // 3. Series Component (Top wire)
            if (topology === 'lowpass' || topology === 'ohms' || topology === 'bandpass') {
                // Zigzag Resistor R
                schemCtx.save();
                schemCtx.strokeStyle = '#d97706';
                schemCtx.lineWidth = 2.8;
                schemCtx.beginPath();
                const x0 = compCenterX - compHalfW;
                const x1 = compCenterX + compHalfW;
                const segW = (x1 - x0) / 6;
                schemCtx.moveTo(x0, topY);
                schemCtx.lineTo(x0 + segW * 0.5, topY - 8);
                schemCtx.lineTo(x0 + segW * 1.5, topY + 8);
                schemCtx.lineTo(x0 + segW * 2.5, topY - 8);
                schemCtx.lineTo(x0 + segW * 3.5, topY + 8);
                schemCtx.lineTo(x0 + segW * 4.5, topY - 8);
                schemCtx.lineTo(x0 + segW * 5.5, topY + 8);
                schemCtx.lineTo(x1, topY);
                schemCtx.stroke();
                schemCtx.restore();

                // Clean Badge directly above resistor
                drawPillBadge(
                    schemCtx,
                    `R = ${formatEngineering(resistance, 'Ω')}`,
                    compCenterX,
                    topY - 18,
                    dark ? '#2a1a15' : '#fffbeb',
                    '#f59e0b',
                    '#b45309',
                    10.5,
                    true
                );
            } else {
                // Series Capacitor plates
                const plateGap = 7;
                const plateH = 24;
                schemCtx.save();
                schemCtx.strokeStyle = '#0284c7';
                schemCtx.lineWidth = 3.2;
                schemCtx.beginPath();
                schemCtx.moveTo(compCenterX - plateGap / 2, topY - plateH / 2);
                schemCtx.lineTo(compCenterX - plateGap / 2, topY + plateH / 2);
                schemCtx.moveTo(compCenterX + plateGap / 2, topY - plateH / 2);
                schemCtx.lineTo(compCenterX + plateGap / 2, topY + plateH / 2);
                schemCtx.stroke();
                schemCtx.restore();

                drawPillBadge(
                    schemCtx,
                    `C = ${formatEngineering(capacitance, 'F')}`,
                    compCenterX,
                    topY - 18,
                    dark ? '#0c2738' : '#f0f9ff',
                    '#0ea5e9',
                    '#0369a1',
                    10.5,
                    true
                );
            }

            // 4. Shunt Component (Vertical branch at nodeX)
            if (topology === 'lowpass' || topology === 'bandpass') {
                // Shunt Capacitor C (horizontal plates)
                const plateGap = 7;
                const plateW = 26;
                schemCtx.save();
                schemCtx.strokeStyle = '#0284c7';
                schemCtx.lineWidth = 3.2;
                schemCtx.beginPath();
                schemCtx.moveTo(nodeX - plateW / 2, shuntCenterY - plateGap / 2);
                schemCtx.lineTo(nodeX + plateW / 2, shuntCenterY - plateGap / 2);
                schemCtx.moveTo(nodeX - plateW / 2, shuntCenterY + plateGap / 2);
                schemCtx.lineTo(nodeX + plateW / 2, shuntCenterY + plateGap / 2);
                schemCtx.stroke();
                schemCtx.restore();

                // Clean Badge to the right of capacitor
                drawPillBadge(
                    schemCtx,
                    `C = ${formatEngineering(capacitance, 'F')}`,
                    Math.min(nodeX + 42, (nodeX + rightX) / 2),
                    shuntCenterY,
                    dark ? '#0c2738' : '#f0f9ff',
                    '#0ea5e9',
                    '#0369a1',
                    10.5,
                    true
                );
            } else {
                // Shunt Resistor R (vertical zigzag)
                schemCtx.save();
                schemCtx.strokeStyle = '#d97706';
                schemCtx.lineWidth = 2.8;
                schemCtx.beginPath();
                const y0 = shuntCenterY - shuntHalfH;
                const y1 = shuntCenterY + shuntHalfH;
                const segH = (y1 - y0) / 6;
                schemCtx.moveTo(nodeX, y0);
                schemCtx.lineTo(nodeX - 7, y0 + segH * 0.5);
                schemCtx.lineTo(nodeX + 7, y0 + segH * 1.5);
                schemCtx.lineTo(nodeX - 7, y0 + segH * 2.5);
                schemCtx.lineTo(nodeX + 7, y0 + segH * 3.5);
                schemCtx.lineTo(nodeX - 7, y0 + segH * 4.5);
                schemCtx.lineTo(nodeX + 7, y0 + segH * 5.5);
                schemCtx.lineTo(nodeX, y1);
                schemCtx.stroke();
                schemCtx.restore();

                drawPillBadge(
                    schemCtx,
                    `R = ${formatEngineering(resistance, 'Ω')}`,
                    Math.min(nodeX + 42, (nodeX + rightX) / 2),
                    shuntCenterY,
                    dark ? '#2a1a15' : '#fffbeb',
                    '#f59e0b',
                    '#b45309',
                    10.5,
                    true
                );
            }

            // 5. Output Terminals on the Right (Vout)
            schemCtx.save();
            schemCtx.fillStyle = dark ? '#1e293b' : '#ffffff';
            schemCtx.lineWidth = 2.2;
            schemCtx.strokeStyle = '#198754';
            schemCtx.beginPath();
            schemCtx.arc(rightX, topY, 4.0, 0, Math.PI * 2);
            schemCtx.fill();
            schemCtx.stroke();

            schemCtx.beginPath();
            schemCtx.arc(rightX, botY, 4.0, 0, Math.PI * 2);
            schemCtx.fill();
            schemCtx.stroke();

            // Vout dashed line with neat arrow
            schemCtx.strokeStyle = '#198754';
            schemCtx.lineWidth = 1.6;
            schemCtx.setLineDash([3, 2]);
            schemCtx.beginPath();
            schemCtx.moveTo(rightX + 12, topY + 6);
            schemCtx.lineTo(rightX + 12, botY - 6);
            schemCtx.stroke();

            schemCtx.fillStyle = '#198754';
            schemCtx.beginPath();
            schemCtx.moveTo(rightX + 12, topY + 4);
            schemCtx.lineTo(rightX + 8, topY + 11);
            schemCtx.lineTo(rightX + 16, topY + 11);
            schemCtx.closePath();
            schemCtx.fill();
            schemCtx.restore();

            // Vout Badge: Placed above rightX at topY - 18
            drawPillBadge(
                schemCtx,
                `Vout: ${state.vOutPeak.toFixed(2)}V`,
                rightX,
                topY - 18,
                dark ? '#064e3b' : '#f0fdf4',
                '#22c55e',
                '#15803d',
                10.5,
                true
            );

            // 6. Ground Symbol at bottom wire
            schemCtx.save();
            schemCtx.strokeStyle = wireColor;
            schemCtx.lineWidth = 2.2;
            schemCtx.beginPath();
            schemCtx.moveTo(nodeX, botY);
            schemCtx.lineTo(nodeX, botY + 12);
            schemCtx.moveTo(nodeX - 10, botY + 12);
            schemCtx.lineTo(nodeX + 10, botY + 12);
            schemCtx.moveTo(nodeX - 6, botY + 16);
            schemCtx.lineTo(nodeX + 6, botY + 16);
            schemCtx.moveTo(nodeX - 3, botY + 20);
            schemCtx.lineTo(nodeX + 3, botY + 20);
            schemCtx.stroke();
            schemCtx.restore();

            // 7. Animated Golden Electron Dots
            const wirePoints = [
                { x: leftX, y: srcCenterY - srcRadius },
                { x: leftX, y: topY },
                { x: nodeX, y: topY },
                { x: nodeX, y: botY },
                { x: leftX, y: botY },
                { x: leftX, y: srcCenterY + srcRadius }
            ];

            schemCtx.save();
            schemCtx.fillStyle = '#f59e0b';
            const numDots = 14;
            for (let i = 0; i < numDots; i++) {
                const progress = (i / numDots + (electronPhase % 1.0) + 1.0) % 1.0;
                const pt = getPointAlongPath(wirePoints, progress);
                if (pt) {
                    schemCtx.beginPath();
                    schemCtx.arc(pt.x, pt.y, 3.2, 0, Math.PI * 2);
                    schemCtx.fill();
                }
            }
            schemCtx.restore();

            // 8. Bottom Information Strip: Current arrow & reading
            schemCtx.save();
            schemCtx.font = 'bold 11.5px "SourceSansPro", system-ui, sans-serif';
            schemCtx.fillStyle = '#d97706';
            schemCtx.textAlign = 'center';
            const currentPhase = visualPhase - state.phaseRad;
            const instCurrentNorm = Math.sin(currentPhase);
            const iDirStr = instCurrentNorm >= 0 ? '→' : '←';
            schemCtx.fillText(`Current i(t): ${iDirStr}  Ipk = ${formatEngineering(state.iPeak, 'A')}`, w / 2, h - 14);
            schemCtx.restore();
        }

        // Helper: get coordinate along polyline path
        function getPointAlongPath(pts, t) {
            let totalLen = 0;
            const lens = [];
            for (let i = 0; i < pts.length - 1; i++) {
                const dx = pts[i + 1].x - pts[i].x;
                const dy = pts[i + 1].y - pts[i].y;
                const l = Math.sqrt(dx * dx + dy * dy);
                lens.push(l);
                totalLen += l;
            }
            let target = t * totalLen;
            for (let i = 0; i < lens.length; i++) {
                if (target <= lens[i]) {
                    const ratio = target / lens[i];
                    return {
                        x: pts[i].x + (pts[i + 1].x - pts[i].x) * ratio,
                        y: pts[i].y + (pts[i + 1].y - pts[i].y) * ratio
                    };
                }
                target -= lens[i];
            }
            return pts[pts.length - 1];
        }

        // Canvas 2: Live Dual-Trace Oscilloscope
        function drawOscilloscope() {
            const w = scopeCanvas.getBoundingClientRect().width;
            const h = scopeCanvas.getBoundingClientRect().height;
            const dark = isDarkTheme();
            const state = calculateState();

            scopeCtx.clearRect(0, 0, w, h);

            // Draw Scope Grid
            scopeCtx.save();
            scopeCtx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
            scopeCtx.lineWidth = 1;
            const cols = 8;
            const rows = 6;
            for (let i = 0; i <= cols; i++) {
                const x = (i / cols) * w;
                scopeCtx.beginPath();
                scopeCtx.moveTo(x, 0);
                scopeCtx.lineTo(x, h);
                scopeCtx.stroke();
            }
            for (let j = 0; j <= rows; j++) {
                const y = (j / rows) * h;
                scopeCtx.beginPath();
                scopeCtx.moveTo(0, y);
                scopeCtx.lineTo(w, y);
                scopeCtx.stroke();
            }

            // Zero line
            const zeroY = h / 2;
            scopeCtx.strokeStyle = dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)';
            scopeCtx.lineWidth = 1.4;
            scopeCtx.beginPath();
            scopeCtx.moveTo(0, zeroY);
            scopeCtx.lineTo(w, zeroY);
            scopeCtx.stroke();
            scopeCtx.restore();

            // Time window: show exactly 2 full cycles
            const numCycles = 2.0;
            const vScale = (h * 0.28) / Math.max(vIn, 1.0); // Leaves ample headroom above/below waveforms

            // Trace 1: Input Voltage Vin(t) (Blue)
            scopeCtx.save();
            scopeCtx.strokeStyle = '#0d6efd';
            scopeCtx.lineWidth = 2.8;
            scopeCtx.beginPath();
            for (let px = 0; px <= w; px += 2) {
                const phase = (px / w) * (2 * Math.PI * numCycles) - visualPhase;
                const val = vIn * Math.sin(phase);
                const py = zeroY - val * vScale;
                if (px === 0) scopeCtx.moveTo(px, py);
                else scopeCtx.lineTo(px, py);
            }
            scopeCtx.stroke();
            scopeCtx.restore();

            // Trace 2: Output Voltage Vout(t) (Green)
            scopeCtx.save();
            scopeCtx.strokeStyle = '#198754';
            scopeCtx.lineWidth = 2.8;
            scopeCtx.beginPath();
            for (let px = 0; px <= w; px += 2) {
                const phase = (px / w) * (2 * Math.PI * numCycles) - visualPhase;
                const val = state.vOutPeak * Math.sin(phase + state.phaseRad);
                const py = zeroY - val * vScale;
                if (px === 0) scopeCtx.moveTo(px, py);
                else scopeCtx.lineTo(px, py);
            }
            scopeCtx.stroke();
            scopeCtx.restore();

            // Trace 3: Current i(t) (Orange dashed, scaled for visual phase comparison)
            scopeCtx.save();
            scopeCtx.strokeStyle = '#f59e0b';
            scopeCtx.lineWidth = 2.0;
            scopeCtx.setLineDash([4, 4]);
            scopeCtx.beginPath();
            const iDisplayScale = (h * 0.22);
            for (let px = 0; px <= w; px += 2) {
                const phase = (px / w) * (2 * Math.PI * numCycles) - visualPhase;
                const normI = Math.sin(phase - state.phaseRad);
                const py = zeroY - normI * iDisplayScale;
                if (px === 0) scopeCtx.moveTo(px, py);
                else scopeCtx.lineTo(px, py);
            }
            scopeCtx.stroke();
            scopeCtx.restore();

            // Legend Badges on Scope Top (Compact & Cleanly Spaced)
            const badgeY = 18;
            drawPillBadge(scopeCtx, `Vin: ${vIn.toFixed(1)}V`, w * 0.20, badgeY, dark ? '#1e3a8a' : '#eff6ff', '#3b82f6', '#1d4ed8', 10, true);
            drawPillBadge(scopeCtx, `Vout: ${state.vOutPeak.toFixed(2)}V`, w * 0.50, badgeY, dark ? '#064e3b' : '#f0fdf4', '#22c55e', '#15803d', 10, true);
            drawPillBadge(scopeCtx, `Phase: ${state.phaseDeg.toFixed(1)}°`, w * 0.80, badgeY, dark ? '#451a03' : '#fffbeb', '#f59e0b', '#b45309', 10, true);
        }

        // Live Calculator & Diagnostic updates
        function updateTelemetry() {
            const state = calculateState();

            // Text labels
            vInVal.textContent = `${vIn.toFixed(1)} V`;
            freqVal.textContent = formatEngineering(freqHz, 'Hz');
            rVal.textContent = formatEngineering(resistance, 'Ω');
            cVal.textContent = formatEngineering(capacitance, 'F');

            // Metric Cards
            if (state.fc > 0) {
                calcFc.textContent = formatEngineering(state.fc, 'Hz');
            } else {
                calcFc.textContent = 'N/A (Resistive)';
            }
            calcXc.textContent = formatEngineering(state.Xc, 'Ω');
            calcZ.textContent = formatEngineering(state.Z, 'Ω');
            calcCurrent.textContent = `Total Current: ${formatEngineering(state.iRms, 'A')} RMS (${formatEngineering(state.iPeak, 'A')} pk)`;
            calcVout.textContent = `${state.vOutPeak.toFixed(2)} V`;
            calcGain.textContent = `${state.gainDb.toFixed(1)} dB`;
            if (calcGainSub) {
                calcGainSub.textContent = `${(state.gain * 100).toFixed(1)}% pass`;
            }

            // HUD Bottom (safely null-checked)
            if (hudIpeak) hudIpeak.textContent = formatEngineering(state.iPeak, 'A');
            if (hudIrms) hudIrms.textContent = formatEngineering(state.iRms, 'A');
            if (hudVout) hudVout.textContent = `${state.vOutPeak.toFixed(2)} V`;
            if (hudPhase) hudPhase.textContent = `${state.phaseDeg.toFixed(1)}°`;

            // Canvas Footers
            if (schemFooterVin) schemFooterVin.textContent = `${vIn.toFixed(1)}V`;
            if (schemFooterCurrent) schemFooterCurrent.textContent = `${formatEngineering(state.iPeak, 'A')}`;
            if (schemFooterVout) schemFooterVout.textContent = `${state.vOutPeak.toFixed(2)}V`;
            if (scopeFooterFreq) scopeFooterFreq.textContent = formatEngineering(freqHz, 'Hz');
            if (scopeFooterGain) scopeFooterGain.textContent = `${state.gainDb.toFixed(1)}dB`;
            if (scopeFooterPhase) scopeFooterPhase.textContent = `${state.phaseDeg.toFixed(0)}°`;

            // State & Mode Badges
            modeBadge.textContent = topology === 'lowpass' ? 'RC Low-Pass Filter' : (topology === 'highpass' ? 'RC High-Pass Filter' : (topology === 'ohms' ? "Resistive Divider (Ohm's Law)" : 'RC Band-Pass Filter'));

            const ratio = state.fc > 0 ? (freqHz / state.fc) : 1;
            if (topology === 'lowpass') {
                if (ratio < 0.5) {
                    stateBadge.className = 'badge bg-success text-white px-3 py-2 fs-6 fw-bold shadow-sm';
                    stateBadge.textContent = 'Passband (Minimal Attenuation)';
                    calcExplanation.textContent = `Signal frequency (${formatEngineering(freqHz, 'Hz')}) is well below cutoff fc (${formatEngineering(state.fc, 'Hz')}). Capacitor impedance Xc is high, allowing the signal to reach Vout with minimal loss.`;
                } else if (ratio <= 2.0) {
                    stateBadge.className = 'badge bg-warning text-dark px-3 py-2 fs-6 fw-bold shadow-sm';
                    stateBadge.textContent = 'Cutoff Knee (-3 dB Region)';
                    calcExplanation.textContent = `Operating near cutoff fc (${formatEngineering(state.fc, 'Hz')}). Resistance R equals reactance Xc, producing -3 dB (70.7%) attenuation and a -45° phase shift.`;
                } else {
                    stateBadge.className = 'badge bg-danger text-white px-3 py-2 fs-6 fw-bold shadow-sm';
                    stateBadge.textContent = 'Stopband (High Attenuation)';
                    calcExplanation.textContent = `High-frequency signal (${formatEngineering(freqHz, 'Hz')}) is rejected! Low capacitor reactance Xc shunts high-frequency current directly to ground.`;
                }
            } else if (topology === 'highpass') {
                if (ratio > 2.0) {
                    stateBadge.className = 'badge bg-success text-white px-3 py-2 fs-6 fw-bold shadow-sm';
                    stateBadge.textContent = 'Passband (Signal Transmitted)';
                    calcExplanation.textContent = `Signal frequency (${formatEngineering(freqHz, 'Hz')}) is high above fc. Capacitor behaves nearly like a short circuit, passing the signal through to load resistor R.`;
                } else if (ratio >= 0.5) {
                    stateBadge.className = 'badge bg-warning text-dark px-3 py-2 fs-6 fw-bold shadow-sm';
                    stateBadge.textContent = 'Cutoff Knee (-3 dB Region)';
                    calcExplanation.textContent = `Operating near cutoff fc (${formatEngineering(state.fc, 'Hz')}). Output is attenuated by -3 dB with a +45° phase lead.`;
                } else {
                    stateBadge.className = 'badge bg-danger text-white px-3 py-2 fs-6 fw-bold shadow-sm';
                    stateBadge.textContent = 'Stopband (Low Frequencies Blocked)';
                    calcExplanation.textContent = `Low frequency (${formatEngineering(freqHz, 'Hz')}) is blocked by high capacitor reactance Xc.`;
                }
            } else {
                stateBadge.className = 'badge bg-primary text-white px-3 py-2 fs-6 fw-bold shadow-sm';
                stateBadge.textContent = 'Linear Ohmic Voltage Division';
                calcExplanation.textContent = `Standard resistive divider: Total current I = Vin / (R1 + R2). Frequency-independent attenuation.`;
            }

            // Calculation formula step-by-step (Clean 2-line structure)
            if (topology === 'lowpass' || topology === 'highpass') {
                calcFormula.innerHTML = `<div><strong>Cutoff:</strong> <em>f</em><sub>c</sub> = 1 / (2&pi;RC) = <strong class="text-primary">${formatEngineering(state.fc, 'Hz')}</strong></div><div><strong>Total Current:</strong> <em>I</em><sub>RMS</sub> = <em>V</em><sub>in</sub> / |<em>Z</em>| = <strong class="text-success">${formatEngineering(state.iRms, 'A')}</strong> &nbsp;&bull;&nbsp; <em>I</em><sub>pk</sub> = <strong class="text-warning-emphasis">${formatEngineering(state.iPeak, 'A')}</strong></div>`;
            } else {
                calcFormula.innerHTML = `<div><strong>Divider Ratio:</strong> <em>V</em><sub>out</sub> / <em>V</em><sub>in</sub> = <strong class="text-success">${(state.gain * 100).toFixed(1)}%</strong></div><div><strong>Total Current:</strong> <em>I</em> = <em>V</em><sub>in</sub> / |<em>Z</em>| = <strong class="text-primary">${formatEngineering(state.iRms, 'A')}</strong></div>`;
            }
        }

        function drawAll() {
            drawSchematic();
            drawOscilloscope();
            updateTelemetry();
        }

        // Animation Loop
        let lastTime = performance.now();
        function loop(now) {
            if (!isPlaying) return;
            const dt = Math.min(0.05, (now - lastTime) / 1000);
            lastTime = now;

            // Advance visual oscilloscope phase at a smooth, readable pace
            const visualOmega = 1.0 * Math.PI * speedMultiplier; // ~0.5 Hz sweep rate
            visualPhase += dt * visualOmega;

            // Move electrons smoothly according to visual AC cycle
            const state = calculateState();
            const instCurrentNorm = Math.sin(visualPhase - state.phaseRad);
            electronPhase += instCurrentNorm * dt * 0.35 * speedMultiplier;

            drawAll();
            animRafId = requestAnimationFrame(loop);
        }

        function startSim() {
            if (isPlaying) return;
            isPlaying = true;
            lastTime = performance.now();
            playIcon.className = 'bi bi-pause-fill fs-6';
            playText.textContent = 'Pause';
            playBtn.classList.remove('btn-outline-success');
            playBtn.classList.add('btn-warning');
            animRafId = requestAnimationFrame(loop);
        }

        function stopSim() {
            isPlaying = false;
            playIcon.className = 'bi bi-play-fill fs-6';
            playText.textContent = 'Play';
            playBtn.classList.remove('btn-warning');
            playBtn.classList.add('btn-outline-success');
            if (animRafId) cancelAnimationFrame(animRafId);
            drawAll();
        }

        // Event listeners
        topologySelect.addEventListener('change', function() {
            topology = this.value;
            drawAll();
        });

        vInSlider.addEventListener('input', function() {
            vIn = parseFloat(this.value);
            drawAll();
        });

        freqSlider.addEventListener('input', function() {
            // Logarithmic mapping: slider 0..100 -> 10 Hz .. 100 kHz
            const val = parseFloat(this.value);
            freqHz = Math.round(10 * Math.pow(10, (val / 100) * 4));
            drawAll();
        });

        rSlider.addEventListener('input', function() {
            // Logarithmic mapping: slider 0..100 -> 100 Ohm .. 100 kOhm
            const val = parseFloat(this.value);
            resistance = Math.round(100 * Math.pow(10, (val / 100) * 3));
            drawAll();
        });

        cSlider.addEventListener('input', function() {
            // Logarithmic mapping: slider 0..100 -> 1 nF .. 10 uF
            const val = parseFloat(this.value);
            capacitance = 1e-9 * Math.pow(10, (val / 100) * 4);
            drawAll();
        });

        if (speedBtn && speedText) {
            speedBtn.addEventListener('click', () => {
                if (speedMultiplier === 1.0) {
                    speedMultiplier = 0.35;
                    speedText.textContent = 'Speed: Slow';
                    speedBtn.className = 'btn btn-outline-info btn-sm px-3 py-1 shadow-sm text-nowrap fw-semibold';
                } else if (speedMultiplier === 0.35) {
                    speedMultiplier = 0.0;
                    speedText.textContent = 'Speed: Frozen';
                    speedBtn.className = 'btn btn-outline-warning btn-sm px-3 py-1 shadow-sm text-nowrap fw-semibold';
                } else {
                    speedMultiplier = 1.0;
                    speedText.textContent = 'Speed: Normal';
                    speedBtn.className = 'btn btn-outline-secondary btn-sm px-3 py-1 shadow-sm text-nowrap fw-semibold';
                }
                drawAll();
            });
        }

        playBtn.addEventListener('click', () => {
            if (isPlaying) stopSim();
            else startSim();
        });

        resetBtn.addEventListener('click', () => {
            vIn = 5.0;
            vInSlider.value = 5.0;
            freqSlider.value = 50; // 1000 Hz
            freqHz = 1000;
            rSlider.value = 33.3; // 1000 Ohm
            resistance = 1000;
            cSlider.value = 50; // 0.1 uF
            capacitance = 1e-7;
            topologySelect.value = 'lowpass';
            topology = 'lowpass';
            visualPhase = 0;
            electronPhase = 0;
            speedMultiplier = 1.0;
            if (speedText) speedText.textContent = 'Speed: Normal';
            if (speedBtn) speedBtn.className = 'btn btn-outline-secondary btn-sm px-3 py-1 shadow-sm text-nowrap fw-semibold';
            drawAll();
        });

        setFcBtn.addEventListener('click', () => {
            const state = calculateState();
            if (state.fc > 0) {
                freqHz = Math.round(state.fc);
                const sliderVal = (Math.log10(freqHz / 10) / 4) * 100;
                freqSlider.value = Math.max(0, Math.min(100, sliderVal));
                drawAll();
            }
        });

        window.addEventListener('resize', resizeCanvases);

        const themeObserver = new MutationObserver(() => {
            drawAll();
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

        resizeCanvases();
        animRafId = requestAnimationFrame(loop);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCircuitSimulator);
    } else {
        initCircuitSimulator();
    }
})();
