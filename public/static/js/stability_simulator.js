// stability_simulator.js
// Interactive Pole-Zero s-Plane and Time-Domain Impulse Response Simulator
(function() {
    function initSimulator() {
        const splaneCanvas = document.getElementById('splane-canvas');
        const responseCanvas = document.getElementById('response-canvas');
        const sigmaSlider = document.getElementById('sigma-slider');
        const omegaSlider = document.getElementById('omega-slider');
        const sigmaVal = document.getElementById('sigma-val');
        const omegaVal = document.getElementById('omega-val');
        const pairSwitch = document.getElementById('pair-switch');
        const statusBadge = document.getElementById('stability-status-badge');
        const coordsReadout = document.getElementById('pole-coords-readout');
        const eqReadout = document.getElementById('equation-readout');
        const analysisTitle = document.getElementById('analysis-title');
        const analysisDesc = document.getElementById('analysis-desc');
        const analysisIcon = document.getElementById('analysis-icon');
        const resetBtn = document.getElementById('reset-origin-btn');
        const presetButtons = document.querySelectorAll('.preset-btn');

        if (!splaneCanvas || !responseCanvas || !sigmaSlider || !omegaSlider) return;

        // Simulator State
        let sigma = -1.2;
        let omega = 2.5;
        let isConjugate = true;
        let isDragging = false;

        const sCtx = splaneCanvas.getContext('2d');
        const rCtx = responseCanvas.getContext('2d');

        // Bounds for s-Plane
        const minSigma = -4.0;
        const maxSigma = 4.0;
        const minOmega = -5.0;
        const maxOmega = 5.0;

        // Time domain bounds
        const tMax = 6.0;
        const tPoints = 300;

        function isDarkTheme() {
            return document.documentElement.getAttribute('data-bs-theme') === 'dark';
        }

        // Resize high-DPI canvases
        function resizeCanvases() {
            const dpr = window.devicePixelRatio || 1;

            const sRect = splaneCanvas.getBoundingClientRect();
            splaneCanvas.width = sRect.width * dpr;
            splaneCanvas.height = sRect.height * dpr;
            if (sCtx.resetTransform) {
                sCtx.resetTransform();
            } else {
                sCtx.setTransform(1, 0, 0, 1, 0, 0);
            }
            sCtx.scale(dpr, dpr);

            const rRect = responseCanvas.getBoundingClientRect();
            responseCanvas.width = rRect.width * dpr;
            responseCanvas.height = rRect.height * dpr;
            if (rCtx.resetTransform) {
                rCtx.resetTransform();
            } else {
                rCtx.setTransform(1, 0, 0, 1, 0, 0);
            }
            rCtx.scale(dpr, dpr);

            drawAll();
        }

        // Coordinate conversions for s-plane
        function sigmaToX(s, width) {
            return ((s - minSigma) / (maxSigma - minSigma)) * width;
        }
        function omegaToY(w, height) {
            return height - ((w - minOmega) / (maxOmega - minOmega)) * height;
        }
        function xToSigma(x, width) {
            return minSigma + (x / width) * (maxSigma - minSigma);
        }
        function yToOmega(y, height) {
            return maxOmega - (y / height) * (maxOmega - minOmega);
        }

        // Draw s-Plane
        function drawSPlane() {
            const width = splaneCanvas.getBoundingClientRect().width;
            const height = splaneCanvas.getBoundingClientRect().height;
            const dark = isDarkTheme();

            sCtx.clearRect(0, 0, width, height);

            const originX = sigmaToX(0, width);
            const originY = omegaToY(0, height);

            // 1. Shaded stability regions
            // Left Half-Plane (Stable)
            sCtx.fillStyle = dark ? 'rgba(40, 167, 69, 0.16)' : 'rgba(40, 167, 69, 0.09)';
            sCtx.fillRect(0, 0, originX, height);

            // Right Half-Plane (Unstable)
            sCtx.fillStyle = dark ? 'rgba(220, 53, 69, 0.15)' : 'rgba(220, 53, 69, 0.08)';
            sCtx.fillRect(originX, 0, width - originX, height);

            // 2. Grid lines
            sCtx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.08)' : '#e9ecef';
            sCtx.lineWidth = 1;
            sCtx.setLineDash([]);

            for (let s = Math.ceil(minSigma); s <= Math.floor(maxSigma); s++) {
                if (s === 0) continue;
                const x = sigmaToX(s, width);
                sCtx.beginPath();
                sCtx.moveTo(x, 0);
                sCtx.lineTo(x, height);
                sCtx.stroke();
            }
            for (let w = Math.ceil(minOmega); w <= Math.floor(maxOmega); w++) {
                if (w === 0) continue;
                const y = omegaToY(w, height);
                sCtx.beginPath();
                sCtx.moveTo(0, y);
                sCtx.lineTo(width, y);
                sCtx.stroke();
            }

            // 3. Axes
            // Real axis (sigma)
            sCtx.strokeStyle = dark ? '#adb5bd' : '#495057';
            sCtx.lineWidth = 1.5;
            sCtx.beginPath();
            sCtx.moveTo(0, originY);
            sCtx.lineTo(width, originY);
            sCtx.stroke();

            // Imaginary axis (j*omega) - highlighted in gold/amber
            sCtx.strokeStyle = '#fd7e14';
            sCtx.lineWidth = 2.5;
            sCtx.beginPath();
            sCtx.moveTo(originX, 0);
            sCtx.lineTo(originX, height);
            sCtx.stroke();

            // Axis labels
            sCtx.fillStyle = dark ? '#e9ecef' : '#212529';
            sCtx.font = 'bold 11px sans-serif';
            sCtx.fillText('Re (σ)', width - 44, originY - 8);
            sCtx.fillStyle = '#fd7e14';
            sCtx.fillText('Im (jω)', originX + 6, 16);

            // Tick numbers
            sCtx.fillStyle = dark ? '#868e96' : '#adb5bd';
            sCtx.font = '9px monospace';
            for (let s = -3; s <= 3; s += 2) {
                if (s === 0) continue;
                sCtx.fillText(s, sigmaToX(s, width) - 4, originY + 12);
            }
            for (let w = -4; w <= 4; w += 2) {
                if (w === 0) continue;
                sCtx.fillText(w + 'j', originX + 4, omegaToY(w, height) + 3);
            }

            // 4. Draw interactive poles (X)
            const poleRadius = 9;

            function drawPoleX(px, py, isMain) {
                sCtx.save();
                sCtx.shadowColor = isMain ? '#ff5f05' : 'rgba(19, 41, 75, 0.4)';
                sCtx.shadowBlur = 8;
                sCtx.strokeStyle = isMain ? '#d63031' : '#0984e3';
                sCtx.lineWidth = 3.5;
                sCtx.beginPath();
                sCtx.moveTo(px - poleRadius, py - poleRadius);
                sCtx.lineTo(px + poleRadius, py + poleRadius);
                sCtx.moveTo(px + poleRadius, py - poleRadius);
                sCtx.lineTo(px - poleRadius, py + poleRadius);
                sCtx.stroke();

                // Circle ring around pole handle
                sCtx.shadowBlur = 0;
                sCtx.strokeStyle = 'rgba(255, 95, 5, 0.6)';
                sCtx.lineWidth = 1.5;
                sCtx.beginPath();
                sCtx.arc(px, py, poleRadius + 4, 0, 2 * Math.PI);
                sCtx.stroke();
                sCtx.restore();
            }

            const mainX = sigmaToX(sigma, width);
            const mainY = omegaToY(omega, height);
            drawPoleX(mainX, mainY, true);

            if (isConjugate && Math.abs(omega) > 0.05) {
                const conjX = sigmaToX(sigma, width);
                const conjY = omegaToY(-omega, height);
                drawPoleX(conjX, conjY, false);

                // Connect conjugate poles with dashed line
                sCtx.setLineDash([3, 3]);
                sCtx.strokeStyle = dark ? 'rgba(173, 181, 189, 0.5)' : 'rgba(108, 117, 125, 0.5)';
                sCtx.lineWidth = 1;
                sCtx.beginPath();
                sCtx.moveTo(mainX, mainY);
                sCtx.lineTo(conjX, conjY);
                sCtx.stroke();
                sCtx.setLineDash([]);
            }
        }

        // Draw Time-Domain Response
        function drawResponse() {
            const width = responseCanvas.getBoundingClientRect().width;
            const height = responseCanvas.getBoundingClientRect().height;
            const dark = isDarkTheme();

            rCtx.clearRect(0, 0, width, height);

            const padLeft = 36;
            const padRight = 16;
            const padTop = 18;
            const padBottom = 26;
            const plotWidth = width - padLeft - padRight;
            const plotHeight = height - padTop - padBottom;
            const originY = padTop + plotHeight / 2;

            // Auto vertical scaling based on max amplitude
            let yLim = 3.5;
            if (sigma > 0) {
                yLim = Math.min(10, Math.max(3.5, Math.exp(sigma * 2.5)));
            }

            function tToX(t) {
                return padLeft + (t / tMax) * plotWidth;
            }
            function yToCanvasY(val) {
                const clamped = Math.max(-yLim * 1.1, Math.min(yLim * 1.1, val));
                return originY - (clamped / yLim) * (plotHeight / 2);
            }

            // 1. Grid lines
            rCtx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.08)' : '#e9ecef';
            rCtx.lineWidth = 1;
            rCtx.setLineDash([]);
            for (let t = 1; t <= tMax; t++) {
                const x = tToX(t);
                rCtx.beginPath();
                rCtx.moveTo(x, padTop);
                rCtx.lineTo(x, padTop + plotHeight);
                rCtx.stroke();
            }

            // 2. Horizontal axes
            rCtx.strokeStyle = dark ? '#adb5bd' : '#495057';
            rCtx.lineWidth = 1.5;
            rCtx.beginPath();
            rCtx.moveTo(padLeft, originY);
            rCtx.lineTo(padLeft + plotWidth, originY);
            rCtx.stroke();

            // Vertical axis (t=0)
            rCtx.beginPath();
            rCtx.moveTo(padLeft, padTop);
            rCtx.lineTo(padLeft, padTop + plotHeight);
            rCtx.stroke();

            // Axis labels & ticks
            rCtx.fillStyle = dark ? '#adb5bd' : '#6c757d';
            rCtx.font = '10px sans-serif';
            rCtx.fillText('y(t)', padLeft - 26, padTop + 8);
            rCtx.fillText('t (s)', padLeft + plotWidth - 24, originY - 6);

            for (let t = 1; t <= tMax; t++) {
                rCtx.fillText(t + 's', tToX(t) - 6, originY + 13);
            }

            // 3. Draw Exponential Envelope e^(sigma*t)
            rCtx.save();
            rCtx.setLineDash([4, 4]);
            rCtx.strokeStyle = dark ? 'rgba(173, 181, 189, 0.4)' : 'rgba(108, 117, 125, 0.45)';
            rCtx.lineWidth = 1.5;

            // Upper envelope
            rCtx.beginPath();
            for (let i = 0; i <= tPoints; i++) {
                const t = (i / tPoints) * tMax;
                const env = Math.exp(sigma * t);
                const x = tToX(t);
                const y = yToCanvasY(env);
                if (i === 0) rCtx.moveTo(x, y);
                else rCtx.lineTo(x, y);
            }
            rCtx.stroke();

            // Lower envelope (for oscillatory response)
            if (isConjugate && Math.abs(omega) > 0.05) {
                rCtx.beginPath();
                for (let i = 0; i <= tPoints; i++) {
                    const t = (i / tPoints) * tMax;
                    const env = -Math.exp(sigma * t);
                    const x = tToX(t);
                    const y = yToCanvasY(env);
                    if (i === 0) rCtx.moveTo(x, y);
                    else rCtx.lineTo(x, y);
                }
                rCtx.stroke();
            }
            rCtx.restore();

            // 4. Draw y(t) response waveform
            let curveColor = '#28a745'; // Green (Stable)
            if (Math.abs(sigma) < 0.05) {
                curveColor = '#fd7e14'; // Amber (Marginal)
            } else if (sigma > 0) {
                curveColor = '#dc3545'; // Red (Unstable)
            }

            rCtx.save();
            rCtx.strokeStyle = curveColor;
            rCtx.lineWidth = 2.5;
            rCtx.shadowColor = curveColor;
            rCtx.shadowBlur = 6;
            rCtx.beginPath();

            for (let i = 0; i <= tPoints; i++) {
                const t = (i / tPoints) * tMax;
                let val = 0;
                if (isConjugate && Math.abs(omega) > 0.05) {
                    val = Math.exp(sigma * t) * Math.cos(omega * t);
                } else {
                    val = Math.exp(sigma * t);
                }

                const x = tToX(t);
                const y = yToCanvasY(val);

                if (i === 0) rCtx.moveTo(x, y);
                else rCtx.lineTo(x, y);
            }
            rCtx.stroke();
            rCtx.restore();

            // 5. Overflow indication if response explodes beyond bounds
            if (sigma > 0.4) {
                rCtx.fillStyle = 'rgba(220, 53, 69, 0.95)';
                rCtx.font = 'bold 11px sans-serif';
                rCtx.fillText('▲ Unbounded (y → ∞)', padLeft + plotWidth - 130, padTop + 14);
            }
        }

        function updateUI() {
            sigmaSlider.value = sigma;
            omegaSlider.value = omega;
            sigmaVal.textContent = (sigma >= 0 ? '+' : '') + sigma.toFixed(2);
            omegaVal.textContent = omega.toFixed(2);

            // Readout text
            if (isConjugate && Math.abs(omega) > 0.05) {
                coordsReadout.textContent = 's = ' + sigma.toFixed(2) + ' ± ' + omega.toFixed(2) + 'j';
                const sSign = sigma < 0 ? '- ' + Math.abs(sigma).toFixed(1) + 't' : '+ ' + sigma.toFixed(1) + 't';
                eqReadout.innerHTML = 'y(t) = e<sup>' + (sigma === 0 ? '0' : sSign) + '</sup> · cos(' + omega.toFixed(1) + 't)';
            } else {
                coordsReadout.textContent = 's = ' + sigma.toFixed(2);
                const sSign = sigma < 0 ? '- ' + Math.abs(sigma).toFixed(1) + 't' : '+ ' + sigma.toFixed(1) + 't';
                eqReadout.innerHTML = 'y(t) = e<sup>' + (sigma === 0 ? '0' : sSign) + '</sup>';
            }

            // Determine stability category
            if (sigma < -0.05) {
                // STABLE
                statusBadge.className = 'badge fs-6 px-3 py-2 rounded-pill bg-success-subtle text-success border border-success';
                statusBadge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> STABLE (LHP)';

                analysisIcon.className = 'bi bi-check-circle-fill text-success fs-5 mt-1';
                if (isConjugate && Math.abs(omega) > 0.05) {
                    analysisTitle.textContent = 'Stable: Damped Oscillatory Response';
                    analysisTitle.className = 'd-block text-success fw-bold';
                    analysisDesc.innerHTML = 'Poles are in the <strong>Left Half-Plane (σ = ' + sigma.toFixed(2) + ' &lt; 0)</strong> with nonzero frequency (<strong>ω = ' + omega.toFixed(2) + '</strong>). The exponential envelope <span class="badge bg-light text-dark font-monospace border">e^(' + sigma.toFixed(2) + 't)</span> forces the oscillations to decay to zero. The system reaches steady state.';
                } else {
                    analysisTitle.textContent = 'Stable: Pure Exponential Decay';
                    analysisTitle.className = 'd-block text-success fw-bold';
                    analysisDesc.innerHTML = 'Poles lie on the real axis in the <strong>Left Half-Plane (σ = ' + sigma.toFixed(2) + ' &lt; 0, ω = 0)</strong>. The response decays monotonically without oscillation, behaving as an overdamped or first-order stable system.';
                }
            } else if (Math.abs(sigma) <= 0.05) {
                // MARGINALLY STABLE
                statusBadge.className = 'badge fs-6 px-3 py-2 rounded-pill bg-warning-subtle text-warning-emphasis border border-warning';
                statusBadge.innerHTML = '<i class="bi bi-dash-circle-fill me-1"></i> MARGINALLY STABLE (jω-Axis)';

                analysisIcon.className = 'bi bi-exclamation-circle-fill text-warning fs-5 mt-1';
                analysisTitle.textContent = 'Marginally Stable: Sustained Oscillation';
                analysisTitle.className = 'd-block text-warning-emphasis fw-bold';
                analysisDesc.innerHTML = 'Poles lie directly on the <strong>Imaginary Axis (σ = 0)</strong>. Because <span class="badge bg-light text-dark font-monospace border">e^(0t) = 1</span>, the signal neither decays nor grows, resulting in constant-amplitude sinusoidal oscillations of frequency <strong>' + omega.toFixed(2) + ' rad/s</strong>.';
            } else {
                // UNSTABLE
                statusBadge.className = 'badge fs-6 px-3 py-2 rounded-pill bg-danger-subtle text-danger border border-danger';
                statusBadge.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i> UNSTABLE (RHP)';

                analysisIcon.className = 'bi bi-x-octagon-fill text-danger fs-5 mt-1';
                if (isConjugate && Math.abs(omega) > 0.05) {
                    analysisTitle.textContent = 'Unstable: Growing Oscillatory Blow-up';
                    analysisTitle.className = 'd-block text-danger fw-bold';
                    analysisDesc.innerHTML = 'Poles are in the <strong>Right Half-Plane (σ = +' + sigma.toFixed(2) + ' &gt; 0)</strong>. The growing exponential factor <span class="badge bg-light text-dark font-monospace border">e^(+' + sigma.toFixed(2) + 't)</span> causes the amplitude to expand indefinitely, causing runaway behavior.';
                } else {
                    analysisTitle.textContent = 'Unstable: Monotonic Exponential Explosion';
                    analysisTitle.className = 'd-block text-danger fw-bold';
                    analysisDesc.innerHTML = 'Poles lie on the real axis in the <strong>Right Half-Plane (σ = +' + sigma.toFixed(2) + ' &gt; 0)</strong>. The response accelerates exponentially toward infinity without oscillating.';
                }
            }
        }

        function drawAll() {
            drawSPlane();
            drawResponse();
            updateUI();
        }

        // Canvas Mouse / Touch Dragging
        function getPointerPos(canvas, e) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }

        splaneCanvas.addEventListener('pointerdown', function(e) {
            const pos = getPointerPos(splaneCanvas, e);
            const w = splaneCanvas.getBoundingClientRect().width;
            const h = splaneCanvas.getBoundingClientRect().height;

            const mainX = sigmaToX(sigma, w);
            const mainY = omegaToY(omega, h);
            const distMain = Math.hypot(pos.x - mainX, pos.y - mainY);

            let distConj = 999;
            if (isConjugate && Math.abs(omega) > 0.05) {
                const conjX = sigmaToX(sigma, w);
                const conjY = omegaToY(-omega, h);
                distConj = Math.hypot(pos.x - conjX, pos.y - conjY);
            }

            if (distMain <= 25 || distConj <= 25) {
                isDragging = true;
                splaneCanvas.setPointerCapture(e.pointerId);
                splaneCanvas.style.cursor = 'grabbing';
                deselectPresets();
            }
        });

        splaneCanvas.addEventListener('pointermove', function(e) {
            if (!isDragging) return;
            const pos = getPointerPos(splaneCanvas, e);
            const w = splaneCanvas.getBoundingClientRect().width;
            const h = splaneCanvas.getBoundingClientRect().height;

            let newSigma = xToSigma(pos.x, w);
            let newOmega = Math.abs(yToOmega(pos.y, h));

            // Snap to zero if near axes
            if (Math.abs(newSigma) < 0.08) newSigma = 0;
            if (newOmega < 0.1) newOmega = 0;

            // Clamp
            sigma = Math.max(minSigma, Math.min(maxSigma, newSigma));
            omega = Math.max(0, Math.min(maxOmega, newOmega));

            drawAll();
        });

        function endDrag(e) {
            if (isDragging) {
                isDragging = false;
                try { splaneCanvas.releasePointerCapture(e.pointerId); } catch(err) {}
                splaneCanvas.style.cursor = 'grab';
            }
        }
        splaneCanvas.addEventListener('pointerup', endDrag);
        splaneCanvas.addEventListener('pointercancel', endDrag);

        // Slider inputs
        sigmaSlider.addEventListener('input', function() {
            sigma = parseFloat(this.value);
            deselectPresets();
            drawAll();
        });

        omegaSlider.addEventListener('input', function() {
            omega = parseFloat(this.value);
            deselectPresets();
            drawAll();
        });

        pairSwitch.addEventListener('change', function() {
            isConjugate = this.checked;
            if (!isConjugate) {
                omega = 0;
                omegaSlider.value = 0;
            }
            drawAll();
        });

        resetBtn.addEventListener('click', function() {
            sigma = -1.2;
            omega = 2.5;
            isConjugate = true;
            pairSwitch.checked = true;
            presetButtons[0].classList.add('active');
            drawAll();
        });

        function deselectPresets() {
            presetButtons.forEach(function(b) { b.classList.remove('active'); });
        }

        presetButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                deselectPresets();
                this.classList.add('active');

                sigma = parseFloat(this.getAttribute('data-sigma'));
                omega = parseFloat(this.getAttribute('data-omega'));
                const type = this.getAttribute('data-type');

                if (type === 'real') {
                    isConjugate = false;
                    pairSwitch.checked = false;
                } else {
                    isConjugate = true;
                    pairSwitch.checked = true;
                }

                drawAll();
            });
        });

        // Resize observer & initial setup
        window.addEventListener('resize', resizeCanvases);
        setTimeout(resizeCanvases, 50);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSimulator);
    } else {
        initSimulator();
    }
})();
