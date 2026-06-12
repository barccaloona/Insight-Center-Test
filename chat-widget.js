// Insight Center Guide — voice-first chat widget
// Zero dependencies. Drop <script src="/chat-widget.js" defer></script> before </body>.

(function () {
  'use strict';

  var TEAL     = '#24594E';
  var MINT     = '#3EA882';
  var OFFWHITE = '#F7F6F2';

  var GREETING = "Hi, I'm the Insight Center Guide. Ask me anything about our services, approach, or team.";

  var history     = [];
  var voiceOn     = true;  // voice-first: on by default
  var curAudio    = null;

  // Voice state machine
  var shouldListen = false; // true when auto-listen loop should run
  var isListening  = false;
  var isThinking   = false;
  var isSpeaking   = false;
  var rec          = null;  // SpeechRecognition instance
  var srSupported  = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // ── SVGs ──────────────────────────────────────────────────────────────────

  var SVG = {
    chat: '<svg width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    close: '<svg width="20" height="20" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    person: '<svg width="13" height="13" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
    speakerOn: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    speakerOff: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    micIdle: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    micStop: '<svg width="18" height="18" fill="currentColor" stroke="none" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
    send: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  };

  // ── CSS ───────────────────────────────────────────────────────────────────

  var CSS = [
    '#ic-wrap *{box-sizing:border-box}',

    '#ic-btn{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;',
    'background:' + TEAL + ';border:none;cursor:pointer;',
    'box-shadow:0 4px 24px rgba(36,89,78,.38);',
    'display:flex;align-items:center;justify-content:center;z-index:9999;',
    'transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s ease}',
    '#ic-btn:hover{transform:scale(1.1);box-shadow:0 6px 32px rgba(36,89,78,.48)}',
    '#ic-btn:active{transform:scale(.94)}',
    '#ic-btn .ic-chat{transition:opacity .2s,transform .2s}',
    '#ic-btn .ic-x{position:absolute;opacity:0;transform:scale(.6) rotate(-90deg);transition:opacity .2s,transform .2s}',
    '#ic-btn.open .ic-chat{opacity:0;transform:scale(.6) rotate(90deg)}',
    '#ic-btn.open .ic-x{opacity:1;transform:scale(1) rotate(0)}',

    '#ic-panel{position:fixed;bottom:92px;right:24px;width:360px;max-height:620px;',
    'background:#fff;border-radius:16px;',
    'box-shadow:0 12px 48px rgba(36,89,78,.16),0 2px 8px rgba(0,0,0,.07);',
    'display:flex;flex-direction:column;overflow:hidden;z-index:9998;',
    'transform:translateY(16px) scale(.97);opacity:0;pointer-events:none;',
    'transition:transform .28s cubic-bezier(.34,1.56,.64,1),opacity .2s ease}',
    '#ic-panel.open{transform:translateY(0) scale(1);opacity:1;pointer-events:all}',

    '@media(max-width:420px){',
    '#ic-panel{width:calc(100vw - 16px);right:8px;bottom:80px;max-height:75vh}',
    '#ic-btn{bottom:16px;right:16px}}',

    // Header
    '#ic-head{background:' + TEAL + ';color:#fff;padding:12px 14px;',
    'display:flex;align-items:center;gap:10px;flex-shrink:0}',
    '#ic-head-dot{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.14);',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '#ic-head-name{font-family:"DM Serif Display",Georgia,serif;font-size:14px;line-height:1.2;letter-spacing:.01em}',
    '#ic-head-sub{font-family:"Outfit",sans-serif;font-size:11px;opacity:.65;margin-top:1px}',
    '#ic-vol{margin-left:auto;background:transparent;border:none;cursor:pointer;',
    'color:rgba(255,255,255,.6);padding:5px;border-radius:6px;display:flex;transition:color .15s}',
    '#ic-vol:hover{color:#fff}',
    '#ic-vol.on{color:#8ED3AE}',

    // Messages
    '#ic-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;',
    'gap:10px;background:' + OFFWHITE + ';scroll-behavior:smooth}',
    '#ic-msgs::-webkit-scrollbar{width:3px}',
    '#ic-msgs::-webkit-scrollbar-thumb{background:rgba(36,89,78,.2);border-radius:2px}',
    '.ic-row{display:flex;gap:8px;align-items:flex-end}',
    '.ic-row.user{flex-direction:row-reverse}',
    '.ic-av{width:26px;height:26px;border-radius:50%;background:' + MINT + ';',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.ic-bbl{max-width:78%;padding:9px 13px;border-radius:14px;',
    'font-family:"Outfit",sans-serif;font-size:13.5px;line-height:1.55;color:#1a2e28}',
    '.ic-row.bot .ic-bbl{background:#fff;border-bottom-left-radius:4px;',
    'box-shadow:0 1px 4px rgba(0,0,0,.07)}',
    '.ic-row.user .ic-bbl{background:' + TEAL + ';color:#fff;border-bottom-right-radius:4px}',
    '.ic-dots{display:flex;gap:4px;padding:4px 2px}',
    '.ic-dots span{width:6px;height:6px;border-radius:50%;background:' + MINT + ';',
    'animation:ic-bounce 1.1s infinite}',
    '.ic-dots span:nth-child(2){animation-delay:.18s}',
    '.ic-dots span:nth-child(3){animation-delay:.36s}',
    '@keyframes ic-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}',

    // Status bar
    '#ic-status{padding:7px 14px;background:#fff;border-top:1px solid rgba(36,89,78,.07);',
    'display:flex;align-items:center;gap:7px;min-height:34px;flex-shrink:0}',
    '#ic-status-dot{width:8px;height:8px;border-radius:50%;background:#ccc;flex-shrink:0;',
    'transition:background .3s}',
    '#ic-status-dot.listening{background:#e04040;animation:ic-pulse-dot 1s infinite}',
    '#ic-status-dot.thinking{background:' + MINT + ';animation:ic-pulse-dot 1.5s infinite}',
    '#ic-status-dot.speaking{background:' + TEAL + ';animation:ic-pulse-dot 0.8s infinite}',
    '@keyframes ic-pulse-dot{0%,100%{opacity:1}50%{opacity:.35}}',
    '#ic-status-txt{font-family:"Outfit",sans-serif;font-size:12px;color:#7a9e99;flex:1}',

    // Input bar
    '#ic-bar{padding:10px;background:#fff;border-top:1px solid rgba(36,89,78,.09);',
    'display:flex;gap:7px;align-items:flex-end;flex-shrink:0}',

    // Mic button — primary, larger
    '#ic-mic{width:44px;height:44px;border-radius:50%;border:2px solid ' + MINT + ';',
    'background:transparent;color:' + MINT + ';cursor:pointer;',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;',
    'transition:background .2s,color .2s,border-color .2s,transform .12s}',
    '#ic-mic:hover{background:' + MINT + ';color:#fff}',
    '#ic-mic:active{transform:scale(.9)}',
    '#ic-mic.listening{background:#e04040;border-color:#e04040;color:#fff;',
    'animation:ic-ring 1s infinite}',
    '#ic-mic.disabled{opacity:.35;cursor:not-allowed;animation:none}',
    '@keyframes ic-ring{0%,100%{box-shadow:0 0 0 0 rgba(224,64,64,.35)}',
    '50%{box-shadow:0 0 0 8px rgba(224,64,64,0)}}',

    '#ic-in{flex:1;border:1.5px solid #dde8e5;border-radius:10px;',
    'padding:8px 11px;font-family:"Outfit",sans-serif;font-size:13px;',
    'color:#1a2e28;resize:none;outline:none;min-height:38px;max-height:90px;',
    'line-height:1.4;background:' + OFFWHITE + ';transition:border-color .2s}',
    '#ic-in:focus{border-color:' + MINT + '}',
    '#ic-in::placeholder{color:#9ab3ad;font-size:12px}',

    '#ic-send{width:36px;height:36px;border-radius:9px;border:none;cursor:pointer;',
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

    var wrap = document.createElement('div');
    wrap.id = 'ic-wrap';
    wrap.innerHTML =
      '<button id="ic-btn" aria-label="Open Insight Center Guide">' +
        '<span class="ic-chat">' + SVG.chat + '</span>' +
        '<span class="ic-x">' + SVG.close + '</span>' +
      '</button>' +
      '<div id="ic-panel" role="dialog" aria-label="Insight Center Guide">' +
        '<div id="ic-head">' +
          '<div id="ic-head-dot">' + SVG.person + '</div>' +
          '<div>' +
            '<div id="ic-head-name">Insight Center Guide</div>' +
            '<div id="ic-head-sub">Insight Center for Cognitive Development</div>' +
          '</div>' +
          '<button id="ic-vol" class="on" aria-label="Toggle voice replies">' + SVG.speakerOn + '</button>' +
        '</div>' +
        '<div id="ic-msgs" role="log" aria-live="polite"></div>' +
        '<div id="ic-status">' +
          '<div id="ic-status-dot"></div>' +
          '<span id="ic-status-txt">' + (srSupported ? 'Tap the mic or type below' : 'Type your question below') + '</span>' +
        '</div>' +
        '<div id="ic-bar">' +
          (srSupported
            ? '<button id="ic-mic" aria-label="Tap to speak">' + SVG.micIdle + '</button>'
            : '') +
          '<textarea id="ic-in" placeholder="Or type here…" rows="1" aria-label="Type your question"></textarea>' +
          '<button id="ic-send" aria-label="Send">' + SVG.send + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(wrap);
  }

  // ── Status bar ────────────────────────────────────────────────────────────

  function setStatus(state) {
    var dot = document.getElementById('ic-status-dot');
    var txt = document.getElementById('ic-status-txt');
    if (!dot || !txt) return;
    dot.className = state || '';
    var labels = { listening: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking…' };
    txt.textContent = labels[state] || (srSupported ? 'Tap the mic or type below' : 'Type your question below');
  }

  // ── Message helpers ───────────────────────────────────────────────────────

  function botRow(text) {
    var msgs = document.getElementById('ic-msgs');
    var row = document.createElement('div');
    row.className = 'ic-row bot';
    row.innerHTML = '<div class="ic-av">' + SVG.person + '</div><div class="ic-bbl"></div>';
    row.querySelector('.ic-bbl').textContent = text;
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    return row.querySelector('.ic-bbl');
  }

  function userRow(text) {
    var msgs = document.getElementById('ic-msgs');
    var row = document.createElement('div');
    row.className = 'ic-row user';
    var bbl = document.createElement('div');
    bbl.className = 'ic-bbl';
    bbl.textContent = text;
    row.appendChild(bbl);
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function typingRow() {
    var msgs = document.getElementById('ic-msgs');
    var row = document.createElement('div');
    row.className = 'ic-row bot';
    row.id = 'ic-typing';
    row.innerHTML = '<div class="ic-av">' + SVG.person + '</div>' +
      '<div class="ic-bbl"><div class="ic-dots"><span></span><span></span><span></span></div></div>';
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    return row;
  }

  // ── Voice: listen ─────────────────────────────────────────────────────────

  function startListening() {
    if (!rec || isListening || isThinking || isSpeaking || !shouldListen) return;
    try {
      rec.start();
    } catch (_) {}
  }

  function stopListening() {
    shouldListen = false;
    if (rec && isListening) {
      try { rec.stop(); } catch (_) {}
    }
  }

  function setupRecognition() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    rec = new SR();
    rec.continuous      = false;
    rec.interimResults  = false;
    rec.lang            = 'en-US';

    rec.addEventListener('start', function () {
      isListening = true;
      setStatus('listening');
      var micBtn = document.getElementById('ic-mic');
      if (micBtn) { micBtn.classList.add('listening'); micBtn.innerHTML = SVG.micStop; micBtn.setAttribute('aria-label', 'Tap to stop'); }
    });

    rec.addEventListener('end', function () {
      isListening = false;
      var micBtn = document.getElementById('ic-mic');
      if (micBtn) { micBtn.classList.remove('listening'); micBtn.innerHTML = SVG.micIdle; micBtn.setAttribute('aria-label', 'Tap to speak'); }
      // Auto-restart if still in voice mode and not busy
      if (shouldListen && !isThinking && !isSpeaking) {
        setTimeout(startListening, 400);
      } else if (!isThinking && !isSpeaking) {
        setStatus('');
      }
    });

    rec.addEventListener('result', function (e) {
      var transcript = e.results[0][0].transcript.trim();
      if (!transcript) return;
      // Stop auto-listen loop while processing
      shouldListen = false;
      sendMessage(transcript);
    });

    rec.addEventListener('error', function (e) {
      isListening = false;
      // On 'no-speech', quietly restart if still in voice mode
      if (e.error === 'no-speech' && shouldListen && !isThinking && !isSpeaking) {
        setTimeout(startListening, 200);
      } else {
        setStatus('');
      }
    });
  }

  // ── Voice: speak ─────────────────────────────────────────────────────────

  function afterSpeak() {
    isSpeaking = false;
    setStatus('');
    if (voiceOn && srSupported) {
      shouldListen = true;
      setTimeout(startListening, 600);
    }
  }

  function speakText(text) {
    stopSpeech();
    isSpeaking = true;
    setStatus('speaking');

    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text }),
    })
    .then(function (resp) {
      if (!resp.ok) throw new Error('TTS unavailable');
      return resp.blob();
    })
    .then(function (blob) {
      var url = URL.createObjectURL(blob);
      curAudio = new Audio(url);
      curAudio.addEventListener('ended', function () { URL.revokeObjectURL(url); afterSpeak(); });
      curAudio.addEventListener('error', function () { afterSpeak(); });
      curAudio.play().catch(function () { afterSpeak(); });
    })
    .catch(function () {
      if (!window.speechSynthesis) { afterSpeak(); return; }
      var utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.93;
      utt.onend = afterSpeak;
      utt.onerror = afterSpeak;
      window.speechSynthesis.speak(utt);
    });
  }

  function stopSpeech() {
    if (curAudio) { curAudio.pause(); curAudio = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isSpeaking = false;
  }

  // ── Stream reply ──────────────────────────────────────────────────────────

  function sendMessage(text) {
    var sendBtn = document.getElementById('ic-send');
    var msgs    = document.getElementById('ic-msgs');

    history.push({ role: 'user', content: text });
    userRow(text);
    if (sendBtn) sendBtn.disabled = true;
    isThinking = true;
    setStatus('thinking');

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
        return resp.json().catch(function () { return { error: 'Server error ' + resp.status }; })
          .then(function (e) { throw new Error(e.error || 'Server error'); });
      }
      var reader  = resp.body.getReader();
      var decoder = new TextDecoder();
      var buf     = '';

      function pump() {
        return reader.read().then(function (chunk) {
          if (chunk.done) return;
          buf += decoder.decode(chunk.value, { stream: true });
          var lines = buf.split('\n');
          buf = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('data: ') !== 0) continue;
            var raw = line.slice(6).trim();
            if (raw === '[DONE]') break;
            try {
              var parsed = JSON.parse(raw);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                if (!bubble) {
                  typing.parentNode && typing.parentNode.removeChild(typing);
                  bubble = botRow('');
                }
                fullTxt += parsed.text;
                bubble.textContent = fullTxt;
                msgs.scrollTop = msgs.scrollHeight;
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
          speakText(fullTxt);
        } else if (srSupported) {
          shouldListen = true;
          setTimeout(startListening, 400);
          setStatus('');
        }
      } else {
        setStatus('');
        if (srSupported && voiceOn) { shouldListen = true; setTimeout(startListening, 400); }
      }
    })
    .catch(function (err) {
      isThinking = false;
      typing.parentNode && typing.parentNode.removeChild(typing);
      botRow('Sorry, something went wrong. Please call us at 540-533-3821 or use the contact form.');
      if (sendBtn) sendBtn.disabled = false;
      setStatus('');
      if (srSupported && voiceOn) { shouldListen = true; setTimeout(startListening, 600); }
      console.error('[IC Guide]', err);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function init() {
    buildDOM();
    setupRecognition();

    var launchBtn = document.getElementById('ic-btn');
    var panel     = document.getElementById('ic-panel');
    var input     = document.getElementById('ic-in');
    var sendBtn   = document.getElementById('ic-send');
    var micBtn    = document.getElementById('ic-mic');
    var volBtn    = document.getElementById('ic-vol');

    botRow(GREETING);

    // Toggle open / close
    launchBtn.addEventListener('click', function () {
      var opening = !panel.classList.contains('open');
      panel.classList.toggle('open', opening);
      launchBtn.classList.toggle('open', opening);

      if (opening) {
        // Auto-start listening shortly after opening
        if (srSupported && voiceOn) {
          shouldListen = true;
          setTimeout(startListening, 700);
        } else {
          setTimeout(function () { input.focus(); }, 300);
        }
      } else {
        // Stop everything on close
        stopListening();
        stopSpeech();
        setStatus('');
      }
    });

    // Manual mic button (tap to start / tap to stop)
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
      if (!voiceOn) {
        stopSpeech();
        stopListening();
        setStatus('');
      } else if (srSupported && panel.classList.contains('open') && !isThinking) {
        shouldListen = true;
        setTimeout(startListening, 300);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
