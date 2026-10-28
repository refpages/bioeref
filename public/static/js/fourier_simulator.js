// fourier_simulator.js
// Streamlined, Responsive Fourier Transform & Frequency Domain Simulation Engine
(function() {
    function initFourierLab() {
        const timeCanvas = document.getElementById('ft-time-canvas');
        const freqCanvas = document.getElementById('ft-freq-canvas');
        if (!timeCanvas || !freqCanvas) return;

        const timeCtx = timeCanvas.getContext('2d');
        const freqCtx = freqCanvas.getContext('2d');

        // Cards & containers
        const timeCard = document.getElementById('ft-time-card');
        const freqCard = document.getElementById('ft-freq-card');
        const controlsMultitone = document.getElementById('ft-controls-multitone');
        const controlsHarmonics = document.getElementById('ft-controls-harmonics');
        const controlsBioe = document.getElementById('ft-controls-bioe');

        // Toolbar elements
        const scenarioSelect = document.getElementById('ft-scenario-select');
        const scenarioBadge = document.getElementById('ft-scenario-badge');
        const viewSelect = document.getElementById('ft-view-select');
        const viewBadge = document.getElementById('ft-view-badge');
        const playBtn = document.getElementById('ft-play-btn');
        const playIcon = document.getElementById('ft-play-icon');
        const playText = document.getElementById('ft-play-text');
        const resetBtn = document.getElementById('ft-reset-btn');

        // Multitone inputs
        const t1FreqSlider = document.getElementById('ft-t1-freq');
        const t1AmpSlider = document.getElementById('ft-t1-amp');
        const t1Badge = document.getElementById('ft-t1-badge');
        const t2FreqSlider = document.getElementById('ft-t2-freq');
        const t2AmpSlider = document.getElementById('ft-t2-amp');
        const t2Badge = document.getElementById('ft-t2-badge');
        const t3FreqSlider = document.getElementById('ft-t3-freq');
        const t3AmpSlider = document.getElementById('ft-t3-amp');
        const t3Badge = document.getElementById('ft-t3-badge');

        // Harmonics inputs
        const harmWaveSelect = document.getElementById('ft-harm-waveform');
        const harmCountSlider = document.getElementById('ft-harm-count');
        const harmCountVal = document.getElementById('ft-harm-count-val');
        const harmF0Slider = document.getElementById('ft-harm-f0');
        const harmF0Val = document.getElementById('ft-harm-f0-val');

        // Bioe inputs
        const bioeHrSlider = document.getElementById('ft-bioe-hr');
        const bioeHrVal = document.getElementById('ft-bioe-hr-val');
        const bioeNoiseAmpSlider = document.getElementById('ft-bioe-noise-amp');
        const bioeNoiseAmpVal = document.getElementById('ft-bioe-noise-amp-val');
        const bioeNoiseFreqSlider = document.getElementById('ft-bioe-noise-freq');
        const bioeNoiseFreqVal = document.getElementById('ft-bioe-noise-freq-val');

        // Toggles
        const showComponentsSwitch = document.getElementById('ft-show-components-switch');
        const addNoiseSwitch = document.getElementById('ft-add-noise-switch');
        const viewStemBtn = document.getElementById('ft-view-stem');
        const viewEnvelopeBtn = document.getElementById('ft-view-envelope');
        const componentsLegend = document.getElementById('ft-components-legend');

        // Readouts
        const timeCursor = document.getElementById('ft-time-cursor');
        const freqCursor = document.getElementById('ft-freq-cursor');
        const metricFdom = document.getElementById('ft-metric-fdom');
        const metricVpp = document.getElementById('ft-metric-vpp');
        const metricRms = document.getElementById('ft-metric-rms');
        const quickExplanation = document.getElementById('ft-quick-explanation');

        // Simulation State
        let currentScenario = 'lecture'; // 'lecture', 'square', 'triangle', 'bioe', 'beats'
        let viewMode = 'stacked'; // 'stacked', 'time', 'freq'
        let spectrumMode = 'stem'; // 'stem' or 'envelope'
        let showComponents = true;
        let addNoise = false;

        // Multitone parameters (Figs 1-3 default)
        let t1 = { f: 0.2, a: 5.0, color: '#0d6efd' }; // Blue
        let t2 = { f: 0.5, a: 1.5, color: '#dc3545' }; // Red
        let t3 = { f: 1.0, a: 2.0, color: '#198754' }; // Green

        // Harmonics parameters
        let harmWave = 'square';
        let harmCount = 5;
        let harmF0 = 0.5;

        // Bioe parameters
        let bioeBpm = 72;
        let bioeNoiseAmp = 1.2;
        let bioeNoiseFreq = 4.5;

        // Interactive Tracking & Animation
        let hoveredTime = null;
        let hoveredFreq = null;
        let isPlaying = false;
        let animProgress = 0.0;
        let animRafId = null;
        let lastFrameTime = null;

        // Time domain bounds
        const tMin = 0.0;
        const tMax = 10.0; // 0 to 10s

        function isDarkTheme() {
            return document.documentElement.getAttribute('data-bs-theme') === 'dark';
        }

        function resizeCanvases() {
            const dpr = window.devicePixelRatio || 1;
            [timeCanvas, freqCanvas].forEach(c => {
                if (c.offsetParent === null) return; // Hidden
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

        // Active frequency components: Array of { f, a, color, label }
        function getActiveComponents() {
            const list = [];
            if (currentScenario === 'lecture' || currentScenario === 'beats') {
                if (t1.a > 0.01) list.push({ f: t1.f, a: t1.a, color: t1.color, label: `Tone 1 (Blue)` });
                if (t2.a > 0.01) list.push({ f: t2.f, a: t2.a, color: t2.color, label: `Tone 2 (Red)` });
                if (t3.a > 0.01) list.push({ f: t3.f, a: t3.a, color: t3.color, label: `Tone 3 (Green)` });
            } else if (currentScenario === 'square' || currentScenario === 'triangle') {
                const colors = ['#0d6efd', '#6610f2', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#198754'];
                if (harmWave === 'square') {
                    const ampBase = 3.5;
                    for (let k = 1; k <= harmCount; k++) {
                        const n = 2 * k - 1;
                        const fn = n * harmF0;
                        const an = (4.0 * ampBase / Math.PI) * (1.0 / n);
                        list.push({ f: fn, a: an, color: colors[(k - 1) % colors.length], label: `${n}f₀ Harmonic` });
                    }
                } else if (harmWave === 'triangle') {
                    const ampBase = 3.5;
                    for (let k = 1; k <= harmCount; k++) {
                        const n = 2 * k - 1;
                        const fn = n * harmF0;
                        const an = (8.0 * ampBase / (Math.PI * Math.PI)) * (1.0 / (n * n));
                        list.push({ f: fn, a: an, color: colors[(k - 1) % colors.length], label: `${n}f₀ Harmonic` });
                    }
                } else if (harmWave === 'sawtooth') {
                    const ampBase = 3.0;
                    for (let k = 1; k <= harmCount; k++) {
                        const fn = k * harmF0;
                        const an = (2.0 * ampBase / Math.PI) * (1.0 / k);
                        list.push({ f: fn, a: an, color: colors[(k - 1) % colors.length], label: `${k}f₀ Harmonic` });
                    }
                }
            } else if (currentScenario === 'bioe') {
                const f0 = bioeBpm / 60.0;
                list.push({ f: f0, a: 1.8, color: '#dc3545', label: `Heartbeat (f₀)` });
                list.push({ f: 2 * f0, a: 1.1, color: '#fd7e14', label: `T-wave (2f₀)` });
                list.push({ f: 3 * f0, a: 2.2, color: '#ffc107', label: `QRS Complex (3f₀)` });
                list.push({ f: 4 * f0, a: 0.9, color: '#198754', label: `P-wave (4f₀)` });
            }

            if (addNoise) {
                const noiseF = (currentScenario === 'bioe') ? bioeNoiseFreq : 3.5;
                const noiseA = (currentScenario === 'bioe') ? bioeNoiseAmp : 1.2;
                list.push({ f: noiseF, a: noiseA, color: '#6c757d', label: `Noise` });
            }

            return list;
        }

        function evaluateSignal(t, components) {
            let val = 0.0;
            for (let i = 0; i < components.length; i++) {
                val += components[i].a * Math.sin(2.0 * Math.PI * components[i].f * t);
            }
            return val;
        }

        function evaluateComponent(t, comp) {
            return comp.a * Math.sin(2.0 * Math.PI * comp.f * t);
        }

        function getRanges(components) {
            let maxFreq = 3.0;
            let maxAmp = 4.0;
            for (let i = 0; i < components.length; i++) {
                if (components[i].f > maxFreq) maxFreq = components[i].f;
                if (components[i].a > maxAmp) maxAmp = components[i].a;
            }
            const fMax = Math.max(3.5, Math.ceil((maxFreq + 0.6) * 2) / 2);

            let peakTimeAmp = 1.0;
            const steps = 250;
            for (let i = 0; i <= steps; i++) {
                const t = tMin + (i / steps) * (tMax - tMin);
                const v = Math.abs(evaluateSignal(t, components));
                if (v > peakTimeAmp) peakTimeAmp = v;
            }
            const yBound = Math.max(3.0, Math.ceil((peakTimeAmp + 0.8) / 1.5) * 1.5);

            return {
                fMin: 0.0,
                fMax: fMax,
                yMin: -yBound,
                yMax: yBound,
                yFreqMax: Math.max(4.0, Math.ceil((maxAmp + 1.0) * 1.15))
            };
        }

        function drawAll() {
            const components = getActiveComponents();
            const ranges = getRanges(components);

            if (viewMode !== 'freq') drawTimePlot(components, ranges);
            if (viewMode !== 'time') drawFreqPlot(components, ranges);
            updateDiagnostics(components, ranges);
        }

        // ---------------- Time Domain Canvas ----------------
        function drawTimePlot(components, ranges) {
            const rect = timeCanvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const dark = isDarkTheme();

            timeCtx.clearRect(0, 0, width, height);

            const padding = { left: 40, right: 15, top: 18, bottom: 24 };
            const plotW = width - padding.left - padding.right;
            const plotH = height - padding.top - padding.bottom;

            function toX(t) {
                return padding.left + ((t - tMin) / (tMax - tMin)) * plotW;
            }
            function toY(y) {
                return padding.top + ((ranges.yMax - y) / (ranges.yMax - ranges.yMin)) * plotH;
            }

            // Canvas Background
            timeCtx.fillStyle = dark ? '#1e2124' : '#ffffff';
            timeCtx.fillRect(padding.left, padding.top, plotW, plotH);

            // Grid & Ticks (Dynamic step to avoid collisions)
            timeCtx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
            timeCtx.lineWidth = 1;
            timeCtx.fillStyle = dark ? '#adb5bd' : '#6c757d';
            timeCtx.font = '10px monospace';
            timeCtx.textAlign = 'center';
            timeCtx.textBaseline = 'top';

            // Calculate non-colliding time tick spacing
            const minTickPx = 55;
            const maxTicks = Math.max(3, Math.floor(plotW / minTickPx));
            const rawStep = (tMax - tMin) / maxTicks;
            let dt = 1.0;
            if (rawStep > 1.8) dt = 2.0;
            if (rawStep > 3.5) dt = 5.0;

            for (let t = tMin; t <= tMax + 0.01; t += dt) {
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
            const dy = Math.max(1, Math.round((ranges.yMax - ranges.yMin) / 5));
            for (let y = Math.ceil(ranges.yMin); y <= ranges.yMax; y += dy) {
                if (Math.abs(y) < 0.01) continue;
                const py = toY(y);
                timeCtx.beginPath();
                timeCtx.moveTo(padding.left, py);
                timeCtx.lineTo(padding.left + plotW, py);
                timeCtx.stroke();
                timeCtx.fillText(`${y > 0 ? '+' : ''}${y}V`, padding.left - 5, py);
            }

            // Zero line
            const yZero = toY(0);
            timeCtx.strokeStyle = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
            timeCtx.lineWidth = 1.5;
            timeCtx.beginPath();
            timeCtx.moveTo(padding.left, yZero);
            timeCtx.lineTo(padding.left + plotW, yZero);
            timeCtx.stroke();
            timeCtx.fillText('0V', padding.left - 5, yZero);

            // Draw individual sines (faint dashed lines)
            if (showComponents && components.length > 1) {
                components.forEach(comp => {
                    timeCtx.save();
                    timeCtx.strokeStyle = comp.color;
                    timeCtx.globalAlpha = dark ? 0.55 : 0.45;
                    timeCtx.lineWidth = 1.4;
                    timeCtx.setLineDash([4, 3]);

                    timeCtx.beginPath();
                    const samples = 350;
                    for (let i = 0; i <= samples; i++) {
                        const t = tMin + (i / samples) * (tMax - tMin);
                        const y = evaluateComponent(t, comp);
                        const px = toX(t);
                        const py = toY(y);
                        if (i === 0) timeCtx.moveTo(px, py);
                        else timeCtx.lineTo(px, py);
                    }
                    timeCtx.stroke();
                    timeCtx.restore();
                });
            }

            // Draw Composite Signal x(t) (Bold Illini Orange)
            timeCtx.save();
            timeCtx.strokeStyle = '#ff5f05';
            timeCtx.lineWidth = 2.4;
            timeCtx.lineJoin = 'round';
            timeCtx.beginPath();

            const samples = 600;
            for (let i = 0; i <= samples; i++) {
                const t = tMin + (i / samples) * (tMax - tMin);
                const y = evaluateSignal(t, components);
                const px = toX(t);
                const py = toY(y);
                if (i === 0) timeCtx.moveTo(px, py);
                else timeCtx.lineTo(px, py);
            }
            timeCtx.stroke();
            timeCtx.restore();

            // Sweep Cursor
            if (isPlaying) {
                const sweepX = toX(animProgress);
                timeCtx.save();
                timeCtx.strokeStyle = 'rgba(255, 95, 5, 0.85)';
                timeCtx.lineWidth = 2;
                timeCtx.setLineDash([3, 2]);
                timeCtx.beginPath();
                timeCtx.moveTo(sweepX, padding.top);
                timeCtx.lineTo(sweepX, padding.top + plotH);
                timeCtx.stroke();

                const sweepY = toY(evaluateSignal(animProgress, components));
                timeCtx.fillStyle = '#ff5f05';
                timeCtx.beginPath();
                timeCtx.arc(sweepX, sweepY, 4, 0, 2 * Math.PI);
                timeCtx.fill();
                timeCtx.restore();
            }

            // Hover indicator
            if (hoveredTime !== null && hoveredTime >= tMin && hoveredTime <= tMax) {
                const hx = toX(hoveredTime);
                const hy = toY(evaluateSignal(hoveredTime, components));

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

        // ---------------- Frequency Domain Canvas ----------------
        function drawFreqPlot(components, ranges) {
            const rect = freqCanvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const dark = isDarkTheme();

            freqCtx.clearRect(0, 0, width, height);

            const padding = { left: 40, right: 15, top: 22, bottom: 24 };
            const plotW = width - padding.left - padding.right;
            const plotH = height - padding.top - padding.bottom;

            function toX(f) {
                return padding.left + ((f - ranges.fMin) / (ranges.fMax - ranges.fMin)) * plotW;
            }
            function toY(a) {
                return padding.top + ((ranges.yFreqMax - a) / ranges.yFreqMax) * plotH;
            }

            // Canvas Background
            freqCtx.fillStyle = dark ? '#1e2124' : '#ffffff';
            freqCtx.fillRect(padding.left, padding.top, plotW, plotH);

            // Grid & Ticks (Dynamically spaced to prevent collision)
            freqCtx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
            freqCtx.lineWidth = 1;
            freqCtx.fillStyle = dark ? '#adb5bd' : '#6c757d';
            freqCtx.font = '10px monospace';
            freqCtx.textAlign = 'center';
            freqCtx.textBaseline = 'top';

            // Calculate clean, non-overlapping frequency ticks
            const minTickPx = 45;
            const maxTicks = Math.max(3, Math.floor(plotW / minTickPx));
            const rawFStep = (ranges.fMax - ranges.fMin) / maxTicks;
            let df = 0.5;
            if (rawFStep > 0.4) df = 1.0;
            if (rawFStep > 1.2) df = 2.0;

            for (let f = 0.0; f <= ranges.fMax + 0.01; f += df) {
                const x = toX(f);
                freqCtx.beginPath();
                freqCtx.moveTo(x, padding.top);
                freqCtx.lineTo(x, padding.top + plotH);
                freqCtx.stroke();
                freqCtx.fillText(`${df < 1.0 ? f.toFixed(1) : f.toFixed(0)}Hz`, x, padding.top + plotH + 4);
            }

            // Y-ticks
            freqCtx.textAlign = 'right';
            freqCtx.textBaseline = 'middle';
            const dy = Math.max(1, Math.round(ranges.yFreqMax / 4));
            for (let a = dy; a <= ranges.yFreqMax; a += dy) {
                const py = toY(a);
                freqCtx.beginPath();
                freqCtx.moveTo(padding.left, py);
                freqCtx.lineTo(padding.left + plotW, py);
                freqCtx.stroke();
                freqCtx.fillText(`${a}V`, padding.left - 5, py);
            }

            // Zero line
            const yZero = toY(0);
            freqCtx.strokeStyle = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
            freqCtx.lineWidth = 1.5;
            freqCtx.beginPath();
            freqCtx.moveTo(padding.left, yZero);
            freqCtx.lineTo(padding.left + plotW, yZero);
            freqCtx.stroke();
            freqCtx.fillText('0V', padding.left - 5, yZero);

            // Envelope Curve Mode
            if (spectrumMode === 'envelope') {
                freqCtx.save();
                freqCtx.strokeStyle = '#0d6efd';
                freqCtx.fillStyle = dark ? 'rgba(13, 110, 253, 0.25)' : 'rgba(13, 110, 253, 0.12)';
                freqCtx.lineWidth = 2;
                freqCtx.beginPath();

                const steps = 300;
                freqCtx.moveTo(toX(0), toY(0));
                for (let i = 0; i <= steps; i++) {
                    const f = ranges.fMin + (i / steps) * (ranges.fMax - ranges.fMin);
                    let envMag = 0.0;
                    for (let c = 0; c < components.length; c++) {
                        const comp = components[c];
                        const sigma = 0.08;
                        const delta = f - comp.f;
                        envMag += comp.a * Math.exp(-(delta * delta) / (2 * sigma * sigma));
                    }
                    freqCtx.lineTo(toX(f), toY(envMag));
                }
                freqCtx.lineTo(toX(ranges.fMax), toY(0));
                freqCtx.closePath();
                freqCtx.fill();
                freqCtx.stroke();
                freqCtx.restore();
            }

            // Stems Mode (Lollipop stems with clean non-colliding labels)
            components.forEach(comp => {
                const x = toX(comp.f);
                const yTop = toY(comp.a);

                // Stem Line
                freqCtx.save();
                freqCtx.strokeStyle = comp.color;
                freqCtx.lineWidth = 2.5;
                freqCtx.beginPath();
                freqCtx.moveTo(x, yZero);
                freqCtx.lineTo(x, yTop);
                freqCtx.stroke();

                // Lollipop Circle
                freqCtx.fillStyle = comp.color;
                freqCtx.beginPath();
                freqCtx.arc(x, yTop, 5, 0, 2 * Math.PI);
                freqCtx.fill();

                freqCtx.strokeStyle = '#ffffff';
                freqCtx.lineWidth = 1.5;
                freqCtx.stroke();

                // Compact Amplitude Label above Lollipop
                freqCtx.fillStyle = dark ? '#e9ecef' : '#212529';
                freqCtx.font = 'bold 9.5px monospace';
                freqCtx.textAlign = 'center';
                freqCtx.textBaseline = 'bottom';

                const labelText = `${comp.a.toFixed(1)}V`;
                const labelW = freqCtx.measureText(labelText).width;
                freqCtx.fillStyle = dark ? 'rgba(33, 37, 41, 0.85)' : 'rgba(255, 255, 255, 0.85)';
                freqCtx.fillRect(x - labelW / 2 - 2, yTop - 15, labelW + 4, 11);

                freqCtx.fillStyle = comp.color;
                freqCtx.fillText(labelText, x, yTop - 4);
                freqCtx.restore();
            });

            // Hover indicator
            if (hoveredFreq !== null && hoveredFreq >= ranges.fMin && hoveredFreq <= ranges.fMax) {
                const hx = toX(hoveredFreq);
                freqCtx.save();
                freqCtx.strokeStyle = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)';
                freqCtx.lineWidth = 1;
                freqCtx.setLineDash([2, 2]);
                freqCtx.beginPath();
                freqCtx.moveTo(hx, padding.top);
                freqCtx.lineTo(hx, padding.top + plotH);
                freqCtx.stroke();
                freqCtx.restore();
            }

            // Border
            freqCtx.strokeStyle = dark ? '#495057' : '#ced4da';
            freqCtx.lineWidth = 1;
            freqCtx.strokeRect(padding.left, padding.top, plotW, plotH);
        }

        // ---------------- Diagnostics ----------------
        function updateDiagnostics(components, ranges) {
            let maxA = 0.0;
            let domF = 0.0;
            let sumSq = 0.0;
            for (let i = 0; i < components.length; i++) {
                if (components[i].a > maxA) {
                    maxA = components[i].a;
                    domF = components[i].f;
                }
                sumSq += (components[i].a * components[i].a) / 2.0;
            }
            const rms = Math.sqrt(sumSq);

            let minVal = 0.0;
            let maxVal = 0.0;
            const steps = 150;
            for (let i = 0; i <= steps; i++) {
                const t = tMin + (i / steps) * (tMax - tMin);
                const v = evaluateSignal(t, components);
                if (v < minVal) minVal = v;
                if (v > maxVal) maxVal = v;
            }
            const vpp = maxVal - minVal;

            metricFdom.textContent = `${domF.toFixed(2)} Hz`;
            metricVpp.textContent = `${vpp.toFixed(2)} V`;
            metricRms.textContent = `${rms.toFixed(2)} V`;

            if (currentScenario === 'lecture') {
                quickExplanation.innerHTML = `<strong>Lecture Figs 1–3:</strong> 3 distinct frequencies combined in time domain, cleanly resolved as discrete spectral peaks in |<em>X</em>(<em>f</em>)|.`;
            } else if (currentScenario === 'square' || currentScenario === 'triangle') {
                if (harmWave === 'square') {
                    quickExplanation.innerHTML = `<strong>Fourier Series (${harmWave}):</strong> Odd harmonics sum as 1/<em>n</em> to create steep edges and Gibbs overshoot.`;
                } else if (harmWave === 'triangle') {
                    quickExplanation.innerHTML = `<strong>Fourier Series (${harmWave}):</strong> Harmonics drop rapidly as 1/<em>n</em>², smoothing into a triangle wave.`;
                } else {
                    quickExplanation.innerHTML = `<strong>Fourier Series (${harmWave}):</strong> Integer harmonics sum to produce the ramp profile.`;
                }
            } else if (currentScenario === 'bioe') {
                if (addNoise) {
                    quickExplanation.innerHTML = `<strong>Biomedical Filtering Context:</strong> High-frequency noise (${bioeNoiseFreq.toFixed(1)} Hz) corrupts the ECG, but appears isolated in |<em>X</em>(<em>f</em>)| ready to be filtered!`;
                } else {
                    quickExplanation.innerHTML = `<strong>Biomedical ECG:</strong> Cardiac fundamental (${(bioeBpm/60).toFixed(2)} Hz) plus depolarization harmonics.`;
                }
            } else if (currentScenario === 'beats') {
                const fBeat = Math.abs(t1.f - t2.f);
                quickExplanation.innerHTML = `<strong>Beat Phenomenon:</strong> Interference between ${t1.f.toFixed(2)} Hz and ${t2.f.toFixed(2)} Hz creates amplitude modulation at <em>f</em><sub>beat</sub> = ${fBeat.toFixed(2)} Hz.`;
            }
        }

        // ---------------- Event Listeners ----------------

        function setScenario(sc) {
            currentScenario = sc;
            scenarioSelect.value = sc;

            controlsMultitone.classList.add('d-none');
            controlsHarmonics.classList.add('d-none');
            controlsBioe.classList.add('d-none');

            if (sc === 'lecture') {
                scenarioBadge.textContent = 'Figs 1–3 (Lecture)';
                controlsMultitone.classList.remove('d-none');
                t1 = { f: 0.2, a: 5.0, color: '#0d6efd' };
                t2 = { f: 0.5, a: 1.5, color: '#dc3545' };
                t3 = { f: 1.0, a: 2.0, color: '#198754' };
                addNoise = false;
                addNoiseSwitch.checked = false;
                syncMultitoneInputs();
            } else if (sc === 'square') {
                scenarioBadge.textContent = 'Square Wave';
                controlsHarmonics.classList.remove('d-none');
                harmWave = 'square';
                harmCount = 7;
                harmF0 = 0.5;
                harmWaveSelect.value = harmWave;
                harmCountSlider.value = harmCount;
                harmCountVal.textContent = `N = ${harmCount}`;
                harmF0Slider.value = harmF0;
                harmF0Val.textContent = `${harmF0.toFixed(1)} Hz`;
            } else if (sc === 'triangle') {
                scenarioBadge.textContent = 'Triangle Wave';
                controlsHarmonics.classList.remove('d-none');
                harmWave = 'triangle';
                harmCount = 5;
                harmF0 = 0.5;
                harmWaveSelect.value = harmWave;
                harmCountSlider.value = harmCount;
                harmCountVal.textContent = `N = ${harmCount}`;
                harmF0Slider.value = harmF0;
                harmF0Val.textContent = `${harmF0.toFixed(1)} Hz`;
            } else if (sc === 'bioe') {
                scenarioBadge.textContent = 'Biomedical ECG';
                controlsBioe.classList.remove('d-none');
                bioeBpm = 72;
                bioeNoiseAmp = 1.2;
                bioeNoiseFreq = 4.5;
                addNoise = true;
                addNoiseSwitch.checked = true;
                bioeHrSlider.value = bioeBpm;
                bioeHrVal.textContent = `${bioeBpm} BPM`;
                bioeNoiseAmpSlider.value = bioeNoiseAmp;
                bioeNoiseAmpVal.textContent = `${bioeNoiseAmp.toFixed(1)} V`;
                bioeNoiseFreqSlider.value = bioeNoiseFreq;
                bioeNoiseFreqVal.textContent = `${bioeNoiseFreq.toFixed(1)} Hz`;
            } else if (sc === 'beats') {
                scenarioBadge.textContent = 'Beat Interference';
                controlsMultitone.classList.remove('d-none');
                t1 = { f: 2.0, a: 2.5, color: '#0d6efd' };
                t2 = { f: 2.3, a: 2.5, color: '#dc3545' };
                t3 = { f: 1.0, a: 0.0, color: '#198754' };
                addNoise = false;
                addNoiseSwitch.checked = false;
                syncMultitoneInputs();
            }

            drawAll();
        }

        function setViewMode(mode) {
            viewMode = mode;
            viewSelect.value = mode;

            if (mode === 'stacked') {
                viewBadge.textContent = 'Stacked View';
                timeCard.classList.remove('d-none');
                freqCard.classList.remove('d-none');
                timeCard.querySelector('.canvas-wrapper').style.height = '190px';
                freqCard.querySelector('.canvas-wrapper').style.height = '190px';
            } else if (mode === 'time') {
                viewBadge.textContent = 'Time Only';
                timeCard.classList.remove('d-none');
                freqCard.classList.add('d-none');
                timeCard.querySelector('.canvas-wrapper').style.height = '240px';
            } else if (mode === 'freq') {
                viewBadge.textContent = 'Frequency Only';
                timeCard.classList.add('d-none');
                freqCard.classList.remove('d-none');
                freqCard.querySelector('.canvas-wrapper').style.height = '240px';
            }

            setTimeout(resizeCanvases, 30);
        }

        function syncMultitoneInputs() {
            t1FreqSlider.value = t1.f;
            t1AmpSlider.value = t1.a;
            t1Badge.textContent = `${t1.f.toFixed(2)} Hz | ${t1.a.toFixed(1)} V`;

            t2FreqSlider.value = t2.f;
            t2AmpSlider.value = t2.a;
            t2Badge.textContent = `${t2.f.toFixed(2)} Hz | ${t2.a.toFixed(1)} V`;

            t3FreqSlider.value = t3.f;
            t3AmpSlider.value = t3.a;
            t3Badge.textContent = `${t3.f.toFixed(2)} Hz | ${t3.a.toFixed(1)} V`;
        }

        scenarioSelect.addEventListener('change', (e) => {
            setScenario(e.target.value);
        });

        viewSelect.addEventListener('change', (e) => {
            setViewMode(e.target.value);
        });

        // Multitone input listeners
        [t1FreqSlider, t1AmpSlider].forEach(el => {
            el.addEventListener('input', () => {
                t1.f = parseFloat(t1FreqSlider.value);
                t1.a = parseFloat(t1AmpSlider.value);
                t1Badge.textContent = `${t1.f.toFixed(2)} Hz | ${t1.a.toFixed(1)} V`;
                drawAll();
            });
        });

        [t2FreqSlider, t2AmpSlider].forEach(el => {
            el.addEventListener('input', () => {
                t2.f = parseFloat(t2FreqSlider.value);
                t2.a = parseFloat(t2AmpSlider.value);
                t2Badge.textContent = `${t2.f.toFixed(2)} Hz | ${t2.a.toFixed(1)} V`;
                drawAll();
            });
        });

        [t3FreqSlider, t3AmpSlider].forEach(el => {
            el.addEventListener('input', () => {
                t3.f = parseFloat(t3FreqSlider.value);
                t3.a = parseFloat(t3AmpSlider.value);
                t3Badge.textContent = `${t3.f.toFixed(2)} Hz | ${t3.a.toFixed(1)} V`;
                drawAll();
            });
        });

        // Harmonics listeners
        harmWaveSelect.addEventListener('change', (e) => {
            harmWave = e.target.value;
            drawAll();
        });

        harmCountSlider.addEventListener('input', (e) => {
            harmCount = parseInt(e.target.value);
            harmCountVal.textContent = `N = ${harmCount}`;
            drawAll();
        });

        harmF0Slider.addEventListener('input', (e) => {
            harmF0 = parseFloat(e.target.value);
            harmF0Val.textContent = `${harmF0.toFixed(1)} Hz`;
            drawAll();
        });

        // Bioe listeners
        bioeHrSlider.addEventListener('input', (e) => {
            bioeBpm = parseInt(e.target.value);
            bioeHrVal.textContent = `${bioeBpm} BPM`;
            drawAll();
        });

        bioeNoiseAmpSlider.addEventListener('input', (e) => {
            bioeNoiseAmp = parseFloat(e.target.value);
            bioeNoiseAmpVal.textContent = `${bioeNoiseAmp.toFixed(1)} V`;
            drawAll();
        });

        bioeNoiseFreqSlider.addEventListener('input', (e) => {
            bioeNoiseFreq = parseFloat(e.target.value);
            bioeNoiseFreqVal.textContent = `${bioeNoiseFreq.toFixed(1)} Hz`;
            drawAll();
        });

        // Switches
        showComponentsSwitch.addEventListener('change', (e) => {
            showComponents = e.target.checked;
            if (showComponents) componentsLegend.classList.remove('d-none');
            else componentsLegend.classList.add('d-none');
            drawAll();
        });

        addNoiseSwitch.addEventListener('change', (e) => {
            addNoise = e.target.checked;
            drawAll();
        });

        // Spectrum Mode
        viewStemBtn.addEventListener('click', () => {
            spectrumMode = 'stem';
            viewStemBtn.classList.add('active');
            viewEnvelopeBtn.classList.remove('active');
            drawAll();
        });

        viewEnvelopeBtn.addEventListener('click', () => {
            spectrumMode = 'envelope';
            viewEnvelopeBtn.classList.add('active');
            viewStemBtn.classList.remove('active');
            drawAll();
        });

        // Reset
        resetBtn.addEventListener('click', () => {
            if (isPlaying) stopAnimation();
            addNoise = false;
            addNoiseSwitch.checked = false;
            showComponents = true;
            showComponentsSwitch.checked = true;
            spectrumMode = 'stem';
            viewStemBtn.classList.add('active');
            viewEnvelopeBtn.classList.remove('active');
            setViewMode('stacked');
            setScenario('lecture');
        });

        // Pointer Tracking
        timeCanvas.addEventListener('pointermove', (e) => {
            const rect = timeCanvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const x = clientX - rect.left;
            const padding = { left: 40, right: 15 };
            const plotW = rect.width - padding.left - padding.right;
            const t = Math.max(tMin, Math.min(tMax, tMin + ((x - padding.left) / plotW) * (tMax - tMin)));
            hoveredTime = t;

            const components = getActiveComponents();
            const val = evaluateSignal(t, components);
            timeCursor.textContent = `t = ${t.toFixed(2)} s | x(t) = ${val.toFixed(2)} V`;
            drawAll();
        });

        timeCanvas.addEventListener('pointerleave', () => {
            hoveredTime = null;
            const components = getActiveComponents();
            timeCursor.textContent = `t = 0.00 s | x(t) = ${evaluateSignal(0, components).toFixed(2)} V`;
            drawAll();
        });

        freqCanvas.addEventListener('pointermove', (e) => {
            const rect = freqCanvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const x = clientX - rect.left;
            const padding = { left: 40, right: 15 };
            const plotW = rect.width - padding.left - padding.right;

            const components = getActiveComponents();
            const ranges = getRanges(components);
            const f = Math.max(ranges.fMin, Math.min(ranges.fMax, ranges.fMin + ((x - padding.left) / plotW) * (ranges.fMax - ranges.fMin)));
            hoveredFreq = f;

            let closest = null;
            let minDist = 0.35;
            for (let i = 0; i < components.length; i++) {
                const dist = Math.abs(components[i].f - f);
                if (dist < minDist) {
                    minDist = dist;
                    closest = components[i];
                }
            }

            if (closest) {
                freqCursor.textContent = `Peak: ${closest.f.toFixed(2)} Hz | ${closest.a.toFixed(1)} V (${closest.label})`;
            } else {
                freqCursor.textContent = `f = ${f.toFixed(2)} Hz`;
            }
            drawAll();
        });

        freqCanvas.addEventListener('pointerleave', () => {
            hoveredFreq = null;
            freqCursor.textContent = `f = 0.00 Hz | |X(f)| = 0.00 V`;
            drawAll();
        });

        // Animation
        function startAnimation() {
            isPlaying = true;
            playIcon.className = 'bi bi-pause-fill';
            playText.textContent = 'Pause';
            playBtn.classList.remove('btn-outline-success');
            playBtn.classList.add('btn-warning');

            animProgress = tMin;
            lastFrameTime = performance.now();

            function frame(now) {
                if (!isPlaying) return;
                const dt = (now - lastFrameTime) / 1000.0;
                lastFrameTime = now;

                const speed = (tMax - tMin) / 5.0;
                animProgress += speed * dt;
                if (animProgress > tMax) animProgress = tMin;

                drawAll();
                animRafId = requestAnimationFrame(frame);
            }
            animRafId = requestAnimationFrame(frame);
        }

        function stopAnimation() {
            isPlaying = false;
            playIcon.className = 'bi bi-play-fill';
            playText.textContent = 'Play';
            playBtn.classList.remove('btn-warning');
            playBtn.classList.add('btn-outline-success');
            if (animRafId) cancelAnimationFrame(animRafId);
            drawAll();
        }

        playBtn.addEventListener('click', () => {
            if (isPlaying) stopAnimation();
            else startAnimation();
        });

        // Window resize and theme change
        window.addEventListener('resize', resizeCanvases);

        const themeObserver = new MutationObserver(() => {
            drawAll();
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

        // Initial setup
        resizeCanvases();
        syncMultitoneInputs();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFourierLab);
    } else {
        initFourierLab();
    }
})();
