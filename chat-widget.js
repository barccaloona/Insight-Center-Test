// Insight Center Guide — chat widget
// Zero dependencies. Drop <script src="/chat-widget.js" defer></script> before </body> on any page.

(function () {
  'use strict';

  var TEAL     = '#24594E';
  var MINT     = '#3EA882';
  var OFFWHITE = '#F7F6F2';

  var GREETING = "Hi! I’m the Insight Center Guide — happy to answer questions about our services, approach, or team. What would you like to know?";

  var history  = []; // conversation turns sent to the API
  var voiceOn  = false;
  var curAudio = null;

  // ── SVGs ──────────────────────────────────────────────────────────────────

  var SVG = {
    chat: '<svg width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    close: '<svg width="20" height="20" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    person: '<svg width="13" height="13" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
    speakerOn: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    speakerOff: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    mic: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
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

    '#ic-panel{position:fixed;bottom:92px;right:24px;width:360px;max-height:600px;',
    'background:#fff;border-radius:16px;',
    'box-shadow:0 12px 48px rgba(36,89,78,.16),0 2px 8px rgba(0,0,0,.07);',
    'display:flex;flex-direction:column;overflow:hidden;z-index:9998;',
    'transform:translateY(16px) scale(.97);opacity:0;pointer-events:none;',
    'transition:transform .28s cubic-bezier(.34,1.56,.64,1),opacity .2s ease}',
    '#ic-panel.open{transform:translateY(0) scale(1);opacity:1;pointer-events:all}',

    '@media(max-width:420px){',
    '#ic-panel{width:calc(100vw - 16px);right:8px;bottom:80px;max-height:72vh}',
    '#ic-btn{bottom:16px;right:16px}}',

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

    '#ic-bar{padding:10px;background:#fff;border-top:1px solid rgba(36,89,78,.09);',
    'display:flex;gap:7px;align-items:flex-end;flex-shrink:0}',
    '#ic-in{flex:1;border:1.5px solid #dde8e5;border-radius:10px;',
    'padding:8px 11px;font-family:"Outfit",sans-serif;font-size:13.5px;',
    'color:#1a2e28;resize:none;outline:none;min-height:38px;max-height:110px;',
    'line-height:1.4;background:' + OFFWHITE + ';transition:border-color .2s}',
    '#ic-in:focus{border-color:' + MINT + '}',
    '#ic-in::placeholder{color:#9ab3ad}',

    '#ic-send,#ic-mic{width:36px;height:36px;border-radius:9px;border:none;cursor:pointer;',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;',
    'transition:background .15s,transform .12s}',
    '#ic-send:active,#ic-mic:active{transform:scale(.9)}',
    '#ic-send{background:' + TEAL + ';color:#fff}',
    '#ic-send:hover{background:#1c4a41}',
    '#ic-send:disabled{background:#c5d5d2;cursor:not-allowed;transform:none}',
    '#ic-mic{background:transparent;color:#9ab3ad;border:1.5px solid #dde8e5}',
    '#ic-mic:hover{color:' + TEAL + ';border-color:' + MINT + '}',
    '#ic-mic.on{color:#d94040;border-color:#d94040;animation:ic-pulse 1s infinite}',
    '@keyframes ic-pulse{0%,100%{box-shadow:0 0 0 0 rgba(217,64,64,.25)}',
    '50%{box-shadow:0 0 0 7px rgba(217,64,64,0)}}',
  ].join('');

  // ── Build DOM ─────────────────────────────────────────────────────────────

  function buildDOM() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);

    var wrap = document.createElement('div');
    wrap.id = 'ic-wrap';
    wrap.innerHTML =
      '<button id="ic-btn" aria-label="Open chat">' +
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
          '<button id="ic-vol" aria-label="Toggle voice replies">' + SVG.speakerOff + '</button>' +
        '</div>' +
        '<div id="ic-msgs" role="log" aria-live="polite"></div>' +
        '<div id="ic-bar">' +
          '<button id="ic-mic" aria-label="Voice input" style="display:none">' + SVG.mic + '</button>' +
          '<textarea id="ic-in" placeholder="Ask me anything…" rows="1" aria-label="Type your question"></textarea>' +
          '<button id="ic-send" aria-label="Send">' + SVG.send + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(wrap);
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

  // ── Streaming reply ───────────────────────────────────────────────────────

  function streamReply(userText) {
    var sendBtn = document.getElementById('ic-send');
    var msgs    = document.getElementById('ic-msgs');

    history.push({ role: 'user', content: userText });
    sendBtn.disabled = true;

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
      if (fullTxt) {
        history.push({ role: 'assistant', content: fullTxt });
        if (voiceOn) speakText(fullTxt);
      }
      sendBtn.disabled = false;
    })
    .catch(function (err) {
      typing.parentNode && typing.parentNode.removeChild(typing);
      botRow('Sorry, something went wrong. Please call us at 540-533-3821 or use the contact form.');
      console.error('[IC Guide]', err);
      sendBtn.disabled = false;
    });
  }

  // ── Voice output ──────────────────────────────────────────────────────────

  function speakText(text) {
    stopSpeech();

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
      curAudio.addEventListener('ended', function () { URL.revokeObjectURL(url); });
      curAudio.play();
    })
    .catch(function () {
      // Browser TTS fallback
      if (!window.speechSynthesis) return;
      var utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.93;
      window.speechSynthesis.speak(utt);
    });
  }

  function stopSpeech() {
    if (curAudio) { curAudio.pause(); curAudio = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  // ── Voice input ───────────────────────────────────────────────────────────

  function setupMic(micBtn, input) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return; // hide mic on unsupported browsers (Firefox)

    micBtn.style.display = 'flex';
    var rec       = new SR();
    rec.continuous      = false;
    rec.interimResults  = false;
    rec.lang            = 'en-US';
    var listening = false;

    micBtn.addEventListener('click', function () {
      if (listening) { rec.stop(); return; }
      try { rec.start(); } catch (_) {}
      // Mic use auto-enables voice replies
      voiceOn = true;
      var vol = document.getElementById('ic-vol');
      vol.classList.add('on');
      vol.innerHTML = SVG.speakerOn;
    });

    rec.addEventListener('start', function () {
      listening = true;
      micBtn.classList.add('on');
      micBtn.setAttribute('aria-label', 'Listening…');
    });
    rec.addEventListener('end', function () {
      listening = false;
      micBtn.classList.remove('on');
      micBtn.setAttribute('aria-label', 'Voice input');
    });
    rec.addEventListener('result', function (e) {
      var transcript = e.results[0][0].transcript.trim();
      if (!transcript) return;
      input.value = transcript;
      input.dispatchEvent(new Event('input'));
      // Auto-send after a short pause so the user can see what was transcribed
      setTimeout(function () { document.getElementById('ic-send').click(); }, 400);
    });
    rec.addEventListener('error', function () {
      listening = false;
      micBtn.classList.remove('on');
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    buildDOM();

    var btn    = document.getElementById('ic-btn');
    var panel  = document.getElementById('ic-panel');
    var input  = document.getElementById('ic-in');
    var sendBtn = document.getElementById('ic-send');
    var micBtn = document.getElementById('ic-mic');
    var volBtn = document.getElementById('ic-vol');

    botRow(GREETING);

    // Toggle open / close
    btn.addEventListener('click', function () {
      var opening = !panel.classList.contains('open');
      panel.classList.toggle('open', opening);
      btn.classList.toggle('open', opening);
      if (opening) setTimeout(function () { input.focus(); }, 300);
    });

    // Send message
    function send() {
      var text = input.value.trim();
      if (!text || sendBtn.disabled) return;
      userRow(text);
      input.value = '';
      input.style.height = 'auto';
      streamReply(text);
    }

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 110) + 'px';
    });

    // Voice toggle
    volBtn.addEventListener('click', function () {
      voiceOn = !voiceOn;
      volBtn.classList.toggle('on', voiceOn);
      volBtn.innerHTML = voiceOn ? SVG.speakerOn : SVG.speakerOff;
      if (!voiceOn) stopSpeech();
    });

    setupMic(micBtn, input);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
