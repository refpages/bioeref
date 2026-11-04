// convolution_simulator.js
// Clean, High-Contrast Interactive Continuous & Discrete Convolution Simulation Engine
(function() {
    function initConvolutionLab() {
        const tauCanvas = document.getElementById('conv-tau-canvas');
        const timeCanvas = document.getElementById('conv-time-canvas');
        if (!tauCanvas || !timeCanvas) return;

        const tauCtx = tauCanvas.getContext('2d');
        const timeCtx = timeCanvas.getContext('2d');

        // Selectors & Badges
        const presetSelect = document.getElementById('conv-preset-select');
        const modeBadge = document.getElementById('conv-mode-badge');
        const statusBadge = document.getElementById('conv-status-badge');
        const discreteDayPillsContainer = document.getElementById('conv-discrete-day-pills');
        const continuousStepBadge = document.getElementById('conv-continuous-step-badge');
        const dayPills = document.querySelectorAll('.conv-day-pill');

        // Playback buttons
        const playBtn = document.getElementById('conv-play-btn');
        const playIcon = document.getElementById('conv-play-icon');
        const playText = document.getElementById('conv-play-text');
        const stepBackBtn = document.getElementById('conv-step-back-btn');
        const stepFwdBtn = document.getElementById('conv-step-fwd-btn');
        const resetBtn = document.getElementById('conv-reset-btn');
        const swapBtn = document.getElementById('conv-swap-btn');

        // Slider & labels
        const timeSlider = document.getElementById('conv-time-slider');
        const timeLabel = document.getElementById('conv-time-label');
        const timeValBadge = document.getElementById('conv-time-val');
        const timeMinLabel = document.getElementById('conv-time-min-label');
        const timeMaxLabel = document.getElementById('conv-time-max-label');

        // Legends & readouts
        const tauCursor = document.getElementById('conv-tau-cursor');
        const yCursor = document.getElementById('conv-y-cursor');
        const xLegendText = document.getElementById('conv-x-legend-text');
        const hLegendText = document.getElementById('conv-h-legend-text');

        // Calculation card elements
        const calcCard = document.getElementById('conv-calc-card');
        const calcTitle = document.getElementById('conv-calc-title');
        const calcResultBadge = document.getElementById('conv-calc-result-badge');
        const calcFormula = document.getElementById('conv-calc-formula');
        const calcNotes = document.getElementById('conv-calc-notes');

        // Bottom HUD readouts
        const metricY = document.getElementById('conv-metric-y');
        const metricMax = document.getElementById('conv-metric-max');
        const metricSum = document.getElementById('conv-metric-sum');
        const quickExplanation = document.getElementById('conv-quick-explanation');

        // Simulation State
        let currentPreset = 'medication'; // 'medication', 'rect_rect', 'pulse_decay', 'two_exp', 'impulse'
        let isSwapped = false; // Commutativity test: swap x and h
        let currentTime = 3.0;
        let isPlaying = false;
        let animRafId = null;
        let lastFrameTime = null;
        let isDraggingTau = false;
        let isDraggingTime = false;
        let hoveredTau = null;
        let hoveredTime = null;

        // Definition of Discrete Medication Dosing scenario (from lecture page)
        // x = [1, 2, 3, 4, 5] for days 1..5
        // h = [3, 2, 1] for doses day 1, 2, 3
        const discreteMedData = {
            x: [1, 2, 3, 4, 5],
            xIndices: [1, 2, 3, 4, 5],
            h: [3, 2, 1],
            y: [3, 8, 14, 20, 26, 14, 5],
            yIndices: [1, 2, 3, 4, 5, 6, 7]
        };

        function isDarkTheme() {
            return document.documentElement.getAttribute('data-bs-theme') === 'dark';
        }

        // Scenario Configurations with generous headroom & padding
        function getScenarioConfig(presetKey, swapped) {
            switch (presetKey) {
                case 'medication':
                    return {
                        isDiscrete: true,
                        tMin: 1.0,
                        tMax: 7.0,
                        tStep: 1.0,
                        tauMin: -0.5,
                        tauMax: 7.5,
                        tauYMin: 0.0,
                        tauYMax: 8.5, // 8.5 gives 3.5 units headroom above max height 5 for badges
                        outYMin: 0.0,
                        outYMax: 34.0, // 34 gives 8 units headroom above 26 for badges
                        xName: swapped ? 'h[k] (Regimen)' : 'x[k] (Patients)',
                        hName: swapped ? 'x[n - k] (Patients)' : 'h[n - k] (Regimen)',
                        unit: 'doses'
                    };
                case 'rect_rect':
                    return {
                        isDiscrete: false,
                        tMin: -2.5,
                        tMax: 2.5,
                        tStep: 0.02,
                        tauMin: -3.0,
                        tauMax: 3.0,
                        tauYMin: 0.0,
                        tauYMax: 1.8,
                        outYMin: 0.0,
                        outYMax: 2.8,
                        xName: swapped ? 'h(τ)' : 'x(τ)',
                        hName: swapped ? 'x(t - τ)' : 'h(t - τ)',
                        unit: 'V·s'
                    };
                case 'pulse_decay':
                    return {
                        isDiscrete: false,
                        tMin: -1.0,
                        tMax: 5.5,
                        tStep: 0.02,
                        tauMin: -1.0,
                        tauMax: 5.5,
                        tauYMin: 0.0,
                        tauYMax: 2.2,
                        outYMin: 0.0,
                        outYMax: 2.0,
                        xName: swapped ? 'h(τ)' : 'x(τ) (Infusion)',
                        hName: swapped ? 'x(t - τ)' : 'h(t - τ) (Clearance)',
                        unit: 'mg/mL'
                    };
                case 'two_exp':
                    return {
                        isDiscrete: false,
                        tMin: -0.5,
                        tMax: 5.0,
                        tStep: 0.02,
                        tauMin: -0.5,
                        tauMax: 5.0,
                        tauYMin: 0.0,
                        tauYMax: 2.6,
                        outYMin: 0.0,
                        outYMax: 0.9,
                        xName: swapped ? 'h(τ)' : 'x(τ)',
                        hName: swapped ? 'x(t - τ)' : 'h(t - τ)',
                        unit: 'V'
                    };
                case 'impulse':
                    return {
                        isDiscrete: false,
                        tMin: -1.0,
                        tMax: 4.5,
                        tStep: 0.02,
                        tauMin: -1.0,
                        tauMax: 4.5,
                        tauYMin: 0.0,
                        tauYMax: 3.8,
                        outYMin: 0.0,
                        outYMax: 1.8,
                        xName: swapped ? 'δ(τ)' : 'x(τ)',
                        hName: swapped ? 'x(t - τ)' : 'δ(t - τ)',
                        unit: 'V'
                    };
                default:
                    return getScenarioConfig('medication', false);
            }
        }

        function evalSigX(tau, swapped) {
            if (swapped) {
                return evalSigH_raw(tau);
            }
            return evalSigX_raw(tau);
        }

        function evalSigH_flippedShifted(tau, t, swapped) {
            const tauArg = t - tau;
            if (swapped) {
                return evalSigX_raw(tauArg);
            }
            return evalSigH_raw(tauArg);
        }

        function evalSigX_raw(tau) {
            switch (currentPreset) {
                case 'rect_rect':
                    return (tau >= -1.0 && tau <= 1.0) ? 1.0 : 0.0;
                case 'pulse_decay':
                    return (tau >= 0.0 && tau <= 2.0) ? 1.5 : 0.0;
                case 'two_exp':
                    return tau >= 0.0 ? 2.0 * Math.exp(-tau) : 0.0;
                case 'impulse':
                    return tau >= 0.0 ? 4.0 * tau * Math.exp(-tau * 1.5) : 0.0;
                default:
                    return 0.0;
            }
        }

        function evalSigH_raw(tau) {
            switch (currentPreset) {
                case 'rect_rect':
                    return (tau >= -1.0 && tau <= 1.0) ? 1.0 : 0.0;
                case 'pulse_decay':
                    return tau >= 0.0 ? Math.exp(-tau) : 0.0;
                case 'two_exp':
                    return tau >= 0.0 ? Math.exp(-2.0 * tau) : 0.0;
                case 'impulse': {
                    const sigma = 0.12;
                    return (1.0 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-(tau * tau) / (2 * sigma * sigma));
                }
                default:
                    return 0.0;
            }
        }

        function evalConvOutput(t) {
            switch (currentPreset) {
                case 'rect_rect':
                    if (Math.abs(t) <= 2.0) {
                        return 2.0 - Math.abs(t);
                    }
                    return 0.0;

                case 'pulse_decay':
                    if (t < 0.0) return 0.0;
                    if (t <= 2.0) {
                        return 1.5 * (1.0 - Math.exp(-t));
                    }
                    return 1.5 * (1.0 - Math.exp(-2.0)) * Math.exp(-(t - 2.0));

                case 'two_exp':
                    if (t < 0.0) return 0.0;
                    return 2.0 * (Math.exp(-t) - Math.exp(-2.0 * t));

                case 'impulse': {
                    if (t < 0.0) return 0.0;
                    return 4.0 * t * Math.exp(-t * 1.5);
                }

                default:
                    return 0.0;
            }
        }

        function getDiscreteState(nVal) {
            const n = Math.round(Math.max(1, Math.min(7, nVal)));
            const terms = [];
            let sum = 0;

            if (!isSwapped) {
                // Fixed: x[k] for k in 1..5.
                // Sliding: h[n - k] for (n - k) in 0..2.
                for (let k = 1; k <= 5; k++) {
                    const hIndex = n - k;
                    if (hIndex >= 0 && hIndex <= 2) {
                        const patCount = discreteMedData.x[k - 1];
                        const doseRegimen = discreteMedData.h[hIndex];
                        const prod = patCount * doseRegimen;
                        terms.push({
                            k: k,
                            xVal: patCount,
                            hIndex: hIndex,
                            hVal: doseRegimen,
                            prod: prod
                        });
                        sum += prod;
                    }
                }
            } else {
                // Swapped: Fixed is h[k] for k in 0..2.
                // Sliding is x[n - k] for (n - k) in 1..5 => xIndex = n - k.
                for (let k = 0; k <= 2; k++) {
                    const xIndex = n - k;
                    if (xIndex >= 1 && xIndex <= 5) {
                        const doseRegimen = discreteMedData.h[k];
                        const patCount = discreteMedData.x[xIndex - 1];
                        const prod = doseRegimen * patCount;
                        terms.push({
                            k: k,
                            xVal: patCount,
                            hIndex: k,
                            hVal: doseRegimen,
                            prod: prod
                        });
                        sum += prod;
                    }
                }
            }

            return {
                day: n,
                terms: terms,
                output: sum,
                yArray: discreteMedData.y,
                accumulated: discreteMedData.y.slice(0, n).reduce((a, b) => a + b, 0)
            };
        }

        // Coordinate transforms
        function tToX(t, width, minT, maxT) {
            return ((t - minT) / (maxT - minT)) * width;
        }

        function xToT(x, width, minT, maxT) {
            return minT + (x / width) * (maxT - minT);
        }

        function vToY(v, height, minV, maxV) {
            return height - ((v - minV) / (maxV - minV)) * height;
        }

        function yToV(y, height, minV, maxV) {
            return minV + ((height - y) / height) * (maxV - minV);
        }

        // Responsive canvas resize
        function resizeCanvases() {
            const dpr = window.devicePixelRatio || 1;
            [tauCanvas, timeCanvas].forEach(c => {
                if (!c || c.offsetParent === null) return;
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

        // Helper to draw pill badges with text on canvas
        function drawPillBadge(ctx, text, x, y, bg, border, textColor, fontSize, isBold) {
            ctx.save();
            ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px monospace`;
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width;
            const padX = 6;
            const padY = 4;
            const w = textWidth + padX * 2;
            const h = fontSize + padY * 2;
            const rx = x - w / 2;
            const ry = y - h / 2;
            const radius = 4;

            ctx.fillStyle = bg;
            ctx.strokeStyle = border;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(rx, ry, w, h, radius) : ctx.rect(rx, ry, w, h);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, y + 1);
            ctx.restore();
        }

        // Draw clean, high-contrast grid and axes
        function drawGrid(ctx, width, height, minX, maxX, minY, maxY, dark, xLabel, yLabel) {
            ctx.clearRect(0, 0, width, height);

            ctx.fillStyle = dark ? '#1e2124' : '#ffffff';
            ctx.fillRect(0, 0, width, height);

            // Minor grid
            ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            const xStepMinor = (maxX - minX) > 6 ? 1.0 : 0.5;
            for (let x = Math.ceil(minX / xStepMinor) * xStepMinor; x <= maxX; x += xStepMinor) {
                const px = tToX(x, width, minX, maxX);
                ctx.moveTo(px, 0);
                ctx.lineTo(px, height);
            }
            const yStepMinor = (maxY - minY) > 10 ? 5.0 : 0.5;
            for (let y = Math.ceil(minY / yStepMinor) * yStepMinor; y <= maxY; y += yStepMinor) {
                const py = vToY(y, height, minY, maxY);
                ctx.moveTo(0, py);
                ctx.lineTo(width, py);
            }
            ctx.stroke();

            // Major grid
            ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.10)';
            ctx.beginPath();
            const xStepMajor = (maxX - minX) > 6 ? 2.0 : 1.0;
            for (let x = Math.ceil(minX / xStepMajor) * xStepMajor; x <= maxX; x += xStepMajor) {
                const px = tToX(x, width, minX, maxX);
                ctx.moveTo(px, 0);
                ctx.lineTo(px, height);
            }
            const yStepMajor = (maxY - minY) > 10 ? 10.0 : 1.0;
            for (let y = Math.ceil(minY / yStepMajor) * yStepMajor; y <= maxY; y += yStepMajor) {
                const py = vToY(y, height, minY, maxY);
                ctx.moveTo(0, py);
                ctx.lineTo(width, py);
            }
            ctx.stroke();

            // Zero axes
            const zeroX = tToX(0, width, minX, maxX);
            const zeroY = vToY(0, height, minY, maxY);

            ctx.strokeStyle = dark ? '#adb5bd' : '#495057';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            if (zeroX >= 0 && zeroX <= width) {
                ctx.moveTo(zeroX, 0);
                ctx.lineTo(zeroX, height);
            }
            if (zeroY >= 0 && zeroY <= height) {
                ctx.moveTo(0, zeroY);
                ctx.lineTo(width, zeroY);
            }
            ctx.stroke();

            // Axis tick labels
            ctx.fillStyle = dark ? '#f8f9fa' : '#212529';
            ctx.font = 'bold 12px "SourceSansPro", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            const tickBaseY = (zeroY >= 20 && zeroY <= height - 20) ? zeroY + 6 : height - 18;
            for (let x = Math.ceil(minX / xStepMajor) * xStepMajor; x <= maxX; x += xStepMajor) {
                if (Math.abs(x) < 0.01 && zeroX >= 20 && zeroX <= width - 20) continue;
                ctx.fillText(x.toFixed(0), tToX(x, width, minX, maxX), tickBaseY);
            }

            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const tickBaseX = (zeroX >= 28 && zeroX <= width - 20) ? zeroX - 6 : 28;
            for (let y = Math.ceil(minY / yStepMajor) * yStepMajor; y <= maxY; y += yStepMajor) {
                if (Math.abs(y) < 0.01) continue;
                ctx.fillText(y.toFixed(0), tickBaseX, vToY(y, height, minY, maxY));
            }

            // Axis Title Labels
            ctx.font = 'bold 12px "SourceSansPro", sans-serif';
            ctx.textAlign = 'right';
            ctx.fillStyle = dark ? '#cbd5e1' : '#334155';
            ctx.fillText(xLabel, width - 10, tickBaseY - 16);
            ctx.textAlign = 'left';
            ctx.fillText(yLabel, tickBaseX + 8, 14);
        }

        // Draw Canvas 1: Flip & Slide (Tau / k domain)
        function drawTauCanvas() {
            const width = tauCanvas.getBoundingClientRect().width;
            const height = tauCanvas.getBoundingClientRect().height;
            const dark = isDarkTheme();
            const cfg = getScenarioConfig(currentPreset, isSwapped);

            drawGrid(
                tauCtx, width, height,
                cfg.tauMin, cfg.tauMax, cfg.tauYMin, cfg.tauYMax,
                dark,
                cfg.isDiscrete ? 'Day / Index k' : 'Dummy Variable τ (s)',
                'Amplitude'
            );

            const zeroY = vToY(0, height, cfg.tauYMin, cfg.tauYMax);

            if (cfg.isDiscrete) {
                const discState = getDiscreteState(currentTime);
                const currentDayInt = Math.round(currentTime);
                const isDayExact = !isPlaying || Math.abs(currentTime - currentDayInt) < 0.35;

                // 1. Draw Overlap Columns first
                if (isDayExact) {
                    discState.terms.forEach(term => {
                        const px = tToX(term.k, width, cfg.tauMin, cfg.tauMax);
                        const maxH = Math.max(term.xVal, term.hVal);
                        const pyTop = vToY(maxH, height, cfg.tauYMin, cfg.tauYMax);
                        const colW = 38;

                        tauCtx.save();
                        tauCtx.fillStyle = 'rgba(25, 135, 84, 0.16)';
                        tauCtx.fillRect(px - colW / 2, pyTop - 4, colW, zeroY - pyTop + 4);

                        tauCtx.strokeStyle = 'rgba(25, 135, 84, 0.6)';
                        tauCtx.lineWidth = 1.5;
                        tauCtx.setLineDash([3, 2]);
                        tauCtx.strokeRect(px - colW / 2, pyTop - 4, colW, zeroY - pyTop + 4);
                        tauCtx.restore();

                        // High-contrast Overlap Product Badge ABOVE the column
                        const prodBadgeY = pyTop - 28;
                        drawPillBadge(
                            tauCtx,
                            `${term.hVal}×${term.xVal} = ${term.prod}`,
                            px,
                            prodBadgeY,
                            '#198754',
                            '#146c43',
                            '#ffffff',
                            12,
                            true
                        );
                    });
                }

                if (!isSwapped) {
                    // 2. Fixed Input Signal stems x[k] (Patients per day) at (k - 0.12)
                    const xArr = [1, 2, 3, 4, 5];
                    for (let k = 1; k <= 5; k++) {
                        const val = xArr[k - 1];
                        const stemK = k - 0.12;
                        const px = tToX(stemK, width, cfg.tauMin, cfg.tauMax);
                        const py = vToY(val, height, cfg.tauYMin, cfg.tauYMax);

                        tauCtx.save();
                        tauCtx.strokeStyle = '#0d6efd';
                        tauCtx.lineWidth = 3.5;
                        tauCtx.beginPath();
                        tauCtx.moveTo(px, zeroY);
                        tauCtx.lineTo(px, py);
                        tauCtx.stroke();

                        tauCtx.fillStyle = '#0d6efd';
                        tauCtx.beginPath();
                        tauCtx.arc(px, py, 5.0, 0, Math.PI * 2);
                        tauCtx.fill();
                        tauCtx.strokeStyle = '#ffffff';
                        tauCtx.lineWidth = 1.5;
                        tauCtx.stroke();
                        tauCtx.restore();

                        drawPillBadge(
                            tauCtx,
                            `x=${val}`,
                            px,
                            py - 12,
                            dark ? '#1e293b' : '#ffffff',
                            '#0d6efd',
                            '#0d6efd',
                            11,
                            true
                        );
                    }

                    // 3. Flipped & Sliding Impulse Response stems h[n - k] at (k + 0.12)
                    const hVals = [3, 2, 1];
                    for (let m = 0; m <= 2; m++) {
                        const dose = hVals[m];
                        const stemK = (currentTime - m) + 0.12;
                        const px = tToX(stemK, width, cfg.tauMin, cfg.tauMax);
                        const py = vToY(dose, height, cfg.tauYMin, cfg.tauYMax);

                        tauCtx.save();
                        tauCtx.strokeStyle = '#ff5f05';
                        tauCtx.lineWidth = 3.0;
                        tauCtx.setLineDash([4, 3]);
                        tauCtx.beginPath();
                        tauCtx.moveTo(px, zeroY);
                        tauCtx.lineTo(px, py);
                        tauCtx.stroke();

                        tauCtx.fillStyle = '#ff5f05';
                        tauCtx.fillRect(px - 5, py - 5, 10, 10);
                        tauCtx.strokeStyle = '#ffffff';
                        tauCtx.lineWidth = 1.5;
                        tauCtx.strokeRect(px - 5, py - 5, 10, 10);
                        tauCtx.restore();

                        drawPillBadge(
                            tauCtx,
                            `h=${dose}`,
                            px,
                            py - 12,
                            dark ? '#2a1a15' : '#ffffff',
                            '#ff5f05',
                            '#ff5f05',
                            11,
                            true
                        );
                    }
                } else {
                    // Swapped mode: Fixed is h[k] at k = 0, 1, 2
                    const hVals = [3, 2, 1];
                    for (let k = 0; k <= 2; k++) {
                        const dose = hVals[k];
                        const stemK = k - 0.12;
                        const px = tToX(stemK, width, cfg.tauMin, cfg.tauMax);
                        const py = vToY(dose, height, cfg.tauYMin, cfg.tauYMax);

                        tauCtx.save();
                        tauCtx.strokeStyle = '#0d6efd';
                        tauCtx.lineWidth = 3.5;
                        tauCtx.beginPath();
                        tauCtx.moveTo(px, zeroY);
                        tauCtx.lineTo(px, py);
                        tauCtx.stroke();

                        tauCtx.fillStyle = '#0d6efd';
                        tauCtx.beginPath();
                        tauCtx.arc(px, py, 5.0, 0, Math.PI * 2);
                        tauCtx.fill();
                        tauCtx.strokeStyle = '#ffffff';
                        tauCtx.lineWidth = 1.5;
                        tauCtx.stroke();
                        tauCtx.restore();

                        drawPillBadge(
                            tauCtx,
                            `h=${dose}`,
                            px,
                            py - 12,
                            dark ? '#1e293b' : '#ffffff',
                            '#0d6efd',
                            '#0d6efd',
                            11,
                            true
                        );
                    }

                    // Sliding is x[n - k] for p = 1..5: position stemK = (currentTime - p) + 0.12
                    const xArr = [1, 2, 3, 4, 5];
                    for (let p = 1; p <= 5; p++) {
                        const pat = xArr[p - 1];
                        const stemK = (currentTime - p) + 0.12;
                        const px = tToX(stemK, width, cfg.tauMin, cfg.tauMax);
                        const py = vToY(pat, height, cfg.tauYMin, cfg.tauYMax);

                        tauCtx.save();
                        tauCtx.strokeStyle = '#ff5f05';
                        tauCtx.lineWidth = 3.0;
                        tauCtx.setLineDash([4, 3]);
                        tauCtx.beginPath();
                        tauCtx.moveTo(px, zeroY);
                        tauCtx.lineTo(px, py);
                        tauCtx.stroke();

                        tauCtx.fillStyle = '#ff5f05';
                        tauCtx.fillRect(px - 5, py - 5, 10, 10);
                        tauCtx.strokeStyle = '#ffffff';
                        tauCtx.lineWidth = 1.5;
                        tauCtx.strokeRect(px - 5, py - 5, 10, 10);
                        tauCtx.restore();

                        drawPillBadge(
                            tauCtx,
                            `x=${pat}`,
                            px,
                            py - 12,
                            dark ? '#2a1a15' : '#ffffff',
                            '#ff5f05',
                            '#ff5f05',
                            11,
                            true
                        );
                    }
                }

                // Slide Marker Arrow
                const shiftPx = tToX(currentTime, width, cfg.tauMin, cfg.tauMax);
                tauCtx.save();
                tauCtx.fillStyle = '#ff5f05';
                tauCtx.beginPath();
                tauCtx.moveTo(shiftPx, zeroY + 2);
                tauCtx.lineTo(shiftPx - 6, zeroY + 12);
                tauCtx.lineTo(shiftPx + 6, zeroY + 12);
                tauCtx.closePath();
                tauCtx.fill();
                tauCtx.restore();

            } else {
                // Continuous Mode
                const numPts = Math.round(width * 1.5);
                const step = (cfg.tauMax - cfg.tauMin) / numPts;

                // 1. Shaded Overlap
                tauCtx.save();
                tauCtx.fillStyle = 'rgba(25, 135, 84, 0.35)';
                tauCtx.beginPath();
                tauCtx.moveTo(0, zeroY);

                for (let i = 0; i <= numPts; i++) {
                    const tau = cfg.tauMin + i * step;
                    const px = tToX(tau, width, cfg.tauMin, cfg.tauMax);
                    const vX = evalSigX(tau, isSwapped);
                    const vH = evalSigH_flippedShifted(tau, currentTime, isSwapped);
                    const prod = Math.min(vX, vH);
                    const py = vToY(prod, height, cfg.tauYMin, cfg.tauYMax);

                    if (prod > 0.005) {
                        tauCtx.lineTo(px, py);
                    } else {
                        tauCtx.lineTo(px, zeroY);
                    }
                }
                tauCtx.lineTo(width, zeroY);
                tauCtx.closePath();
                tauCtx.fill();
                tauCtx.restore();

                // 2. Fixed Input x(tau)
                tauCtx.save();
                tauCtx.strokeStyle = '#0d6efd';
                tauCtx.lineWidth = 3.5;
                tauCtx.beginPath();
                for (let i = 0; i <= numPts; i++) {
                    const tau = cfg.tauMin + i * step;
                    const px = tToX(tau, width, cfg.tauMin, cfg.tauMax);
                    const val = evalSigX(tau, isSwapped);
                    const py = vToY(val, height, cfg.tauYMin, cfg.tauYMax);
                    if (i === 0) tauCtx.moveTo(px, py);
                    else tauCtx.lineTo(px, py);
                }
                tauCtx.stroke();
                tauCtx.restore();

                // 3. Sliding h(t - tau)
                tauCtx.save();
                tauCtx.strokeStyle = '#ff5f05';
                tauCtx.lineWidth = 3.0;
                tauCtx.setLineDash([5, 4]);
                tauCtx.beginPath();
                for (let i = 0; i <= numPts; i++) {
                    const tau = cfg.tauMin + i * step;
                    const px = tToX(tau, width, cfg.tauMin, cfg.tauMax);
                    const val = evalSigH_flippedShifted(tau, currentTime, isSwapped);
                    const py = vToY(val, height, cfg.tauYMin, cfg.tauYMax);
                    if (i === 0) tauCtx.moveTo(px, py);
                    else tauCtx.lineTo(px, py);
                }
                tauCtx.stroke();
                tauCtx.restore();

                // 4. Center Line
                const centerPx = tToX(currentTime, width, cfg.tauMin, cfg.tauMax);
                tauCtx.save();
                tauCtx.strokeStyle = '#ff5f05';
                tauCtx.lineWidth = 1.5;
                tauCtx.setLineDash([3, 3]);
                tauCtx.beginPath();
                tauCtx.moveTo(centerPx, 0);
                tauCtx.lineTo(centerPx, height);
                tauCtx.stroke();

                tauCtx.fillStyle = '#ff5f05';
                tauCtx.beginPath();
                tauCtx.arc(centerPx, zeroY, 5, 0, Math.PI * 2);
                tauCtx.fill();
                tauCtx.restore();
            }

            // Hover indicator
            if (hoveredTau !== null) {
                const hx = tToX(hoveredTau, width, cfg.tauMin, cfg.tauMax);
                tauCtx.save();
                tauCtx.strokeStyle = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)';
                tauCtx.lineWidth = 1.2;
                tauCtx.setLineDash([2, 2]);
                tauCtx.beginPath();
                tauCtx.moveTo(hx, 0);
                tauCtx.lineTo(hx, height);
                tauCtx.stroke();
                tauCtx.restore();
            }
        }

        // Draw Canvas 2: Convolution Output y(t) or y[n]
        function drawTimeCanvas() {
            const width = timeCanvas.getBoundingClientRect().width;
            const height = timeCanvas.getBoundingClientRect().height;
            const dark = isDarkTheme();
            const cfg = getScenarioConfig(currentPreset, isSwapped);

            drawGrid(
                timeCtx, width, height,
                cfg.tMin, cfg.tMax, cfg.outYMin, cfg.outYMax,
                dark,
                cfg.isDiscrete ? 'Day n' : 'Time t (s)',
                'Output y'
            );

            const zeroY = vToY(0, height, cfg.outYMin, cfg.outYMax);

            if (cfg.isDiscrete) {
                const discState = getDiscreteState(currentTime);
                const activeDay = discState.day;

                discreteMedData.yIndices.forEach((dayIdx, i) => {
                    const yVal = discreteMedData.y[i];
                    const px = tToX(dayIdx, width, cfg.tMin, cfg.tMax);
                    const py = vToY(yVal, height, cfg.outYMin, cfg.outYMax);
                    const isReached = dayIdx <= activeDay;
                    const isActive = dayIdx === activeDay;

                    // Stem line
                    timeCtx.save();
                    timeCtx.strokeStyle = isActive ? '#198754' : (isReached ? '#0d6efd' : '#64748b');
                    timeCtx.lineWidth = isActive ? 4.5 : 2.5;
                    timeCtx.beginPath();
                    timeCtx.moveTo(px, zeroY);
                    timeCtx.lineTo(px, py);
                    timeCtx.stroke();

                    // Stem head circle
                    timeCtx.fillStyle = isActive ? '#198754' : (isReached ? '#0d6efd' : '#64748b');
                    timeCtx.beginPath();
                    timeCtx.arc(px, py, isActive ? 8.0 : 5.0, 0, Math.PI * 2);
                    timeCtx.fill();
                    timeCtx.strokeStyle = '#ffffff';
                    timeCtx.lineWidth = 2.0;
                    timeCtx.stroke();

                    if (isActive) {
                        timeCtx.strokeStyle = 'rgba(25, 135, 84, 0.45)';
                        timeCtx.lineWidth = 8.0;
                        timeCtx.stroke();
                    }
                    timeCtx.restore();

                    // High-contrast value badge above every stem
                    if (isActive) {
                        drawPillBadge(
                            timeCtx,
                            `Day ${dayIdx}: ${yVal} doses`,
                            px,
                            py - 18,
                            '#198754',
                            '#146c43',
                            '#ffffff',
                            13,
                            true
                        );
                    } else {
                        drawPillBadge(
                            timeCtx,
                            `${yVal}`,
                            px,
                            py - 12,
                            dark ? '#1e293b' : '#ffffff',
                            isReached ? '#0d6efd' : '#94a3b8',
                            isReached ? '#0d6efd' : (dark ? '#e2e8f0' : '#334155'),
                            12,
                            true
                        );
                    }
                });

            } else {
                // Continuous Mode
                const numPts = Math.round(width * 1.5);
                const step = (cfg.tMax - cfg.tMin) / numPts;

                // 1. Ghost preview
                timeCtx.save();
                timeCtx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)';
                timeCtx.lineWidth = 2.0;
                timeCtx.setLineDash([4, 4]);
                timeCtx.beginPath();
                for (let i = 0; i <= numPts; i++) {
                    const t = cfg.tMin + i * step;
                    const px = tToX(t, width, cfg.tMin, cfg.tMax);
                    const val = evalConvOutput(t);
                    const py = vToY(val, height, cfg.outYMin, cfg.outYMax);
                    if (i === 0) timeCtx.moveTo(px, py);
                    else timeCtx.lineTo(px, py);
                }
                timeCtx.stroke();
                timeCtx.restore();

                // 2. Solid Trailing Curve
                timeCtx.save();
                timeCtx.strokeStyle = '#198754';
                timeCtx.lineWidth = 4.0;
                timeCtx.beginPath();
                let started = false;
                for (let i = 0; i <= numPts; i++) {
                    const t = cfg.tMin + i * step;
                    if (t > currentTime) break;
                    const px = tToX(t, width, cfg.tMin, cfg.tMax);
                    const val = evalConvOutput(t);
                    const py = vToY(val, height, cfg.outYMin, cfg.outYMax);
                    if (!started) {
                        timeCtx.moveTo(px, py);
                        started = true;
                    } else {
                        timeCtx.lineTo(px, py);
                    }
                }
                timeCtx.stroke();
                timeCtx.restore();

                // 3. Current active point
                const currentVal = evalConvOutput(currentTime);
                const curPx = tToX(currentTime, width, cfg.tMin, cfg.tMax);
                const curPy = vToY(currentVal, height, cfg.outYMin, cfg.outYMax);

                timeCtx.save();
                timeCtx.strokeStyle = '#ff5f05';
                timeCtx.lineWidth = 2.0;
                timeCtx.setLineDash([3, 3]);
                timeCtx.beginPath();
                timeCtx.moveTo(curPx, zeroY);
                timeCtx.lineTo(curPx, curPy);
                timeCtx.stroke();

                timeCtx.fillStyle = 'rgba(255, 95, 5, 0.3)';
                timeCtx.beginPath();
                timeCtx.arc(curPx, curPy, 11, 0, Math.PI * 2);
                timeCtx.fill();

                timeCtx.fillStyle = '#ff5f05';
                timeCtx.beginPath();
                timeCtx.arc(curPx, curPy, 6, 0, Math.PI * 2);
                timeCtx.fill();
                timeCtx.strokeStyle = '#ffffff';
                timeCtx.lineWidth = 2.5;
                timeCtx.stroke();
                timeCtx.restore();

                const badgeLabel = `y(${currentTime.toFixed(2)}) = ${currentVal.toFixed(2)}`;
                const tagX = curPx > width - 110 ? curPx - 65 : curPx + 65;
                drawPillBadge(
                    timeCtx,
                    badgeLabel,
                    tagX,
                    curPy - 14,
                    '#ff5f05',
                    '#d94e04',
                    '#ffffff',
                    12,
                    true
                );
            }

            // Hover indicator
            if (hoveredTime !== null) {
                const hx = tToX(hoveredTime, width, cfg.tMin, cfg.tMax);
                timeCtx.save();
                timeCtx.strokeStyle = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)';
                timeCtx.lineWidth = 1.2;
                timeCtx.setLineDash([2, 2]);
                timeCtx.beginPath();
                timeCtx.moveTo(hx, 0);
                timeCtx.lineTo(hx, height);
                timeCtx.stroke();
                timeCtx.restore();
            }
        }

        function drawAll() {
            drawTauCanvas();
            drawTimeCanvas();
            updateTelemetryAndDiagnostics();
        }

        function updateTelemetryAndDiagnostics() {
            const cfg = getScenarioConfig(currentPreset, isSwapped);

            // Update Mode Badge
            if (cfg.isDiscrete) {
                modeBadge.textContent = isSwapped ? 'Discrete (Swapped h * x)' : 'Discrete Mode';
                modeBadge.className = 'badge bg-primary text-white px-2 py-1 fs-6';
                discreteDayPillsContainer.classList.remove('d-none');
                continuousStepBadge.classList.add('d-none');
            } else {
                modeBadge.textContent = isSwapped ? 'Continuous (Swapped h * x)' : 'Continuous Mode';
                modeBadge.className = 'badge bg-info text-dark px-2 py-1 fs-6 fw-bold';
                discreteDayPillsContainer.classList.add('d-none');
                continuousStepBadge.classList.remove('d-none');
            }

            // Update Time Slider & Label
            timeLabel.innerHTML = cfg.isDiscrete ? 'Day Shift (<em>n</em>):' : 'Shift Parameter (<em>t</em>):';
            timeValBadge.textContent = cfg.isDiscrete ? `Day n = ${Math.round(currentTime)}` : `t = ${currentTime.toFixed(2)} s`;

            timeSlider.min = cfg.tMin;
            timeSlider.max = cfg.tMax;
            timeSlider.step = cfg.tStep;
            timeSlider.value = currentTime;
            timeMinLabel.textContent = cfg.isDiscrete ? `Day 1` : `${cfg.tMin.toFixed(1)}s`;
            timeMaxLabel.textContent = cfg.isDiscrete ? `Day 7` : `${cfg.tMax.toFixed(1)}s`;

            // Update Discrete Day Pills
            if (cfg.isDiscrete) {
                const activeDayInt = Math.round(currentTime);
                dayPills.forEach(pill => {
                    const day = parseInt(pill.getAttribute('data-day'));
                    if (day === activeDayInt) {
                        pill.classList.add('active', 'btn-primary', 'fw-bold');
                        pill.classList.remove('btn-outline-primary');
                    } else {
                        pill.classList.remove('active', 'btn-primary', 'fw-bold');
                        pill.classList.add('btn-outline-primary');
                    }
                });
            }

            xLegendText.textContent = cfg.xName;
            hLegendText.textContent = cfg.hName;

            if (cfg.isDiscrete) {
                const discState = getDiscreteState(currentTime);
                const day = discState.day;

                calcTitle.textContent = isSwapped
                    ? `Day ${day} Swapped (h * x) Dosing Breakdown:`
                    : `Day ${day} Medication Convolution Breakdown:`;
                calcResultBadge.textContent = `${discState.output} doses`;

                if (discState.terms.length > 0) {
                    const sortedTerms = [...discState.terms].sort((a, b) => b.hVal - a.hVal);
                    const termsStr = sortedTerms
                        .map(t => `(<span class="text-danger fw-bold">${t.hVal}</span> &times; <span class="text-primary fw-bold">${t.xVal}</span>)`)
                        .join(' + ');

                    if (sortedTerms.length > 1) {
                        const prodStr = sortedTerms.map(t => `${t.prod}`).join(' + ');
                        calcFormula.innerHTML = `<strong>Day ${day}:</strong> ${termsStr} &nbsp;=&nbsp; ${prodStr} &nbsp;=&nbsp; <strong class="text-success fs-5">${discState.output} doses</strong>`;
                    } else {
                        calcFormula.innerHTML = `<strong>Day ${day}:</strong> ${termsStr} &nbsp;=&nbsp; <strong class="text-success fs-5">${discState.output} doses</strong>`;
                    }
                } else {
                    calcFormula.innerHTML = `<strong>Day ${day}:</strong> No overlapping patients and regimen = <strong class="text-secondary fs-5">0 doses</strong>`;
                }

                calcNotes.innerHTML = `Total medicine administered through Day 1–${day}: <strong class="text-primary">${discState.accumulated} doses</strong> &bull; Entire 7-day week total = <strong class="text-dark">${discState.yArray.reduce((a,b)=>a+b, 0)} doses</strong>.`;

                metricY.textContent = `${discState.output} doses`;
                metricMax.textContent = `26 doses (Day 5)`;
                metricSum.textContent = `${discState.accumulated} doses`;

                if (day === 5) {
                    statusBadge.textContent = 'Peak Dosing Day';
                    statusBadge.className = 'badge bg-danger text-white px-2 py-1 fs-6 fw-bold';
                    quickExplanation.textContent = 'Day 5: Maximum patient load and dosing overlap (26 doses).';
                } else if (day >= 1 && day <= 7) {
                    statusBadge.textContent = `Active Dosing (Day ${day})`;
                    statusBadge.className = 'badge bg-success text-white px-2 py-1 fs-6 fw-bold';
                    quickExplanation.textContent = `Day ${day}: Patients from preceding days receive multi-day regimen doses.`;
                } else {
                    statusBadge.textContent = 'No Overlap';
                    statusBadge.className = 'badge bg-secondary text-white px-2 py-1 fs-6';
                    quickExplanation.textContent = 'No medications administered.';
                }

            } else {
                const curY = evalConvOutput(currentTime);
                metricY.textContent = `${curY.toFixed(2)} ${cfg.unit}`;

                let maxVal = 0;
                for (let t = cfg.tMin; t <= cfg.tMax; t += 0.05) {
                    const v = evalConvOutput(t);
                    if (v > maxVal) maxVal = v;
                }
                metricMax.textContent = `${maxVal.toFixed(2)} ${cfg.unit}`;
                metricSum.textContent = `Continuous`;

                calcResultBadge.textContent = `y(${currentTime.toFixed(2)}) = ${curY.toFixed(2)}`;

                if (currentPreset === 'rect_rect') {
                    calcTitle.textContent = 'Continuous Integration Overlap Area:';
                    if (Math.abs(currentTime) > 2.0) {
                        statusBadge.textContent = 'Separated: Zero Overlap';
                        statusBadge.className = 'badge bg-secondary text-white px-2 py-1 fs-6';
                        calcFormula.innerHTML = `&int; x(&tau;) h(${currentTime.toFixed(2)} &minus; &tau;) d&tau; = <strong class="text-secondary fs-5">0.00</strong> (Signals do not touch)`;
                        calcNotes.textContent = 'Rectangles are separated; the pointwise product is identically zero.';
                        quickExplanation.textContent = 'No overlap: output y(t) = 0.';
                    } else if (currentTime < 0) {
                        statusBadge.textContent = 'Entering: Rising Overlap';
                        statusBadge.className = 'badge bg-primary text-white px-2 py-1 fs-6 fw-bold';
                        calcFormula.innerHTML = `&int; x(&tau;) h(t &minus; &tau;) d&tau; = 2.0 + (${currentTime.toFixed(2)}) = <strong class="text-success fs-5">${(2.0 + currentTime).toFixed(2)}</strong>`;
                        calcNotes.textContent = 'Linear ramp up as the sliding rectangle enters the stationary rectangle.';
                        quickExplanation.textContent = 'Entering overlap: Area expands linearly.';
                    } else if (Math.abs(currentTime) < 0.05) {
                        statusBadge.textContent = 'Full Alignment: Peak Triangle';
                        statusBadge.className = 'badge bg-danger text-white px-2 py-1 fs-6 fw-bold';
                        calcFormula.innerHTML = `&int;_{-1}^{1} (1.0 &times; 1.0) d&tau; = <strong class="text-danger fs-5">2.00</strong> (Maximum Coincidence)`;
                        calcNotes.textContent = 'The two identical rectangles perfectly coincide, yielding maximum area.';
                        quickExplanation.textContent = 'Perfect coincidence: peak value y(0) = 2.0.';
                    } else {
                        statusBadge.textContent = 'Exiting: Falling Overlap';
                        statusBadge.className = 'badge bg-warning text-dark px-2 py-1 fs-6 fw-bold';
                        calcFormula.innerHTML = `&int; x(&tau;) h(t &minus; &tau;) d&tau; = 2.0 &minus; (${currentTime.toFixed(2)}) = <strong class="text-success fs-5">${(2.0 - currentTime).toFixed(2)}</strong>`;
                        calcNotes.textContent = 'Linear ramp down as the sliding rectangle exits.';
                        quickExplanation.textContent = 'Exiting overlap: Area contracts linearly.';
                    }

                } else if (currentPreset === 'pulse_decay') {
                    calcTitle.textContent = 'Pharmacokinetics (Infusion & Elimination):';
                    if (currentTime < 0.0) {
                        statusBadge.textContent = 'Pre-Infusion';
                        statusBadge.className = 'badge bg-secondary text-white px-2 py-1 fs-6';
                        calcFormula.innerHTML = `Drug concentration = <strong class="text-secondary fs-5">0.00 mg/mL</strong> (Infusion has not started)`;
                        calcNotes.textContent = 'Baseline bloodstream concentration prior to drug administration.';
                        quickExplanation.textContent = 't < 0: No drug in bloodstream.';
                    } else if (currentTime <= 2.0) {
                        statusBadge.textContent = 'Constant Infusion Phase';
                        statusBadge.className = 'badge bg-success text-white px-2 py-1 fs-6 fw-bold';
                        calcFormula.innerHTML = `y(t) = 1.5 &times; (1 &minus; e^{-${currentTime.toFixed(2)}}) = <strong class="text-success fs-5">${curY.toFixed(2)} mg/mL</strong>`;
                        calcNotes.textContent = 'Active IV infusion: Drug accumulates toward steady state.';
                        quickExplanation.textContent = 'Accumulation phase: Infusion rate exceeds systemic clearance rate.';
                    } else {
                        statusBadge.textContent = 'Elimination / Clearance Phase';
                        statusBadge.className = 'badge bg-info text-dark px-2 py-1 fs-6 fw-bold';
                        calcFormula.innerHTML = `y(t) = 1.30 &times; e^{-(t &minus; 2.0)} = <strong class="text-success fs-5">${curY.toFixed(2)} mg/mL</strong>`;
                        calcNotes.textContent = 'Infusion ended at t = 2.0s: Drug is cleared via first-order metabolism.';
                        quickExplanation.textContent = 'Washout phase: Pure exponential clearance.';
                    }

                } else if (currentPreset === 'two_exp') {
                    calcTitle.textContent = 'Cascaded First-Order Response:';
                    calcFormula.innerHTML = `y(t) = 2 &times; [e^{-t} &minus; e^{-2t}] = <strong class="text-success fs-5">${curY.toFixed(3)} V</strong>`;
                    calcNotes.textContent = 'Typical rise and exponential decay seen in bioelectric biosensors and tracer kinetics.';
                    quickExplanation.textContent = `Output peaks at t = ln(2) ≈ 0.69s.`;
                    statusBadge.textContent = currentTime < 0.7 ? 'Rising Overlap' : 'Decaying Tail';
                    statusBadge.className = 'badge bg-primary text-white px-2 py-1 fs-6 fw-bold';

                } else if (currentPreset === 'impulse') {
                    calcTitle.textContent = 'Sifting Property of Impulse Response:';
                    calcFormula.innerHTML = `&int; x(&tau;) &times; &delta;(t &minus; &tau;) d&tau; = x(t) = <strong class="text-success fs-5">${curY.toFixed(2)} V</strong>`;
                    calcNotes.textContent = 'Convolving any arbitrary signal with an impulse δ(t) perfectly reproduces the original signal!';
                    quickExplanation.textContent = 'Identity property: x(t) * δ(t) = x(t).';
                    statusBadge.textContent = 'Sifting Property Active';
                    statusBadge.className = 'badge bg-success text-white px-2 py-1 fs-6 fw-bold';
                }
            }
        }

        function applyPreset(presetKey) {
            currentPreset = presetKey;
            isSwapped = false;
            swapBtn.classList.remove('btn-primary', 'text-white');
            swapBtn.classList.add('btn-outline-primary');

            const cfg = getScenarioConfig(presetKey, isSwapped);
            currentTime = cfg.isDiscrete ? 3.0 : 0.0;

            if (isPlaying) stopAnimation();
            drawAll();
        }

        function startAnimation() {
            isPlaying = true;
            playIcon.className = 'bi bi-pause-fill fs-6';
            playText.textContent = 'Pause';
            playBtn.classList.remove('btn-outline-success');
            playBtn.classList.add('btn-warning');

            const cfg = getScenarioConfig(currentPreset, isSwapped);
            if (currentTime >= cfg.tMax - 0.1) {
                currentTime = cfg.tMin;
            }
            lastFrameTime = performance.now();

            function frame(now) {
                if (!isPlaying) return;
                const dt = (now - lastFrameTime) / 1000.0;
                lastFrameTime = now;

                const cfg = getScenarioConfig(currentPreset, isSwapped);
                const totalDuration = cfg.tMax - cfg.tMin;
                const speed = totalDuration / 7.0;

                currentTime += speed * dt;
                if (currentTime > cfg.tMax) {
                    currentTime = cfg.tMin;
                }

                drawAll();
                animRafId = requestAnimationFrame(frame);
            }
            animRafId = requestAnimationFrame(frame);
        }

        function stopAnimation() {
            isPlaying = false;
            playIcon.className = 'bi bi-play-fill fs-6';
            playText.textContent = 'Play';
            playBtn.classList.remove('btn-warning');
            playBtn.classList.add('btn-outline-success');
            if (animRafId) cancelAnimationFrame(animRafId);
            drawAll();
        }

        function step(delta) {
            if (isPlaying) stopAnimation();
            const cfg = getScenarioConfig(currentPreset, isSwapped);
            if (cfg.isDiscrete) {
                currentTime = Math.round(currentTime + delta);
            } else {
                currentTime += delta * 0.25;
            }
            currentTime = Math.max(cfg.tMin, Math.min(cfg.tMax, currentTime));
            drawAll();
        }

        // Event Listeners
        presetSelect.addEventListener('change', function() {
            applyPreset(this.value);
        });

        playBtn.addEventListener('click', () => {
            if (isPlaying) stopAnimation();
            else startAnimation();
        });

        stepBackBtn.addEventListener('click', () => step(-1));
        stepFwdBtn.addEventListener('click', () => step(1));

        resetBtn.addEventListener('click', () => {
            if (isPlaying) stopAnimation();
            const cfg = getScenarioConfig(currentPreset, isSwapped);
            currentTime = cfg.isDiscrete ? 1.0 : cfg.tMin;
            drawAll();
        });

        swapBtn.addEventListener('click', function() {
            isSwapped = !isSwapped;
            if (isSwapped) {
                this.classList.remove('btn-outline-primary');
                this.classList.add('btn-primary', 'text-white');
            } else {
                this.classList.remove('btn-primary', 'text-white');
                this.classList.add('btn-outline-primary');
            }
            drawAll();
        });

        timeSlider.addEventListener('input', function() {
            if (isPlaying) stopAnimation();
            const cfg = getScenarioConfig(currentPreset, isSwapped);
            const val = parseFloat(this.value);
            currentTime = cfg.isDiscrete ? Math.round(val) : val;
            drawAll();
        });

        dayPills.forEach(pill => {
            pill.addEventListener('click', function() {
                if (isPlaying) stopAnimation();
                const day = parseFloat(this.getAttribute('data-day'));
                currentTime = day;
                drawAll();
            });
        });

        tauCanvas.addEventListener('pointerdown', function(e) {
            isDraggingTau = true;
            try { tauCanvas.setPointerCapture(e.pointerId); } catch(err) {}
            tauCanvas.style.cursor = 'grabbing';

            const rect = tauCanvas.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const cfg = getScenarioConfig(currentPreset, isSwapped);
            const clickedTau = xToT(px, rect.width, cfg.tauMin, cfg.tauMax);
            const rawTime = Math.max(cfg.tMin, Math.min(cfg.tMax, clickedTau));
            currentTime = cfg.isDiscrete ? Math.round(rawTime) : rawTime;
            if (isPlaying) stopAnimation();
            drawAll();
        });

        tauCanvas.addEventListener('pointermove', function(e) {
            const rect = tauCanvas.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const cfg = getScenarioConfig(currentPreset, isSwapped);
            hoveredTau = xToT(px, rect.width, cfg.tauMin, cfg.tauMax);
            tauCursor.textContent = cfg.isDiscrete ? `k = ${hoveredTau.toFixed(1)}` : `τ = ${hoveredTau.toFixed(2)}`;

            if (isDraggingTau) {
                const rawTime = Math.max(cfg.tMin, Math.min(cfg.tMax, hoveredTau));
                currentTime = cfg.isDiscrete ? Math.round(rawTime) : rawTime;
                drawAll();
            } else {
                drawTauCanvas();
            }
        });

        function endTauDrag(e) {
            if (isDraggingTau) {
                isDraggingTau = false;
                try { tauCanvas.releasePointerCapture(e.pointerId); } catch(err) {}
                tauCanvas.style.cursor = 'grab';
            }
        }
        tauCanvas.addEventListener('pointerup', endTauDrag);
        tauCanvas.addEventListener('pointercancel', endTauDrag);
        tauCanvas.addEventListener('pointerleave', () => {
            hoveredTau = null;
            tauCursor.textContent = 'τ = 0.00';
            drawTauCanvas();
        });

        timeCanvas.addEventListener('pointerdown', function(e) {
            isDraggingTime = true;
            try { timeCanvas.setPointerCapture(e.pointerId); } catch(err) {}

            const rect = timeCanvas.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const cfg = getScenarioConfig(currentPreset, isSwapped);
            const clickedT = xToT(px, rect.width, cfg.tMin, cfg.tMax);
            const rawTime = Math.max(cfg.tMin, Math.min(cfg.tMax, clickedT));
            currentTime = cfg.isDiscrete ? Math.round(rawTime) : rawTime;
            if (isPlaying) stopAnimation();
            drawAll();
        });

        timeCanvas.addEventListener('pointermove', function(e) {
            const rect = timeCanvas.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;
            const cfg = getScenarioConfig(currentPreset, isSwapped);
            hoveredTime = xToT(px, rect.width, cfg.tMin, cfg.tMax);
            const hoveredVal = yToV(py, rect.height, cfg.outYMin, cfg.outYMax);
            yCursor.textContent = cfg.isDiscrete ? `y = ${Math.round(hoveredVal)} doses` : `y = ${hoveredVal.toFixed(1)}`;

            if (isDraggingTime) {
                const rawTime = Math.max(cfg.tMin, Math.min(cfg.tMax, hoveredTime));
                currentTime = cfg.isDiscrete ? Math.round(rawTime) : rawTime;
                drawAll();
            } else {
                drawTimeCanvas();
            }
        });

        function endTimeDrag(e) {
            if (isDraggingTime) {
                isDraggingTime = false;
                try { timeCanvas.releasePointerCapture(e.pointerId); } catch(err) {}
            }
        }
        timeCanvas.addEventListener('pointerup', endTimeDrag);
        timeCanvas.addEventListener('pointercancel', endTimeDrag);
        timeCanvas.addEventListener('pointerleave', () => {
            hoveredTime = null;
            yCursor.textContent = 'y = 0.00';
            drawTimeCanvas();
        });

        window.addEventListener('resize', resizeCanvases);

        const themeObserver = new MutationObserver(() => {
            drawAll();
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

        resizeCanvases();
        applyPreset('medication');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initConvolutionLab);
    } else {
        initConvolutionLab();
    }
})();

