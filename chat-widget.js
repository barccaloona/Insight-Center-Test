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
  var greetingDone = false;

  // ── Voice state ────────────────────────────────────────────────────────────
  var shouldListen = false;
  var isListening  = false;
  var isThinking   = false;
  var rec          = null;
  var srSupported  = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // ── TTS audio queue ────────────────────────────────────────────────────────
  // Sentences are queued as Promises<blob-url> so audio plays in order
  // even when ElevenLabs responses arrive out of order.
  var audioQueue     = [];
  var audioPlaying   = false;
  var ttsFinished    = false; // true when no more sentences will be enqueued
  var currentAudio   = null;

  function resetTTSQueue() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    audioQueue     = [];
    audioPlaying   = false;
    ttsFinished    = false;
  }

  function playNextInQueue() {
    if (audioPlaying || audioQueue.length === 0) return;
    audioPlaying = true;
    var item = audioQueue.shift(); // Promise<url|null>
    item.then(function (url) {
      if (!url) { audioPlaying = false; checkTTSDone(); playNextInQueue(); return; }
      currentAudio = new Audio(url);
      currentAudio.addEventListener('ended', function () {
        URL.revokeObjectURL(url);
        currentAudio   = null;
        audioPlaying   = false;
        checkTTSDone();
        playNextInQueue();
      });
      currentAudio.addEventListener('error', function () {
        URL.revokeObjectURL(url);
        currentAudio   = null;
        audioPlaying   = false;
        checkTTSDone();
        playNextInQueue();
      });
      currentAudio.play().catch(function () {
        audioPlaying = false;
        checkTTSDone();
        playNextInQueue();
      });
    }).catch(function () {
      audioPlaying = false;
      checkTTSDone();
      playNextInQueue();
    });
  }

  function checkTTSDone() {
    if (ttsFinished && audioQueue.length === 0 && !audioPlaying) {
      afterAllSpoken();
    }
  }

  // Enqueue a sentence for TTS — fires request immediately, queues the Promise
  function enqueueSentence(text) {
    if (!text.trim()) return;
    var promise = fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text }),
    }).then(function (r) {
      if (!r.ok) throw new Error('tts error');
      return r.blob();
    }).then(function (blob) {
      return URL.createObjectURL(blob);
    }).catch(function () {
      // Browser TTS fallback — play inline, return null so queue keeps moving
      if (window.speechSynthesis) {
        var u = new SpeechSynthesisUtterance(text);
        u.rate = 0.93;
        window.speechSynthesis.speak(u);
      }
      return null;
    });
    audioQueue.push(promise);
    playNextInQueue();
  }

  // Called when the last audio finishes and no more are queued
  function afterAllSpoken() {
    setOrbState('');
    if (voiceOn && srSupported) {
      shouldListen = true;
      setTimeout(startListening, 500);
    }
  }

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

    '#ic-orb-area{background:' + OFFWHITE + ';padding:28px 0 20px;',
    'display:flex;flex-direction:column;align-items:center;gap:14px;flex-shrink:0}',

    '#ic-orb-wrap{position:relative;width:96px;height:96px;',
    'display:flex;align-items:center;justify-content:center}',
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
    'box-shadow:0 4px 20px rgba(36,89,78,.35);',
    'animation:ic-orb-idle 3.5s ease-in-out infinite}',
    '@keyframes ic-orb-idle{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}',
    '#ic-orb-wrap.listening #ic-orb{',
    'background:radial-gradient(circle at 38% 35%,#e87070,#c03030);',
    'box-shadow:0 4px 24px rgba(200,48,48,.4);',
    'animation:ic-orb-listen .9s ease-in-out infinite}',
    '@keyframes ic-orb-listen{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}',
    '#ic-orb-wrap.thinking #ic-orb{',
    'background:radial-gradient(circle at 38% 35%,#8ED3AE,' + MINT + ');',
    'animation:ic-orb-think 1.2s ease-in-out infinite}',
    '@keyframes ic-orb-think{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}',
    '#ic-orb-wrap.speaking #ic-orb{',
    'animation:ic-orb-speak .65s ease-in-out infinite}',
    '@keyframes ic-orb-speak{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}',

    // Label under orb — shows status or interim transcript
    '#ic-orb-label{font-family:"Outfit",sans-serif;font-size:12px;color:#5a8a82;',
    'letter-spacing:.03em;text-align:center;max-width:260px;',
    'min-height:18px;padding:0 12px;line-height:1.4;',
    'transition:color .2s}',
    '#ic-orb-label.interim{color:#1a2e28;font-style:italic}',

    '#ic-wave{display:flex;align-items:center;gap:3px;height:20px;opacity:0;transition:opacity .3s}',
    '#ic-wave.active{opacity:1}',
    '#ic-wave span{width:3px;border-radius:2px;background:' + MINT + ';animation:ic-bar 1.2s ease-in-out infinite}',
    '#ic-wave span:nth-child(1){animation-delay:0s}',
    '#ic-wave span:nth-child(2){animation-delay:.1s}',
    '#ic-wave span:nth-child(3){animation-delay:.2s}',
    '#ic-wave span:nth-child(4){animation-delay:.3s}',
    '#ic-wave span:nth-child(5){animation-delay:.4s}',
    '#ic-wave span:nth-child(6){animation-delay:.15s}',
    '#ic-wave span:nth-child(7){animation-delay:.25s}',
    '@keyframes ic-bar{0%,100%{height:4px}50%{height:18px}}',

    '#ic-transcript{max-height:160px;overflow-y:auto;padding:10px 14px;',
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
    '.ic-dots span{width:5px;height:5px;border-radius:50%;background:' + MINT + ';animation:ic-bounce 1.1s infinite}',
    '.ic-dots span:nth-child(2){animation-delay:.18s}',
    '.ic-dots span:nth-child(3){animation-delay:.36s}',
    '@keyframes ic-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}',

    '#ic-bar{padding:10px 12px;background:#fff;border-top:1px solid rgba(36,89,78,.09);',
    'display:flex;gap:8px;align-items:center;flex-shrink:0}',
    '#ic-mic{width:42px;height:42px;border-radius:50%;border:2px solid ' + MINT + ';',
    'background:transparent;color:' + MINT + ';cursor:pointer;',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;',
    'transition:background .2s,color .2s,border-color .2s,transform .12s}',
    '#ic-mic:hover{background:' + MINT + ';color:#fff}',
    '#ic-mic:active{transform:scale(.9)}',
    '#ic-mic.listening{background:#c03030;border-color:#c03030;color:#fff;animation:ic-mic-ring 1s infinite}',
    '@keyframes ic-mic-ring{0%,100%{box-shadow:0 0 0 0 rgba(192,48,48,.3)}50%{box-shadow:0 0 0 8px rgba(192,48,48,0)}}',
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
          micHTML +
          '<textarea id="ic-in" placeholder="Or type here…" rows="1" aria-label="Type your question"></textarea>' +
          '<button id="ic-send" aria-label="Send">' + SVG.send + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(wrap);
  }

  // ── Orb / label helpers ───────────────────────────────────────────────────

  function setOrbState(state) {
    var wrap = document.getElementById('ic-orb-wrap');
    var wave = document.getElementById('ic-wave');
    if (wrap) wrap.className = state || '';
    if (wave) wave.classList.toggle('active', state === 'listening' || state === 'speaking');
    if (state !== 'listening') setOrbLabel(
      state === 'thinking' ? 'Thinking…' :
      state === 'speaking' ? 'Speaking…' : 'Insight Center Guide'
    );
  }

  function setOrbLabel(text, interim) {
    var el = document.getElementById('ic-orb-label');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('interim', !!interim);
  }

  // ── Transcript ────────────────────────────────────────────────────────────

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

  // ── Speech recognition (continuous + interim) ─────────────────────────────

  function startListening() {
    if (!rec || isListening || isThinking || !shouldListen) return;
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
    rec.continuous     = true;   // keep mic open — no aggressive timeout
    rec.interimResults = true;   // show what's being heard in real-time
    rec.lang           = 'en-US';

    var pendingFinal = '';
    var sendTimer    = null;

    rec.addEventListener('start', function () {
      isListening = true;
      pendingFinal = '';
      setOrbState('listening');
      setOrbLabel('Listening…');
      var m = document.getElementById('ic-mic');
      if (m) { m.classList.add('listening'); m.innerHTML = SVG.stop; m.setAttribute('aria-label', 'Stop'); }
    });

    rec.addEventListener('end', function () {
      isListening = false;
      clearTimeout(sendTimer);
      var m = document.getElementById('ic-mic');
      if (m) { m.classList.remove('listening'); m.innerHTML = SVG.mic; m.setAttribute('aria-label', 'Tap to speak'); }
      // Auto-restart if still in voice mode and not busy
      if (shouldListen && !isThinking) {
        setTimeout(startListening, 250);
      } else if (!isThinking) {
        setOrbState('');
      }
    });

    rec.addEventListener('result', function (e) {
      var interim = '';
      var newFinal = '';

      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          newFinal += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }

      if (newFinal) pendingFinal += newFinal;

      // Show what's being heard under the orb
      var display = (pendingFinal + interim).trim();
      if (display) setOrbLabel(display, true);

      // After 1 second of no new speech, send what we have
      clearTimeout(sendTimer);
      if (pendingFinal.trim()) {
        sendTimer = setTimeout(function () {
          var toSend = pendingFinal.trim();
          pendingFinal = '';
          if (!toSend) return;
          shouldListen = false;
          try { rec.stop(); } catch (_) {}
          setOrbLabel('');
          sendMessage(toSend);
        }, 1000);
      }
    });

    rec.addEventListener('error', function (e) {
      isListening = false;
      clearTimeout(sendTimer);
      pendingFinal = '';
      // no-speech is normal; other errors reset state
      if (e.error !== 'no-speech') setOrbState('');
    });
  }

  // ── Send / stream ─────────────────────────────────────────────────────────

  // Sentence splitter — splits on . ! ? followed by space or end of string
  var SENTENCE_RE = /[^.!?]*[.!?]+(?:\s|$)/g;
  var sentenceBuf = '';

  function flushSentenceBuf(force) {
    // Extract complete sentences from buffer
    var matches = sentenceBuf.match(SENTENCE_RE);
    if (matches) {
      for (var i = 0; i < matches.length; i++) {
        var s = matches[i].trim();
        if (s) enqueueSentence(s);
      }
      // Keep the remainder (incomplete sentence)
      var last = matches[matches.length - 1];
      sentenceBuf = sentenceBuf.slice(sentenceBuf.lastIndexOf(last) + last.length);
    }
    // On force flush (end of stream), speak whatever's left
    if (force && sentenceBuf.trim()) {
      enqueueSentence(sentenceBuf.trim());
      sentenceBuf = '';
    }
  }

  function sendMessage(text) {
    var sendBtn = document.getElementById('ic-send');
    var t       = document.getElementById('ic-transcript');

    history.push({ role: 'user', content: text });
    userRow(text);
    if (sendBtn) sendBtn.disabled = true;
    isThinking = true;
    setOrbState('thinking');

    // Reset TTS queue for new response
    resetTTSQueue();
    sentenceBuf  = '';
    ttsFinished  = false;

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
                // Show in transcript
                if (!bubble) { typing.parentNode && typing.parentNode.removeChild(typing); bubble = botRow(''); }
                fullTxt += p.text;
                bubble.textContent = fullTxt;
                t.scrollTop = t.scrollHeight;
                // Feed into TTS pipeline sentence-by-sentence
                if (voiceOn) {
                  sentenceBuf += p.text;
                  flushSentenceBuf(false);
                  // Switch orb to speaking once first audio is queued
                  if (audioQueue.length > 0 || audioPlaying) setOrbState('speaking');
                }
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
        if (voiceOn) {
          // Flush any remaining sentence fragment
          flushSentenceBuf(true);
          ttsFinished = true;
          // If nothing is playing or queued, call afterAllSpoken directly
          if (!audioPlaying && audioQueue.length === 0) afterAllSpoken();
          else setOrbState('speaking');
          return;
        }
      }
      setOrbState('');
      if (srSupported) { shouldListen = true; setTimeout(startListening, 400); }
    })
    .catch(function (err) {
      isThinking = false;
      ttsFinished = true;
      typing.parentNode && typing.parentNode.removeChild(typing);
      botRow('Sorry, something went wrong. Please call us at 540-533-3821.');
      if (sendBtn) sendBtn.disabled = false;
      setOrbState('');
      if (srSupported && voiceOn) { shouldListen = true; setTimeout(startListening, 600); }
      console.error('[IC Guide]', err);
    });
  }

  // ── Speak the greeting ────────────────────────────────────────────────────

  function speakGreeting() {
    if (!voiceOn) { shouldListen = true; setTimeout(startListening, 400); return; }
    resetTTSQueue();
    sentenceBuf = '';
    ttsFinished = false;
    setOrbState('speaking');
    // Split greeting into sentences manually for immediate start
    var sentences = GREETING_TEXT.match(SENTENCE_RE) || [GREETING_TEXT];
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i].trim();
      if (s) enqueueSentence(s);
    }
    ttsFinished = true;
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

    launchBtn.addEventListener('click', function () {
      var opening = !panel.classList.contains('open');
      panel.classList.toggle('open', opening);
      launchBtn.classList.toggle('open', opening);

      if (opening) {
        if (!greetingDone) {
          greetingDone = true;
          setTimeout(speakGreeting, 500);
        } else if (srSupported && voiceOn && !isThinking) {
          shouldListen = true;
          setTimeout(startListening, 400);
        }
      } else {
        stopListening();
        resetTTSQueue();
        setOrbState('');
      }
    });

    if (micBtn) {
      micBtn.addEventListener('click', function () {
        if (isListening) { stopListening(); }
        else { shouldListen = true; startListening(); }
      });
    }

    function sendTyped() {
      var text = input.value.trim();
      if (!text || isThinking) return;
      stopListening();
      resetTTSQueue();
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

    volBtn.addEventListener('click', function () {
      voiceOn = !voiceOn;
      volBtn.classList.toggle('on', voiceOn);
      volBtn.innerHTML = voiceOn ? SVG.speakerOn : SVG.speakerOff;
      if (!voiceOn) { resetTTSQueue(); stopListening(); setOrbState(''); }
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
