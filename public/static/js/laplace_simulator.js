// laplace_simulator.js
// Clean, Responsive Interactive Laplace Transform Lab
(function() {
    function initLaplaceSimulator() {
        const timeCanvas = document.getElementById('lp-time-canvas');
        const splaneCanvas = document.getElementById('lp-splane-canvas');
        if (!timeCanvas || !splaneCanvas) return;

        const tCtx = timeCanvas.getContext('2d');
        const sCtx = splaneCanvas.getContext('2d');

        // Cards & Selectors
        const timeCard = document.getElementById('lp-time-card');
        const splaneCard = document.getElementById('lp-splane-card');
        const signalSelect = document.getElementById('lp-signal-select');
        const presetButtons = document.querySelectorAll('.lp-preset-btn');
        const viewButtons = document.querySelectorAll('.lp-view-btn');

        // Playback & Reset
        const playBtn = document.getElementById('lp-play-btn');
        const playIcon = document.getElementById('lp-play-icon');
        const playText = document.getElementById('lp-play-text');
        const resetBtn = document.getElementById('lp-reset-btn');

        // Sliders & Containers
        const aSlider = document.getElementById('lp-a-slider');
        const omegaSlider = document.getElementById('lp-omega-slider');
        const tWidthSlider = document.getElementById('lp-twidth-slider');
        const omegaContainer = document.getElementById('lp-omega-container');
        const tWidthContainer = document.getElementById('lp-twidth-container');

        // Badges & Labels
        const aVal = document.getElementById('lp-a-val');
        const aStatusText = document.getElementById('lp-a-status-text');
        const omegaVal = document.getElementById('lp-omega-val');
        const omegaHzHint = document.getElementById('lp-omega-hz-hint');
        const tWidthVal = document.getElementById('lp-twidth-val');

        const signalBadge = document.getElementById('lp-signal-badge');
        const rocBadge = document.getElementById('lp-roc-badge');
        const timeCursor = document.getElementById('lp-time-cursor');
        const splaneCursor = document.getElementById('lp-splane-cursor');
        const timeEqInline = document.getElementById('lp-time-eq-inline');
        const splaneEqInline = document.getElementById('lp-splane-eq-inline');
        const envelopeLegend = document.getElementById('lp-envelope-legend');

        // Summary bar elements
        const summaryPoles = document.getElementById('lp-summary-poles');
        const summaryRoc = document.getElementById('lp-summary-roc');
        const summaryFourier = document.getElementById('lp-summary-fourier');
        const summaryDesc = document.getElementById('lp-summary-desc');

        // State
        let signalType = 'damped_cos';
        let a = 1.0;
        let omega = 3.5;
        let pulseT = 2.0;
        let amp = 1.0;
        let currentView = 'both';

        // Animation sweep state
        let isPlaying = false;
        let animTime = 0.0;
        let lastTimestamp = 0;
        let animRafId = null;

        // Hover & Interaction
        let hoveredTime = null;
        let isDraggingPole = false;
        let hoveredPoleIndex = -1;

        // Coordinate Bounds
        const tMin = 0.0;
        const tMax = 6.0;
        const sigmaMin = -3.5;
        const sigmaMax = 2.0;
        const omegaMin = -5.0;
        const omegaMax = 5.0;

        function isDarkTheme() {
            return document.documentElement.getAttribute('data-bs-theme') === 'dark';
        }

        // Evaluate f(t)
        function evaluateSignal(t) {
            if (t < 0) return 0.0;
            switch (signalType) {
                case 'exp_decay':
                    return amp * Math.exp(-a * t);
                case 'damped_cos':
                    return amp * Math.exp(-a * t) * Math.cos(omega * t);
                case 'damped_sin':
                    return amp * Math.exp(-a * t) * Math.sin(omega * t);
                case 'step':
                    return amp;
                case 'pulse':
                    return (t <= pulseT) ? amp : 0.0;
                case 'crit_damped':
                    return amp * t * Math.exp(-a * t) * (a > 0 ? a * Math.E : 1.0);
                case 'pure_cos':
                    return amp * Math.cos(omega * t);
                default:
                    return 0.0;
            }
        }

        // Evaluate envelope for damped sinusoid
        function evaluateEnvelope(t) {
            if (signalType === 'damped_cos' || signalType === 'damped_sin') {
                return amp * Math.exp(-a * t);
            }
            return null;
        }

        // Get Poles and Zeros list
        function getPolesAndZeros() {
            const poles = [];
            const zeros = [];

            switch (signalType) {
                case 'exp_decay':
                    poles.push({ sigma: -a, omega: 0, mult: 1 });
                    break;
                case 'damped_cos':
                    poles.push({ sigma: -a, omega: omega, mult: 1 });
                    if (omega !== 0) poles.push({ sigma: -a, omega: -omega, mult: 1 });
                    zeros.push({ sigma: -a, omega: 0, mult: 1 });
                    break;
                case 'damped_sin':
                    poles.push({ sigma: -a, omega: omega, mult: 1 });
                    if (omega !== 0) poles.push({ sigma: -a, omega: -omega, mult: 1 });
                    break;
                case 'step':
                    poles.push({ sigma: 0, omega: 0, mult: 1 });
                    break;
                case 'pulse':
                    zeros.push({ sigma: 0, omega: (2 * Math.PI) / pulseT, mult: 1 });
                    zeros.push({ sigma: 0, omega: -(2 * Math.PI) / pulseT, mult: 1 });
                    break;
                case 'crit_damped':
                    poles.push({ sigma: -a, omega: 0, mult: 2 });
                    break;
                case 'pure_cos':
                    poles.push({ sigma: 0, omega: omega, mult: 1 });
                    if (omega !== 0) poles.push({ sigma: 0, omega: -omega, mult: 1 });
                    zeros.push({ sigma: 0, omega: 0, mult: 1 });
                    break;
            }
            return { poles, zeros };
        }

        // Region of convergence boundary: Re(s) > sigma0
        function getRocBoundary() {
            if (signalType === 'pulse') return -Infinity;
            if (signalType === 'step' || signalType === 'pure_cos') return 0.0;
            return -a;
        }

        // Coordinate transforms
        function tToX(t, width) {
            const padL = 40;
            const padR = 20;
            return padL + ((t - tMin) / (tMax - tMin)) * (width - padL - padR);
        }
        function xToT(x, width) {
            const padL = 40;
            const padR = 20;
            return tMin + ((x - padL) / (width - padL - padR)) * (tMax - tMin);
        }
        function vToY(v, height, yMin, yMax) {
            const padT = 20;
            const padB = 25;
            return height - padB - ((v - yMin) / (yMax - yMin)) * (height - padT - padB);
        }

        function sigmaToX(s, width) {
            const pad = 35;
            return pad + ((s - sigmaMin) / (sigmaMax - sigmaMin)) * (width - 2 * pad);
        }
        function xToSigma(x, width) {
            const pad = 35;
            return sigmaMin + ((x - pad) / (width - 2 * pad)) * (sigmaMax - sigmaMin);
        }
        function omegaToY(w, height) {
            const pad = 22;
            return height - pad - ((w - omegaMin) / (omegaMax - omegaMin)) * (height - 2 * pad);
        }
        function yToOmega(y, height) {
            const pad = 22;
            return omegaMax - ((y - pad) / (height - 2 * pad)) * (omegaMax - omegaMin);
        }

        // Resize High-DPI Canvases
        function resizeCanvases() {
            const dpr = window.devicePixelRatio || 1;

            if (timeCard.style.display !== 'none') {
                const tRect = timeCanvas.getBoundingClientRect();
                timeCanvas.width = tRect.width * dpr;
                timeCanvas.height = tRect.height * dpr;
                if (tCtx.resetTransform) tCtx.resetTransform();
                else tCtx.setTransform(1, 0, 0, 1, 0, 0);
                tCtx.scale(dpr, dpr);
            }

            if (splaneCard.style.display !== 'none') {
                const sRect = splaneCanvas.getBoundingClientRect();
                splaneCanvas.width = sRect.width * dpr;
                splaneCanvas.height = sRect.height * dpr;
                if (sCtx.resetTransform) sCtx.resetTransform();
                else sCtx.setTransform(1, 0, 0, 1, 0, 0);
                sCtx.scale(dpr, dpr);
            }

            drawAll();
        }

        // Draw Time Domain Canvas
        function drawTimeDomain() {
            if (timeCard.style.display === 'none') return;

            const rect = timeCanvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const dark = isDarkTheme();

            tCtx.clearRect(0, 0, width, height);

            let yMin = -1.25;
            let yMax = 1.35;
            if (signalType === 'step' || signalType === 'pulse' || signalType === 'exp_decay') {
                yMin = -0.2;
                yMax = 1.3;
            } else if (signalType === 'crit_damped') {
                yMin = -0.2;
                yMax = 1.25;
            }

            // High-contrast clean colors
            const gridColor = dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
            const axisColor = dark ? '#cbd5e1' : '#334155';
            const textColor = dark ? '#f1f5f9' : '#1e293b'; // High contrast bold
            const zeroY = vToY(0, height, yMin, yMax);

            // 1. Grid
            tCtx.lineWidth = 1;
            tCtx.strokeStyle = gridColor;

            // Vertical time gridlines
            for (let t = 0; t <= tMax; t += 1.0) {
                const x = tToX(t, width);
                tCtx.beginPath();
                tCtx.moveTo(x, 15);
                tCtx.lineTo(x, height - 20);
                tCtx.stroke();
            }

            // Horizontal zero line
            tCtx.beginPath();
            tCtx.strokeStyle = axisColor;
            tCtx.lineWidth = 1.8;
            tCtx.moveTo(tToX(0, width), zeroY);
            tCtx.lineTo(tToX(tMax, width), zeroY);
            tCtx.stroke();

            // Vertical t=0 axis
            tCtx.beginPath();
            tCtx.moveTo(tToX(0, width), 15);
            tCtx.lineTo(tToX(0, width), height - 20);
            tCtx.stroke();

            // 2. High-contrast, large axis labels
            tCtx.fillStyle = textColor;
            tCtx.font = 'bold 12px system-ui, -apple-system, sans-serif';
            tCtx.textAlign = 'center';
            tCtx.textBaseline = 'top';

            for (let t = 0; t <= tMax; t += 1.0) {
                const x = tToX(t, width);
                tCtx.fillText(`${t}s`, x, height - 18);
            }

            // Y-axis tick values (clean 0 and 1)
            tCtx.textAlign = 'right';
            tCtx.textBaseline = 'middle';
            tCtx.fillText('0', tToX(0, width) - 6, zeroY);
            tCtx.fillText('1', tToX(0, width) - 6, vToY(1.0, height, yMin, yMax));
            if (yMin < -0.5) {
                tCtx.fillText('-1', tToX(0, width) - 6, vToY(-1.0, height, yMin, yMax));
            }

            // 3. Draw Envelope (if oscillatory)
            const env = evaluateEnvelope(1.0);
            if (env !== null && a > 0) {
                tCtx.setLineDash([5, 4]);
                tCtx.lineWidth = 1.8;
                tCtx.strokeStyle = '#ff7f0e';

                // + Envelope
                tCtx.beginPath();
                for (let px = tToX(0, width); px <= tToX(tMax, width); px += 2) {
                    const t = xToT(px, width);
                    const e = evaluateEnvelope(t);
                    const py = vToY(e, height, yMin, yMax);
                    if (px === tToX(0, width)) tCtx.moveTo(px, py);
                    else tCtx.lineTo(px, py);
                }
                tCtx.stroke();

                // - Envelope
                tCtx.beginPath();
                for (let px = tToX(0, width); px <= tToX(tMax, width); px += 2) {
                    const t = xToT(px, width);
                    const e = evaluateEnvelope(t);
                    const py = vToY(-e, height, yMin, yMax);
                    if (px === tToX(0, width)) tCtx.moveTo(px, py);
                    else tCtx.lineTo(px, py);
                }
                tCtx.stroke();
                tCtx.setLineDash([]);
            }

            // 4. Main Signal Curve f(t)
            tCtx.beginPath();
            tCtx.lineWidth = 3.0;
            tCtx.strokeStyle = '#0d6efd';
            tCtx.lineJoin = 'round';

            const startX = tToX(0, width);
            const endX = tToX(tMax, width);
            const stepPx = 1.5;

            tCtx.moveTo(startX, vToY(evaluateSignal(0.0001), height, yMin, yMax));
            for (let px = startX; px <= endX; px += stepPx) {
                const t = xToT(px, width);
                const val = evaluateSignal(t);
                const py = vToY(val, height, yMin, yMax);

                if (signalType === 'pulse' && Math.abs(t - pulseT) < (tMax / (endX - startX))) {
                    tCtx.lineTo(tToX(pulseT, width), vToY(amp, height, yMin, yMax));
                    tCtx.lineTo(tToX(pulseT, width), vToY(0, height, yMin, yMax));
                } else {
                    tCtx.lineTo(px, py);
                }
            }
            tCtx.stroke();

            // 5. Sweep or Hover Cursor
            const activeTime = isPlaying ? animTime : hoveredTime;
            if (activeTime !== null && activeTime >= 0 && activeTime <= tMax) {
                const curX = tToX(activeTime, width);
                const curVal = evaluateSignal(activeTime);
                const curY = vToY(curVal, height, yMin, yMax);

                tCtx.beginPath();
                tCtx.setLineDash([3, 3]);
                tCtx.strokeStyle = '#ff5f05';
                tCtx.lineWidth = 1.5;
                tCtx.moveTo(curX, 15);
                tCtx.lineTo(curX, height - 20);
                tCtx.stroke();
                tCtx.setLineDash([]);

                tCtx.beginPath();
                tCtx.arc(curX, curY, 6, 0, 2 * Math.PI);
                tCtx.fillStyle = '#ff5f05';
                tCtx.fill();
                tCtx.lineWidth = 2;
                tCtx.strokeStyle = '#ffffff';
                tCtx.stroke();
            }
        }

        // Draw Complex s-Plane Canvas
        function drawSPlane() {
            if (splaneCard.style.display === 'none') return;

            const rect = splaneCanvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const dark = isDarkTheme();

            sCtx.clearRect(0, 0, width, height);

            const gridColor = dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
            const axisColor = dark ? '#cbd5e1' : '#334155';
            const textColor = dark ? '#f1f5f9' : '#1e293b'; // High contrast bold
            const jwColor = '#ff5f05'; // Vibrant Fourier boundary
            const poleColor = '#dc3545';
            const zeroColor = '#0dcaf0';

            const originX = sigmaToX(0, width);
            const originY = omegaToY(0, height);

            // 1. Shaded Region of Convergence (ROC)
            const rocBoundary = getRocBoundary();
            if (rocBoundary === -Infinity) {
                sCtx.fillStyle = dark ? 'rgba(25, 135, 84, 0.16)' : 'rgba(25, 135, 84, 0.10)';
                sCtx.fillRect(0, 0, width, height);
            } else {
                const rocStartX = Math.max(0, sigmaToX(rocBoundary, width));
                const rocWidth = width - rocStartX;
                if (rocWidth > 0) {
                    sCtx.fillStyle = dark ? 'rgba(13, 202, 240, 0.16)' : 'rgba(13, 110, 253, 0.10)';
                    sCtx.fillRect(rocStartX, 0, rocWidth, height);

                    // Dashed ROC boundary line
                    sCtx.beginPath();
                    sCtx.setLineDash([5, 4]);
                    sCtx.lineWidth = 1.8;
                    sCtx.strokeStyle = dark ? '#38bdf8' : '#0d6efd';
                    sCtx.moveTo(rocStartX, 10);
                    sCtx.lineTo(rocStartX, height - 10);
                    sCtx.stroke();
                    sCtx.setLineDash([]);

                    // ROC boundary label
                    sCtx.fillStyle = dark ? '#38bdf8' : '#0d6efd';
                    sCtx.font = 'bold 11px system-ui, sans-serif';
                    sCtx.textAlign = 'left';
                    sCtx.textBaseline = 'top';
                    sCtx.fillText(`ROC: σ > ${rocBoundary.toFixed(2)}`, rocStartX + 6, 8);
                }
            }

            // 2. Grid lines
            sCtx.lineWidth = 1;
            sCtx.strokeStyle = gridColor;

            for (let s = -3; s <= 1; s++) {
                if (s === 0) continue;
                const x = sigmaToX(s, width);
                sCtx.beginPath();
                sCtx.moveTo(x, 10);
                sCtx.lineTo(x, height - 10);
                sCtx.stroke();
            }

            for (let w = -4; w <= 4; w += 2) {
                if (w === 0) continue;
                const y = omegaToY(w, height);
                sCtx.beginPath();
                sCtx.moveTo(10, y);
                sCtx.lineTo(width - 10, y);
                sCtx.stroke();
            }

            // 3. Real (sigma) Axis
            sCtx.beginPath();
            sCtx.strokeStyle = axisColor;
            sCtx.lineWidth = 1.8;
            sCtx.moveTo(10, originY);
            sCtx.lineTo(width - 10, originY);
            sCtx.stroke();

            // 4. Imaginary (jw) Axis - Fourier Axis (Prominent)
            sCtx.beginPath();
            sCtx.strokeStyle = jwColor;
            sCtx.lineWidth = 2.5;
            sCtx.moveTo(originX, 10);
            sCtx.lineTo(originX, height - 10);
            sCtx.stroke();

            // 5. Bold, High-Contrast Axis Numbers
            sCtx.fillStyle = textColor;
            sCtx.font = 'bold 12px system-ui, sans-serif';

            // Real axis ticks
            sCtx.textAlign = 'center';
            sCtx.textBaseline = 'top';
            for (let s = -3; s <= 1; s++) {
                if (s === 0) continue;
                const x = sigmaToX(s, width);
                sCtx.fillText(`${s}`, x, originY + 5);
            }

            // Imaginary axis ticks
            sCtx.textAlign = 'right';
            sCtx.textBaseline = 'middle';
            for (let w = -4; w <= 4; w += 2) {
                if (w === 0) continue;
                const y = omegaToY(w, height);
                sCtx.fillText(`${w > 0 ? '+' : ''}${w}j`, originX - 6, y);
            }

            // Axis Titles
            sCtx.fillStyle = textColor;
            sCtx.textAlign = 'right';
            sCtx.fillText('Real (σ)', width - 12, originY - 14);

            sCtx.fillStyle = jwColor;
            sCtx.textAlign = 'left';
            sCtx.fillText('jω (Fourier Line)', originX + 8, 16);

            // 6. Draw Zeros (o)
            const { poles, zeros } = getPolesAndZeros();
            zeros.forEach(z => {
                const zX = sigmaToX(z.sigma, width);
                const zY = omegaToY(z.omega, height);

                sCtx.beginPath();
                sCtx.arc(zX, zY, 7, 0, 2 * Math.PI);
                sCtx.fillStyle = 'rgba(13, 202, 240, 0.2)';
                sCtx.fill();
                sCtx.lineWidth = 2.5;
                sCtx.strokeStyle = zeroColor;
                sCtx.stroke();
            });

            // 7. Draw Poles (x) - Large and Bold
            poles.forEach((p, index) => {
                const pX = sigmaToX(p.sigma, width);
                const pY = omegaToY(p.omega, height);
                const isHovered = hoveredPoleIndex === index || isDraggingPole;

                // Subtle halo
                sCtx.beginPath();
                sCtx.arc(pX, pY, isHovered ? 15 : 12, 0, 2 * Math.PI);
                sCtx.fillStyle = isHovered ? 'rgba(220, 53, 69, 0.25)' : 'rgba(220, 53, 69, 0.12)';
                sCtx.fill();

                // Draw bold 'X'
                const arm = 8;
                sCtx.beginPath();
                sCtx.lineWidth = 3.5;
                sCtx.strokeStyle = poleColor;
                sCtx.lineCap = 'round';
                sCtx.moveTo(pX - arm, pY - arm);
                sCtx.lineTo(pX + arm, pY + arm);
                sCtx.moveTo(pX - arm, pY + arm);
                sCtx.lineTo(pX + arm, pY - arm);
                sCtx.stroke();
                sCtx.lineCap = 'butt';

                if (p.mult === 2) {
                    sCtx.fillStyle = poleColor;
                    sCtx.font = 'bold 12px system-ui, sans-serif';
                    sCtx.textAlign = 'left';
                    sCtx.textBaseline = 'bottom';
                    sCtx.fillText('(×2)', pX + 10, pY - 2);
                }
            });
        }

        function drawAll() {
            drawTimeDomain();
            drawSPlane();
        }

        // Update readouts, formulas, and single summary strip
        function updateDiagnostics() {
            aVal.textContent = a.toFixed(2);
            omegaVal.textContent = omega.toFixed(1) + ' rad/s';
            tWidthVal.textContent = pulseT.toFixed(1) + ' s';

            // Show/hide frequency or pulse width
            if (signalType === 'damped_cos' || signalType === 'damped_sin' || signalType === 'pure_cos') {
                omegaContainer.style.display = 'block';
                const hz = (omega / (2 * Math.PI)).toFixed(2);
                omegaHzHint.textContent = `f ≈ ${hz} Hz`;
            } else {
                omegaContainer.style.display = 'none';
            }

            if (signalType === 'pulse') {
                tWidthContainer.style.display = 'block';
            } else {
                tWidthContainer.style.display = 'none';
            }

            // Status label for a
            if (a > 0) {
                aStatusText.textContent = 'Stable Decay (ROC covers jω)';
                aStatusText.className = 'text-success fw-semibold';
            } else if (a === 0) {
                aStatusText.textContent = 'Marginal / Constant (Pole on jω)';
                aStatusText.className = 'text-warning fw-semibold text-dark';
            } else {
                aStatusText.textContent = 'Unstable Growth (Divergent)';
                aStatusText.className = 'text-danger fw-semibold';
            }

            // Envelope legend toggle
            if (signalType === 'damped_cos' || signalType === 'damped_sin') {
                envelopeLegend.style.display = 'inline';
            } else {
                envelopeLegend.style.display = 'none';
            }

            // Formulate compact text
            let signalName = '';
            let timeFormula = '';
            let splaneFormula = '';
            let rocDesc = '';
            let isFourier = false;

            const aSign = a >= 0 ? `-${a.toFixed(2)}t` : `+${Math.abs(a).toFixed(2)}t`;
            const sPlusA = a >= 0 ? `(s + ${a.toFixed(2)})` : `(s - ${Math.abs(a).toFixed(2)})`;
            const wSq = (omega * omega).toFixed(1);

            switch (signalType) {
                case 'damped_cos':
                    signalName = 'Damped Cosine';
                    timeFormula = `f(t) = e<sup>${aSign}</sup> cos(${omega.toFixed(1)}t)`;
                    splaneFormula = `F(s) = ${sPlusA} / [${sPlusA}² + ${wSq}]`;
                    rocDesc = `ROC: Re(s) > -${a.toFixed(2)}`;
                    isFourier = a > 0;
                    break;
                case 'exp_decay':
                    signalName = 'Exponential Decay';
                    timeFormula = `f(t) = e<sup>${aSign}</sup> u(t)`;
                    splaneFormula = `F(s) = 1 / (s + ${a.toFixed(2)})`;
                    rocDesc = `ROC: Re(s) > -${a.toFixed(2)}`;
                    isFourier = a > 0;
                    break;
                case 'damped_sin':
                    signalName = 'Damped Sine';
                    timeFormula = `f(t) = e<sup>${aSign}</sup> sin(${omega.toFixed(1)}t)`;
                    splaneFormula = `F(s) = ${omega.toFixed(1)} / [${sPlusA}² + ${wSq}]`;
                    rocDesc = `ROC: Re(s) > -${a.toFixed(2)}`;
                    isFourier = a > 0;
                    break;
                case 'step':
                    signalName = 'Unit Step u(t)';
                    timeFormula = `f(t) = u(t)`;
                    splaneFormula = `F(s) = 1 / s`;
                    rocDesc = `ROC: Re(s) > 0`;
                    isFourier = false;
                    break;
                case 'pulse':
                    signalName = 'Rectangular Pulse';
                    timeFormula = `f(t) = u(t) - u(t - ${pulseT.toFixed(1)})`;
                    splaneFormula = `F(s) = (1 - e<sup>-${pulseT.toFixed(1)}s</sup>) / s`;
                    rocDesc = `ROC: Entire s-plane`;
                    isFourier = true;
                    break;
                case 'crit_damped':
                    signalName = 'Critically Damped';
                    timeFormula = `f(t) = t · e<sup>${aSign}</sup>`;
                    splaneFormula = `F(s) = 1 / ${sPlusA}²`;
                    rocDesc = `ROC: Re(s) > -${a.toFixed(2)}`;
                    isFourier = a > 0;
                    break;
                case 'pure_cos':
                    signalName = 'Pure Oscillation';
                    timeFormula = `f(t) = cos(${omega.toFixed(1)}t)`;
                    splaneFormula = `F(s) = s / (s² + ${wSq})`;
                    rocDesc = `ROC: Re(s) > 0`;
                    isFourier = false;
                    break;
            }

            // Update Badges & Inlines
            signalBadge.textContent = signalName;
            rocBadge.textContent = rocDesc;
            timeEqInline.innerHTML = timeFormula;
            splaneEqInline.innerHTML = splaneFormula;

            // Update Single Summary Strip
            const { poles } = getPolesAndZeros();
            if (poles.length === 0) {
                summaryPoles.textContent = 'None (Removable at s = 0)';
            } else if (poles.length === 1) {
                summaryPoles.textContent = `s = ${poles[0].sigma.toFixed(2)} ${poles[0].mult === 2 ? '(Double)' : ''}`;
            } else {
                summaryPoles.textContent = `s = ${poles[0].sigma.toFixed(2)} ± ${Math.abs(poles[0].omega).toFixed(2)}j`;
            }

            summaryRoc.textContent = rocDesc.replace('ROC: ', '');

            if (isFourier) {
                summaryFourier.className = 'badge bg-success-subtle text-success border border-success';
                summaryFourier.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Fourier Transform Exists';
            } else if (signalType === 'step' || signalType === 'pure_cos') {
                summaryFourier.className = 'badge bg-warning-subtle text-dark border border-warning';
                summaryFourier.innerHTML = '<i class="bi bi-exclamation-circle-fill me-1"></i> Marginal (Pole on jω)';
            } else {
                summaryFourier.className = 'badge bg-danger-subtle text-danger border border-danger';
                summaryFourier.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i> Unstable / Divergent';
            }
        }

        // Apply a Preset
        function applyPreset(presetKey) {
            presetButtons.forEach(btn => btn.classList.remove('active'));

            switch (presetKey) {
                case 'damped_osc':
                    signalType = 'damped_cos';
                    a = 1.0;
                    omega = 3.5;
                    break;
                case 'exp_decay':
                    signalType = 'exp_decay';
                    a = 1.5;
                    omega = 0.0;
                    break;
                case 'step':
                    signalType = 'step';
                    a = 0.0;
                    omega = 0.0;
                    break;
                case 'pure_cos':
                    signalType = 'pure_cos';
                    a = 0.0;
                    omega = 3.0;
                    break;
            }

            signalSelect.value = signalType;
            aSlider.value = a;
            omegaSlider.value = omega;
            tWidthSlider.value = pulseT;

            const btn = document.querySelector(`.lp-preset-btn[data-preset="${presetKey}"]`);
            if (btn) btn.classList.add('active');

            updateDiagnostics();
            drawAll();
        }

        // View toggle handler
        viewButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                viewButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentView = this.dataset.view;

                if (currentView === 'both') {
                    timeCard.style.display = 'block';
                    splaneCard.style.display = 'block';
                } else if (currentView === 'time') {
                    timeCard.style.display = 'block';
                    splaneCard.style.display = 'none';
                } else if (currentView === 'splane') {
                    timeCard.style.display = 'none';
                    splaneCard.style.display = 'block';
                }
                resizeCanvases();
            });
        });

        // Animation loop
        function animate(timestamp) {
            if (!lastTimestamp) lastTimestamp = timestamp;
            const dt = (timestamp - lastTimestamp) / 1000;
            lastTimestamp = timestamp;

            animTime += dt * 1.8;
            if (animTime > tMax) animTime = 0.0;

            const curVal = evaluateSignal(animTime);
            timeCursor.textContent = `t = ${animTime.toFixed(2)} s | f(t) = ${curVal.toFixed(2)}`;
            drawTimeDomain();

            if (isPlaying) {
                animRafId = requestAnimationFrame(animate);
            }
        }

        function startAnimation() {
            isPlaying = true;
            playIcon.className = 'bi bi-pause-fill';
            playText.textContent = 'Pause';
            playBtn.classList.remove('btn-outline-success');
            playBtn.classList.add('btn-warning');
            lastTimestamp = 0;
            animRafId = requestAnimationFrame(animate);
        }

        function stopAnimation() {
            isPlaying = false;
            playIcon.className = 'bi bi-play-fill';
            playText.textContent = 'Play';
            playBtn.classList.remove('btn-warning');
            playBtn.classList.add('btn-outline-success');
            if (animRafId) cancelAnimationFrame(animRafId);
            drawTimeDomain();
        }

        playBtn.addEventListener('click', function() {
            if (isPlaying) stopAnimation();
            else startAnimation();
        });

        resetBtn.addEventListener('click', function() {
            stopAnimation();
            animTime = 0.0;
            applyPreset('damped_osc');
        });

        // Sliders
        aSlider.addEventListener('input', function() {
            a = parseFloat(this.value);
            presetButtons.forEach(btn => btn.classList.remove('active'));
            updateDiagnostics();
            drawAll();
        });

        omegaSlider.addEventListener('input', function() {
            omega = parseFloat(this.value);
            presetButtons.forEach(btn => btn.classList.remove('active'));
            updateDiagnostics();
            drawAll();
        });

        tWidthSlider.addEventListener('input', function() {
            pulseT = parseFloat(this.value);
            updateDiagnostics();
            drawAll();
        });

        signalSelect.addEventListener('change', function() {
            signalType = this.value;
            if (signalType === 'pure_cos' && omega === 0) omega = 3.0;
            if ((signalType === 'damped_cos' || signalType === 'damped_sin') && omega === 0) omega = 3.5;
            if (signalType === 'step') a = 0.0;

            aSlider.value = a;
            omegaSlider.value = omega;

            presetButtons.forEach(btn => btn.classList.remove('active'));
            updateDiagnostics();
            drawAll();
        });

        presetButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                applyPreset(this.dataset.preset);
            });
        });

        // Time Canvas Hover
        timeCanvas.addEventListener('pointermove', function(e) {
            const rect = timeCanvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const x = clientX - rect.left;
            const t = Math.max(tMin, Math.min(tMax, xToT(x, rect.width)));
            hoveredTime = t;

            const val = evaluateSignal(t);
            timeCursor.textContent = `t = ${t.toFixed(2)} s | f(t) = ${val.toFixed(2)}`;
            drawTimeDomain();
        });

        timeCanvas.addEventListener('pointerleave', function() {
            hoveredTime = null;
            timeCursor.textContent = `t = 0.00 s | f(t) = ${evaluateSignal(0).toFixed(2)}`;
            drawTimeDomain();
        });

        // s-Plane Pointer Dragging & Hover
        function getPoleHit(canvasX, canvasY, width, height) {
            const { poles } = getPolesAndZeros();
            const hitRadius = 22;

            for (let i = 0; i < poles.length; i++) {
                const p = poles[i];
                const px = sigmaToX(p.sigma, width);
                const py = omegaToY(p.omega, height);
                if (Math.hypot(canvasX - px, canvasY - py) <= hitRadius) {
                    return i;
                }
            }
            return -1;
        }

        splaneCanvas.addEventListener('pointerdown', function(e) {
            const rect = splaneCanvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
            const x = clientX - rect.left;
            const y = clientY - rect.top;

            const hitIndex = getPoleHit(x, y, rect.width, rect.height);
            if (hitIndex !== -1) {
                isDraggingPole = true;
                hoveredPoleIndex = hitIndex;
                splaneCanvas.setPointerCapture(e.pointerId);
                splaneCanvas.style.cursor = 'grabbing';
            }
        });

        splaneCanvas.addEventListener('pointermove', function(e) {
            const rect = splaneCanvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
            const x = clientX - rect.left;
            const y = clientY - rect.top;

            const curSigma = Math.max(sigmaMin, Math.min(sigmaMax, xToSigma(x, rect.width)));
            const curOmega = Math.max(omegaMin, Math.min(omegaMax, yToOmega(y, rect.height)));

            if (isDraggingPole) {
                // a = -sigma
                const newA = Math.max(-0.5, Math.min(3.0, -curSigma));
                a = Math.round(newA * 20) / 20;
                aSlider.value = a;

                if (signalType === 'damped_cos' || signalType === 'damped_sin' || signalType === 'pure_cos') {
                    const newOmega = Math.max(0.0, Math.min(7.0, Math.abs(curOmega)));
                    omega = Math.round(newOmega * 10) / 10;
                    omegaSlider.value = omega;
                }

                presetButtons.forEach(btn => btn.classList.remove('active'));
                updateDiagnostics();
                drawAll();
            } else {
                const hit = getPoleHit(x, y, rect.width, rect.height);
                hoveredPoleIndex = hit;
                splaneCanvas.style.cursor = (hit !== -1) ? 'grab' : 'crosshair';

                splaneCursor.textContent = `s = ${curSigma >= 0 ? '+' : ''}${curSigma.toFixed(2)} ${curOmega >= 0 ? '+' : ''}${curOmega.toFixed(2)}j`;
                drawSPlane();
            }
        });

        function endPoleDrag(e) {
            if (isDraggingPole) {
                isDraggingPole = false;
                try {
                    splaneCanvas.releasePointerCapture(e.pointerId);
                } catch(err) {}
                splaneCanvas.style.cursor = 'grab';
                drawAll();
            }
        }

        splaneCanvas.addEventListener('pointerup', endPoleDrag);
        splaneCanvas.addEventListener('pointercancel', endPoleDrag);

        splaneCanvas.addEventListener('pointerleave', function() {
            if (!isDraggingPole) {
                hoveredPoleIndex = -1;
                const { poles } = getPolesAndZeros();
                if (poles.length > 0) {
                    splaneCursor.textContent = `s = ${poles[0].sigma.toFixed(2)} ± ${Math.abs(poles[0].omega).toFixed(2)}j`;
                }
                drawSPlane();
            }
        });

        window.addEventListener('resize', resizeCanvases);

        const themeObserver = new MutationObserver(function() {
            drawAll();
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

        resizeCanvases();
        updateDiagnostics();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLaplaceSimulator);
    } else {
        initLaplaceSimulator();
    }
})();
