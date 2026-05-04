<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pahoa STEAM Assessment Portal - Sign In</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #0f172a; /* Deep Slate Blue */
            color: #e6edf3;
            margin: 0;
            overflow: hidden;
        }

        .main-bg {
            background: radial-gradient(circle at 30% 50%, #1e293b 0%, #0f172a 100%);
        }

        /* Darkgold Popup Card Styling */
        .login-card {
            background: rgba(24, 23, 21, 0.95); 
            backdrop-filter: blur(20px);
            border: 1px solid rgba(249, 115, 22, 0.2); 
            box-shadow: 0 35px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(249, 115, 22, 0.08); 
        }

        .google-btn {
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            background: transparent;
            color: #f97316; 
            border: 1px solid #f97316;
        }

        .google-btn:hover {
            background: rgba(249, 115, 22, 0.08);
            box-shadow: 0 0 15px rgba(249, 115, 22, 0.15);
            transform: translateY(-1px);
        }

        .icon-box {
            background: transparent;
            border: 1px solid #f97316;
            color: #f97316;
            box-shadow: inset 0 0 10px rgba(249, 115, 22, 0.1), 0 0 15px rgba(249, 115, 22, 0.2);
        }

        canvas {
            display: block;
        }

        .fade-in {
            animation: fadeIn 0.8s ease-out forwards;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body class="h-screen w-screen main-bg relative">

    <!-- Full Screen Background Animation -->
    <div class="absolute inset-0 z-0 pointer-events-none" id="animation-container">
        <canvas id="complexCanvas"></canvas>
    </div>

    <!-- Foreground UI Layout -->
    <div class="relative z-10 flex flex-col lg:flex-row h-full w-full pointer-events-none">
        
        <!-- Left Side: Empty space to let the animation breathe -->
        <div class="hidden lg:block lg:w-[55%] h-full"></div>

        <!-- Right Side: Floating Popup Card -->
        <div class="w-full lg:w-[45%] h-full flex flex-col items-center justify-center p-6 lg:p-12 pointer-events-auto">
            
            <div class="max-w-[420px] w-full login-card rounded-[2rem] p-10 fade-in flex flex-col relative z-20" style="animation-delay: 0.1s;">
                
                <div class="flex flex-col items-center text-center mb-8">
                    <div class="icon-box w-14 h-14 rounded-full flex items-center justify-center mb-6">
                        <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                    </div>
                    
                    <h1 class="text-[22px] leading-tight font-bold text-white tracking-wide mb-4">
                        Welcome to Pahoa<br>STEAM Assessment<br>Portal
                    </h1>
                    
                    <p class="text-[#a09f9d] text-[13px] leading-relaxed mb-6 px-4">
                        Log in to access your STEAM project dashboard.
                    </p>

                    <p class="text-[#f97316] text-[12px] font-semibold px-2 leading-relaxed">
                        Note: Only @sekolah.pahoa.sch.id email accounts are permitted.
                    </p>
                </div>

                <div class="space-y-6">
                    <button onclick="handleLogin()" class="google-btn w-full flex items-center justify-center gap-3 py-3 px-6 rounded-lg font-medium text-[13px]">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
                        </svg>
                        Login with Google
                    </button>

                    <div class="flex items-center justify-center gap-2 pt-2 text-[#737270] text-[11px] font-medium">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                        Secure quantum encryption active
                    </div>
                </div>
            </div>

            <!-- Footer anchored below the card -->
            <div class="mt-8 text-center">
                <p class="text-[#8e98a8] text-[10px]">
                    © Pahoa STEAM Assessment Portal. All rights reserved.
                </p>
            </div>

        </div>
    </div>

    <!-- Feedback Modal -->
    <div id="statusModal" class="fixed inset-0 bg-black/80 backdrop-blur-md hidden items-center justify-center z-50 pointer-events-auto">
        <div class="bg-[#181715] p-10 rounded-2xl border border-white/10 max-w-sm w-full mx-4 text-center shadow-2xl">
            <div class="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <div class="w-3 h-3 bg-orange-500 rounded-full animate-ping"></div>
            </div>
            <h3 class="text-xl font-medium text-white mb-3">Authenticating</h3>
            <p class="text-[#a09f9d] text-sm mb-8 leading-relaxed">Verifying institution credentials through Google Workspace.</p>
            <button onclick="closeModal()" class="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm transition-all font-medium border border-white/10">Cancel</button>
        </div>
    </div>

    <script>
        const canvas = document.getElementById('complexCanvas');
        const ctx = canvas.getContext('2d');

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resize);
        resize();

        // Theme Constants for Animation
        const c_card = "#181715";
        const c_border = "rgba(255, 255, 255, 0.08)";
        const c_empty = "rgba(255, 255, 255, 0.04)";
        const c_fill = "rgba(255, 255, 255, 0.15)";
        const c_orange = "#f97316";

        // Global Anim State
        let stateTime = 0;
        let globalTick = 0;
        let state = 'MORPH_IN';

        let cursor = { x: 200, y: 300, active: true };
        let ripple = { x: 0, y: 0, radius: 0, active: false };
        let particles = [];
        let currentRubricRow = 0;

        // Progress Controllers
        let p = {
            cardScale: 0,
            scrollY: 0,           
            dropOpen: 0,          
            dropSelected: false,  
            short: 0,             
            essay: 0,             
            submitW: 280,         
            submitH: 50,
            submitColor: c_orange,
            loadingSpin: 0,
            formAlpha: 1,         
            rubricMorph: 0,       
            rubricScores: [0, 0, 0, 0], 
            scorePop: 0,          
        };

        function getLeftWidth() {
            return canvas.width > 1024 ? canvas.width * 0.55 : canvas.width;
        }

        function lerp(a, b, t) {
            return a + (b - a) * t;
        }

        function drawRoundedRect(x, y, w, h, r) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
        }

        function spawnParticles(x, y, color) {
            for(let i=0; i<15; i++) {
                particles.push({
                    x: x, y: y,
                    vx: (Math.random() - 0.5) * 4,
                    vy: (Math.random() - 0.5) * 4 - 2,
                    life: 1,
                    color: color
                });
            }
        }

        function updateParticles() {
            for(let i=particles.length-1; i>=0; i--) {
                let pt = particles[i];
                pt.x += pt.vx;
                pt.y += pt.vy;
                pt.life -= 0.03;
                if(pt.life <= 0) particles.splice(i, 1);
            }
        }

        function drawParticles() {
            particles.forEach(pt => {
                ctx.globalAlpha = pt.life;
                ctx.fillStyle = pt.color;
                ctx.shadowColor = pt.color;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.life * 3, 0, Math.PI*2);
                ctx.fill();
                ctx.shadowBlur = 0;
            });
            ctx.globalAlpha = 1;
        }

        function drawBackground() {
            ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
            let yOffset = (globalTick * 0.5) % 30;
            for(let x=0; x<canvas.width; x+=30) {
                for(let y=0; y<canvas.height + 30; y+=30) {
                    ctx.beginPath(); ctx.arc(x, y - yOffset, 1.5, 0, Math.PI*2); ctx.fill();
                }
            }
        }

        function drawUI() {
            const baseW = 340;
            const cw = lerp(baseW, 460, p.rubricMorph); 
            const ch = 480;
            
            // Virtual coordinates (centered at 0,0)
            const cx = -cw / 2;
            const cy = -ch / 2;

            if (p.cardScale > 0 && p.scorePop === 0) {
                ctx.save();
                
                let s = p.cardScale + Math.sin(p.cardScale * Math.PI) * 0.1;
                ctx.scale(s, s);

                // Base Card Panel
                ctx.fillStyle = c_card;
                ctx.shadowColor = "rgba(0,0,0,0.6)";
                ctx.shadowBlur = 40;
                ctx.shadowOffsetY = 15;
                drawRoundedRect(cx, cy, cw, ch, 16);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
                ctx.strokeStyle = c_border;
                ctx.lineWidth = 1;
                ctx.stroke();

                // Masking block
                ctx.save();
                drawRoundedRect(cx, cy, cw, ch, 16);
                ctx.clip();

                // ---------------- FORM VIEW ----------------
                if (p.formAlpha > 0) {
                    ctx.globalAlpha = p.formAlpha;
                    ctx.save();
                    ctx.translate(0, p.scrollY);

                    ctx.fillStyle = c_fill;
                    drawRoundedRect(cx + 30, cy + 30, 120, 14, 4); ctx.fill();
                    ctx.fillStyle = c_empty;
                    drawRoundedRect(cx + 30, cy + 55, 200, 10, 4); ctx.fill();
                    drawRoundedRect(cx + 30, cy + 70, 150, 10, 4); ctx.fill();

                    const dropY = cy + 110;
                    ctx.fillStyle = c_empty;
                    drawRoundedRect(cx + 30, dropY, baseW - 60, 45, 8); ctx.fill();
                    
                    ctx.fillStyle = "rgba(255,255,255,0.2)";
                    ctx.save();
                    ctx.translate(cx + baseW - 45, dropY + 22);
                    if (p.dropOpen > 0) ctx.scale(1, -1); 
                    ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(5, -2); ctx.lineTo(0, 4); ctx.fill();
                    ctx.restore();

                    if (p.dropOpen > 0) {
                        const expandH = 80 * p.dropOpen;
                        ctx.fillStyle = "#1e1d1a";
                        ctx.shadowColor = "rgba(0,0,0,0.5)";
                        ctx.shadowBlur = 10;
                        drawRoundedRect(cx + 30, dropY + 50, baseW - 60, expandH, 8);
                        ctx.fill();
                        ctx.shadowBlur = 0;
                        
                        ctx.fillStyle = "rgba(255,255,255,0.05)";
                        if (p.dropOpen > 0.5) {
                            drawRoundedRect(cx + 45, dropY + 65, baseW - 120, 10, 3); ctx.fill();
                            ctx.fillStyle = "rgba(249, 115, 22, 0.2)";
                            drawRoundedRect(cx + 40, dropY + 90, baseW - 80, 24, 4); ctx.fill();
                            ctx.fillStyle = c_orange;
                            drawRoundedRect(cx + 45, dropY + 97, baseW - 150, 10, 3); ctx.fill();
                        }
                    }

                    if (p.dropSelected) {
                        ctx.fillStyle = c_fill;
                        drawRoundedRect(cx + 45, dropY + 15, baseW - 130, 15, 4); ctx.fill();
                    }

                    const yShift = 80 * p.dropOpen;

                    const shortY = cy + 175 + yShift;
                    ctx.fillStyle = c_empty;
                    drawRoundedRect(cx + 30, shortY, baseW - 60, 45, 8); ctx.fill();

                    if (p.short > 0) {
                        ctx.fillStyle = c_fill;
                        drawRoundedRect(cx + 45, shortY + 15, (baseW - 90) * p.short, 15, 4); ctx.fill();
                    }

                    const essayY = cy + 240 + yShift;
                    const essayH = 140;
                    ctx.fillStyle = c_empty;
                    drawRoundedRect(cx + 30, essayY, baseW - 60, essayH, 8); ctx.fill();
                    
                    ctx.fillStyle = "rgba(255,255,255,0.03)";
                    drawRoundedRect(cx + baseW - 40, essayY + 10, 4, essayH - 20, 2); ctx.fill();

                    if (p.essay > 0) {
                        ctx.fillStyle = c_fill;
                        const totalLines = 5;
                        for (let i = 0; i < totalLines; i++) {
                            let lineP = Math.min(1, Math.max(0, (p.essay * totalLines) - i));
                            const shortEdge = (i === totalLines - 1) ? 80 : 0; 
                            if (lineP > 0) {
                                drawRoundedRect(cx + 45, essayY + 20 + (i * 24), (baseW - 110 - shortEdge) * lineP, 12, 4); 
                                ctx.fill();
                            }
                        }
                        if (p.essay < 1 && Math.floor(globalTick / 15) % 2 === 0) {
                            const currentLine = Math.floor(p.essay * totalLines);
                            const lineW = (baseW - 110) * ((p.essay * totalLines) % 1);
                            if (currentLine < totalLines) {
                                ctx.fillStyle = c_orange;
                                ctx.fillRect(cx + 45 + lineW, essayY + 20 + (currentLine * 24), 4, 12);
                            }
                        }
                    }

                    const submitY = cy + 400 + yShift;
                    const btnCx = cx + baseW/2;
                    const btnCy = submitY + 25;

                    ctx.save();
                    ctx.translate(btnCx, btnCy);
                    ctx.fillStyle = p.submitColor;
                    
                    drawRoundedRect(-p.submitW/2, -p.submitH/2, p.submitW, p.submitH, p.submitH/2);
                    if(p.submitW > p.submitH) {
                        ctx.shadowColor = "rgba(249, 115, 22, 0.4)";
                        ctx.shadowBlur = 15;
                        ctx.fill();
                    } else {
                        ctx.shadowBlur = 0;
                        ctx.strokeStyle = "rgba(255,255,255,0.1)";
                        ctx.lineWidth = 4;
                        ctx.beginPath(); ctx.arc(0,0, p.submitH/2 - 4, 0, Math.PI*2); ctx.stroke();
                        
                        ctx.strokeStyle = c_orange;
                        ctx.lineCap = "round";
                        p.loadingSpin += 0.2;
                        ctx.beginPath(); ctx.arc(0,0, p.submitH/2 - 4, p.loadingSpin, p.loadingSpin + Math.PI/2); ctx.stroke();
                    }
                    ctx.restore();
                    ctx.restore(); 

                    if (p.scrollY < 0) {
                        const scrollTrackH = ch - 40;
                        const thumbH = scrollTrackH * (ch / (ch + 150)); 
                        const thumbY = cy + 20 + (-p.scrollY * 0.6); 
                        
                        ctx.fillStyle = "rgba(255,255,255,0.05)";
                        drawRoundedRect(cx + baseW - 12, cy + 20, 4, scrollTrackH, 2); ctx.fill();
                        ctx.fillStyle = "rgba(255,255,255,0.2)";
                        drawRoundedRect(cx + baseW - 12, thumbY, 4, thumbH, 2); ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                }

                // ---------------- RUBRIC VIEW ----------------
                if (p.rubricMorph > 0) {
                    ctx.globalAlpha = p.rubricMorph;
                    
                    ctx.fillStyle = c_orange;
                    ctx.shadowColor = c_orange;
                    ctx.shadowBlur = 10;
                    drawRoundedRect(cx + 30, cy + 30, 200, 16, 4); ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = "rgba(255,255,255,0.1)";
                    drawRoundedRect(cx + 30, cy + 55, 140, 8, 4); ctx.fill();

                    const boxW = 55;
                    const boxH = 45;

                    for (let r=0; r<4; r++) {
                        let rowY = cy + 100 + (r * 80);
                        
                        ctx.fillStyle = c_empty;
                        drawRoundedRect(cx + 30, rowY + 15, 100, 12, 4); ctx.fill();

                        for(let b=0; b<4; b++) {
                            let blockX = cx + 160 + (b * (boxW + 10));
                            let isFilled = (b < p.rubricScores[r]);

                            ctx.fillStyle = isFilled ? c_orange : c_empty;
                            if (isFilled) {
                                ctx.shadowColor = c_orange;
                                ctx.shadowBlur = 15;
                            }
                            drawRoundedRect(blockX, rowY, boxW, boxH, 6);
                            ctx.fill();
                            ctx.shadowBlur = 0;
                        }
                    }

                    ctx.globalAlpha = 1;
                }

                ctx.restore(); 
                ctx.restore(); 
            }

            // ================= SCORE REVEAL =================
            if (p.scorePop > 0) {
                ctx.save();
                
                let pop = p.scorePop;
                let s = pop + Math.sin(pop * Math.PI) * 0.2;
                ctx.scale(s, s);
                ctx.globalAlpha = Math.min(1, pop * 2);

                const g = ctx.createRadialGradient(0,0,40, 0,0,120);
                g.addColorStop(0, "rgba(249, 115, 22, 0.2)");
                g.addColorStop(1, "transparent");
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(0,0, 120, 0, Math.PI*2); ctx.fill();

                ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
                ctx.lineWidth = 16;
                ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.stroke();

                ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(0, 0, 110, 0, Math.PI * 2); ctx.stroke();

                ctx.shadowColor = c_orange;
                ctx.shadowBlur = 25;
                ctx.strokeStyle = c_orange;
                ctx.lineWidth = 16;
                ctx.lineCap = "round";
                ctx.beginPath(); 
                ctx.arc(0, 0, 90, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * 0.94 * pop)); 
                ctx.stroke();
                ctx.shadowBlur = 0;

                ctx.fillStyle = c_card;
                ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.fill();

                ctx.fillStyle = c_orange;
                ctx.font = "bold 64px Inter";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(Math.floor(94 * pop), 0, 5);

                ctx.fillStyle = "rgba(255,255,255,0.5)";
                ctx.font = "600 12px Inter";
                ctx.letterSpacing = "2px";
                ctx.fillText("SCORE", 0, -40);

                ctx.restore();
            }
        }

        function drawCursorObject() {
            if (!cursor.active) return;
            if (p.cardScale <= 0 && p.scorePop > 0) return; 

            if (ripple.active) {
                ctx.beginPath();
                ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(249, 115, 22, ${1 - (ripple.radius / 40)})`;
                ctx.lineWidth = 2;
                ctx.stroke();
                ripple.radius += 2.5;
                if (ripple.radius > 40) ripple.active = false;
            }

            ctx.save();
            ctx.translate(cursor.x, cursor.y);
            const cScale = ripple.active && ripple.radius < 10 ? 0.8 : 1;
            ctx.scale(cScale, cScale);

            ctx.fillStyle = "white";
            ctx.shadowBlur = 8;
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.beginPath();
            ctx.moveTo(0,0); ctx.lineTo(0, 20); ctx.lineTo(5, 15); ctx.lineTo(13, 15);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        function triggerClick(tx, ty) {
            ripple.x = tx;
            ripple.y = ty;
            ripple.radius = 0;
            ripple.active = true;
        }

        function updateAnimation() {
            stateTime++;
            globalTick++;

            const baseW = 340;
            const cw = lerp(baseW, 460, p.rubricMorph); 
            const ch = 480;
            
            // Virtual coords center
            const cx = -cw / 2;
            const cy = -ch / 2;

            const tDrop = { x: cx + cw - 50, y: cy + 130 + p.scrollY };
            const tDropSel = { x: cx + cw/2, y: cy + 200 + p.scrollY };
            const tShort = { x: cx + cw/2, y: cy + 195 + p.scrollY };
            const tEssay = { x: cx + cw/2, y: cy + 280 + p.scrollY };
            const tSubmit = { x: cx + cw/2, y: cy + 425 + p.scrollY };

            switch(state) {
                case 'MORPH_IN':
                    p.cardScale = lerp(p.cardScale, 1, 0.08);
                    if (p.cardScale > 0.99) {
                        p.cardScale = 1;
                        if (stateTime > 30) { state = 'M_DROP'; stateTime = 0; }
                    }
                    break;
                
                case 'M_DROP':
                    cursor.x = lerp(cursor.x, tDrop.x, 0.1);
                    cursor.y = lerp(cursor.y, tDrop.y, 0.1);
                    if (Math.abs(cursor.x - tDrop.x) < 2 && stateTime > 20) {
                        triggerClick(cursor.x, cursor.y);
                        state = 'OPEN_DROP';
                        stateTime = 0;
                    }
                    break;

                case 'OPEN_DROP':
                    p.dropOpen = lerp(p.dropOpen, 1, 0.2);
                    cursor.x = lerp(cursor.x, tDropSel.x, 0.15);
                    cursor.y = lerp(cursor.y, tDropSel.y, 0.15);
                    if (stateTime > 30) {
                        triggerClick(cursor.x, cursor.y);
                        p.dropSelected = true;
                        state = 'CLOSE_DROP';
                        stateTime = 0;
                    }
                    break;

                case 'CLOSE_DROP':
                    p.dropOpen = lerp(p.dropOpen, 0, 0.2);
                    if (p.dropOpen < 0.01) {
                        p.dropOpen = 0;
                        if(stateTime > 15) { state = 'M_SHORT'; stateTime = 0; }
                    }
                    break;

                case 'M_SHORT':
                    cursor.x = lerp(cursor.x, tShort.x, 0.1);
                    cursor.y = lerp(cursor.y, tShort.y, 0.1);
                    if (Math.abs(cursor.x - tShort.x) < 2 && stateTime > 15) {
                        triggerClick(cursor.x, cursor.y);
                        state = 'F_SHORT';
                        stateTime = 0;
                    }
                    break;

                case 'F_SHORT':
                    p.short += 0.04;
                    if (p.short >= 1) {
                        p.short = 1;
                        if (stateTime > 30) { state = 'SCROLL_DOWN'; stateTime = 0; }
                    }
                    break;

                case 'SCROLL_DOWN':
                    p.scrollY = lerp(p.scrollY, -150, 0.06);
                    cursor.x = lerp(cursor.x, cx + cw/2, 0.1);
                    cursor.y = lerp(cursor.y, cy + ch/2, 0.1);
                    
                    if (Math.abs(p.scrollY - (-150)) < 1) {
                        p.scrollY = -150;
                        state = 'M_ESSAY';
                        stateTime = 0;
                    }
                    break;

                case 'M_ESSAY':
                    cursor.x = lerp(cursor.x, tEssay.x, 0.1);
                    cursor.y = lerp(cursor.y, tEssay.y, 0.1);
                    if (Math.abs(cursor.x - tEssay.x) < 2 && stateTime > 15) {
                        triggerClick(cursor.x, cursor.y);
                        state = 'F_ESSAY';
                        stateTime = 0;
                    }
                    break;

                case 'F_ESSAY':
                    p.essay += 0.015;
                    if (p.essay >= 1) {
                        p.essay = 1;
                        if (stateTime > 40) { state = 'M_SUBMIT'; stateTime = 0; }
                    }
                    break;

                case 'M_SUBMIT':
                    cursor.x = lerp(cursor.x, tSubmit.x, 0.1);
                    cursor.y = lerp(cursor.y, tSubmit.y, 0.1);
                    if (Math.abs(cursor.x - tSubmit.x) < 2 && stateTime > 15) {
                        triggerClick(cursor.x, cursor.y);
                        state = 'C_SUBMIT';
                        stateTime = 0;
                    }
                    break;

                case 'C_SUBMIT':
                    p.submitW = lerp(p.submitW, 260, 0.4); 
                    if (stateTime > 8) {
                        state = 'LOADING';
                        stateTime = 0;
                    }
                    break;

                case 'LOADING':
                    p.submitW = lerp(p.submitW, p.submitH, 0.15);
                    p.submitColor = "transparent";
                    cursor.x = lerp(cursor.x, 200, 0.05); 
                    cursor.y = lerp(cursor.y, 300, 0.05);

                    if (stateTime % 5 === 0 && p.submitW < 80) {
                        spawnParticles(tSubmit.x, tSubmit.y, c_orange);
                    }

                    if (stateTime > 100) {
                        state = 'MORPH_TO_RUBRIC';
                        stateTime = 0;
                    }
                    break;

                case 'MORPH_TO_RUBRIC':
                    p.formAlpha = Math.max(0, p.formAlpha - 0.1);
                    p.rubricMorph = lerp(p.rubricMorph, 1, 0.08);
                    
                    if (p.rubricMorph > 0.99) {
                        p.rubricMorph = 1;
                        currentRubricRow = 0;
                        cursor.active = true; 
                        state = 'M_RUBRIC_ROW';
                        stateTime = 0;
                    }
                    break;

                case 'M_RUBRIC_ROW':
                    if (currentRubricRow >= 4) {
                        state = 'RUBRIC_DONE';
                        stateTime = 0;
                        break;
                    }
                    
                    const targetScores = [4, 3, 4, 4];
                    const targetScore = targetScores[currentRubricRow];
                    
                    const boxW = 55;
                    const boxH = 45;
                    const blockX = cx + 160 + ((targetScore - 1) * (boxW + 10)) + boxW/2;
                    const rowY = cy + 100 + (currentRubricRow * 80) + boxH/2;

                    cursor.x = lerp(cursor.x, blockX, 0.15);
                    cursor.y = lerp(cursor.y, rowY, 0.15);

                    if (Math.abs(cursor.x - blockX) < 2 && stateTime > 15) {
                        triggerClick(cursor.x, cursor.y);
                        state = 'C_RUBRIC_ROW';
                        stateTime = 0;
                    }
                    break;

                case 'C_RUBRIC_ROW':
                    if (stateTime === 8) {
                        const targetScores = [4, 3, 4, 4];
                        p.rubricScores[currentRubricRow] = targetScores[currentRubricRow];
                    }
                    if (stateTime > 20) {
                        currentRubricRow++;
                        state = 'M_RUBRIC_ROW';
                        stateTime = 0;
                    }
                    break;

                case 'RUBRIC_DONE':
                    if (stateTime > 40) {
                        state = 'MORPH_OUT';
                        stateTime = 0;
                        cursor.active = false;
                    }
                    break;

                case 'MORPH_OUT':
                    p.cardScale = lerp(p.cardScale, 0, 0.1);
                    if (p.cardScale < 0.01) {
                        p.cardScale = 0;
                        state = 'SHOW_SCORE';
                        stateTime = 0;
                        spawnParticles(0, 0, c_orange);
                        spawnParticles(0, 0, "#ffffff");
                    }
                    break;

                case 'SHOW_SCORE':
                    p.scorePop = lerp(p.scorePop, 1, 0.08);
                    if (p.scorePop > 0.99) {
                        p.scorePop = 1;
                        if (stateTime > 150) { state = 'RESET'; stateTime = 0; }
                    }
                    break;

                case 'RESET':
                    p.scorePop = lerp(p.scorePop, 0, 0.1);
                    if (p.scorePop < 0.01) {
                        p = { 
                            cardScale: 0, scrollY: 0, dropOpen: 0, dropSelected: false, 
                            short: 0, essay: 0, submitW: 280, submitH: 50, 
                            submitColor: c_orange, loadingSpin: 0, formAlpha: 1, 
                            rubricMorph: 0, rubricScores: [0, 0, 0, 0], scorePop: 0, pulseScore: 0 
                        };
                        currentRubricRow = 0;
                        cursor = { x: 200, y: 300, active: true };
                        state = 'MORPH_IN';
                        stateTime = 0;
                    }
                    break;
            }
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Background drawn in absolute screen space
            drawBackground();
            
            // Calculate Responsive Scale
            const leftW = getLeftWidth();
            const scaleFactor = Math.min(leftW / 600, canvas.height / 700, 1.5);
            
            // Establish Virtual Coordinate Space (Centered at 0,0, Scaled appropriately)
            ctx.save();
            ctx.translate(leftW / 2, canvas.height / 2);
            ctx.scale(scaleFactor, scaleFactor);
            
            updateParticles();
            updateAnimation();
            drawUI();
            drawParticles();
            drawCursorObject();
            
            ctx.restore();

            requestAnimationFrame(animate);
        }

        function handleLogin() {
            document.getElementById('statusModal').style.display = 'flex';
        }

        function closeModal() {
            document.getElementById('statusModal').style.display = 'none';
        }

        requestAnimationFrame(animate);

    </script>
</body>
</html>