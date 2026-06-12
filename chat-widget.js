// Insight Center Guide — chat-first widget with voice mode
// Zero dependencies. Drop <script src="/chat-widget.js" defer></script> before </body>.

(function () {
  'use strict';

  var TEAL     = '#24594E';
  var MINT     = '#3EA882';
  var OFFWHITE = '#F7F6F2';

  var GREETING = "Hi, I'm the Insight Center Guide. Ask me anything about our services, team, or approach to cognitive development.";

  // Latency tuning
  var PAUSE_MS           = 650;  // silence before sending (was 900)
  var INTERRUPT_PAUSE_MS = 800;  // pause after interrupting agent speech
  var FIRST_FLUSH_CHARS  = 48;   // flush first TTS chunk early so audio starts fast

  var history      = [];
  var voiceMode    = false; // are we in voice mode (orb view, mic running)?
  var voiceOn      = true;  // mute toggle within voice mode
  var greetingDone = false;
  var warmed       = false;
  var srSupported  = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // ── State ─────────────────────────────────────────────────────────────────
  // 'idle' | 'listening' | 'thinking' | 'speaking'
  var state = 'idle';

  function setState(s) {
    state = s;
    var orbWrap = document.getElementById('ic-orb-wrap');
    var wave    = document.getElementById('ic-wave');
    var label   = document.getElementById('ic-orb-label');
    if (orbWrap) orbWrap.className = (s === 'idle' ? '' : s);
    if (wave)    wave.classList.toggle('active', s === 'listening' || s === 'speaking');
    if (label && s !== 'listening') {
      label.textContent = { thinking: 'Thinking…', speaking: 'Speaking…' }[s] || 'Insight Center Guide';
      label.classList.remove('interim');
    }
  }

  // ── Warmup (avoid serverless cold-start lag on first message) ─────────────

  function warm() {
    if (warmed) return;
    warmed = true;
    try {
      fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ warmup: true }) }).catch(function () {});
      fetch('/api/tts',  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ warmup: true }) }).catch(function () {});
    } catch (_) {}
  }

  // ── TTS audio queue ────────────────────────────────────────────────────────
  var audioQueue   = [];   // array of Promise<string|null> (blob URL or null)
  var audioPlaying = false;
  var streamDone   = false; // true when no more TTS chunks will arrive
  var curAudio     = null;
  var playGen      = 0;    // incremented on reset to invalidate stale callbacks

  function resetAudio() {
    playGen++;
    streamDone   = false;
    audioQueue   = [];
    audioPlaying = false;
    ttsBuffer    = '';
    if (curAudio) { curAudio.pause(); curAudio = null; }
  }

  function onAudioDone() {
    audioPlaying = false;
    curAudio     = null;
    if (audioQueue.length > 0) {
      playNext();
    } else if (streamDone) {
      // All audio finished — resume listening if still in voice mode
      setState('idle');
      if (voiceMode && srSupported) {
        clearTimeout(sendTimer);
        sendTimer = null;
        pendingFinal = '';
        setTimeout(startRec, 300);
      }
    }
  }

  function playNext() {
    if (audioPlaying || audioQueue.length === 0) return;
    audioPlaying = true;
    setState('speaking');
    if (voiceMode) startRec(); // keep mic live so barge-in can fire
    var p   = audioQueue.shift();
    var gen = playGen;
    p.then(function (url) {
      if (gen !== playGen) { if (url) URL.revokeObjectURL(url); return; }
      if (!url) { onAudioDone(); return; }
      curAudio = new Audio(url);
      curAudio.onended = function () { URL.revokeObjectURL(url); onAudioDone(); };
      curAudio.onerror = function () { URL.revokeObjectURL(url); onAudioDone(); };
      curAudio.play().catch(onAudioDone);
    }).catch(function () { if (gen === playGen) onAudioDone(); });
  }

  function enqueueTTS(text) {
    if (!text.trim() || !voiceMode || !voiceOn) return;
    firstChunkSent = true;
    var p = fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
    }).then(function (r) {
      if (!r.ok) throw new Error('tts');
      return r.blob();
    }).then(function (b) {
      return URL.createObjectURL(b);
    }).catch(function () {
      return null; // skip silently — no browser TTS fallback to avoid double-voice
    });
    audioQueue.push(p);
    playNext();
  }

  // ── Sentence / clause buffer ───────────────────────────────────────────────
  // First chunk is flushed aggressively (clause or ~48 chars) so audio starts
  // as soon as possible. After that, flush on sentence endings, commas after
  // 60+ chars, or a hard cap at 120 chars.

  var ttsBuffer      = '';
  var firstChunkSent = false;

  function flushTTS(force) {
    while (true) {
      // Sentence boundary — always flush
      var m = ttsBuffer.match(/^(.*?[.!?]+)\s/);
      if (m) { enqueueTTS(m[1]); ttsBuffer = ttsBuffer.slice(m[0].length); continue; }

      if (!firstChunkSent) {
        // Aggressive first flush: clause boundary after 15+ chars
        var fi = ttsBuffer.search(/[,;:]\s/);
        if (fi >= 15) { enqueueTTS(ttsBuffer.slice(0, fi + 1)); ttsBuffer = ttsBuffer.slice(fi + 2); continue; }
        // Or word boundary near FIRST_FLUSH_CHARS
        if (ttsBuffer.length >= FIRST_FLUSH_CHARS) {
          var fw = ttsBuffer.lastIndexOf(' ', FIRST_FLUSH_CHARS);
          if (fw > 20) { enqueueTTS(ttsBuffer.slice(0, fw)); ttsBuffer = ttsBuffer.slice(fw + 1); continue; }
        }
      } else {
        // Comma/semicolon boundary after 60+ chars
        if (ttsBuffer.length >= 60) {
          var ci = ttsBuffer.search(/[,;]\s/);
          if (ci > 20) { enqueueTTS(ttsBuffer.slice(0, ci + 1)); ttsBuffer = ttsBuffer.slice(ci + 2); continue; }
        }
        // Hard cap: flush at word boundary around 120 chars
        if (ttsBuffer.length >= 120) {
          var si = ttsBuffer.lastIndexOf(' ', 120);
          if (si > 40) { enqueueTTS(ttsBuffer.slice(0, si)); ttsBuffer = ttsBuffer.slice(si + 1); continue; }
        }
      }

      break;
    }

    if (force && ttsBuffer.trim()) {
      enqueueTTS(ttsBuffer);
      ttsBuffer = '';
    }
  }

  // ── SVGs ──────────────────────────────────────────────────────────────────

  var SVG = {
    chat:   '<svg width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    close:  '<svg width="20" height="20" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    person: '<svg width="13" height="13" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
    volOn:  '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    volOff: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    mic:    '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    send:   '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    keys:   '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="10"/><line x1="10" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="14" y2="10"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="7" y1="14" x2="17" y2="14"/></svg>',
  };

  // ── CSS ───────────────────────────────────────────────────────────────────

  var CSS = [
    '#ic-wrap *{box-sizing:border-box}',
    '#ic-btn{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;',
    'background:' + TEAL + ';border:none;cursor:pointer;box-shadow:0 4px 24px rgba(36,89,78,.4);',
    'display:flex;align-items:center;justify-content:center;z-index:9999;',
    'transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s ease}',
    '#ic-btn:hover{transform:scale(1.1)}#ic-btn:active{transform:scale(.93)}',
    '#ic-btn .ic-chat{transition:opacity .2s,transform .2s}',
    '#ic-btn .ic-x{position:absolute;opacity:0;transform:scale(.6) rotate(-90deg);transition:opacity .2s,transform .2s}',
    '#ic-btn.open .ic-chat{opacity:0;transform:scale(.6) rotate(90deg)}',
    '#ic-btn.open .ic-x{opacity:1;transform:scale(1) rotate(0)}',

    '#ic-panel{position:fixed;bottom:96px;right:24px;width:340px;background:#fff;border-radius:20px;',
    'box-shadow:0 16px 56px rgba(36,89,78,.18),0 2px 10px rgba(0,0,0,.07);',
    'display:flex;flex-direction:column;overflow:hidden;z-index:9998;',
    'transform:translateY(20px) scale(.96);opacity:0;pointer-events:none;',
    'transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .22s ease}',
    '#ic-panel.open{transform:translateY(0) scale(1);opacity:1;pointer-events:all}',
    '@media(max-width:420px){#ic-panel{width:calc(100vw - 20px);right:10px;bottom:84px}#ic-btn{bottom:18px;right:18px}}',

    '#ic-head{background:' + TEAL + ';padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}',
    '#ic-head-left{display:flex;align-items:center;gap:10px}',
    '#ic-head-dot{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '#ic-head-name{font-family:"DM Serif Display",Georgia,serif;font-size:14.5px;color:#fff;line-height:1.2;letter-spacing:.01em}',
    '#ic-head-tag{font-family:"Outfit",sans-serif;font-size:10.5px;color:rgba(255,255,255,.6);margin-top:1px}',
    '#ic-vol{background:transparent;border:none;cursor:pointer;color:rgba(255,255,255,.55);padding:5px;border-radius:6px;display:none;transition:color .15s}',
    '#ic-panel.voice #ic-vol{display:flex}',
    '#ic-vol:hover{color:#fff}#ic-vol.on{color:#8ED3AE}',

    // Orb area — hidden in chat mode, shown in voice mode
    '#ic-orb-area{background:' + OFFWHITE + ';padding:28px 0 20px;display:none;flex-direction:column;align-items:center;gap:14px;flex-shrink:0}',
    '#ic-panel.voice #ic-orb-area{display:flex}',
    '#ic-orb-wrap{position:relative;width:96px;height:96px;display:flex;align-items:center;justify-content:center}',
    '#ic-orb-wrap .ic-ring{position:absolute;border-radius:50%;opacity:0;transition:opacity .3s}',
    '#ic-orb-wrap .ic-ring-1{width:96px;height:96px;border:2px solid ' + MINT + '}',
    '#ic-orb-wrap .ic-ring-2{width:116px;height:116px;border:1.5px solid ' + MINT + '}',
    '#ic-orb-wrap .ic-ring-3{width:136px;height:136px;border:1px solid ' + MINT + '}',
    '#ic-orb-wrap.listening .ic-ring-1{opacity:.7;animation:ic-ripple 1.6s ease-out infinite}',
    '#ic-orb-wrap.listening .ic-ring-2{opacity:.45;animation:ic-ripple 1.6s ease-out .35s infinite}',
    '#ic-orb-wrap.listening .ic-ring-3{opacity:.25;animation:ic-ripple 1.6s ease-out .7s infinite}',
    '#ic-orb-wrap.speaking .ic-ring-1{opacity:.6;animation:ic-ripple .9s ease-out infinite}',
    '#ic-orb-wrap.speaking .ic-ring-2{opacity:.38;animation:ic-ripple .9s ease-out .2s infinite}',
    '#ic-orb-wrap.speaking .ic-ring-3{opacity:.2;animation:ic-ripple .9s ease-out .4s infinite}',
    '@keyframes ic-ripple{0%{transform:scale(.85);opacity:.7}100%{transform:scale(1.1);opacity:0}}',
    '#ic-orb{width:72px;height:72px;border-radius:50%;position:relative;z-index:1;',
    'background:radial-gradient(circle at 38% 35%,' + MINT + ',' + TEAL + ');',
    'box-shadow:0 4px 20px rgba(36,89,78,.35);animation:ic-orb-idle 3.5s ease-in-out infinite}',
    '@keyframes ic-orb-idle{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}',
    '#ic-orb-wrap.listening #ic-orb{background:radial-gradient(circle at 38% 35%,#e87070,#c03030);box-shadow:0 4px 24px rgba(200,48,48,.4);animation:ic-orb-listen .9s ease-in-out infinite}',
    '@keyframes ic-orb-listen{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}',
    '#ic-orb-wrap.thinking #ic-orb{background:radial-gradient(circle at 38% 35%,#8ED3AE,' + MINT + ');animation:ic-orb-think 1.2s ease-in-out infinite}',
    '@keyframes ic-orb-think{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}',
    '#ic-orb-wrap.speaking #ic-orb{animation:ic-orb-speak .65s ease-in-out infinite}',
    '@keyframes ic-orb-speak{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}',
    '#ic-orb-label{font-family:"Outfit",sans-serif;font-size:12px;color:#5a8a82;letter-spacing:.03em;',
    'text-align:center;max-width:260px;min-height:18px;padding:0 12px;line-height:1.4;transition:color .2s}',
    '#ic-orb-label.interim{color:#1a2e28;font-style:italic}',
    '#ic-wave{display:flex;align-items:center;gap:3px;height:20px;opacity:0;transition:opacity .3s}',
    '#ic-wave.active{opacity:1}',
    '#ic-wave span{width:3px;border-radius:2px;background:' + MINT + ';animation:ic-bar 1.2s ease-in-out infinite}',
    '#ic-wave span:nth-child(1){animation-delay:0s}#ic-wave span:nth-child(2){animation-delay:.1s}',
    '#ic-wave span:nth-child(3){animation-delay:.2s}#ic-wave span:nth-child(4){animation-delay:.3s}',
    '#ic-wave span:nth-child(5){animation-delay:.4s}#ic-wave span:nth-child(6){animation-delay:.15s}',
    '#ic-wave span:nth-child(7){animation-delay:.25s}',
    '@keyframes ic-bar{0%,100%{height:4px}50%{height:18px}}',

    // Transcript — tall in chat mode, compact in voice mode
    '#ic-transcript{max-height:320px;min-height:120px;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;',
    'gap:8px;background:#fff;scroll-behavior:smooth}',
    '#ic-panel.voice #ic-transcript{max-height:150px;min-height:0;border-top:1px solid rgba(36,89,78,.07)}',
    '#ic-transcript::-webkit-scrollbar{width:3px}',
    '#ic-transcript::-webkit-scrollbar-thumb{background:rgba(36,89,78,.15);border-radius:2px}',
    '.ic-row{display:flex;gap:7px;align-items:flex-end}.ic-row.user{flex-direction:row-reverse}',
    '.ic-av{width:22px;height:22px;border-radius:50%;background:' + MINT + ';display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.ic-bbl{max-width:82%;padding:7px 11px;border-radius:12px;font-family:"Outfit",sans-serif;font-size:13px;line-height:1.5;color:#1a2e28}',
    '.ic-row.bot .ic-bbl{background:' + OFFWHITE + ';border-bottom-left-radius:3px}',
    '.ic-row.user .ic-bbl{background:' + TEAL + ';color:#fff;border-bottom-right-radius:3px}',
    '.ic-dots{display:flex;gap:4px;padding:3px 0}',
    '.ic-dots span{width:5px;height:5px;border-radius:50%;background:' + MINT + ';animation:ic-bounce 1.1s infinite}',
    '.ic-dots span:nth-child(2){animation-delay:.18s}.ic-dots span:nth-child(3){animation-delay:.36s}',
    '@keyframes ic-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}',

    // Chat input bar (hidden in voice mode)
    '#ic-bar{padding:10px 12px;background:#fff;border-top:1px solid rgba(36,89,78,.09);display:flex;gap:8px;align-items:center;flex-shrink:0}',
    '#ic-panel.voice #ic-bar{display:none}',
    '#ic-in{flex:1;border:1.5px solid #dde8e5;border-radius:10px;padding:8px 11px;font-family:"Outfit",sans-serif;font-size:13px;',
    'color:#1a2e28;resize:none;outline:none;height:38px;line-height:1.4;background:' + OFFWHITE + ';transition:border-color .2s}',
    '#ic-in:focus{border-color:' + MINT + '}#ic-in::placeholder{color:#9ab3ad;font-size:12px}',
    '#ic-send{width:34px;height:34px;border-radius:9px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;',
    'background:' + TEAL + ';color:#fff;transition:background .15s,transform .12s}',
    '#ic-send:hover{background:#1c4a41}#ic-send:active{transform:scale(.9)}',
    '#ic-send:disabled{background:#c5d5d2;cursor:not-allowed;transform:none}',

    // Voice mode entry button — orb-gradient circle in the chat bar
    '#ic-voicebtn{width:38px;height:38px;border-radius:50%;border:none;cursor:pointer;flex-shrink:0;',
    'background:radial-gradient(circle at 38% 35%,' + MINT + ',' + TEAL + ');color:#fff;',
    'display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(36,89,78,.3);',
    'transition:transform .15s,box-shadow .15s}',
    '#ic-voicebtn:hover{transform:scale(1.08);box-shadow:0 3px 14px rgba(36,89,78,.4)}',
    '#ic-voicebtn:active{transform:scale(.92)}',

    // Voice mode bottom bar (exit back to typing)
    '#ic-voicebar{display:none;padding:10px 12px;background:#fff;border-top:1px solid rgba(36,89,78,.09);justify-content:center;flex-shrink:0}',
    '#ic-panel.voice #ic-voicebar{display:flex}',
    '#ic-endvoice{display:flex;align-items:center;gap:7px;padding:8px 16px;border-radius:20px;border:1.5px solid #dde8e5;',
    'background:' + OFFWHITE + ';color:' + TEAL + ';cursor:pointer;font-family:"Outfit",sans-serif;font-size:12.5px;font-weight:500;',
    'transition:border-color .2s,background .2s}',
    '#ic-endvoice:hover{border-color:' + MINT + ';background:#fff}',
  ].join('');

  // ── DOM ───────────────────────────────────────────────────────────────────

  function buildDOM() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
    var wrap = document.createElement('div');
    wrap.id = 'ic-wrap';
    wrap.innerHTML =
      '<button id="ic-btn" aria-label="Open Insight Center Guide">' +
        '<span class="ic-chat">' + SVG.mic + '</span>' +
        '<span class="ic-x">' + SVG.close + '</span>' +
      '</button>' +
      '<div id="ic-panel" role="dialog" aria-label="Insight Center Guide">' +
        '<div id="ic-head">' +
          '<div id="ic-head-left">' +
            '<div id="ic-head-dot">' + SVG.person + '</div>' +
            '<div><div id="ic-head-name">Insight Center Guide</div>' +
            '<div id="ic-head-tag">Ask us anything</div></div>' +
          '</div>' +
          '<button id="ic-vol" class="on" aria-label="Toggle voice audio">' + SVG.volOn + '</button>' +
        '</div>' +
        '<div id="ic-orb-area">' +
          '<div id="ic-orb-wrap">' +
            '<div class="ic-ring ic-ring-1"></div>' +
            '<div class="ic-ring ic-ring-2"></div>' +
            '<div class="ic-ring ic-ring-3"></div>' +
            '<div id="ic-orb"></div>' +
          '</div>' +
          '<div id="ic-wave"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>' +
          '<div id="ic-orb-label">Insight Center Guide</div>' +
        '</div>' +
        '<div id="ic-transcript" role="log" aria-live="polite"></div>' +
        '<div id="ic-bar">' +
          '<textarea id="ic-in" placeholder="Type your question…" rows="1" aria-label="Type your question"></textarea>' +
          '<button id="ic-send" aria-label="Send">' + SVG.send + '</button>' +
          (srSupported ? '<button id="ic-voicebtn" aria-label="Start voice mode" title="Talk to the Guide">' + SVG.mic + '</button>' : '') +
        '</div>' +
        '<div id="ic-voicebar">' +
          '<button id="ic-endvoice">' + SVG.keys + '<span>Type instead</span></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
  }

  // ── Transcript ────────────────────────────────────────────────────────────

  function botRow(text) {
    var t = document.getElementById('ic-transcript');
    var row = document.createElement('div');
    row.className = 'ic-row bot';
    row.innerHTML = '<div class="ic-av">' + SVG.person + '</div><div class="ic-bbl"></div>';
    row.querySelector('.ic-bbl').textContent = text;
    t.appendChild(row); t.scrollTop = t.scrollHeight;
    return row.querySelector('.ic-bbl');
  }

  function userRow(text) {
    var t = document.getElementById('ic-transcript');
    var row = document.createElement('div');
    row.className = 'ic-row user';
    var b = document.createElement('div');
    b.className = 'ic-bbl'; b.textContent = text;
    row.appendChild(b); t.appendChild(row); t.scrollTop = t.scrollHeight;
  }

  function typingRow() {
    var t = document.getElementById('ic-transcript');
    var row = document.createElement('div');
    row.className = 'ic-row bot'; row.id = 'ic-typing';
    row.innerHTML = '<div class="ic-av">' + SVG.person + '</div>' +
      '<div class="ic-bbl"><div class="ic-dots"><span></span><span></span><span></span></div></div>';
    t.appendChild(row); t.scrollTop = t.scrollHeight;
    return row;
  }

  // ── Speech recognition ────────────────────────────────────────────────────
  // Mic runs continuously while voice mode is active.
  // During speaking: any substantial speech interrupts the agent.
  // During listening: interim display + send-on-pause.

  var rec          = null;
  var recRunning   = false;
  var pendingFinal = '';
  var sendTimer    = null;

  function setupRecognition() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    rec = new SR();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-US';

    rec.addEventListener('start', function () {
      recRunning = true;
      if (state !== 'speaking' && state !== 'thinking') {
        setState('listening');
        setLabel('Listening…');
      }
    });

    rec.addEventListener('end', function () {
      recRunning = false;
      // Restart only while voice mode is active and we're not mid-response
      if (voiceMode && state !== 'thinking') {
        setTimeout(startRec, 250);
      }
    });

    rec.addEventListener('result', function (e) {
      var interim  = '';
      var newFinal = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) newFinal += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (newFinal) pendingFinal += newFinal;

      var display = (pendingFinal + interim).trim();

      if (state === 'speaking') {
        // Interrupt only on confirmed final speech (2+ words) — not breaths/interim noise
        if (newFinal && pendingFinal.trim().split(/\s+/).filter(Boolean).length >= 2) {
          resetAudio();
          clearTimeout(sendTimer);
          sendTimer = setTimeout(function () {
            var toSend = pendingFinal.trim() || display;
            if (!toSend) return;
            pendingFinal = ''; clearTimeout(sendTimer);
            stopRec();
            sendMessage(toSend);
          }, INTERRUPT_PAUSE_MS);
          setState('listening');
          setLabel(display, true);
        }
        return;
      }

      // Normal listening mode
      if (display) setLabel(display, true);

      clearTimeout(sendTimer);
      if (pendingFinal.trim()) {
        sendTimer = setTimeout(function () {
          var toSend = pendingFinal.trim();
          if (!toSend) return;
          pendingFinal = ''; clearTimeout(sendTimer);
          stopRec();
          setLabel('');
          sendMessage(toSend);
        }, PAUSE_MS);
      }
    });

    rec.addEventListener('error', function (e) {
      recRunning = false;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        exitVoice();
        botRow('I need microphone access for voice mode. You can keep typing here instead.');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setState('idle');
      }
    });
  }

  function startRec() {
    if (!rec || recRunning || !voiceMode) return;
    pendingFinal = '';
    try { rec.start(); } catch (_) {}
  }

  function stopRec() {
    if (rec && recRunning) { try { rec.stop(); } catch (_) {} }
  }

  function setLabel(text, interim) {
    var el = document.getElementById('ic-orb-label');
    if (!el) return;
    el.textContent = text || 'Insight Center Guide';
    el.classList.toggle('interim', !!interim);
  }

  // ── Voice mode enter / exit ───────────────────────────────────────────────

  function enterVoice() {
    if (voiceMode) return;
    voiceMode = true;
    warm();
    var panel = document.getElementById('ic-panel');
    panel.classList.add('voice');
    setState('idle');
    setLabel('Listening…');
    startRec();
  }

  function exitVoice() {
    voiceMode = false;
    stopRec();
    resetAudio();
    clearTimeout(sendTimer);
    var panel = document.getElementById('ic-panel');
    panel.classList.remove('voice');
    setState('idle');
    var input = document.getElementById('ic-in');
    if (input) input.focus();
  }

  // ── Send message / stream ─────────────────────────────────────────────────

  function sendMessage(text) {
    var sendBtn = document.getElementById('ic-send');
    var t       = document.getElementById('ic-transcript');

    history.push({ role: 'user', content: text });
    userRow(text);
    if (sendBtn) sendBtn.disabled = true;
    setState('thinking');
    resetAudio();
    firstChunkSent = false;
    streamDone = false;

    var typing  = typingRow();
    var bubble  = null;
    var fullTxt = '';

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    })
    .then(function (resp) {
      if (!resp.ok) return resp.json().catch(function () { return { error: 'Error ' + resp.status }; })
        .then(function (e) { throw new Error(e.error); });
      var reader = resp.body.getReader();
      var dec = new TextDecoder();
      var buf = '';
      function pump() {
        return reader.read().then(function (chunk) {
          if (chunk.done) return;
          buf += dec.decode(chunk.value, { stream: true });
          var lines = buf.split('\n'); buf = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            if (lines[i].indexOf('data: ') !== 0) continue;
            var raw = lines[i].slice(6).trim();
            if (raw === '[DONE]') continue;
            try {
              var p = JSON.parse(raw);
              if (p.error) throw new Error(p.error);
              if (p.text) {
                if (!bubble) { typing.parentNode && typing.parentNode.removeChild(typing); bubble = botRow(''); }
                fullTxt += p.text;
                bubble.textContent = fullTxt;
                t.scrollTop = t.scrollHeight;
                if (voiceMode && voiceOn) { ttsBuffer += p.text; flushTTS(false); }
              }
            } catch (_) {}
          }
          return pump();
        });
      }
      return pump();
    })
    .then(function () {
      if (sendBtn) sendBtn.disabled = false;
      typing.parentNode && typing.parentNode.removeChild(typing);
      if (fullTxt) history.push({ role: 'assistant', content: fullTxt });
      if (voiceMode && voiceOn) {
        flushTTS(true);
        streamDone = true;
        // If nothing queued or playing, go back to listening now
        if (!audioPlaying && audioQueue.length === 0) {
          setState('idle');
          setTimeout(startRec, 300);
        }
      } else {
        setState('idle');
        if (voiceMode) setTimeout(startRec, 300);
      }
    })
    .catch(function (err) {
      if (sendBtn) sendBtn.disabled = false;
      typing.parentNode && typing.parentNode.removeChild(typing);
      botRow('Sorry, something went wrong. Please call us at 540-533-3821.');
      setState('idle');
      if (voiceMode) setTimeout(startRec, 600);
      console.error('[IC Guide]', err);
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    buildDOM();
    setupRecognition();

    var btn      = document.getElementById('ic-btn');
    var panel    = document.getElementById('ic-panel');
    var input    = document.getElementById('ic-in');
    var sendBtn  = document.getElementById('ic-send');
    var voiceBtn = document.getElementById('ic-voicebtn');
    var endBtn   = document.getElementById('ic-endvoice');
    var volBtn   = document.getElementById('ic-vol');

    btn.addEventListener('click', function () {
      var opening = !panel.classList.contains('open');
      panel.classList.toggle('open', opening);
      btn.classList.toggle('open', opening);
      if (opening) {
        warm();
        if (!greetingDone) {
          greetingDone = true;
          botRow(GREETING);
        }
        setTimeout(enterVoice, 350); // go straight into voice mode
      } else {
        exitVoice();
      }
    });

    if (voiceBtn) voiceBtn.addEventListener('click', enterVoice);
    if (endBtn)   endBtn.addEventListener('click', exitVoice);

    function sendTyped() {
      var text = input.value.trim();
      if (!text || state === 'thinking') return;
      resetAudio(); clearTimeout(sendTimer);
      input.value = ''; input.style.height = 'auto';
      sendMessage(text);
    }
    sendBtn.addEventListener('click', sendTyped);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTyped(); }
    });
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 90) + 'px';
    });

    volBtn.addEventListener('click', function () {
      voiceOn = !voiceOn;
      volBtn.classList.toggle('on', voiceOn);
      volBtn.innerHTML = voiceOn ? SVG.volOn : SVG.volOff;
      if (!voiceOn) resetAudio();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
