// time_domain_simulator.js
// Streamlined, Responsive Time-Domain Signal Lab
(function() {
    function initTimeDomainLab() {
        const mainCanvas = document.getElementById('td-main-canvas');
        const waveSelect = document.getElementById('td-wave-select');
        const ampSlider = document.getElementById('td-amp-slider');
        const freqSlider = document.getElementById('td-freq-slider');
        const shiftSlider = document.getElementById('td-shift-slider');
        const fsSlider = document.getElementById('td-fs-slider');
        const modeSwitch = document.getElementById('td-mode-switch');
        const reversalSwitch = document.getElementById('td-reversal-switch');
        const playBtn = document.getElementById('td-play-btn');
        const playIcon = document.getElementById('td-play-icon');
        const playText = document.getElementById('td-play-text');
        const resetBtn = document.getElementById('td-reset-btn');

        // Readouts
        const ampVal = document.getElementById('td-amp-val');
        const freqVal = document.getElementById('td-freq-val');
        const shiftVal = document.getElementById('td-shift-val');
        const fsVal = document.getElementById('td-fs-val');
        const freqLabel = document.getElementById('td-freq-label');
        const fsContainer = document.getElementById('td-fs-container');
        const stemLegend = document.getElementById('td-stem-legend');
        const refLegend = document.getElementById('td-ref-legend');
        const cursorReadout = document.getElementById('td-cursor-readout');
        const formulaReadout = document.getElementById('td-formula-readout');
        const shiftHint = document.getElementById('td-shift-hint');
        const statusBadge = document.getElementById('td-status-badge');
        const causalityBadge = document.getElementById('td-causality-badge');

        // Metrics
        const metricPeriod = document.getElementById('metric-period');
        const metricVpp = document.getElementById('metric-vpp');
        const metricRms = document.getElementById('metric-rms');
        const quickExplanation = document.getElementById('td-quick-explanation');

        const presetButtons = document.querySelectorAll('.td-preset-btn');

        if (!mainCanvas || !waveSelect || !ampSlider || !freqSlider) return;

        const ctx = mainCanvas.getContext('2d');

        // State
        let waveform = 'sine';
        let amplitude = 1.0;
        let frequency = 1.0;
        let timeShift = 0.0;
        let isDiscrete = false;
        let fs = 6.0;
        let isReversed = false;

        // Hover
        let hoveredTime = null;

        // Animation sweep
        let isPlaying = false;
        let animProgress = 0.0;
        let animRafId = null;
        let lastFrameTime = null;

        // Axis limits: t in [-3.5, 5.5], y in [-2.5, 2.8]
        const tMin = -3.5;
        const tMax = 5.5;
        const yMin = -2.5;
        const yMax = 2.8;

        function isDarkTheme() {
            return document.documentElement.getAttribute('data-bs-theme') === 'dark';
        }

        function resizeCanvas() {
            const dpr = window.devicePixelRatio || 1;
            const rect = mainCanvas.getBoundingClientRect();
            mainCanvas.width = rect.width * dpr;
            mainCanvas.height = rect.height * dpr;
            if (ctx.resetTransform) {
                ctx.resetTransform();
            } else {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
            }
            ctx.scale(dpr, dpr);
            draw();
        }

        function tToX(t, width) {
            return ((t - tMin) / (tMax - tMin)) * width;
        }
        function yToY(y, height) {
            return height - ((y - yMin) / (yMax - yMin)) * height;
        }
        function xToT(x, width) {
            return tMin + (x / width) * (tMax - tMin);
        }

        // Base evaluation without shift
        function rawWaveform(t, A, f) {
            switch (waveform) {
                case 'sine':
                    return A * Math.cos(2 * Math.PI * f * t);
                case 'ecg': {
                    const T = 1.0 / f;
                    let tau = ((t % T) + T) % T;
                    if (tau > T / 2) tau -= T;
                    const p = 0.22 * Math.exp(-Math.pow((tau + 0.20 * T) / (0.045 * T), 2));
                    const q = -0.30 * Math.exp(-Math.pow((tau + 0.05 * T) / (0.02 * T), 2));
                    const r = 1.75 * Math.exp(-Math.pow(tau / (0.03 * T), 2));
                    const s = -0.50 * Math.exp(-Math.pow((tau - 0.06 * T) / (0.025 * T), 2));
                    const tw = 0.35 * Math.exp(-Math.pow((tau - 0.24 * T) / (0.075 * T), 2));
                    return A * (p + q + r + s + tw);
                }
                case 'step':
                    return t >= 0 ? A : 0.0;
                case 'pulse': {
                    const halfW = 0.5 / f;
                    return Math.abs(t) <= halfW ? A : 0.0;
                }
                case 'ramp': {
                    const halfW = 1.0 / f;
                    if (Math.abs(t) <= halfW) {
                        return A * (1.0 - Math.abs(t) / halfW);
                    }
                    return 0.0;
                }
                case 'expo':
                    return t >= 0 ? A * Math.exp(-f * t) : 0.0;
                case 'sinc': {
                    const arg = Math.PI * f * t;
                    if (Math.abs(arg) < 1e-6) return A;
                    return A * (Math.sin(arg) / arg);
                }
                default:
                    return 0.0;
            }
        }

        // Transformed signal evaluation: x(a(t - t0))
        function evaluateSignal(t) {
            let effT = t - timeShift;
            if (isReversed) effT = -effT;
            return rawWaveform(effT, amplitude, frequency);
        }

        // Draw grid and axes
        function drawGrid(width, height, dark) {
            ctx.clearRect(0, 0, width, height);

            const gridColor = dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
            const axisColor = dark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(19, 41, 75, 0.55)';
            const textColor = dark ? '#a0aec0' : '#4a5568';

            // Vertical grid lines
            ctx.lineWidth = 1;
            ctx.strokeStyle = gridColor;
            for (let t = Math.ceil(tMin); t <= Math.floor(tMax); t += 1.0) {
                const x = tToX(t, width);
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }

            // Horizontal grid lines
            for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y += 1.0) {
                const py = yToY(y, height);
                ctx.beginPath();
                ctx.moveTo(0, py);
                ctx.lineTo(width, py);
                ctx.stroke();
            }

            const zeroX = tToX(0, width);
            const zeroY = yToY(0, height);

            ctx.strokeStyle = axisColor;
            ctx.lineWidth = 1.5;

            // X axis
            ctx.beginPath();
            ctx.moveTo(0, zeroY);
            ctx.lineTo(width, zeroY);
            ctx.stroke();

            // Y axis
            ctx.beginPath();
            ctx.moveTo(zeroX, 0);
            ctx.lineTo(zeroX, height);
            ctx.stroke();

            // Axis numbers
            ctx.fillStyle = textColor;
            ctx.font = '10px "SourceSansPro", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            for (let t = Math.ceil(tMin); t <= Math.floor(tMax); t += 1.0) {
                if (t === 0) continue;
                ctx.fillText(t + 's', tToX(t, width), zeroY + 4);
            }

            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y += 1.0) {
                if (y === 0) continue;
                ctx.fillText(y.toFixed(0), zeroX - 4, yToY(y, height));
            }

            ctx.font = 'bold 10px "SourceSansPro", sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('Time t (s)', width - 8, zeroY - 7);
            ctx.textAlign = 'left';
            ctx.fillText('Amplitude', zeroX + 6, 11);
        }

        // Draw main signal
        function draw() {
            const width = mainCanvas.getBoundingClientRect().width;
            const height = mainCanvas.getBoundingClientRect().height;
            const dark = isDarkTheme();

            drawGrid(width, height, dark);

            const zeroY = yToY(0, height);
            const numPoints = Math.round(width * 1.5);
            const hasShiftOrReversal = Math.abs(timeShift) > 0.02 || isReversed;

            // 1. Ghost reference of unshifted original if shifted
            if (hasShiftOrReversal) {
                refLegend.classList.remove('d-none');
                ctx.save();
                ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.22)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                for (let i = 0; i <= numPoints; i++) {
                    const px = (i / numPoints) * width;
                    const t = xToT(px, width);
                    const val = rawWaveform(t, amplitude, frequency);
                    const py = yToY(val, height);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
                ctx.restore();
            } else {
                refLegend.classList.add('d-none');
            }

            // 2. Active Signal Curve
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i <= numPoints; i++) {
                const px = (i / numPoints) * width;
                const t = xToT(px, width);
                const val = evaluateSignal(t);
                const py = yToY(val, height);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }

            // Main stroke color
            const curveColor = hasShiftOrReversal ? '#ff5f05' : (dark ? '#63b3ed' : '#13294B');
            ctx.strokeStyle = curveColor;
            ctx.lineWidth = 2.4;
            ctx.stroke();

            // Gradient fill under curve
            const grad = ctx.createLinearGradient(0, 0, 0, height);
            if (hasShiftOrReversal) {
                grad.addColorStop(0, 'rgba(255, 95, 5, 0.12)');
                grad.addColorStop(1, 'rgba(255, 95, 5, 0.00)');
            } else {
                grad.addColorStop(0, dark ? 'rgba(99, 179, 237, 0.16)' : 'rgba(19, 41, 75, 0.10)');
                grad.addColorStop(1, 'rgba(19, 41, 75, 0.00)');
            }

            ctx.lineTo(width, zeroY);
            ctx.lineTo(0, zeroY);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.restore();

            // 3. Discrete Sampling Stems
            if (isDiscrete) {
                const Ts = 1.0 / fs;
                const nStart = Math.ceil(tMin / Ts);
                const nEnd = Math.floor(tMax / Ts);

                ctx.save();
                for (let n = nStart; n <= nEnd; n++) {
                    const tn = n * Ts;
                    const val = evaluateSignal(tn);
                    const px = tToX(tn, width);
                    const py = yToY(val, height);

                    ctx.strokeStyle = '#c84113';
                    ctx.lineWidth = 1.8;
                    ctx.beginPath();
                    ctx.moveTo(px, zeroY);
                    ctx.lineTo(px, py);
                    ctx.stroke();

                    ctx.fillStyle = '#ff5f05';
                    ctx.beginPath();
                    ctx.arc(px, py, 3.8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                }
                ctx.restore();
            }

            // 4. Animation Sweep Cursor
            if (isPlaying) {
                const sweepX = tToX(animProgress, width);
                const sweepVal = evaluateSignal(animProgress);
                const sweepY = yToY(sweepVal, height);

                ctx.save();
                ctx.strokeStyle = '#ff5f05';
                ctx.lineWidth = 2.0;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(sweepX, 0);
                ctx.lineTo(sweepX, height);
                ctx.stroke();

                ctx.fillStyle = '#ff5f05';
                ctx.beginPath();
                ctx.arc(sweepX, sweepY, 5.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.8;
                ctx.stroke();
                ctx.restore();
            }

            // 5. Hover indicator
            if (hoveredTime !== null) {
                const hx = tToX(hoveredTime, width);
                const hVal = evaluateSignal(hoveredTime);
                const hy = yToY(hVal, height);

                ctx.save();
                ctx.strokeStyle = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)';
                ctx.lineWidth = 1.2;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(hx, 0);
                ctx.lineTo(hx, height);
                ctx.stroke();

                ctx.fillStyle = curveColor;
                ctx.beginPath();
                ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
            }
        }

        // Update UI metrics & readouts
        function updateDiagnostics() {
            ampVal.textContent = amplitude.toFixed(2);
            freqVal.textContent = frequency.toFixed(2) + (waveform === 'expo' ? '' : ' Hz');
            shiftVal.textContent = (timeShift >= 0 ? '+' : '') + timeShift.toFixed(2) + ' s';
            fsVal.textContent = fs.toFixed(0) + ' Hz';

            // Shift hint
            if (Math.abs(timeShift) < 0.02) {
                shiftHint.textContent = 't₀ = 0.0s (Center)';
                shiftHint.className = 'badge bg-secondary-subtle text-secondary border font-monospace py-1';
            } else if (timeShift > 0) {
                shiftHint.textContent = `Delay: +${timeShift.toFixed(1)}s (→)`;
                shiftHint.className = 'badge bg-danger-subtle text-danger border font-monospace py-1';
            } else {
                shiftHint.textContent = `Advance: ${timeShift.toFixed(1)}s (←)`;
                shiftHint.className = 'badge bg-primary-subtle text-primary border font-monospace py-1';
            }

            // Formula readout
            let fStr = 'x(';
            if (isReversed) {
                fStr += timeShift !== 0 ? `-(t ${timeShift > 0 ? '-' : '+'} ${Math.abs(timeShift).toFixed(1)})` : '-t';
            } else {
                fStr += timeShift !== 0 ? `t ${timeShift > 0 ? '-' : '+'} ${Math.abs(timeShift).toFixed(1)}` : 't';
            }
            fStr += ') = ';

            switch (waveform) {
                case 'sine':
                    fStr += `${amplitude.toFixed(1)} &middot; cos(2&pi;&middot;${frequency.toFixed(1)}t)`;
                    break;
                case 'ecg':
                    fStr += `ECG(t) [75 BPM cardiac cycle]`;
                    break;
                case 'step':
                    fStr += `${amplitude.toFixed(1)} &middot; u(t)`;
                    break;
                case 'pulse':
                    fStr += `${amplitude.toFixed(1)} &middot; rect(t/${(1/frequency).toFixed(1)})`;
                    break;
                case 'ramp':
                    fStr += `Triangle(t)`;
                    break;
                case 'expo':
                    fStr += `${amplitude.toFixed(1)} &middot; e<sup>-${frequency.toFixed(1)}t</sup> u(t)`;
                    break;
                case 'sinc':
                    fStr += `${amplitude.toFixed(1)} &middot; sinc(${frequency.toFixed(1)}t)`;
                    break;
            }
            formulaReadout.innerHTML = fStr;

            // Badges
            let isCausal = false;
            let isPeriodic = false;
            let periodSec = (1.0 / frequency).toFixed(2);
            let expl = '';

            switch (waveform) {
                case 'sine':
                    statusBadge.textContent = 'Sinusoid';
                    statusBadge.className = 'badge bg-primary-subtle text-primary border border-primary px-2 py-1';
                    isCausal = false;
                    isPeriodic = true;
                    expl = `Periodic wave (T = ${periodSec}s). Shifting right delays the signal; shifting left advances it.`;
                    break;
                case 'ecg':
                    statusBadge.textContent = 'ECG Heartbeat';
                    statusBadge.className = 'badge bg-danger-subtle text-danger border border-danger px-2 py-1';
                    isCausal = false;
                    isPeriodic = true;
                    expl = 'PQRST complex: P (atrial), QRS (ventricular spike), and T (repolarization).';
                    break;
                case 'step':
                    statusBadge.textContent = 'Unit Step u(t)';
                    statusBadge.className = 'badge bg-success-subtle text-success border border-success px-2 py-1';
                    isCausal = (timeShift >= 0);
                    isPeriodic = false;
                    expl = 'Instantaneous digital switch from 0 to 1. Zero for t < 0 (Causal).';
                    break;
                case 'pulse':
                    statusBadge.textContent = 'Rectangular Pulse';
                    statusBadge.className = 'badge bg-warning-subtle text-warning border border-warning px-2 py-1';
                    isCausal = false;
                    isPeriodic = false;
                    expl = 'Finite-duration window pulse representing a digital bit or gating interval.';
                    break;
                case 'ramp':
                    statusBadge.textContent = 'Triangle / Ramp';
                    statusBadge.className = 'badge bg-info-subtle text-info border border-info px-2 py-1';
                    isCausal = false;
                    isPeriodic = false;
                    expl = 'Linear sweep function used in timebases and pulse modulation.';
                    break;
                case 'expo':
                    statusBadge.textContent = 'Exponential Decay';
                    statusBadge.className = 'badge bg-success-subtle text-success border border-success px-2 py-1';
                    isCausal = true;
                    isPeriodic = false;
                    expl = `Decaying response e^(-at) with time constant τ = ${(1/frequency).toFixed(2)}s (RC discharge).`;
                    break;
                case 'sinc':
                    statusBadge.textContent = 'Sinc Function';
                    statusBadge.className = 'badge bg-primary-subtle text-primary border border-primary px-2 py-1';
                    isCausal = false;
                    isPeriodic = false;
                    expl = 'Bandlimited impulse response with zero-crossings every 1/f seconds.';
                    break;
            }

            if (isCausal) {
                causalityBadge.textContent = 'Causal (t ≥ 0)';
                causalityBadge.className = 'badge bg-success-subtle text-success border border-success px-2 py-1';
            } else {
                causalityBadge.textContent = 'Non-Causal';
                causalityBadge.className = 'badge bg-secondary-subtle text-secondary border border-secondary px-2 py-1';
            }

            // Quick metrics
            metricPeriod.textContent = isPeriodic ? `${periodSec} s` : 'N/A';
            metricVpp.textContent = `±${amplitude.toFixed(2)} V`;
            metricRms.textContent = waveform === 'sine' ? (amplitude * 0.707).toFixed(2) + ' V' : (amplitude * 0.5).toFixed(2) + ' V';
            quickExplanation.innerHTML = expl;
        }

        // Control listeners
        waveSelect.addEventListener('change', function() {
            waveform = this.value;
            if (waveform === 'expo') {
                freqLabel.innerHTML = 'Decay Rate (<em>a</em>):';
            } else {
                freqLabel.innerHTML = 'Frequency (<em>f</em>):';
            }
            presetButtons.forEach(b => b.classList.remove('active'));
            updateDiagnostics();
            draw();
        });

        ampSlider.addEventListener('input', function() {
            amplitude = parseFloat(this.value);
            updateDiagnostics();
            draw();
        });

        freqSlider.addEventListener('input', function() {
            frequency = parseFloat(this.value);
            updateDiagnostics();
            draw();
        });

        shiftSlider.addEventListener('input', function() {
            timeShift = parseFloat(this.value);
            updateDiagnostics();
            draw();
        });

        fsSlider.addEventListener('input', function() {
            fs = parseFloat(this.value);
            updateDiagnostics();
            draw();
        });

        modeSwitch.addEventListener('change', function() {
            isDiscrete = this.checked;
            if (isDiscrete) {
                fsContainer.style.opacity = '1.0';
                fsContainer.style.pointerEvents = 'auto';
                stemLegend.classList.remove('d-none');
            } else {
                fsContainer.style.opacity = '0.35';
                fsContainer.style.pointerEvents = 'none';
                stemLegend.classList.add('d-none');
            }
            updateDiagnostics();
            draw();
        });

        reversalSwitch.addEventListener('change', function() {
            isReversed = this.checked;
            updateDiagnostics();
            draw();
        });

        // Presets
        presetButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                presetButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                const preset = this.getAttribute('data-preset');
                switch (preset) {
                    case 'sine':
                        waveform = 'sine';
                        amplitude = 1.0;
                        frequency = 1.0;
                        timeShift = 0.0;
                        isDiscrete = false;
                        isReversed = false;
                        break;
                    case 'ecg':
                        waveform = 'ecg';
                        amplitude = 1.0;
                        frequency = 1.25;
                        timeShift = 0.0;
                        isDiscrete = false;
                        isReversed = false;
                        break;
                    case 'step':
                        waveform = 'step';
                        amplitude = 1.0;
                        frequency = 1.0;
                        timeShift = 1.0;
                        isDiscrete = false;
                        isReversed = false;
                        break;
                    case 'pulse':
                        waveform = 'pulse';
                        amplitude = 1.0;
                        frequency = 1.0;
                        timeShift = 0.0;
                        isDiscrete = false;
                        isReversed = false;
                        break;
                    case 'expo':
                        waveform = 'expo';
                        amplitude = 1.5;
                        frequency = 1.0;
                        timeShift = 0.0;
                        isDiscrete = false;
                        isReversed = false;
                        break;
                }

                waveSelect.value = waveform;
                ampSlider.value = amplitude;
                freqSlider.value = frequency;
                shiftSlider.value = timeShift;
                modeSwitch.checked = isDiscrete;
                reversalSwitch.checked = isReversed;

                fsContainer.style.opacity = '0.35';
                fsContainer.style.pointerEvents = 'none';
                stemLegend.classList.add('d-none');

                if (waveform === 'expo') {
                    freqLabel.innerHTML = 'Decay Rate (<em>a</em>):';
                } else {
                    freqLabel.innerHTML = 'Frequency (<em>f</em>):';
                }

                updateDiagnostics();
                draw();
            });
        });

        resetBtn.addEventListener('click', function() {
            waveform = 'sine';
            amplitude = 1.0;
            frequency = 1.0;
            timeShift = 0.0;
            isDiscrete = false;
            fs = 6.0;
            isReversed = false;

            waveSelect.value = 'sine';
            ampSlider.value = 1.0;
            freqSlider.value = 1.0;
            shiftSlider.value = 0.0;
            fsSlider.value = 6.0;
            modeSwitch.checked = false;
            reversalSwitch.checked = false;

            fsContainer.style.opacity = '0.35';
            fsContainer.style.pointerEvents = 'none';
            stemLegend.classList.add('d-none');

            presetButtons.forEach(b => b.classList.remove('active'));
            if (presetButtons[0]) presetButtons[0].classList.add('active');

            if (isPlaying) stopAnimation();

            updateDiagnostics();
            draw();
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

                const speed = (tMax - tMin) / 3.0;
                animProgress += speed * dt;
                if (animProgress > tMax) animProgress = tMin;

                draw();
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
            draw();
        }

        playBtn.addEventListener('click', function() {
            if (isPlaying) stopAnimation();
            else startAnimation();
        });

        // Hover tracking
        mainCanvas.addEventListener('pointermove', function(e) {
            const rect = mainCanvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const x = clientX - rect.left;
            const t = Math.max(tMin, Math.min(tMax, xToT(x, rect.width)));
            hoveredTime = t;

            const val = evaluateSignal(t);
            cursorReadout.textContent = `t = ${t.toFixed(2)} s | x(t) = ${val.toFixed(2)}`;
            draw();
        });

        mainCanvas.addEventListener('pointerleave', function() {
            hoveredTime = null;
            cursorReadout.textContent = `t = 0.00 s | x(t) = ${evaluateSignal(0).toFixed(2)}`;
            draw();
        });

        window.addEventListener('resize', resizeCanvas);

        const themeObserver = new MutationObserver(function() {
            draw();
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

        resizeCanvas();
        updateDiagnostics();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTimeDomainLab);
    } else {
        initTimeDomainLab();
    }
})();
