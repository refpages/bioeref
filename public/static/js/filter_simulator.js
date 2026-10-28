// filter_simulator.js
// Simple, Intuitive Interactive Filter Lab Simulation Engine
(function() {
    function initFilterLab() {
        const timeCanvas = document.getElementById('flt-time-canvas');
        const freqCanvas = document.getElementById('flt-freq-canvas');
        if (!timeCanvas || !freqCanvas) return;

        const timeCtx = timeCanvas.getContext('2d');
        const freqCtx = freqCanvas.getContext('2d');

        // Toolbar elements
        const presetSelect = document.getElementById('flt-preset-select');
        const statusBadge = document.getElementById('flt-status-badge');
        const resetBtn = document.getElementById('flt-reset-btn');

        // Sliders & Order buttons
        const fcSlider = document.getElementById('flt-fc-slider');
        const fcVal = document.getElementById('flt-fc-val');
        const fcLabel = document.getElementById('flt-fc-label');
        const orderBadge = document.getElementById('flt-order-badge');
        const orderHint = document.getElementById('flt-order-hint');
        const orderButtons = document.querySelectorAll('.flt-order-btn');

        // Readouts
        const timeCursor = document.getElementById('flt-time-cursor');
        const freqCursor = document.getElementById('flt-freq-cursor');
        const noiseAtten = document.getElementById('flt-noise-atten');
        const guidanceText = document.getElementById('flt-guidance-text');

        // State
        let currentPreset = 'ecg_noise'; // 'ecg_noise', 'ecg_drift', 'notch_hum', 'sine_noise'
        let filterType = 'lowpass'; // 'lowpass', 'highpass', 'notch'
        let fc = 2.0; // Cutoff frequency (Hz)
        let order = 2; // 1, 2, or 4

        // Hover tracking
        let hoveredTime = null;
        let hoveredFreq = null;

        // Bounds
        const fMin = 0.0;
        const fMax = 8.0;
        const dbMin = -40.0;
        const dbMax = 4.0;
        const tMin = 0.0;
        const tMax = 6.0;

        function isDarkTheme() {
            return document.documentElement.getAttribute('data-bs-theme') === 'dark';
        }

        function resizeCanvases() {
            const dpr = window.devicePixelRatio || 1;
            [timeCanvas, freqCanvas].forEach(c => {
                const rect = c.getBoundingClientRect();
                c.width = rect.width * dpr;
                c.height = rect.height * dpr;
                const ctx = c.getContext('2d');
                if (ctx.resetTransform) ctx.resetTransform();
                else ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
            });
            drawAll();
        }

        // Mathematical Filter Response: |H(f)| & Phase
        function getFilterResponse(f) {
            if (f < 0.0001) f = 0.0001;
            let magLinear = 1.0;
            let phase = 0.0;

            if (filterType === 'lowpass') {
                const ratio = Math.pow(f / fc, 2 * order);
                magLinear = 1.0 / Math.sqrt(1.0 + ratio);
                phase = -order * Math.atan(f / fc);
            } else if (filterType === 'highpass') {
                const ratio = Math.pow(fc / f, 2 * order);
                magLinear = 1.0 / Math.sqrt(1.0 + ratio);
                phase = order * (Math.PI / 2.0 - Math.atan(f / fc));
            } else if (filterType === 'notch') {
                const f0 = fc;
                const bw = 1.0;
                const num = f * f - f0 * f0;
                const den = f * bw;
                const ratio = Math.pow(num / den, 2);
                magLinear = Math.sqrt(ratio / (1.0 + ratio));
                phase = Math.atan(den / (num + 0.0001));
            }

            magLinear = Math.max(0.005, magLinear);
            const db = 20.0 * Math.log10(magLinear);
            return { magLinear, db, phase };
        }

        // Signal Components: Array of { f, a, phase, color, isNoise, label }
        function getSignalComponents() {
            const list = [];
            if (currentPreset === 'ecg_noise') {
                // Desired ECG signal at 1.2 Hz (72 BPM)
                list.push({ f: 1.2, a: 2.0, phase: 0, color: '#0d6efd', isNoise: false, label: 'ECG (1.2 Hz)' });
                list.push({ f: 2.4, a: 1.1, phase: -0.4, color: '#0d6efd', isNoise: false, label: 'Harmonic (2.4 Hz)' });
                list.push({ f: 3.6, a: 1.6, phase: 0.7, color: '#0d6efd', isNoise: false, label: 'QRS (3.6 Hz)' });
                // Unwanted high-frequency noise at 5.5 Hz
                list.push({ f: 5.5, a: 1.3, phase: 0.3, color: '#dc3545', isNoise: true, label: 'Noise (5.5 Hz)' });
            } else if (currentPreset === 'ecg_drift') {
                // Desired ECG signal at 1.2 Hz
                list.push({ f: 1.2, a: 2.0, phase: 0, color: '#0d6efd', isNoise: false, label: 'ECG (1.2 Hz)' });
                list.push({ f: 2.4, a: 1.1, phase: -0.4, color: '#0d6efd', isNoise: false, label: 'Harmonic (2.4 Hz)' });
                // Unwanted slow baseline wander from breathing at 0.2 Hz
                list.push({ f: 0.2, a: 1.8, phase: 0, color: '#dc3545', isNoise: true, label: 'Drift (0.2 Hz)' });
            } else if (currentPreset === 'notch_hum') {
                // ECG signal + 5.0 Hz interference hum
                list.push({ f: 1.2, a: 2.0, phase: 0, color: '#0d6efd', isNoise: false, label: 'ECG (1.2 Hz)' });
                list.push({ f: 2.4, a: 1.2, phase: -0.4, color: '#0d6efd', isNoise: false, label: 'Harmonic (2.4 Hz)' });
                list.push({ f: 5.0, a: 1.5, phase: 0.5, color: '#dc3545', isNoise: true, label: 'Hum (5.0 Hz)' });
            } else if (currentPreset === 'sine_noise') {
                // 1.0 Hz clean sine + 5.5 Hz noise
                list.push({ f: 1.0, a: 2.5, phase: 0, color: '#0d6efd', isNoise: false, label: '1.0 Hz Sine' });
                list.push({ f: 5.5, a: 1.2, phase: 0.3, color: '#dc3545', isNoise: true, label: 'Noise (5.5 Hz)' });
            }
            return list;
        }

        function evaluateRawSignal(t, components) {
            let sum = 0.0;
            for (let i = 0; i < components.length; i++) {
                const c = components[i];
                sum += c.a * Math.sin(2.0 * Math.PI * c.f * t + c.phase);
            }
            return sum;
        }

        function evaluateFilteredSignal(t, components) {
            let sum = 0.0;
            for (let i = 0; i < components.length; i++) {
                const c = components[i];
                const resp = getFilterResponse(c.f);
                sum += c.a * resp.magLinear * Math.sin(2.0 * Math.PI * c.f * t + c.phase + resp.phase);
            }
            return sum;
        }

        function drawAll() {
            const components = getSignalComponents();
            drawTimePlot(components);
            drawFreqPlot(components);
            updateStatusAndHUD(components);
        }

        // ---------------- Time Domain Plot ----------------
        function drawTimePlot(components) {
            const rect = timeCanvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const dark = isDarkTheme();

            timeCtx.clearRect(0, 0, width, height);

            const padding = { left: 40, right: 15, top: 15, bottom: 22 };
            const plotW = width - padding.left - padding.right;
            const plotH = height - padding.top - padding.bottom;

            const yBound = 4.0;
            const yMin = -yBound;
            const yMax = yBound;

            function toX(t) {
                return padding.left + ((t - tMin) / (tMax - tMin)) * plotW;
            }
            function toY(y) {
                return padding.top + ((yMax - y) / (yMax - yMin)) * plotH;
            }

            // Background
            timeCtx.fillStyle = dark ? '#1e2124' : '#ffffff';
            timeCtx.fillRect(padding.left, padding.top, plotW, plotH);

            // Grid lines
            timeCtx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
            timeCtx.lineWidth = 1;
            timeCtx.fillStyle = dark ? '#adb5bd' : '#6c757d';
            timeCtx.font = '10px monospace';
            timeCtx.textAlign = 'center';
            timeCtx.textBaseline = 'top';

            for (let t = tMin; t <= tMax + 0.01; t += 1.0) {
                const x = toX(t);
                timeCtx.beginPath();
                timeCtx.moveTo(x, padding.top);
                timeCtx.lineTo(x, padding.top + plotH);
                timeCtx.stroke();
                timeCtx.fillText(`${t.toFixed(0)}s`, x, padding.top + plotH + 4);
            }

            // Y-ticks
            timeCtx.textAlign = 'right';
            timeCtx.textBaseline = 'middle';
            [-2, 0, 2].forEach(y => {
                const py = toY(y);
                timeCtx.beginPath();
                timeCtx.moveTo(padding.left, py);
                timeCtx.lineTo(padding.left + plotW, py);
                timeCtx.stroke();
                timeCtx.fillText(`${y > 0 ? '+' : ''}${y}V`, padding.left - 5, py);
            });

            // Zero line
            const yZero = toY(0);
            timeCtx.strokeStyle = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
            timeCtx.lineWidth = 1.5;
            timeCtx.beginPath();
            timeCtx.moveTo(padding.left, yZero);
            timeCtx.lineTo(padding.left + plotW, yZero);
            timeCtx.stroke();

            // 1. Raw Noisy Input x(t) (dashed gray)
            timeCtx.save();
            timeCtx.strokeStyle = dark ? 'rgba(255,255,255,0.38)' : 'rgba(108, 117, 125, 0.45)';
            timeCtx.lineWidth = 1.4;
            timeCtx.setLineDash([4, 3]);
            timeCtx.beginPath();

            const steps = 350;
            for (let i = 0; i <= steps; i++) {
                const t = tMin + (i / steps) * (tMax - tMin);
                const y = evaluateRawSignal(t, components);
                const px = toX(t);
                const py = toY(y);
                if (i === 0) timeCtx.moveTo(px, py);
                else timeCtx.lineTo(px, py);
            }
            timeCtx.stroke();
            timeCtx.restore();

            // 2. Clean Filtered Signal y(t) (Bold Illini Orange)
            timeCtx.save();
            timeCtx.strokeStyle = '#ff5f05';
            timeCtx.lineWidth = 2.4;
            timeCtx.lineJoin = 'round';
            timeCtx.beginPath();

            const fSteps = 450;
            for (let i = 0; i <= fSteps; i++) {
                const t = tMin + (i / fSteps) * (tMax - tMin);
                const y = evaluateFilteredSignal(t, components);
                const px = toX(t);
                const py = toY(y);
                if (i === 0) timeCtx.moveTo(px, py);
                else timeCtx.lineTo(px, py);
            }
            timeCtx.stroke();
            timeCtx.restore();

            // Hover indicator
            if (hoveredTime !== null && hoveredTime >= tMin && hoveredTime <= tMax) {
                const hx = toX(hoveredTime);
                const hy = toY(evaluateFilteredSignal(hoveredTime, components));

                timeCtx.save();
                timeCtx.strokeStyle = dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';
                timeCtx.lineWidth = 1;
                timeCtx.setLineDash([2, 2]);
                timeCtx.beginPath();
                timeCtx.moveTo(hx, padding.top);
                timeCtx.lineTo(hx, padding.top + plotH);
                timeCtx.stroke();

                timeCtx.fillStyle = '#13294B';
                timeCtx.beginPath();
                timeCtx.arc(hx, hy, 4.5, 0, 2 * Math.PI);
                timeCtx.fill();
                timeCtx.strokeStyle = '#ffffff';
                timeCtx.lineWidth = 1.5;
                timeCtx.stroke();
                timeCtx.restore();
            }

            // Border
            timeCtx.strokeStyle = dark ? '#495057' : '#ced4da';
            timeCtx.lineWidth = 1;
            timeCtx.strokeRect(padding.left, padding.top, plotW, plotH);
        }

        // ---------------- Frequency Response Plot ----------------
        function drawFreqPlot(components) {
            const rect = freqCanvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const dark = isDarkTheme();

            freqCtx.clearRect(0, 0, width, height);

            const padding = { left: 40, right: 15, top: 18, bottom: 22 };
            const plotW = width - padding.left - padding.right;
            const plotH = height - padding.top - padding.bottom;

            function toX(f) {
                return padding.left + ((f - fMin) / (fMax - fMin)) * plotW;
            }
            function toY(db) {
                return padding.top + ((dbMax - db) / (dbMax - dbMin)) * plotH;
            }

            // Background
            freqCtx.fillStyle = dark ? '#1e2124' : '#ffffff';
            freqCtx.fillRect(padding.left, padding.top, plotW, plotH);

            // Shaded Passband Region (Gain > -3 dB)
            freqCtx.save();
            freqCtx.fillStyle = dark ? 'rgba(25, 135, 84, 0.18)' : 'rgba(25, 135, 84, 0.10)';

            if (filterType === 'lowpass') {
                const xCutoff = toX(fc);
                freqCtx.fillRect(padding.left, padding.top, Math.max(0, xCutoff - padding.left), plotH);
            } else if (filterType === 'highpass') {
                const xCutoff = toX(fc);
                freqCtx.fillRect(xCutoff, padding.top, Math.max(0, padding.left + plotW - xCutoff), plotH);
            }
            freqCtx.restore();

            // Grid Lines & Ticks (Non-colliding)
            freqCtx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
            freqCtx.lineWidth = 1;
            freqCtx.fillStyle = dark ? '#adb5bd' : '#6c757d';
            freqCtx.font = '10px monospace';
            freqCtx.textAlign = 'center';
            freqCtx.textBaseline = 'top';

            for (let f = 0.0; f <= fMax + 0.01; f += 1.0) {
                const x = toX(f);
                freqCtx.beginPath();
                freqCtx.moveTo(x, padding.top);
                freqCtx.lineTo(x, padding.top + plotH);
                freqCtx.stroke();
                freqCtx.fillText(`${f.toFixed(0)}Hz`, x, padding.top + plotH + 4);
            }

            // Y-ticks (dB scale)
            freqCtx.textAlign = 'right';
            freqCtx.textBaseline = 'middle';
            [0, -10, -20, -30].forEach(db => {
                const py = toY(db);
                freqCtx.beginPath();
                freqCtx.moveTo(padding.left, py);
                freqCtx.lineTo(padding.left + plotW, py);
                freqCtx.stroke();
                freqCtx.fillText(`${db}dB`, padding.left - 5, py);
            });

            // Dashed -3 dB Line
            const y3db = toY(-3.01);
            freqCtx.save();
            freqCtx.strokeStyle = '#dc3545';
            freqCtx.lineWidth = 1.4;
            freqCtx.setLineDash([4, 3]);
            freqCtx.beginPath();
            freqCtx.moveTo(padding.left, y3db);
            freqCtx.lineTo(padding.left + plotW, y3db);
            freqCtx.stroke();

            freqCtx.fillStyle = '#dc3545';
            freqCtx.font = 'bold 9px monospace';
            freqCtx.textAlign = 'right';
            freqCtx.fillText('-3dB', padding.left + plotW - 4, y3db - 5);
            freqCtx.restore();

            // Vertical Cutoff Marker Line
            const xCutoff = toX(fc);
            freqCtx.save();
            freqCtx.strokeStyle = 'rgba(220, 53, 69, 0.4)';
            freqCtx.lineWidth = 1.2;
            freqCtx.setLineDash([3, 3]);
            freqCtx.beginPath();
            freqCtx.moveTo(xCutoff, padding.top);
            freqCtx.lineTo(xCutoff, padding.top + plotH);
            freqCtx.stroke();
            freqCtx.restore();

            // Draw Bode Curve |H(f)|
            freqCtx.save();
            freqCtx.strokeStyle = '#0d6efd';
            freqCtx.lineWidth = 2.4;
            freqCtx.beginPath();

            const cSteps = 250;
            for (let i = 0; i <= cSteps; i++) {
                const f = fMin + (i / cSteps) * (fMax - fMin);
                const resp = getFilterResponse(f);
                const px = toX(f);
                const py = toY(resp.db);
                if (i === 0) freqCtx.moveTo(px, py);
                else freqCtx.lineTo(px, py);
            }
            freqCtx.stroke();
            freqCtx.restore();

            // Cutoff Marker Dot at (fc, -3 dB)
            const cutoffResp = getFilterResponse(fc);
            freqCtx.save();
            freqCtx.fillStyle = '#dc3545';
            freqCtx.beginPath();
            freqCtx.arc(xCutoff, toY(cutoffResp.db), 4.5, 0, 2 * Math.PI);
            freqCtx.fill();
            freqCtx.strokeStyle = '#ffffff';
            freqCtx.lineWidth = 1.5;
            freqCtx.stroke();
            freqCtx.restore();

            // Component Frequency Markers (ECG vs Noise)
            components.forEach(comp => {
                const compX = toX(comp.f);
                const resp = getFilterResponse(comp.f);
                const compY = toY(resp.db);

                freqCtx.save();
                freqCtx.fillStyle = comp.color;
                freqCtx.beginPath();
                freqCtx.arc(compX, compY, 4, 0, 2 * Math.PI);
                freqCtx.fill();
                freqCtx.strokeStyle = '#ffffff';
                freqCtx.lineWidth = 1.2;
                freqCtx.stroke();

                freqCtx.fillStyle = dark ? '#adb5bd' : '#495057';
                freqCtx.font = 'bold 9px monospace';
                freqCtx.textAlign = 'center';
                freqCtx.fillText(`${comp.f.toFixed(1)}Hz`, compX, compY - 6);
                freqCtx.restore();
            });

            // Hover indicator
            if (hoveredFreq !== null && hoveredFreq >= fMin && hoveredFreq <= fMax) {
                const hx = toX(hoveredFreq);
                const resp = getFilterResponse(hoveredFreq);
                const hy = toY(resp.db);

                freqCtx.save();
                freqCtx.strokeStyle = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)';
                freqCtx.lineWidth = 1;
                freqCtx.setLineDash([2, 2]);
                freqCtx.beginPath();
                freqCtx.moveTo(hx, padding.top);
                freqCtx.lineTo(hx, padding.top + plotH);
                freqCtx.stroke();

                freqCtx.fillStyle = '#ff5f05';
                freqCtx.beginPath();
                freqCtx.arc(hx, hy, 4.5, 0, 2 * Math.PI);
                freqCtx.fill();
                freqCtx.strokeStyle = '#ffffff';
                freqCtx.lineWidth = 1.5;
                freqCtx.stroke();
                freqCtx.restore();
            }

            // Border
            freqCtx.strokeStyle = dark ? '#495057' : '#ced4da';
            freqCtx.lineWidth = 1;
            freqCtx.strokeRect(padding.left, padding.top, plotW, plotH);
        }

        // ---------------- Status Badge & Guidance HUD ----------------
        function updateStatusAndHUD(components) {
            let noiseComp = null;
            for (let i = 0; i < components.length; i++) {
                if (components[i].isNoise) {
                    noiseComp = components[i];
                    break;
                }
            }

            if (noiseComp) {
                const resp = getFilterResponse(noiseComp.f);
                const percentRemoved = Math.max(0, Math.min(99, Math.round((1.0 - resp.magLinear) * 100)));
                noiseAtten.textContent = `${percentRemoved}% (${resp.db.toFixed(1)} dB)`;
            } else {
                noiseAtten.textContent = 'None';
            }

            // Simple status feedback
            if (currentPreset === 'ecg_noise' || currentPreset === 'sine_noise') {
                if (fc < 1.1) {
                    statusBadge.className = 'badge bg-warning-subtle text-warning-emphasis border border-warning px-2 py-1';
                    statusBadge.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i> Cutoff Too Low: Signal Distorted';
                    guidanceText.innerHTML = 'Increase <em>f<sub>c</sub></em> above 1.5 Hz to stop cutting off the heartbeat!';
                } else if (fc >= 1.4 && fc <= 3.2) {
                    statusBadge.className = 'badge bg-success-subtle text-success border border-success px-2 py-1';
                    statusBadge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Well-Tuned: Noise Filtered Out!';
                    guidanceText.innerHTML = 'Optimal! The 1.2 Hz ECG heartbeat is preserved while 5.5 Hz noise is crushed.';
                } else {
                    statusBadge.className = 'badge bg-danger-subtle text-danger border border-danger px-2 py-1';
                    statusBadge.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i> Cutoff Too High: Noise Leaking In';
                    guidanceText.innerHTML = 'Lower <em>f<sub>c</sub></em> below 3.5 Hz to attenuate the high-frequency noise.';
                }
            } else if (currentPreset === 'ecg_drift') {
                if (fc < 0.4) {
                    statusBadge.className = 'badge bg-danger-subtle text-danger border border-danger px-2 py-1';
                    statusBadge.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i> Cutoff Too Low: Drift Still Present';
                    guidanceText.innerHTML = 'Increase <em>f<sub>c</sub></em> above 0.5 Hz to block the slow 0.2 Hz respiratory drift.';
                } else if (fc >= 0.5 && fc <= 1.0) {
                    statusBadge.className = 'badge bg-success-subtle text-success border border-success px-2 py-1';
                    statusBadge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Well-Tuned: Baseline Restored!';
                    guidanceText.innerHTML = 'High-pass filter eliminates the slow drift while preserving fast ECG peaks.';
                } else {
                    statusBadge.className = 'badge bg-warning-subtle text-warning-emphasis border border-warning px-2 py-1';
                    statusBadge.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i> Cutoff Too High: Distorting ECG';
                    guidanceText.innerHTML = 'Lower <em>f<sub>c</sub></em> below 1.0 Hz so the true heartbeat rhythm is not blocked.';
                }
            } else if (currentPreset === 'notch_hum') {
                if (Math.abs(fc - 5.0) <= 0.3) {
                    statusBadge.className = 'badge bg-success-subtle text-success border border-success px-2 py-1';
                    statusBadge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Notch Centered: Hum Eliminated!';
                    guidanceText.innerHTML = 'The notch filter targets and eliminates the exact 5.0 Hz interference frequency.';
                } else {
                    statusBadge.className = 'badge bg-warning-subtle text-warning-emphasis border border-warning px-2 py-1';
                    statusBadge.innerHTML = '<i class="bi bi-crosshair me-1"></i> Center Notch at 5.0 Hz';
                    guidanceText.innerHTML = 'Move the notch slider closer to 5.0 Hz to trap and remove the electrical hum.';
                }
            }
        }

        // ---------------- Event Handlers ----------------

        function setPreset(p) {
            currentPreset = p;
            presetSelect.value = p;

            if (p === 'ecg_noise') {
                filterType = 'lowpass';
                fc = 2.0;
                fcSlider.min = '0.5';
                fcSlider.max = '6.0';
                fcSlider.value = '2.0';
                fcLabel.innerHTML = 'Cutoff Frequency (<em>f<sub>c</sub></em>):';
            } else if (p === 'ecg_drift') {
                filterType = 'highpass';
                fc = 0.8;
                fcSlider.min = '0.2';
                fcSlider.max = '3.0';
                fcSlider.value = '0.8';
                fcLabel.innerHTML = 'Cutoff Frequency (<em>f<sub>c</sub></em>):';
            } else if (p === 'notch_hum') {
                filterType = 'notch';
                fc = 5.0;
                fcSlider.min = '3.0';
                fcSlider.max = '7.0';
                fcSlider.value = '5.0';
                fcLabel.innerHTML = 'Notch Frequency (<em>f</em><sub>0</sub>):';
            } else if (p === 'sine_noise') {
                filterType = 'lowpass';
                fc = 2.0;
                fcSlider.min = '0.5';
                fcSlider.max = '6.0';
                fcSlider.value = '2.0';
                fcLabel.innerHTML = 'Cutoff Frequency (<em>f<sub>c</sub></em>):';
            }

            fcVal.textContent = `${fc.toFixed(1)} Hz`;
            drawAll();
        }

        presetSelect.addEventListener('change', (e) => setPreset(e.target.value));

        fcSlider.addEventListener('input', (e) => {
            fc = parseFloat(e.target.value);
            fcVal.textContent = `${fc.toFixed(1)} Hz`;
            drawAll();
        });

        orderButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                orderButtons.forEach(b => {
                    b.classList.remove('active', 'btn-outline-primary');
                    b.classList.add('btn-outline-secondary');
                });
                this.classList.remove('btn-outline-secondary');
                this.classList.add('active', 'btn-outline-primary');

                order = parseInt(this.dataset.order);
                if (order === 1) {
                    orderBadge.textContent = 'Gentle (1st)';
                    orderHint.textContent = 'Roll-off: -20 dB/decade (gentle slope, slower transition)';
                } else if (order === 2) {
                    orderBadge.textContent = 'Standard (2nd)';
                    orderHint.textContent = 'Roll-off: -40 dB/decade (standard biomedical filter slope)';
                } else if (order === 4) {
                    orderBadge.textContent = 'Sharp (4th)';
                    orderHint.textContent = 'Roll-off: -80 dB/decade (steep brick-wall transition)';
                }
                drawAll();
            });
        });

        resetBtn.addEventListener('click', () => {
            order = 2;
            orderButtons.forEach(b => {
                b.classList.remove('active', 'btn-outline-primary');
                b.classList.add('btn-outline-secondary');
                if (b.dataset.order === '2') {
                    b.classList.remove('btn-outline-secondary');
                    b.classList.add('active', 'btn-outline-primary');
                }
            });
            orderBadge.textContent = 'Standard (2nd)';
            orderHint.textContent = 'Roll-off rate: -40 dB/decade';
            setPreset('ecg_noise');
        });

        // Hover tracking
        timeCanvas.addEventListener('pointermove', (e) => {
            const rect = timeCanvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const x = clientX - rect.left;
            const padding = { left: 40, right: 15 };
            const plotW = rect.width - padding.left - padding.right;
            const t = Math.max(tMin, Math.min(tMax, tMin + ((x - padding.left) / plotW) * (tMax - tMin)));
            hoveredTime = t;

            const components = getSignalComponents();
            const y = evaluateFilteredSignal(t, components);
            timeCursor.textContent = `t = ${t.toFixed(2)} s | y(t) = ${y.toFixed(2)} V`;
            drawAll();
        });

        timeCanvas.addEventListener('pointerleave', () => {
            hoveredTime = null;
            const components = getSignalComponents();
            timeCursor.textContent = `t = 0.00 s | y(t) = ${evaluateFilteredSignal(0, components).toFixed(2)} V`;
            drawAll();
        });

        freqCanvas.addEventListener('pointermove', (e) => {
            const rect = freqCanvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const x = clientX - rect.left;
            const padding = { left: 40, right: 15 };
            const plotW = rect.width - padding.left - padding.right;
            const f = Math.max(fMin, Math.min(fMax, fMin + ((x - padding.left) / plotW) * (fMax - fMin)));
            hoveredFreq = f;

            const resp = getFilterResponse(f);
            freqCursor.textContent = `f = ${f.toFixed(2)} Hz | Gain = ${resp.db.toFixed(1)} dB (${resp.magLinear.toFixed(2)} V/V)`;
            drawAll();
        });

        freqCanvas.addEventListener('pointerleave', () => {
            hoveredFreq = null;
            freqCursor.textContent = `fc = ${fc.toFixed(2)} Hz | Cutoff = -3.0 dB`;
            drawAll();
        });

        window.addEventListener('resize', resizeCanvases);

        const themeObserver = new MutationObserver(() => drawAll());
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

        resizeCanvases();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFilterLab);
    } else {
        initFilterLab();
    }
})();
