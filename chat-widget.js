// Insight Center Guide — voice-first agent widget
// Zero dependencies. Drop <script src="/chat-widget.js" defer></script> before </body>.

(function () {
  'use strict';

  var TEAL     = '#24594E';
  var MINT     = '#3EA882';
  var OFFWHITE = '#F7F6F2';

  var GREETING_TEXT = "Hi, I'm the Insight Center Guide. Ask me anything about our services, team, or approach to cognitive development.";

  var history      = [];
  var voiceOn      = true;
  var curAudio     = null;
  var greetingDone = false;

  // Voice state
  var shouldListen = false;
  var isListening  = false;
  var isThinking   = false;
  var isSpeaking   = false;
  var rec          = null;
  var srSupported  = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // ── SVGs ──────────────────────────────────────────────────────────────────

  var SVG = {
    chat: '<svg width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    close: '<svg width="20" height="20" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    person: '<svg width="13" height="13" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
    speakerOn: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    speakerOff: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    mic: '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    stop: '<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
    send: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  };

  // ── CSS ───────────────────────────────────────────────────────────────────

  var CSS = [
    '#ic-wrap *{box-sizing:border-box}',

    // Launcher button
    '#ic-btn{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;',
    'background:' + TEAL + ';border:none;cursor:pointer;',
    'box-shadow:0 4px 24px rgba(36,89,78,.4);',
    'display:flex;align-items:center;justify-content:center;z-index:9999;',
    'transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s ease}',
    '#ic-btn:hover{transform:scale(1.1);box-shadow:0 6px 32px rgba(36,89,78,.5)}',
    '#ic-btn:active{transform:scale(.93)}',
    '#ic-btn .ic-chat{transition:opacity .2s,transform .2s}',
    '#ic-btn .ic-x{position:absolute;opacity:0;transform:scale(.6) rotate(-90deg);transition:opacity .2s,transform .2s}',
    '#ic-btn.open .ic-chat{opacity:0;transform:scale(.6) rotate(90deg)}',
    '#ic-btn.open .ic-x{opacity:1;transform:scale(1) rotate(0)}',

    // Panel
    '#ic-panel{position:fixed;bottom:96px;right:24px;width:340px;',
    'background:#fff;border-radius:20px;',
    'box-shadow:0 16px 56px rgba(36,89,78,.18),0 2px 10px rgba(0,0,0,.07);',
    'display:flex;flex-direction:column;overflow:hidden;z-index:9998;',
    'transform:translateY(20px) scale(.96);opacity:0;pointer-events:none;',
    'transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .22s ease}',
    '#ic-panel.open{transform:translateY(0) scale(1);opacity:1;pointer-events:all}',
    '@media(max-width:420px){',
    '#ic-panel{width:calc(100vw - 20px);right:10px;bottom:84px}',
    '#ic-btn{bottom:18px;right:18px}}',

    // Header
    '#ic-head{background:' + TEAL + ';padding:14px 16px;',
    'display:flex;align-items:center;justify-content:space-between;flex-shrink:0}',
    '#ic-head-left{display:flex;align-items:center;gap:10px}',
    '#ic-head-dot{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.15);',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '#ic-head-name{font-family:"DM Serif Display",Georgia,serif;font-size:14.5px;color:#fff;line-height:1.2;letter-spacing:.01em}',
    '#ic-head-tag{font-family:"Outfit",sans-serif;font-size:10.5px;color:rgba(255,255,255,.6);margin-top:1px}',
    '#ic-vol{background:transparent;border:none;cursor:pointer;color:rgba(255,255,255,.55);',
    'padding:5px;border-radius:6px;display:flex;transition:color .15s}',
    '#ic-vol:hover{color:#fff}',
    '#ic-vol.on{color:#8ED3AE}',

    // Orb area — the voice visual centerpiece
    '#ic-orb-area{background:' + OFFWHITE + ';padding:28px 0 20px;',
    'display:flex;flex-direction:column;align-items:center;gap:14px;flex-shrink:0}',

    '#ic-orb-wrap{position:relative;width:96px;height:96px;',
    'display:flex;align-items:center;justify-content:center}',

    // Ripple rings (shown when listening or speaking)
    '#ic-orb-wrap .ic-ring{position:absolute;border-radius:50%;opacity:0;',
    'transition:opacity .3s}',
    '#ic-orb-wrap .ic-ring-1{width:96px;height:96px;border:2px solid ' + MINT + '}',
    '#ic-orb-wrap .ic-ring-2{width:114px;height:114px;border:1.5px solid ' + MINT + '}',
    '#ic-orb-wrap .ic-ring-3{width:132px;height:132px;border:1px solid ' + MINT + '}',

    '#ic-orb-wrap.listening .ic-ring-1{opacity:.7;animation:ic-ripple 1.6s ease-out infinite}',
    '#ic-orb-wrap.listening .ic-ring-2{opacity:.45;animation:ic-ripple 1.6s ease-out .35s infinite}',
    '#ic-orb-wrap.listening .ic-ring-3{opacity:.25;animation:ic-ripple 1.6s ease-out .7s infinite}',
    '#ic-orb-wrap.speaking .ic-ring-1{opacity:.6;animation:ic-ripple 1s ease-out infinite}',
    '#ic-orb-wrap.speaking .ic-ring-2{opacity:.4;animation:ic-ripple 1s ease-out .2s infinite}',
    '#ic-orb-wrap.speaking .ic-ring-3{opacity:.22;animation:ic-ripple 1s ease-out .4s infinite}',
    '@keyframes ic-ripple{0%{transform:scale(.85);opacity:.7}100%{transform:scale(1.1);opacity:0}}',

    // The orb itself
    '#ic-orb{width:72px;height:72px;border-radius:50%;position:relative;z-index:1;',
    'background:radial-gradient(circle at 38% 35%,' + MINT + ',' + TEAL + ');',
    'box-shadow:0 4px 20px rgba(36,89,78,.35);',
    'transition:transform .3s ease,box-shadow .3s ease;',
    'animation:ic-orb-idle 3.5s ease-in-out infinite}',
    '@keyframes ic-orb-idle{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}',
    '#ic-orb-wrap.listening #ic-orb{',
    'background:radial-gradient(circle at 38% 35%,#e87070,#c03030);',
    'box-shadow:0 4px 24px rgba(200,48,48,.4);',
    'animation:ic-orb-listen .9s ease-in-out infinite}',
    '@keyframes ic-orb-listen{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}',
    '#ic-orb-wrap.thinking #ic-orb{',
    'background:radial-gradient(circle at 38% 35%,#8ED3AE,' + MINT + ');',
    'animation:ic-orb-think 1.4s ease-in-out infinite}',
    '@keyframes ic-orb-think{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}',
    '#ic-orb-wrap.speaking #ic-orb{',
    'animation:ic-orb-speak .7s ease-in-out infinite}',
    '@keyframes ic-orb-speak{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}',

    // Status label under orb
    '#ic-orb-label{font-family:"Outfit",sans-serif;font-size:12.5px;color:#5a8a82;',
    'letter-spacing:.04em;text-transform:uppercase;font-weight:500;min-height:18px;',
    'transition:opacity .2s}',

    // Waveform bars (visible when listening or speaking)
    '#ic-wave{display:flex;align-items:center;gap:3px;height:20px;opacity:0;',
    'transition:opacity .3s}',
    '#ic-wave.active{opacity:1}',
    '#ic-wave span{width:3px;border-radius:2px;background:' + MINT + ';',
    'animation:ic-bar 1.2s ease-in-out infinite}',
    '#ic-wave span:nth-child(1){animation-delay:0s}',
    '#ic-wave span:nth-child(2){animation-delay:.1s}',
    '#ic-wave span:nth-child(3){animation-delay:.2s}',
    '#ic-wave span:nth-child(4){animation-delay:.3s}',
    '#ic-wave span:nth-child(5){animation-delay:.4s}',
    '#ic-wave span:nth-child(6){animation-delay:.15s}',
    '#ic-wave span:nth-child(7){animation-delay:.25s}',
    '@keyframes ic-bar{0%,100%{height:4px}50%{height:18px}}',

    // Transcript area
    '#ic-transcript{max-height:180px;overflow-y:auto;padding:12px 14px;',
    'display:flex;flex-direction:column;gap:8px;background:#fff;',
    'border-top:1px solid rgba(36,89,78,.07);scroll-behavior:smooth}',
    '#ic-transcript:empty{display:none}',
    '#ic-transcript::-webkit-scrollbar{width:3px}',
    '#ic-transcript::-webkit-scrollbar-thumb{background:rgba(36,89,78,.15);border-radius:2px}',
    '.ic-row{display:flex;gap:7px;align-items:flex-end}',
    '.ic-row.user{flex-direction:row-reverse}',
    '.ic-av{width:22px;height:22px;border-radius:50%;background:' + MINT + ';',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.ic-bbl{max-width:82%;padding:7px 11px;border-radius:12px;',
    'font-family:"Outfit",sans-serif;font-size:13px;line-height:1.5;color:#1a2e28}',
    '.ic-row.bot .ic-bbl{background:' + OFFWHITE + ';border-bottom-left-radius:3px}',
    '.ic-row.user .ic-bbl{background:' + TEAL + ';color:#fff;border-bottom-right-radius:3px}',
    '.ic-dots{display:flex;gap:4px;padding:3px 0}',
    '.ic-dots span{width:5px;height:5px;border-radius:50%;background:' + MINT + ';',
    'animation:ic-bounce 1.1s infinite}',
    '.ic-dots span:nth-child(2){animation-delay:.18s}',
    '.ic-dots span:nth-child(3){animation-delay:.36s}',
    '@keyframes ic-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}',

    // Input bar
    '#ic-bar{padding:10px 12px;background:#fff;border-top:1px solid rgba(36,89,78,.09);',
    'display:flex;gap:8px;align-items:center;flex-shrink:0}',
    '#ic-mic{width:42px;height:42px;border-radius:50%;border:2px solid ' + MINT + ';',
    'background:transparent;color:' + MINT + ';cursor:pointer;',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;',
    'transition:background .2s,color .2s,border-color .2s,transform .12s}',
    '#ic-mic:hover{background:' + MINT + ';color:#fff}',
    '#ic-mic:active{transform:scale(.9)}',
    '#ic-mic.listening{background:#c03030;border-color:#c03030;color:#fff;',
    'animation:ic-mic-ring 1s infinite}',
    '#ic-mic.disabled{opacity:.3;cursor:not-allowed;animation:none}',
    '@keyframes ic-mic-ring{0%,100%{box-shadow:0 0 0 0 rgba(192,48,48,.3)}',
    '50%{box-shadow:0 0 0 8px rgba(192,48,48,0)}}',
    '#ic-in{flex:1;border:1.5px solid #dde8e5;border-radius:10px;',
    'padding:8px 11px;font-family:"Outfit",sans-serif;font-size:13px;',
    'color:#1a2e28;resize:none;outline:none;height:38px;',
    'line-height:1.4;background:' + OFFWHITE + ';transition:border-color .2s}',
    '#ic-in:focus{border-color:' + MINT + '}',
    '#ic-in::placeholder{color:#9ab3ad;font-size:12px}',
    '#ic-send{width:34px;height:34px;border-radius:9px;border:none;cursor:pointer;',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;',
    'background:' + TEAL + ';color:#fff;transition:background .15s,transform .12s}',
    '#ic-send:hover{background:#1c4a41}',
    '#ic-send:active{transform:scale(.9)}',
    '#ic-send:disabled{background:#c5d5d2;cursor:not-allowed;transform:none}',
  ].join('');

  // ── Build DOM ─────────────────────────────────────────────────────────────

  function buildDOM() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);

    var micHTML = srSupported
      ? '<button id="ic-mic" aria-label="Tap to speak">' + SVG.mic + '</button>'
      : '';

    var wrap = document.createElement('div');
    wrap.id = 'ic-wrap';
    wrap.innerHTML =
      '<button id="ic-btn" aria-label="Open Insight Center Guide">' +
        '<span class="ic-chat">' + SVG.chat + '</span>' +
        '<span class="ic-x">' + SVG.close + '</span>' +
      '</button>' +
      '<div id="ic-panel" role="dialog" aria-label="Insight Center Guide">' +
        // Header
        '<div id="ic-head">' +
          '<div id="ic-head-left">' +
            '<div id="ic-head-dot">' + SVG.person + '</div>' +
            '<div>' +
              '<div id="ic-head-name">Insight Center Guide</div>' +
              '<div id="ic-head-tag">Voice Assistant</div>' +
            '</div>' +
          '</div>' +
          '<button id="ic-vol" class="on" aria-label="Toggle voice">' + SVG.speakerOn + '</button>' +
        '</div>' +
        // Orb
        '<div id="ic-orb-area">' +
          '<div id="ic-orb-wrap">' +
            '<div class="ic-ring ic-ring-1"></div>' +
            '<div class="ic-ring ic-ring-2"></div>' +
            '<div class="ic-ring ic-ring-3"></div>' +
            '<div id="ic-orb"></div>' +
          '</div>' +
          '<div id="ic-wave">' +
            '<span></span><span></span><span></span><span></span>' +
            '<span></span><span></span><span></span>' +
          '</div>' +
          '<div id="ic-orb-label">Insight Center Guide</div>' +
        '</div>' +
        // Transcript
        '<div id="ic-transcript" role="log" aria-live="polite"></div>' +
        // Input bar
        '<div id="ic-bar">' +
          micHTML +
          '<textarea id="ic-in" placeholder="Or type here…" rows="1" aria-label="Type your question"></textarea>' +
          '<button id="ic-send" aria-label="Send">' + SVG.send + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(wrap);
  }

  // ── Orb state ─────────────────────────────────────────────────────────────

  function setOrbState(state) {
    var wrap  = document.getElementById('ic-orb-wrap');
    var label = document.getElementById('ic-orb-label');
    var wave  = document.getElementById('ic-wave');
    if (!wrap) return;
    wrap.className = state || '';
    var labels = {
      listening: 'Listening…',
      thinking:  'Thinking…',
      speaking:  'Speaking…',
    };
    if (label) label.textContent = labels[state] || 'Insight Center Guide';
    if (wave)  wave.classList.toggle('active', state === 'listening' || state === 'speaking');
  }

  // ── Transcript helpers ────────────────────────────────────────────────────

  function botRow(text) {
    var t = document.getElementById('ic-transcript');
    var row = document.createElement('div');
    row.className = 'ic-row bot';
    row.innerHTML = '<div class="ic-av">' + SVG.person + '</div><div class="ic-bbl"></div>';
    row.querySelector('.ic-bbl').textContent = text;
    t.appendChild(row);
    t.scrollTop = t.scrollHeight;
    return row.querySelector('.ic-bbl');
  }

  function userRow(text) {
    var t = document.getElementById('ic-transcript');
    var row = document.createElement('div');
    row.className = 'ic-row user';
    var bbl = document.createElement('div');
    bbl.className = 'ic-bbl';
    bbl.textContent = text;
    row.appendChild(bbl);
    t.appendChild(row);
    t.scrollTop = t.scrollHeight;
  }

  function typingRow() {
    var t = document.getElementById('ic-transcript');
    var row = document.createElement('div');
    row.className = 'ic-row bot';
    row.id = 'ic-typing';
    row.innerHTML = '<div class="ic-av">' + SVG.person + '</div>' +
      '<div class="ic-bbl"><div class="ic-dots"><span></span><span></span><span></span></div></div>';
    t.appendChild(row);
    t.scrollTop = t.scrollHeight;
    return row;
  }

  // ── Recognition ───────────────────────────────────────────────────────────

  function startListening() {
    if (!rec || isListening || isThinking || isSpeaking || !shouldListen) return;
    try { rec.start(); } catch (_) {}
  }

  function stopListening() {
    shouldListen = false;
    if (rec && isListening) { try { rec.stop(); } catch (_) {} }
  }

  function setupRecognition() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    rec = new SR();
    rec.continuous     = false;
    rec.interimResults = false;
    rec.lang           = 'en-US';

    rec.addEventListener('start', function () {
      isListening = true;
      setOrbState('listening');
      var m = document.getElementById('ic-mic');
      if (m) { m.classList.add('listening'); m.innerHTML = SVG.stop; m.setAttribute('aria-label', 'Stop'); }
    });

    rec.addEventListener('end', function () {
      isListening = false;
      var m = document.getElementById('ic-mic');
      if (m) { m.classList.remove('listening'); m.innerHTML = SVG.mic; m.setAttribute('aria-label', 'Tap to speak'); }
      if (shouldListen && !isThinking && !isSpeaking) {
        setTimeout(startListening, 350);
      } else if (!isThinking && !isSpeaking) {
        setOrbState('');
      }
    });

    rec.addEventListener('result', function (e) {
      var text = e.results[0][0].transcript.trim();
      if (!text) return;
      shouldListen = false;
      sendMessage(text);
    });

    rec.addEventListener('error', function (e) {
      isListening = false;
      if (e.error === 'no-speech' && shouldListen && !isThinking && !isSpeaking) {
        setTimeout(startListening, 200);
      } else {
        setOrbState('');
      }
    });
  }

  // ── Voice output ──────────────────────────────────────────────────────────

  function afterSpeak() {
    isSpeaking = false;
    if (voiceOn && srSupported) {
      shouldListen = true;
      setTimeout(startListening, 500);
    } else {
      setOrbState('');
    }
  }

  function speakText(text) {
    stopSpeech();
    isSpeaking = true;
    setOrbState('speaking');

    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text }),
    })
    .then(function (r) {
      if (!r.ok) throw new Error('no tts');
      return r.blob();
    })
    .then(function (blob) {
      var url = URL.createObjectURL(blob);
      curAudio = new Audio(url);
      curAudio.addEventListener('ended', function () { URL.revokeObjectURL(url); afterSpeak(); });
      curAudio.addEventListener('error', afterSpeak);
      curAudio.play().catch(afterSpeak);
    })
    .catch(function () {
      if (!window.speechSynthesis) { afterSpeak(); return; }
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 0.93;
      u.onend = afterSpeak;
      u.onerror = afterSpeak;
      window.speechSynthesis.speak(u);
    });
  }

  function stopSpeech() {
    if (curAudio) { curAudio.pause(); curAudio = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isSpeaking = false;
  }

  // ── Send / stream ─────────────────────────────────────────────────────────

  function sendMessage(text) {
    var sendBtn = document.getElementById('ic-send');
    var t       = document.getElementById('ic-transcript');

    history.push({ role: 'user', content: text });
    userRow(text);
    if (sendBtn) sendBtn.disabled = true;
    isThinking = true;
    setOrbState('thinking');

    var typing  = typingRow();
    var bubble  = null;
    var fullTxt = '';

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    })
    .then(function (resp) {
      if (!resp.ok) {
        return resp.json().catch(function () { return { error: 'Error ' + resp.status }; })
          .then(function (e) { throw new Error(e.error); });
      }
      var reader  = resp.body.getReader();
      var decoder = new TextDecoder();
      var buf     = '';
      function pump() {
        return reader.read().then(function (chunk) {
          if (chunk.done) return;
          buf += decoder.decode(chunk.value, { stream: true });
          var lines = buf.split('\n'); buf = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('data: ') !== 0) continue;
            var raw = line.slice(6).trim();
            if (raw === '[DONE]') break;
            try {
              var p = JSON.parse(raw);
              if (p.error) throw new Error(p.error);
              if (p.text) {
                if (!bubble) { typing.parentNode && typing.parentNode.removeChild(typing); bubble = botRow(''); }
                fullTxt += p.text;
                bubble.textContent = fullTxt;
                t.scrollTop = t.scrollHeight;
              }
            } catch (_) {}
          }
          return pump();
        });
      }
      return pump();
    })
    .then(function () {
      isThinking = false;
      if (sendBtn) sendBtn.disabled = false;
      if (fullTxt) {
        history.push({ role: 'assistant', content: fullTxt });
        if (voiceOn) { speakText(fullTxt); return; }
      }
      setOrbState('');
      if (srSupported) { shouldListen = true; setTimeout(startListening, 400); }
    })
    .catch(function (err) {
      isThinking = false;
      typing.parentNode && typing.parentNode.removeChild(typing);
      botRow('Sorry, something went wrong. Please call us at 540-533-3821.');
      if (sendBtn) sendBtn.disabled = false;
      setOrbState('');
      if (srSupported && voiceOn) { shouldListen = true; setTimeout(startListening, 600); }
      console.error('[IC Guide]', err);
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    buildDOM();
    setupRecognition();

    var launchBtn = document.getElementById('ic-btn');
    var panel     = document.getElementById('ic-panel');
    var input     = document.getElementById('ic-in');
    var sendBtn   = document.getElementById('ic-send');
    var micBtn    = document.getElementById('ic-mic');
    var volBtn    = document.getElementById('ic-vol');

    // Open / close panel
    launchBtn.addEventListener('click', function () {
      var opening = !panel.classList.contains('open');
      panel.classList.toggle('open', opening);
      launchBtn.classList.toggle('open', opening);

      if (opening) {
        // Speak the greeting the first time; on subsequent opens just resume listening
        if (!greetingDone) {
          greetingDone = true;
          setTimeout(function () {
            if (voiceOn) {
              speakText(GREETING_TEXT);
            } else {
              shouldListen = true;
              setTimeout(startListening, 400);
            }
          }, 400);
        } else if (srSupported && voiceOn && !isThinking && !isSpeaking) {
          shouldListen = true;
          setTimeout(startListening, 500);
        }
      } else {
        stopListening();
        stopSpeech();
        setOrbState('');
      }
    });

    // Manual mic button
    if (micBtn) {
      micBtn.addEventListener('click', function () {
        if (isListening) {
          stopListening();
        } else {
          shouldListen = true;
          startListening();
        }
      });
    }

    // Text send
    function sendTyped() {
      var text = input.value.trim();
      if (!text || isThinking) return;
      stopListening();
      stopSpeech();
      input.value = '';
      input.style.height = 'auto';
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

    // Voice toggle
    volBtn.addEventListener('click', function () {
      voiceOn = !voiceOn;
      volBtn.classList.toggle('on', voiceOn);
      volBtn.innerHTML = voiceOn ? SVG.speakerOn : SVG.speakerOff;
      if (!voiceOn) { stopSpeech(); stopListening(); setOrbState(''); }
      else if (srSupported && panel.classList.contains('open') && !isThinking) {
        shouldListen = true; setTimeout(startListening, 300);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
