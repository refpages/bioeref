// transfer_function_simulator.js
// Streamlined, Responsive Transfer Function Lab for Signals & Systems / Bioengineering
(function() {
    function initSimulator() {
        const blockCanvas = document.getElementById('tf-block-canvas');
        const responseCanvas = document.getElementById('tf-response-canvas');

        if (!blockCanvas || !responseCanvas) return;

        // Selectors
        const modelSelect = document.getElementById('tf-model-select');
        const inputSelect = document.getElementById('tf-input-select');

        // Sliders & Controls
        // 1st Order
        const firstControls = document.getElementById('tf-first-controls');
        const firstKSlider = document.getElementById('tf-first-k-slider');
        const firstTauSlider = document.getElementById('tf-first-tau-slider');
        const firstKVal = document.getElementById('tf-first-k-val');
        const firstTauVal = document.getElementById('tf-first-tau-val');

        // 2nd Order
        const secondControls = document.getElementById('tf-second-controls');
        const secondZetaSlider = document.getElementById('tf-second-zeta-slider');
        const secondWnSlider = document.getElementById('tf-second-wn-slider');
        const secondKSlider = document.getElementById('tf-second-k-slider');
        const secondZetaVal = document.getElementById('tf-second-zeta-val');
        const secondWnVal = document.getElementById('tf-second-wn-val');
        const secondKVal = document.getElementById('tf-second-k-val');

        // Series
        const seriesControls = document.getElementById('tf-series-controls');
        const seriesTau1Slider = document.getElementById('tf-series-tau1-slider');
        const seriesTau2Slider = document.getElementById('tf-series-tau2-slider');
        const seriesKSlider = document.getElementById('tf-series-k-slider');
        const seriesTau1Val = document.getElementById('tf-series-tau1-val');
        const seriesTau2Val = document.getElementById('tf-series-tau2-val');
        const seriesKVal = document.getElementById('tf-series-k-val');

        // Parallel
        const parallelControls = document.getElementById('tf-parallel-controls');
        const parK1Slider = document.getElementById('tf-par-k1-slider');
        const parTau1Slider = document.getElementById('tf-par-tau1-slider');
        const parK2Slider = document.getElementById('tf-par-k2-slider');
        const parTau2Slider = document.getElementById('tf-par-tau2-slider');
        const parSignBtn = document.getElementById('tf-par-sign-btn');
        const parK1Val = document.getElementById('tf-par-k1-val');
        const parTau1Val = document.getElementById('tf-par-tau1-val');
        const parK2Val = document.getElementById('tf-par-k2-val');
        const parTau2Val = document.getElementById('tf-par-tau2-val');

        // HUD / Readouts
        const formulaReadout = document.getElementById('tf-formula-readout');
        const cursorReadout = document.getElementById('tf-cursor-readout');
        const statusBadge = document.getElementById('tf-status-badge');
        const regimeBadge = document.getElementById('tf-regime-badge');
        const topologyTitle = document.getElementById('tf-topology-title');
        const intermediateLegend = document.getElementById('tf-intermediate-legend');

        const metricGain = document.getElementById('tf-metric-gain');
        const metricTs = document.getElementById('tf-metric-ts');
        const metricTr = document.getElementById('tf-metric-tr');
        const metricOs = document.getElementById('tf-metric-os');
        const metricPoles = document.getElementById('tf-metric-poles');

        const analysisTitle = document.getElementById('tf-analysis-title');
        const analysisDesc = document.getElementById('tf-analysis-desc');

        // Buttons
        const playBtn = document.getElementById('tf-play-btn');
        const playIcon = document.getElementById('tf-play-icon');
        const playText = document.getElementById('tf-play-text');
        const resetBtn = document.getElementById('tf-reset-btn');
        const presetButtons = document.querySelectorAll('.tf-preset-btn');

        const bCtx = blockCanvas.getContext('2d');
        const rCtx = responseCanvas.getContext('2d');

        // State
        let model = 'first';
        let inputType = 'step';

        let firstK = 1.0;
        let firstTau = 0.8;

        let secondZeta = 0.40;
        let secondWn = 4.0;
        let secondK = 1.0;

        let seriesTau1 = 0.333;
        let seriesTau2 = 0.25;
        let seriesK = 1.0;

        let parK1 = 1.0;
        let parTau1 = 0.5;
        let parK2 = 1.0;
        let parTau2 = 1.2;
        let parOp = '-';

        let hoveredTime = null;
        let isPlaying = false;
        let animProgress = 0.0;
        let animRafId = null;
        let animStartTime = null;

        const tMax = 8.0;
        const tMin = 0.0;
        const numPoints = 400;

        function isDarkTheme() {
            return document.documentElement.getAttribute('data-bs-theme') === 'dark';
        }

        // Resize High-DPI Canvases
        function resizeCanvases() {
            const dpr = window.devicePixelRatio || 1;

            const bRect = blockCanvas.getBoundingClientRect();
            if (bRect.width > 0 && bRect.height > 0) {
                blockCanvas.width = bRect.width * dpr;
                blockCanvas.height = bRect.height * dpr;
                if (bCtx.resetTransform) {
                    bCtx.resetTransform();
                } else {
                    bCtx.setTransform(1, 0, 0, 1, 0, 0);
                }
                bCtx.scale(dpr, dpr);
            }

            const rRect = responseCanvas.getBoundingClientRect();
            if (rRect.width > 0 && rRect.height > 0) {
                responseCanvas.width = rRect.width * dpr;
                responseCanvas.height = rRect.height * dpr;
                if (rCtx.resetTransform) {
                    rCtx.resetTransform();
                } else {
                    rCtx.setTransform(1, 0, 0, 1, 0, 0);
                }
                rCtx.scale(dpr, dpr);
            }

            drawAll();
        }

        // Input Evaluation
        function evalInput(t) {
            if (t < 0) return 0.0;
            switch (inputType) {
                case 'step':
                    return 1.0;
                case 'impulse':
                    return t <= 0.08 ? 1.0 / 0.08 : 0.0;
                case 'pulse':
                    return t <= 2.0 ? 1.0 : 0.0;
                case 'sine':
                    return Math.sin(2.0 * t);
                default:
                    return 1.0;
            }
        }

        // 1st-Order Equations
        function stepRespFirst(t, K, tau) {
            if (t < 0) return 0.0;
            return K * (1.0 - Math.exp(-t / tau));
        }

        function impulseRespFirst(t, K, tau) {
            if (t < 0) return 0.0;
            return (K / tau) * Math.exp(-t / tau);
        }

        function sineRespFirst(t, K, tau) {
            if (t < 0) return 0.0;
            const w = 2.0;
            const denom = 1.0 + (w * tau) * (w * tau);
            const phi = -Math.atan(w * tau);
            return K * ((w * tau / denom) * Math.exp(-t / tau) + (1.0 / Math.sqrt(denom)) * Math.sin(w * t + phi));
        }

        function evalFirstOrder(t, K, tau) {
            if (t < 0) return 0.0;
            switch (inputType) {
                case 'step':
                    return stepRespFirst(t, K, tau);
                case 'impulse':
                    return impulseRespFirst(t, K, tau);
                case 'pulse':
                    return stepRespFirst(t, K, tau) - (t >= 2.0 ? stepRespFirst(t - 2.0, K, tau) : 0.0);
                case 'sine':
                    return sineRespFirst(t, K, tau);
                default:
                    return stepRespFirst(t, K, tau);
            }
        }

        // 2nd-Order Equations
        function stepRespSecond(t, K, z, wn) {
            if (t < 0) return 0.0;
            if (z < 0.999) {
                const wd = wn * Math.sqrt(1.0 - z * z);
                const sigma = z * wn;
                const phi = Math.acos(z);
                return K * (1.0 - (Math.exp(-sigma * t) / Math.sqrt(1.0 - z * z)) * Math.sin(wd * t + phi));
            } else if (z > 1.001) {
                const disc = Math.sqrt(z * z - 1.0);
                const s1 = (z - disc) * wn;
                const s2 = (z + disc) * wn;
                return K * (1.0 - (s2 * Math.exp(-s1 * t) - s1 * Math.exp(-s2 * t)) / (s2 - s1));
            } else {
                return K * (1.0 - Math.exp(-wn * t) * (1.0 + wn * t));
            }
        }

        function impulseRespSecond(t, K, z, wn) {
            if (t < 0) return 0.0;
            if (z < 0.999) {
                const wd = wn * Math.sqrt(1.0 - z * z);
                const sigma = z * wn;
                return (K * wn / Math.sqrt(1.0 - z * z)) * Math.exp(-sigma * t) * Math.sin(wd * t);
            } else if (z > 1.001) {
                const disc = Math.sqrt(z * z - 1.0);
                const s1 = (z - disc) * wn;
                const s2 = (z + disc) * wn;
                return (K * s1 * s2 / (s2 - s1)) * (Math.exp(-s1 * t) - Math.exp(-s2 * t));
            } else {
                return K * wn * wn * t * Math.exp(-wn * t);
            }
        }

        function sineRespSecond(t, K, z, wn) {
            if (t < 0) return 0.0;
            const w = 2.0;
            const num = K * wn * wn;
            const re = wn * wn - w * w;
            const im = 2.0 * z * wn * w;
            const denom = Math.sqrt(re * re + im * im);
            const mag = num / (denom || 1e-6);
            const phi = -Math.atan2(im, re);
            const y_ss = mag * Math.sin(w * t + phi);

            if (z < 0.999) {
                const wd = wn * Math.sqrt(1.0 - z * z);
                const sigma = z * wn;
                const y0 = mag * Math.sin(phi);
                const v0 = mag * w * Math.cos(phi);
                const c1 = -y0;
                const c2 = (-v0 - sigma * c1) / wd;
                return y_ss + Math.exp(-sigma * t) * (c1 * Math.cos(wd * t) + c2 * Math.sin(wd * t));
            } else {
                return y_ss - y_ss * Math.exp(-wn * t);
            }
        }

        function evalSecondOrder(t, K, z, wn) {
            if (t < 0) return 0.0;
            switch (inputType) {
                case 'step':
                    return stepRespSecond(t, K, z, wn);
                case 'impulse':
                    return impulseRespSecond(t, K, z, wn);
                case 'pulse':
                    return stepRespSecond(t, K, z, wn) - (t >= 2.0 ? stepRespSecond(t - 2.0, K, z, wn) : 0.0);
                case 'sine':
                    return sineRespSecond(t, K, z, wn);
                default:
                    return stepRespSecond(t, K, z, wn);
            }
        }

        // Series Cascade Evaluation
        function evalSeries(t) {
            if (t < 0) return { y1: 0.0, y: 0.0 };
            const tau1 = seriesTau1;
            const tau2 = seriesTau2;
            const K = seriesK;

            const y1 = evalFirstOrder(t, 1.0, tau1);
            let y = 0.0;

            if (inputType === 'step') {
                if (Math.abs(tau1 - tau2) > 0.001) {
                    y = K * (1.0 - (tau1 * Math.exp(-t / tau1) - tau2 * Math.exp(-t / tau2)) / (tau1 - tau2));
                } else {
                    y = K * (1.0 - Math.exp(-t / tau1) * (1.0 + t / tau1));
                }
            } else if (inputType === 'impulse') {
                if (Math.abs(tau1 - tau2) > 0.001) {
                    y = (K / (tau1 - tau2)) * (Math.exp(-t / tau1) - Math.exp(-t / tau2));
                } else {
                    y = (K / (tau1 * tau1)) * t * Math.exp(-t / tau1);
                }
            } else if (inputType === 'pulse') {
                const s1 = (tVal) => {
                    if (tVal < 0) return 0.0;
                    if (Math.abs(tau1 - tau2) > 0.001) {
                        return K * (1.0 - (tau1 * Math.exp(-tVal / tau1) - tau2 * Math.exp(-tVal / tau2)) / (tau1 - tau2));
                    } else {
                        return K * (1.0 - Math.exp(-tVal / tau1) * (1.0 + tVal / tau1));
                    }
                };
                y = s1(t) - (t >= 2.0 ? s1(t - 2.0) : 0.0);
            } else if (inputType === 'sine') {
                const w = 2.0;
                const m1 = 1.0 / Math.sqrt(1.0 + (w * tau1) * (w * tau1));
                const p1 = -Math.atan(w * tau1);
                const m2 = K / Math.sqrt(1.0 + (w * tau2) * (w * tau2));
                const p2 = -Math.atan(w * tau2);
                const steady = m1 * m2 * Math.sin(w * t + p1 + p2);
                const decay = Math.exp(-t / Math.max(tau1, tau2));
                y = steady * (1.0 - decay);
            }

            return { y1, y };
        }

        // Parallel Evaluation
        function evalParallel(t) {
            if (t < 0) return { y1: 0.0, y2: 0.0, y: 0.0 };
            const y1 = evalFirstOrder(t, parK1, parTau1);
            const y2 = evalFirstOrder(t, parK2, parTau2);
            const sign = (parOp === '+' ? 1.0 : -1.0);
            const y = y1 + sign * y2;
            return { y1, y2, y };
        }

        function getSystemOutputs(t) {
            switch (model) {
                case 'first':
                    return { y: evalFirstOrder(t, firstK, firstTau), y1: null };
                case 'second':
                    return { y: evalSecondOrder(t, secondK, secondZeta, secondWn), y1: null };
                case 'series':
                    return evalSeries(t);
                case 'parallel':
                    return evalParallel(t);
                default:
                    return { y: evalFirstOrder(t, firstK, firstTau), y1: null };
            }
        }

        // Drawing Arrows & Flow Pulses
        function drawArrow(ctx, x1, y1, x2, y2, label, labelPos, color) {
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 1.8;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            const headlen = 6;
            const angle = Math.atan2(y2 - y1, x2 - x1);
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();

            if (label) {
                ctx.font = '600 10px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'center';
                if (labelPos === 'top') {
                    ctx.fillText(label, (x1 + x2) / 2, y1 - 5);
                } else {
                    ctx.fillText(label, (x1 + x2) / 2, y1 + 13);
                }
            }
        }

        function drawFlowPulse(ctx, x1, y1, x2, y2, progress, color) {
            const px = x1 + (x2 - x1) * progress;
            const py = y1 + (y2 - y1) * progress;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(px, py, 3.0, 0, Math.PI * 2);
            ctx.fill();
        }

        function drawBlockBox(ctx, cx, cy, width, height, numStr, denStr, labelStr, dark) {
            const x = cx - width / 2;
            const y = cy - height / 2;
            const radius = 5;

            ctx.fillStyle = dark ? '#21262d' : '#f8fafc';
            ctx.strokeStyle = dark ? '#484f58' : '#0d6efd';
            ctx.lineWidth = 1.5;

            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, y, width, height, radius);
            } else {
                ctx.rect(x, y, width, height);
            }
            ctx.fill();
            ctx.stroke();

            if (labelStr) {
                ctx.fillStyle = dark ? '#8b949e' : '#64748b';
                ctx.font = 'bold 8px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(labelStr, cx, y + 9);
            }

            ctx.fillStyle = dark ? '#f0f6fc' : '#0f172a';
            ctx.font = '600 10px "Source Code Pro", Menlo, Monaco, monospace';
            ctx.textAlign = 'center';

            const mathCenterY = labelStr ? cy + 4 : cy;
            ctx.fillText(numStr, cx, mathCenterY - 3);

            const barWidth = Math.max(width * 0.75, 40);
            ctx.strokeStyle = dark ? '#6e7681' : '#334155';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(cx - barWidth / 2, mathCenterY);
            ctx.lineTo(cx + barWidth / 2, mathCenterY);
            ctx.stroke();

            ctx.fillText(denStr, cx, mathCenterY + 11);
        }

        function drawSummingJunction(ctx, cx, cy, radius, topSign, bottomSign, dark) {
            ctx.fillStyle = dark ? '#21262d' : '#ffffff';
            ctx.strokeStyle = dark ? '#8b949e' : '#13294b';
            ctx.lineWidth = 1.6;

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx - radius * 0.65, cy);
            ctx.lineTo(cx + radius * 0.65, cy);
            ctx.moveTo(cx, cy - radius * 0.65);
            ctx.lineTo(cx, cy + radius * 0.65);
            ctx.stroke();

            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = dark ? '#ff7b72' : '#dc3545';
            ctx.textAlign = 'center';
            ctx.fillText(topSign, cx - 9, cy - radius + 2);
            ctx.fillText(bottomSign, cx - 9, cy + radius + 6);
        }

        // Draw Block Diagram in the compact full-width strip
        function drawBlockDiagram() {
            const width = blockCanvas.getBoundingClientRect().width;
            const height = blockCanvas.getBoundingClientRect().height;
            const dark = isDarkTheme();

            bCtx.clearRect(0, 0, width, height);

            const inColor = '#ff5f05';
            const outColor = dark ? '#58a6ff' : '#0d6efd';
            const midColor = '#20c997';
            const pulsePhase = (Date.now() % 1200) / 1200;

            const midY = height / 2;

            if (model === 'first') {
                const boxW = Math.min(width * 0.36, 160);
                const boxH = 46;
                const cx = width / 2;

                const num = firstK.toFixed(2);
                const den = `${firstTau.toFixed(2)}s + 1`;

                drawBlockBox(bCtx, cx, midY, boxW, boxH, num, den, 'H(s) = Y(s)/U(s)', dark);

                const inX1 = 20;
                const inX2 = cx - boxW / 2;
                drawArrow(bCtx, inX1, midY, inX2, midY, 'U(s)', 'top', inColor);

                const outX1 = cx + boxW / 2;
                const outX2 = width - 20;
                drawArrow(bCtx, outX1, midY, outX2, midY, 'Y(s)', 'top', outColor);

                if (isPlaying) {
                    drawFlowPulse(bCtx, inX1, midY, inX2, midY, pulsePhase, inColor);
                    drawFlowPulse(bCtx, outX1, midY, outX2, midY, pulsePhase, outColor);
                }

            } else if (model === 'second') {
                const boxW = Math.min(width * 0.44, 200);
                const boxH = 48;
                const cx = width / 2;

                const num = (secondK * secondWn * secondWn).toFixed(1);
                const twoZWn = (2.0 * secondZeta * secondWn).toFixed(2);
                const wn2 = (secondWn * secondWn).toFixed(1);
                const den = `s² + ${twoZWn}s + ${wn2}`;

                drawBlockBox(bCtx, cx, midY, boxW, boxH, num, den, 'H(s) [2nd-Order]', dark);

                const inX1 = 20;
                const inX2 = cx - boxW / 2;
                drawArrow(bCtx, inX1, midY, inX2, midY, 'U(s)', 'top', inColor);

                const outX1 = cx + boxW / 2;
                const outX2 = width - 20;
                drawArrow(bCtx, outX1, midY, outX2, midY, 'Y(s)', 'top', outColor);

                if (isPlaying) {
                    drawFlowPulse(bCtx, inX1, midY, inX2, midY, pulsePhase, inColor);
                    drawFlowPulse(bCtx, outX1, midY, outX2, midY, pulsePhase, outColor);
                }

            } else if (model === 'series') {
                const boxW = Math.min(width * 0.24, 120);
                const boxH = 44;
                const c1x = width * 0.35;
                const c2x = width * 0.67;

                const num1 = '1.0';
                const den1 = `${seriesTau1.toFixed(2)}s + 1`;
                const num2 = seriesK.toFixed(1);
                const den2 = `${seriesTau2.toFixed(2)}s + 1`;

                drawBlockBox(bCtx, c1x, midY, boxW, boxH, num1, den1, 'H₁(s)', dark);
                drawBlockBox(bCtx, c2x, midY, boxW, boxH, num2, den2, 'H₂(s)', dark);

                const inX1 = 15;
                const inX2 = c1x - boxW / 2;
                drawArrow(bCtx, inX1, midY, inX2, midY, 'U(s)', 'top', inColor);

                const midX1 = c1x + boxW / 2;
                const midX2 = c2x - boxW / 2;
                drawArrow(bCtx, midX1, midY, midX2, midY, 'Y₁(s)', 'top', midColor);

                const outX1 = c2x + boxW / 2;
                const outX2 = width - 15;
                drawArrow(bCtx, outX1, midY, outX2, midY, 'Y(s)', 'top', outColor);

                if (isPlaying) {
                    drawFlowPulse(bCtx, inX1, midY, inX2, midY, pulsePhase, inColor);
                    drawFlowPulse(bCtx, midX1, midY, midX2, midY, pulsePhase, midColor);
                    drawFlowPulse(bCtx, outX1, midY, outX2, midY, pulsePhase, outColor);
                }

            } else if (model === 'parallel') {
                const boxW = Math.min(width * 0.24, 115);
                const boxH = 30;
                const c1x = width * 0.44;
                const c2x = width * 0.44;
                const y1 = midY - 18;
                const y2 = midY + 18;
                const sumX = width * 0.74;

                const num1 = `${parK1.toFixed(1)}/(${parTau1.toFixed(2)}s+1)`;
                const num2 = `${parK2.toFixed(1)}/(${parTau2.toFixed(2)}s+1)`;

                drawBlockBox(bCtx, c1x, y1, boxW, boxH, 'H₁(s)', num1, '', dark);
                drawBlockBox(bCtx, c2x, y2, boxW, boxH, 'H₂(s)', num2, '', dark);

                const inX = 15;
                const splitX = width * 0.22;
                drawArrow(bCtx, inX, midY, splitX, midY, 'U(s)', 'top', inColor);

                bCtx.strokeStyle = inColor;
                bCtx.lineWidth = 1.6;
                bCtx.beginPath();
                bCtx.moveTo(splitX, midY);
                bCtx.lineTo(splitX, y1);
                bCtx.lineTo(c1x - boxW / 2, y1);
                bCtx.moveTo(splitX, midY);
                bCtx.lineTo(splitX, y2);
                bCtx.lineTo(c2x - boxW / 2, y2);
                bCtx.stroke();

                bCtx.strokeStyle = dark ? '#8b949e' : '#475569';
                bCtx.beginPath();
                bCtx.moveTo(c1x + boxW / 2, y1);
                bCtx.lineTo(sumX, y1);
                bCtx.lineTo(sumX, midY - 10);
                bCtx.moveTo(c2x + boxW / 2, y2);
                bCtx.lineTo(sumX, y2);
                bCtx.lineTo(sumX, midY + 10);
                bCtx.stroke();

                drawSummingJunction(bCtx, sumX, midY, 9, '+', parOp, dark);
                drawArrow(bCtx, sumX + 9, midY, width - 15, midY, 'Y(s)', 'top', outColor);
            }
        }

        // Draw Full-Width Time-Domain Response Plot
        function drawResponsePlot() {
            const width = responseCanvas.getBoundingClientRect().width;
            const height = responseCanvas.getBoundingClientRect().height;
            const dark = isDarkTheme();

            rCtx.clearRect(0, 0, width, height);

            const padLeft = 40;
            const padRight = 15;
            const padTop = 18;
            const padBottom = 26;

            const plotW = width - padLeft - padRight;
            const plotH = height - padTop - padBottom;

            if (plotW <= 0 || plotH <= 0) return;

            const tStep = (tMax - tMin) / numPoints;
            const points = [];
            let minY = 0.0;
            let maxY = 1.2;

            for (let i = 0; i <= numPoints; i++) {
                const t = tMin + i * tStep;
                const u = evalInput(t);
                const out = getSystemOutputs(t);
                minY = Math.min(minY, out.y, u);
                maxY = Math.max(maxY, out.y, u);
                if (out.y1 !== null) {
                    minY = Math.min(minY, out.y1);
                    maxY = Math.max(maxY, out.y1);
                }
                points.push({ t, u, y: out.y, y1: out.y1 });
            }

            minY = Math.min(-0.2, Math.floor(minY * 1.2 * 2) / 2);
            maxY = Math.max(1.4, Math.ceil(maxY * 1.15 * 2) / 2);

            function tToX(t) {
                return padLeft + ((t - tMin) / (tMax - tMin)) * plotW;
            }
            function yToY(y) {
                return padTop + plotH - ((y - minY) / (maxY - minY)) * plotH;
            }

            // Grid Background
            rCtx.fillStyle = dark ? '#181b1f' : '#ffffff';
            rCtx.fillRect(padLeft, padTop, plotW, plotH);

            const gridColor = dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
            const axisColor = dark ? '#484f58' : '#cbd5e1';
            const textColor = dark ? '#8b949e' : '#64748b';

            rCtx.strokeStyle = gridColor;
            rCtx.lineWidth = 1.0;

            const tGridStep = (tMax <= 6.0) ? 1.0 : 2.0;
            for (let t = tMin; t <= tMax; t += tGridStep) {
                const x = tToX(t);
                rCtx.beginPath();
                rCtx.moveTo(x, padTop);
                rCtx.lineTo(x, padTop + plotH);
                rCtx.stroke();

                rCtx.fillStyle = textColor;
                rCtx.font = '10px system-ui, sans-serif';
                rCtx.textAlign = 'center';
                rCtx.fillText(`${t.toFixed(0)}s`, x, padTop + plotH + 15);
            }

            const yGridStep = (maxY - minY > 3.0) ? 1.0 : 0.5;
            for (let yVal = Math.ceil(minY / yGridStep) * yGridStep; yVal <= maxY; yVal += yGridStep) {
                const y = yToY(yVal);
                rCtx.beginPath();
                rCtx.moveTo(padLeft, y);
                rCtx.lineTo(padLeft + plotW, y);
                rCtx.stroke();

                rCtx.fillStyle = textColor;
                rCtx.font = '10px monospace';
                rCtx.textAlign = 'right';
                rCtx.fillText(yVal.toFixed(1), padLeft - 5, y + 3);
            }

            const yZero = yToY(0);
            if (yZero >= padTop && yZero <= padTop + plotH) {
                rCtx.strokeStyle = axisColor;
                rCtx.lineWidth = 1.5;
                rCtx.beginPath();
                rCtx.moveTo(padLeft, yZero);
                rCtx.lineTo(padLeft + plotW, yZero);
                rCtx.stroke();
            }

            // Steady-State Reference Line
            if (inputType === 'step') {
                let yss = 1.0;
                if (model === 'first') yss = firstK;
                else if (model === 'second') yss = secondK;
                else if (model === 'series') yss = seriesK;
                else if (model === 'parallel') yss = parK1 + (parOp === '+' ? 1 : -1) * parK2;

                const yssY = yToY(yss);
                if (yssY >= padTop && yssY <= padTop + plotH) {
                    rCtx.strokeStyle = dark ? 'rgba(88, 166, 255, 0.4)' : 'rgba(13, 110, 253, 0.35)';
                    rCtx.lineWidth = 1.2;
                    rCtx.setLineDash([4, 4]);
                    rCtx.beginPath();
                    rCtx.moveTo(padLeft, yssY);
                    rCtx.lineTo(padLeft + plotW, yssY);
                    rCtx.stroke();
                    rCtx.setLineDash([]);

                    rCtx.fillStyle = dark ? '#58a6ff' : '#0d6efd';
                    rCtx.font = '10px system-ui, sans-serif';
                    rCtx.textAlign = 'right';
                    rCtx.fillText(`yss = ${yss.toFixed(2)}`, padLeft + plotW - 6, yssY - 4);
                }
            }

            // Input Curve u(t)
            rCtx.strokeStyle = '#ff5f05';
            rCtx.lineWidth = 1.8;
            rCtx.setLineDash([5, 4]);
            rCtx.beginPath();
            let firstPt = true;
            for (let i = 0; i <= numPoints; i++) {
                const pt = points[i];
                const x = tToX(pt.t);
                const y = yToY(pt.u);
                if (firstPt) {
                    rCtx.moveTo(x, y);
                    firstPt = false;
                } else {
                    rCtx.lineTo(x, y);
                }
            }
            rCtx.stroke();
            rCtx.setLineDash([]);

            // Intermediate Curve y1(t)
            if (model === 'series' || model === 'parallel') {
                rCtx.strokeStyle = '#20c997';
                rCtx.lineWidth = 1.4;
                rCtx.setLineDash([2, 3]);
                rCtx.beginPath();
                let fPt = true;
                for (let i = 0; i <= numPoints; i++) {
                    const pt = points[i];
                    if (pt.y1 !== null) {
                        const x = tToX(pt.t);
                        const y = yToY(pt.y1);
                        if (fPt) {
                            rCtx.moveTo(x, y);
                            fPt = false;
                        } else {
                            rCtx.lineTo(x, y);
                        }
                    }
                }
                rCtx.stroke();
                rCtx.setLineDash([]);
            }

            // Output Curve y(t) with gradient
            const maxPlotT = isPlaying ? animProgress * tMax : tMax;
            const curveColor = dark ? '#58a6ff' : '#0d6efd';

            rCtx.save();
            rCtx.beginPath();
            rCtx.rect(padLeft, padTop, plotW, plotH);
            rCtx.clip();

            const grad = rCtx.createLinearGradient(0, padTop, 0, padTop + plotH);
            grad.addColorStop(0, dark ? 'rgba(88, 166, 255, 0.20)' : 'rgba(13, 110, 253, 0.15)');
            grad.addColorStop(1, 'rgba(13, 110, 253, 0.0)');

            rCtx.fillStyle = grad;
            rCtx.beginPath();
            rCtx.moveTo(tToX(0), yToY(0));

            for (let i = 0; i <= numPoints; i++) {
                const pt = points[i];
                if (pt.t > maxPlotT) break;
                rCtx.lineTo(tToX(pt.t), yToY(pt.y));
            }
            const currentT = Math.min(maxPlotT, tMax);
            rCtx.lineTo(tToX(currentT), yToY(0));
            rCtx.closePath();
            rCtx.fill();

            rCtx.strokeStyle = curveColor;
            rCtx.lineWidth = 2.4;
            rCtx.beginPath();
            firstPt = true;
            for (let i = 0; i <= numPoints; i++) {
                const pt = points[i];
                if (pt.t > maxPlotT) break;
                const x = tToX(pt.t);
                const y = yToY(pt.y);
                if (firstPt) {
                    rCtx.moveTo(x, y);
                    firstPt = false;
                } else {
                    rCtx.lineTo(x, y);
                }
            }
            rCtx.stroke();

            if (isPlaying && maxPlotT < tMax) {
                const lastPt = getSystemOutputs(maxPlotT);
                rCtx.fillStyle = '#ff5f05';
                rCtx.beginPath();
                rCtx.arc(tToX(maxPlotT), yToY(lastPt.y), 4.5, 0, Math.PI * 2);
                rCtx.fill();
            }

            rCtx.restore();

            // Peak Callout for 2nd-order underdamped
            if (model === 'second' && secondZeta < 1.0 && inputType === 'step' && secondK > 0) {
                const wd = secondWn * Math.sqrt(1.0 - secondZeta * secondZeta);
                const tp = Math.PI / wd;
                if (tp <= tMax && (!isPlaying || tp <= maxPlotT)) {
                    const osDec = Math.exp(-Math.PI * secondZeta / Math.sqrt(1.0 - secondZeta * secondZeta));
                    const ypeak = secondK * (1.0 + osDec);
                    const osPct = osDec * 100.0;

                    const px = tToX(tp);
                    const py = yToY(ypeak);

                    rCtx.fillStyle = '#dc3545';
                    rCtx.beginPath();
                    rCtx.arc(px, py, 4.0, 0, Math.PI * 2);
                    rCtx.fill();

                    rCtx.fillStyle = dark ? '#ff7b72' : '#dc3545';
                    rCtx.font = 'bold 10px system-ui, sans-serif';
                    rCtx.textAlign = 'center';
                    rCtx.fillText(`Peak: ${ypeak.toFixed(2)} (+${osPct.toFixed(0)}%)`, px, py - 7);
                }
            }

            // Hover Cursor Inspection
            if (hoveredTime !== null && hoveredTime >= tMin && hoveredTime <= tMax) {
                const hx = tToX(hoveredTime);
                const hOut = getSystemOutputs(hoveredTime);
                const hIn = evalInput(hoveredTime);
                const hy = yToY(hOut.y);

                rCtx.strokeStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
                rCtx.lineWidth = 1.0;
                rCtx.setLineDash([3, 3]);
                rCtx.beginPath();
                rCtx.moveTo(hx, padTop);
                rCtx.lineTo(hx, padTop + plotH);
                rCtx.stroke();
                rCtx.setLineDash([]);

                rCtx.fillStyle = curveColor;
                rCtx.beginPath();
                rCtx.arc(hx, hy, 4.5, 0, Math.PI * 2);
                rCtx.fill();

                if (cursorReadout) {
                    cursorReadout.textContent = `t = ${hoveredTime.toFixed(2)}s | u = ${hIn.toFixed(2)} | y = ${hOut.y.toFixed(2)}`;
                }
            }
        }

        // Update Math HUD & Metrics
        function updateHUD() {
            let formulaHTML = '';
            let topologyHTML = '';
            let statusText = '';
            let regimeText = '';
            let polesText = '';
            let gainVal = 1.0;
            let tsVal = '-';
            let trVal = '-';
            let osVal = '0%';

            if (model === 'first') {
                formulaHTML = `H(s) = ${firstK.toFixed(2)} / (${firstTau.toFixed(2)}s + 1)`;
                topologyHTML = '1st-Order Single Block';
                statusText = '1st-Order Lag';
                regimeText = 'Exponential Decay';

                gainVal = firstK;
                tsVal = `${(4.0 * firstTau).toFixed(2)} s`;
                trVal = `${(2.2 * firstTau).toFixed(2)} s`;
                osVal = '0%';
                const p = -1.0 / firstTau;
                polesText = `s = ${p.toFixed(2)}`;

                if (analysisTitle && analysisDesc) {
                    analysisTitle.textContent = '1st-Order Exponential Lag';
                    analysisDesc.innerHTML = `Standard 1st-order transfer function <em>H</em>(<em>s</em>) = <em>K</em> / (&tau;<em>s</em> + 1). Time constant &tau; = ${firstTau.toFixed(2)} s controls response speed: reaches <strong>63.2%</strong> of steady-state at <em>t</em> = &tau; and <strong>98%</strong> at <em>t</em> = 4&tau;. Commonly models 1-compartment drug clearance and RC biosensors.`;
                }

            } else if (model === 'second') {
                const wn = secondWn;
                const z = secondZeta;
                const wn2 = wn * wn;
                const twoZWn = 2.0 * z * wn;
                const num = secondK * wn2;

                formulaHTML = `H(s) = ${num.toFixed(1)} / (s² + ${twoZWn.toFixed(2)}s + ${wn2.toFixed(1)})`;
                topologyHTML = '2nd-Order Resonant Block';
                gainVal = secondK;

                if (z < 0.999) {
                    statusText = `Underdamped (ζ = ${z.toFixed(2)})`;
                    regimeText = 'Oscillatory Decay';
                    const wd = wn * Math.sqrt(1.0 - z * z);
                    const sigma = z * wn;
                    polesText = `s = -${sigma.toFixed(2)} ± ${wd.toFixed(2)}j`;

                    const osPct = Math.exp(-Math.PI * z / Math.sqrt(1.0 - z * z)) * 100.0;
                    osVal = `${osPct.toFixed(1)}%`;
                    tsVal = `${(4.0 / (z * wn)).toFixed(2)} s`;
                    trVal = `${((1.76 - 0.417 * z) / wn).toFixed(2)} s`;

                    if (analysisTitle && analysisDesc) {
                        analysisTitle.textContent = 'Underdamped System (ζ < 1)';
                        analysisDesc.innerHTML = `Complex conjugate poles oscillate at damped natural frequency &omega;<sub>d</sub> = ${wd.toFixed(2)} rad/s with <strong>${osVal} overshoot</strong>. In bioinstrumentation, underdamped arterial line blood pressure catheters cause systolic peak amplification artifacts.`;
                    }
                } else if (z > 1.001) {
                    statusText = `Overdamped (ζ = ${z.toFixed(2)})`;
                    regimeText = 'Non-Oscillatory Lag';
                    const disc = Math.sqrt(z * z - 1.0);
                    const s1 = (z - disc) * wn;
                    const s2 = (z + disc) * wn;
                    polesText = `s = -${s1.toFixed(2)}, -${s2.toFixed(2)}`;

                    osVal = '0%';
                    tsVal = `${(4.0 / s1).toFixed(2)} s`;
                    trVal = `${(3.35 * z / wn).toFixed(2)} s`;

                    if (analysisTitle && analysisDesc) {
                        analysisTitle.textContent = 'Overdamped System (ζ > 1)';
                        analysisDesc.innerHTML = `Two real distinct poles at <em>s</em> = -${s1.toFixed(2)} and <em>s</em> = -${s2.toFixed(2)}. High viscous damping prevents overshoot but leads to a sluggish rise to steady state. Characteristic of heavily damped biomedical transducers and pharmacokinetic clearance.`;
                    }
                } else {
                    statusText = 'Critically Damped (ζ = 1.0)';
                    regimeText = 'Fastest Non-Overshoot';
                    polesText = `s = -${wn.toFixed(2)} (double)`;

                    osVal = '0%';
                    tsVal = `${(5.8 / wn).toFixed(2)} s`;
                    trVal = `${(3.35 / wn).toFixed(2)} s`;

                    if (analysisTitle && analysisDesc) {
                        analysisTitle.textContent = 'Critically Damped (ζ = 1)';
                        analysisDesc.innerHTML = `Double real pole at <em>s</em> = -${wn.toFixed(2)}. Provides the <strong>fastest possible rise time without any overshoot</strong> (0%). Ideal benchmark for physiological control loops, such as saccadic eye movements.`;
                    }
                }

            } else if (model === 'series') {
                const tau1 = seriesTau1;
                const tau2 = seriesTau2;
                const K = seriesK;
                const a = (1.0 / tau1).toFixed(2);
                const b = (1.0 / tau2).toFixed(2);
                const scaleNum = (K / (tau1 * tau2)).toFixed(1);

                formulaHTML = `H(s) = ${scaleNum} / [(s + ${a})(s + ${b})]`;
                topologyHTML = 'Series Cascade Multiplication';
                statusText = 'Series Cascade';
                regimeText = '2nd-Order Lag';

                gainVal = K;
                tsVal = `${(4.0 * Math.max(tau1, tau2) + 1.5 * Math.min(tau1, tau2)).toFixed(2)} s`;
                trVal = `${(2.2 * Math.max(tau1, tau2)).toFixed(2)} s`;
                osVal = '0%';
                polesText = `s = -${a}, -${b}`;

                if (analysisTitle && analysisDesc) {
                    analysisTitle.textContent = 'Cascaded Transfer Functions (Figure 1 & 2)';
                    analysisDesc.innerHTML = `Blocks in series multiply together: <em>H</em>(<em>s</em>) = <em>H</em><sub>1</sub>(<em>s</em>) &middot; <em>H</em><sub>2</sub>(<em>s</em>) (as in Example 1). Cascading first-order stages introduces cumulative delay and smooths out sharp transients into a sigmoidal curve.`;
                }

            } else if (model === 'parallel') {
                const opSym = (parOp === '+' ? '+' : '-');
                formulaHTML = `H(s) = [${parK1.toFixed(1)}/(${parTau1.toFixed(2)}s+1)] ${opSym} [${parK2.toFixed(1)}/(${parTau2.toFixed(2)}s+1)]`;
                topologyHTML = `Parallel Branches (${opSym === '+' ? 'Summing' : 'Differencing'})`;
                statusText = `Parallel ${opSym === '+' ? 'Sum (+)' : 'Diff (-)'}`;
                regimeText = opSym === '+' ? 'Dual Path Addition' : 'Differential Rejection';

                gainVal = parK1 + (parOp === '+' ? 1.0 : -1.0) * parK2;
                tsVal = `${(4.0 * Math.max(parTau1, parTau2)).toFixed(2)} s`;
                trVal = `${(2.2 * Math.min(parTau1, parTau2)).toFixed(2)} s`;
                osVal = opSym === '-' ? 'Lead/Peak' : '0%';
                const p1 = (-1.0 / parTau1).toFixed(2);
                const p2 = (-1.0 / parTau2).toFixed(2);
                polesText = `s = ${p1}, ${p2}`;

                if (analysisTitle && analysisDesc) {
                    analysisTitle.textContent = 'Parallel Branches (Figure 2 Summing Junction)';
                    analysisDesc.innerHTML = `Parallel branches add or subtract at the summing junction: <em>Y</em>(<em>s</em>) = [<em>H</em><sub>1</sub>(<em>s</em>) ${opSym} <em>H</em><sub>2</sub>(<em>s</em>)] <em>U</em>(<em>s</em>) (as in Figure 2: <em>G</em><sub>4</sub><em>G</em><sub>5</sub> - <em>G</em><sub>3</sub>). Differencing parallel paths can reject DC baseline drift while preserving rapid transients.`;
                }
            }

            // Intermediate legend visibility
            if (intermediateLegend) {
                intermediateLegend.classList.toggle('d-none', model !== 'series' && model !== 'parallel');
            }

            // Update DOM Elements
            if (formulaReadout) formulaReadout.innerHTML = formulaHTML;
            if (topologyTitle) topologyTitle.textContent = topologyHTML;
            if (statusBadge) statusBadge.textContent = statusText;
            if (regimeBadge) regimeBadge.textContent = regimeText;

            if (metricGain) metricGain.textContent = gainVal.toFixed(2);
            if (metricTs) metricTs.textContent = tsVal;
            if (metricTr) metricTr.textContent = trVal;
            if (metricOs) metricOs.textContent = osVal;
            if (metricPoles) metricPoles.textContent = polesText;
        }

        function drawAll() {
            updateHUD();
            drawBlockDiagram();
            drawResponsePlot();
        }

        // Animation Loop
        function animate(timestamp) {
            if (!animStartTime) animStartTime = timestamp;
            const elapsed = (timestamp - animStartTime) / 1000.0;
            const animDuration = 4.0;

            animProgress = (elapsed % animDuration) / animDuration;

            drawAll();

            if (isPlaying) {
                animRafId = requestAnimationFrame(animate);
            }
        }

        function togglePlay() {
            isPlaying = !isPlaying;
            if (isPlaying) {
                if (playIcon) playIcon.className = 'bi bi-pause-fill';
                if (playText) playText.textContent = 'Pause';
                animStartTime = null;
                animRafId = requestAnimationFrame(animate);
            } else {
                if (playIcon) playIcon.className = 'bi bi-play-fill';
                if (playText) playText.textContent = 'Play';
                if (animRafId) cancelAnimationFrame(animRafId);
                animProgress = 1.0;
                drawAll();
            }
        }

        function deselectPresets() {
            presetButtons.forEach(btn => btn.classList.remove('active'));
        }

        function updateModelVisibility() {
            if (firstControls) firstControls.classList.toggle('d-none', model !== 'first');
            if (secondControls) secondControls.classList.toggle('d-none', model !== 'second');
            if (seriesControls) seriesControls.classList.toggle('d-none', model !== 'series');
            if (parallelControls) parallelControls.classList.toggle('d-none', model !== 'parallel');
        }

        // Model Select Dropdown
        if (modelSelect) {
            modelSelect.addEventListener('change', function() {
                model = this.value;
                updateModelVisibility();
                deselectPresets();
                drawAll();
            });
        }

        // Input Select Dropdown
        if (inputSelect) {
            inputSelect.addEventListener('change', function() {
                inputType = this.value;
                drawAll();
            });
        }

        // Slider Listeners: 1st Order
        if (firstKSlider) {
            firstKSlider.addEventListener('input', function() {
                firstK = parseFloat(this.value);
                if (firstKVal) firstKVal.textContent = firstK.toFixed(2);
                deselectPresets();
                drawAll();
            });
        }
        if (firstTauSlider) {
            firstTauSlider.addEventListener('input', function() {
                firstTau = parseFloat(this.value);
                if (firstTauVal) firstTauVal.textContent = `${firstTau.toFixed(2)} s`;
                deselectPresets();
                drawAll();
            });
        }

        // Slider Listeners: 2nd Order
        if (secondZetaSlider) {
            secondZetaSlider.addEventListener('input', function() {
                secondZeta = parseFloat(this.value);
                if (secondZetaVal) secondZetaVal.textContent = secondZeta.toFixed(2);
                deselectPresets();
                drawAll();
            });
        }
        if (secondWnSlider) {
            secondWnSlider.addEventListener('input', function() {
                secondWn = parseFloat(this.value);
                if (secondWnVal) secondWnVal.textContent = `${secondWn.toFixed(2)} rad/s`;
                deselectPresets();
                drawAll();
            });
        }
        if (secondKSlider) {
            secondKSlider.addEventListener('input', function() {
                secondK = parseFloat(this.value);
                if (secondKVal) secondKVal.textContent = secondK.toFixed(2);
                deselectPresets();
                drawAll();
            });
        }

        // Slider Listeners: Series
        if (seriesTau1Slider) {
            seriesTau1Slider.addEventListener('input', function() {
                seriesTau1 = parseFloat(this.value);
                if (seriesTau1Val) seriesTau1Val.textContent = `${seriesTau1.toFixed(2)} s`;
                deselectPresets();
                drawAll();
            });
        }
        if (seriesTau2Slider) {
            seriesTau2Slider.addEventListener('input', function() {
                seriesTau2 = parseFloat(this.value);
                if (seriesTau2Val) seriesTau2Val.textContent = `${seriesTau2.toFixed(2)} s`;
                deselectPresets();
                drawAll();
            });
        }
        if (seriesKSlider) {
            seriesKSlider.addEventListener('input', function() {
                seriesK = parseFloat(this.value);
                if (seriesKVal) seriesKVal.textContent = seriesK.toFixed(2);
                deselectPresets();
                drawAll();
            });
        }

        // Slider Listeners: Parallel
        if (parK1Slider) {
            parK1Slider.addEventListener('input', function() {
                parK1 = parseFloat(this.value);
                if (parK1Val) parK1Val.textContent = parK1.toFixed(2);
                deselectPresets();
                drawAll();
            });
        }
        if (parTau1Slider) {
            parTau1Slider.addEventListener('input', function() {
                parTau1 = parseFloat(this.value);
                if (parTau1Val) parTau1Val.textContent = `${parTau1.toFixed(2)} s`;
                deselectPresets();
                drawAll();
            });
        }
        if (parK2Slider) {
            parK2Slider.addEventListener('input', function() {
                parK2 = parseFloat(this.value);
                if (parK2Val) parK2Val.textContent = parK2.toFixed(2);
                deselectPresets();
                drawAll();
            });
        }
        if (parTau2Slider) {
            parTau2Slider.addEventListener('input', function() {
                parTau2 = parseFloat(this.value);
                if (parTau2Val) parTau2Val.textContent = `${parTau2.toFixed(2)} s`;
                deselectPresets();
                drawAll();
            });
        }
        if (parSignBtn) {
            parSignBtn.addEventListener('click', function() {
                parOp = (parOp === '-' ? '+' : '-');
                this.textContent = `Sign: (${parOp})`;
                deselectPresets();
                drawAll();
            });
        }

        // Preset Handlers
        presetButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                deselectPresets();
                this.classList.add('active');
                const preset = this.getAttribute('data-preset');

                if (preset === 'first') {
                    model = 'first';
                    if (modelSelect) modelSelect.value = 'first';
                    updateModelVisibility();

                    firstK = 1.0;
                    firstTau = 0.8;
                    if (firstKSlider) firstKSlider.value = 1.0;
                    if (firstTauSlider) firstTauSlider.value = 0.8;
                    if (firstKVal) firstKVal.textContent = '1.00';
                    if (firstTauVal) firstTauVal.textContent = '0.80 s';

                    inputType = 'step';
                    if (inputSelect) inputSelect.value = 'step';

                } else if (preset === 'arterial') {
                    model = 'second';
                    if (modelSelect) modelSelect.value = 'second';
                    updateModelVisibility();

                    secondZeta = 0.40;
                    secondWn = 5.0;
                    secondK = 1.0;
                    if (secondZetaSlider) secondZetaSlider.value = 0.40;
                    if (secondWnSlider) secondWnSlider.value = 5.0;
                    if (secondKSlider) secondKSlider.value = 1.0;
                    if (secondZetaVal) secondZetaVal.textContent = '0.40';
                    if (secondWnVal) secondWnVal.textContent = '5.00 rad/s';
                    if (secondKVal) secondKVal.textContent = '1.00';

                    inputType = 'step';
                    if (inputSelect) inputSelect.value = 'step';

                } else if (preset === 'crit') {
                    model = 'second';
                    if (modelSelect) modelSelect.value = 'second';
                    updateModelVisibility();

                    secondZeta = 1.00;
                    secondWn = 4.0;
                    secondK = 1.0;
                    if (secondZetaSlider) secondZetaSlider.value = 1.00;
                    if (secondWnSlider) secondWnSlider.value = 4.0;
                    if (secondKSlider) secondKSlider.value = 1.0;
                    if (secondZetaVal) secondZetaVal.textContent = '1.00';
                    if (secondWnVal) secondWnVal.textContent = '4.00 rad/s';
                    if (secondKVal) secondKVal.textContent = '1.00';

                    inputType = 'step';
                    if (inputSelect) inputSelect.value = 'step';

                } else if (preset === 'over') {
                    model = 'second';
                    if (modelSelect) modelSelect.value = 'second';
                    updateModelVisibility();

                    secondZeta = 2.00;
                    secondWn = 3.0;
                    secondK = 1.0;
                    if (secondZetaSlider) secondZetaSlider.value = 2.00;
                    if (secondWnSlider) secondWnSlider.value = 3.0;
                    if (secondKSlider) secondKSlider.value = 1.0;
                    if (secondZetaVal) secondZetaVal.textContent = '2.00';
                    if (secondWnVal) secondWnVal.textContent = '3.00 rad/s';
                    if (secondKVal) secondKVal.textContent = '1.00';

                    inputType = 'step';
                    if (inputSelect) inputSelect.value = 'step';

                } else if (preset === 'example1') {
                    model = 'series';
                    if (modelSelect) modelSelect.value = 'series';
                    updateModelVisibility();

                    seriesTau1 = 0.333;
                    seriesTau2 = 0.25;
                    seriesK = 0.333;
                    if (seriesTau1Slider) seriesTau1Slider.value = 0.33;
                    if (seriesTau2Slider) seriesTau2Slider.value = 0.25;
                    if (seriesKSlider) seriesKSlider.value = 0.33;
                    if (seriesTau1Val) seriesTau1Val.textContent = '0.33 s';
                    if (seriesTau2Val) seriesTau2Val.textContent = '0.25 s';
                    if (seriesKVal) seriesKVal.textContent = '0.33';

                    inputType = 'impulse';
                    if (inputSelect) inputSelect.value = 'impulse';

                } else if (preset === 'parallel') {
                    model = 'parallel';
                    if (modelSelect) modelSelect.value = 'parallel';
                    updateModelVisibility();

                    parK1 = 1.5;
                    parTau1 = 0.5;
                    parK2 = 1.0;
                    parTau2 = 1.5;
                    parOp = '-';
                    if (parK1Slider) parK1Slider.value = 1.5;
                    if (parTau1Slider) parTau1Slider.value = 0.5;
                    if (parK2Slider) parK2Slider.value = 1.0;
                    if (parTau2Slider) parTau2Slider.value = 1.5;
                    if (parSignBtn) parSignBtn.textContent = 'Sign: (-)';
                    if (parK1Val) parK1Val.textContent = '1.50';
                    if (parTau1Val) parTau1Val.textContent = '0.50 s';
                    if (parK2Val) parK2Val.textContent = '1.00';
                    if (parTau2Val) parTau2Val.textContent = '1.50 s';

                    inputType = 'step';
                    if (inputSelect) inputSelect.value = 'step';
                }

                drawAll();
            });
        });

        // Hover & Touch Events
        responseCanvas.addEventListener('mousemove', function(e) {
            const rect = responseCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const padLeft = 40;
            const padRight = 15;
            const plotW = rect.width - padLeft - padRight;

            if (x >= padLeft && x <= padLeft + plotW) {
                hoveredTime = tMin + ((x - padLeft) / plotW) * (tMax - tMin);
            } else {
                hoveredTime = null;
            }
            drawResponsePlot();
        });

        responseCanvas.addEventListener('mouseleave', function() {
            hoveredTime = null;
            if (cursorReadout) {
                cursorReadout.textContent = 'Hover over plot to inspect';
            }
            drawResponsePlot();
        });

        responseCanvas.addEventListener('touchmove', function(e) {
            if (e.touches.length > 0) {
                const rect = responseCanvas.getBoundingClientRect();
                const x = e.touches[0].clientX - rect.left;
                const padLeft = 40;
                const padRight = 15;
                const plotW = rect.width - padLeft - padRight;
                if (x >= padLeft && x <= padLeft + plotW) {
                    hoveredTime = tMin + ((x - padLeft) / plotW) * (tMax - tMin);
                    drawResponsePlot();
                }
            }
        }, { passive: true });

        // Play/Reset Controls
        if (playBtn) playBtn.addEventListener('click', togglePlay);
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                if (isPlaying) togglePlay();
                const firstPresetBtn = document.querySelector('.tf-preset-btn[data-preset="first"]');
                if (firstPresetBtn) firstPresetBtn.click();
            });
        }

        // Theme and Resize Observer
        const observer = new MutationObserver(() => {
            drawAll();
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

        window.addEventListener('resize', resizeCanvases);
        setTimeout(resizeCanvases, 50);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSimulator);
    } else {
        initSimulator();
    }
})();
