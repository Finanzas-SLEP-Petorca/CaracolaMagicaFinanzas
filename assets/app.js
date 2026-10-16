/* Caracola Mágica Finanzas — lógica de la página (JavaScript puro, sin dependencias). */

/* ---------------------------------------------------------------------------
 * Ajustes. Cambia estos valores para personalizar la caracola.
 * ------------------------------------------------------------------------- */
const CONFIG = {
  // Respuestas posibles: 'Simples + Finanzas' (todas) o 'Solo simples'.
  modo: 'Simples + Finanzas',
  // Color de acento. Sugeridos: '#FF8A5B', '#FFD27A', '#7FE0C8', '#B9A6FF'.
  acento: '#FF8A5B',
  // true: la caracola lee la respuesta en voz alta. false: solo efectos de sonido.
  voz: true
};

/* Respuestas. Para agregar una nueva, súmala a la lista que corresponda. */
const RESPUESTAS = {
  simples: ['Sí.', 'No.', 'Depende.', 'Puede ser.', 'Claro que sí.', 'Ni lo sueñes.', 'Mejor no.', 'Obvio.', 'Hoy no.', 'Quizás.'],
  finanzas: ['Depende del presupuesto.', 'Solo con CDP.', 'Después del cierre.', 'Pregúntale a DIPRES.', 'Pregúntale a la DEP.', 'Sí, pero por oficio.', 'Sí, pero por MEMO.', 'Sí, pero por REX.', 'Sin disponibilidad presupuestaria.', 'Eso hay que rendirlo.', 'Cuando llegue la remesa.']
};

(function () {
  'use strict';

  const KEY_REGISTRO = 'caracola-finanzas:registro:v1';
  const KEY_SONIDO = 'caracola-finanzas:sonido';
  const MAX_REGISTROS = 2000;
  const SILENCIO = '(pregunta en silencio)';
  const SPRING = 'cubic-bezier(.34,1.56,.64,1)';

  const $ = (id) => document.getElementById(id);
  const el = {
    q: $('cmf-q'),
    idle: $('cmf-idle'),
    thinking: $('cmf-thinking'),
    result: $('cmf-result'),
    lastQ: $('cmf-lastq'),
    answer: $('cmf-answer'),
    cord: $('cmf-cord'),
    shell: $('cmf-shell'),
    ring: $('cmf-ring'),
    hint: $('cmf-hint'),
    toggle: $('cmf-toggle'),
    iconOn: $('cmf-icon-on'),
    iconOff: $('cmf-icon-off'),
    soundLabel: $('cmf-sound-label'),
    history: $('cmf-history'),
    historyList: $('cmf-history-list'),
    openLog: $('cmf-open-log'),
    count: $('cmf-count'),
    warn: $('cmf-storage-warn'),
    log: $('cmf-log'),
    logClose: $('cmf-log-close'),
    logTotal: $('cmf-log-total'),
    logTopWrap: $('cmf-log-top-wrap'),
    logTop: $('cmf-log-top'),
    logSearch: $('cmf-log-search'),
    logShowing: $('cmf-log-showing'),
    logBody: $('cmf-log-body'),
    logExport: $('cmf-log-export'),
    logClear: $('cmf-log-clear'),
    logCancel: $('cmf-log-cancel'),
    logStatus: $('cmf-log-status')
  };

  document.documentElement.style.setProperty('--acento', CONFIG.acento);

  /* -------------------------------------------------------------------------
   * Almacenamiento local (todo dentro de try/catch)
   * ----------------------------------------------------------------------- */

  function nuevoId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    } catch (err) {}
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function normalizar(r) {
    if (!r || typeof r !== 'object') return null;
    const fecha = typeof r.fecha === 'string' ? r.fecha : '';
    if (!fecha || isNaN(Date.parse(fecha))) return null;
    return {
      id: r.id ? String(r.id) : nuevoId(),
      fecha: fecha,
      pregunta: typeof r.pregunta === 'string' ? r.pregunta : '',
      respuesta: typeof r.respuesta === 'string' ? r.respuesta : '',
      modo: typeof r.modo === 'string' ? r.modo : '',
      via: typeof r.via === 'string' ? r.via : ''
    };
  }

  // Devuelve { ok, lista }. ok = false si localStorage no está disponible.
  function leerRegistro() {
    let raw;
    try {
      const ls = window.localStorage;
      const prueba = 'caracola-finanzas:prueba';
      ls.setItem(prueba, '1');
      ls.removeItem(prueba);
      raw = ls.getItem(KEY_REGISTRO);
    } catch (err) {
      return { ok: false, lista: [] };
    }
    if (!raw) return { ok: true, lista: [] };
    try {
      const datos = JSON.parse(raw);
      if (!Array.isArray(datos)) return { ok: true, lista: [] };
      const lista = datos.map(normalizar).filter(Boolean);
      lista.sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha));
      return { ok: true, lista: lista.slice(-MAX_REGISTROS) };
    } catch (err) {
      return { ok: true, lista: [] };
    }
  }

  function escribirRegistro(lista) {
    try {
      window.localStorage.setItem(KEY_REGISTRO, JSON.stringify(lista));
      return true;
    } catch (err) {
      return false;
    }
  }

  function borrarRegistroGuardado() {
    try {
      window.localStorage.removeItem(KEY_REGISTRO);
      return true;
    } catch (err) {
      return false;
    }
  }

  function leerSonido() {
    try {
      const v = window.localStorage.getItem(KEY_SONIDO);
      if (v === 'encendido') return true;
      if (v === 'apagado') return false;
    } catch (err) {}
    return null;
  }

  function guardarSonido(on) {
    try { window.localStorage.setItem(KEY_SONIDO, on ? 'encendido' : 'apagado'); } catch (err) {}
  }

  /* -------------------------------------------------------------------------
   * Fechas (es-CL, America/Santiago) y CSV
   * ----------------------------------------------------------------------- */

  const FMT_OPCIONES = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  let fmtFecha;
  try {
    fmtFecha = new Intl.DateTimeFormat('es-CL', Object.assign({ timeZone: 'America/Santiago' }, FMT_OPCIONES));
  } catch (err) {
    fmtFecha = new Intl.DateTimeFormat('es-CL', FMT_OPCIONES);
  }

  function partesFecha(valor) {
    const d = new Date(valor);
    if (isNaN(d.getTime())) return { fecha: '', hora: '', ymd: '' };
    const p = {};
    fmtFecha.formatToParts(d).forEach((x) => { p[x.type] = x.value; });
    return {
      fecha: p.day + '-' + p.month + '-' + p.year,
      hora: p.hour + ':' + p.minute,
      ymd: p.year + '-' + p.month + '-' + p.day
    };
  }

  function campoCSV(valor) {
    let s = String(valor == null ? '' : valor);
    // Evita que Excel interprete el texto como fórmula.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[";\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportarCSV() {
    const filas = [['Fecha', 'Hora', 'Pregunta', 'Respuesta', 'Modo', 'Vía']];
    state.registro.slice().reverse().forEach((r) => {
      const p = partesFecha(r.fecha);
      filas.push([p.fecha, p.hora, r.pregunta, r.respuesta, r.modo, r.via]);
    });
    const csv = '﻿' + filas.map((f) => f.map(campoCSV).join(';')).join('\r\n') + '\r\n';
    const nombre = 'registro-caracola-' + partesFecha(Date.now()).ymd + '.csv';
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      el.logStatus.textContent = 'Se descargó ' + nombre + '.';
    } catch (err) {
      el.logStatus.textContent = 'No se pudo exportar el archivo.';
    }
  }

  /* -------------------------------------------------------------------------
   * Estado y render
   * ----------------------------------------------------------------------- */

  const inicial = leerRegistro();
  const sonidoGuardado = leerSonido();

  const state = {
    question: '',
    lastQ: '',
    answer: '',
    thinking: false,
    pull: 0,
    dragging: false,
    soundOn: sonidoGuardado !== false,
    registro: inicial.lista, // ordenado del más antiguo al más reciente
    version: 0,
    storageOk: inicial.ok,
    filtro: '',
    confirmClear: false,
    needQuestion: false // se intentó preguntar sin escribir nada
  };

  let startY = 0;
  let moved = false;
  let lastAnswer = '';
  let muted = !state.soundOn;
  let ctx = null;
  let armed = false;
  let voiceUnlocked = false;
  let confirmAt = 0;
  const pintado = { historia: -1, panel: '' };

  function setState(patch) {
    Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
    render();
  }

  function later(fn, ms) {
    setTimeout(fn, ms);
  }

  function nodo(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function fmtNum(n) {
    return n.toLocaleString('es-CL');
  }

  function render() {
    const s = state;
    const pull = s.pull;

    const locked = !s.thinking && !tienePregunta();

    let hint = 'Arrastra la argolla hacia abajo y suelta, o toca la caracola.';
    if (s.dragging) hint = pull >= 60 ? '¡Suelta la cuerda!' : 'Un poco más…';
    else if (s.thinking) hint = 'La caracola está deliberando…';
    else if (locked) hint = s.needQuestion ? 'Primero escribe tu pregunta.' : 'Escribe tu pregunta para despertar a la caracola.';

    if (el.q.value !== s.question) el.q.value = s.question;
    if (s.needQuestion && locked) el.q.setAttribute('aria-invalid', 'true');
    else el.q.removeAttribute('aria-invalid');

    el.idle.hidden = !(!s.thinking && !s.answer);
    el.thinking.hidden = !s.thinking;
    el.result.hidden = !(!s.thinking && !!s.answer);
    el.lastQ.hidden = !s.lastQ;
    el.lastQ.textContent = s.lastQ ? '«' + s.lastQ + '»' : '';
    el.answer.textContent = s.answer;

    el.cord.style.height = (98 + pull) + 'px';
    el.cord.style.transition = s.dragging ? 'none' : 'height 480ms ' + SPRING;
    el.ring.style.transform = 'translateY(' + pull + 'px)';
    el.ring.style.transition = s.dragging ? 'none' : 'transform 480ms ' + SPRING;
    el.ring.style.cursor = locked ? 'not-allowed' : (s.dragging ? 'grabbing' : 'grab');
    el.shell.classList.toggle('cmf-wobble', s.thinking);
    el.shell.classList.toggle('is-locked', locked);
    el.ring.classList.toggle('is-locked', locked);
    el.shell.setAttribute('aria-disabled', String(locked));
    el.ring.setAttribute('aria-disabled', String(locked));

    el.hint.textContent = hint;

    el.iconOn.hidden = !s.soundOn;
    el.iconOff.hidden = s.soundOn;
    el.soundLabel.textContent = s.soundOn ? 'Sonido encendido' : 'Sonido apagado';

    el.warn.hidden = s.storageOk;

    if (pintado.historia !== s.version) {
      pintado.historia = s.version;
      renderHistoria();
    }

    const clavePanel = [s.version, s.filtro, s.confirmClear, el.log.open].join('|');
    if (el.log.open && pintado.panel !== clavePanel) {
      pintado.panel = clavePanel;
      renderPanel();
    } else if (!el.log.open) {
      pintado.panel = '';
    }
  }

  function renderHistoria() {
    const s = state;
    const total = s.registro.length;
    const recientes = s.registro.slice(-4).reverse();

    el.history.hidden = recientes.length === 0;
    el.historyList.textContent = '';
    recientes.forEach((r) => {
      const li = nodo('li', 'cmf-item');
      li.appendChild(nodo('span', 'cmf-item-q', r.pregunta || SILENCIO));
      li.appendChild(nodo('span', 'cmf-item-a', r.respuesta));
      el.historyList.appendChild(li);
    });
    el.openLog.textContent = 'Ver registro completo (' + fmtNum(total) + ')';
    el.count.textContent = (s.storageOk ? 'Consultas registradas en este navegador: ' : 'Consultas atendidas en esta sesión: ') + fmtNum(total);
  }

  function normalizarBusqueda(t) {
    return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function renderPanel() {
    const s = state;
    const total = s.registro.length;

    // Resumen
    el.logTotal.textContent = 'Total de consultas: ' + fmtNum(total);
    const conteo = new Map();
    s.registro.forEach((r) => conteo.set(r.respuesta, (conteo.get(r.respuesta) || 0) + 1));
    const top = Array.from(conteo).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, 3);
    el.logTopWrap.hidden = top.length === 0;
    el.logTop.textContent = '';
    top.forEach(([resp, n]) => {
      const li = nodo('li', null, resp + ' ');
      li.appendChild(nodo('span', 'cmf-top-n', '— ' + fmtNum(n) + (n === 1 ? ' vez' : ' veces')));
      el.logTop.appendChild(li);
    });

    // Tabla (la más reciente arriba)
    const filtro = normalizarBusqueda(s.filtro.trim());
    const filas = s.registro.slice().reverse().filter((r) => {
      if (!filtro) return true;
      return normalizarBusqueda((r.pregunta || SILENCIO) + ' ' + r.respuesta).indexOf(filtro) !== -1;
    });

    el.logShowing.hidden = !filtro;
    el.logShowing.textContent = 'Mostrando ' + fmtNum(filas.length) + ' de ' + fmtNum(total);

    el.logBody.textContent = '';
    if (filas.length === 0) {
      const tr = nodo('tr');
      const td = nodo('td', 'cmf-td-empty', total === 0 ? 'Aún no hay consultas registradas.' : 'Ninguna consulta coincide con la búsqueda.');
      td.colSpan = 3;
      tr.appendChild(td);
      el.logBody.appendChild(tr);
    } else {
      const frag = document.createDocumentFragment();
      filas.forEach((r) => {
        const p = partesFecha(r.fecha);
        const tr = nodo('tr');
        const tdFecha = nodo('td', 'cmf-td-fecha', p.fecha + ' ' + p.hora);
        const tdQ = nodo('td', 'cmf-td-q' + (r.pregunta ? '' : ' is-silent'), r.pregunta || SILENCIO);
        const tdA = nodo('td', 'cmf-td-a', r.respuesta);
        tr.appendChild(tdFecha);
        tr.appendChild(tdQ);
        tr.appendChild(tdA);
        frag.appendChild(tr);
      });
      el.logBody.appendChild(frag);
    }

    // Acciones
    el.logExport.disabled = total === 0;
    el.logClear.disabled = total === 0 && !s.confirmClear;
    el.logClear.textContent = s.confirmClear ? 'Sí, borrar todo' : 'Borrar registro';
    el.logClear.classList.toggle('is-confirm', s.confirmClear);
    el.logCancel.hidden = !s.confirmClear;
  }

  /* -------------------------------------------------------------------------
   * Sonido (Web Audio) y voz (speechSynthesis)
   * ----------------------------------------------------------------------- */

  function useVoice() {
    return (CONFIG.voz ?? true) !== false;
  }

  function unlock() {
    if (muted) return;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (err) {}
    if (!voiceUnlocked && useVoice() && window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') {
      voiceUnlocked = true;
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch (err) {}
    }
  }

  function tone(type, f0, f1, dur, vol, delay) {
    const c = ctx;
    if (!c || muted) return;
    try {
      const t = c.currentTime + (delay || 0);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (err) {}
  }

  function playZip() {
    const c = ctx;
    if (!c || muted) return;
    try {
      const t = c.currentTime;
      const o = c.createOscillator();
      const f = c.createBiquadFilter();
      const g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1400, t);
      o.frequency.exponentialRampToValueAtTime(130, t + 0.3);
      f.type = 'lowpass';
      f.frequency.setValueAtTime(2600, t);
      f.Q.value = 3;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(f);
      f.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + 0.36);
    } catch (err) {}
    tone('square', 95, 60, 0.07, 0.08, 0.3);
  }

  function playTick() {
    tone('triangle', 1800, 1200, 0.05, 0.08, 0);
  }

  function playBloop() {
    tone('sine', 260, 720, 0.14, 0.22, 0);
    tone('sine', 360, 940, 0.12, 0.16, 0.1);
  }

  function playHum() {
    const c = ctx;
    if (!c || muted) return;
    try {
      const t = c.currentTime;
      const o = c.createOscillator();
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(196, t);
      lfo.frequency.setValueAtTime(6, t);
      lfoGain.gain.setValueAtTime(9, t);
      lfo.connect(lfoGain);
      lfoGain.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      lfo.start(t);
      o.stop(t + 1.1);
      lfo.stop(t + 1.1);
    } catch (err) {}
  }

  function playChime() {
    const notes = [1046.5, 1318.5, 1568, 2093];
    notes.forEach((n, i) => {
      tone('triangle', n, 0, 0.7, 0.09, i * 0.08);
      tone('sine', n / 2, 0, 0.8, 0.05, i * 0.08);
    });
  }

  function pickVoice() {
    try {
      const vs = window.speechSynthesis.getVoices() || [];
      const es = vs.filter((v) => /^es/i.test(v.lang || ''));
      const pref = ['es-cl', 'es-419', 'es-us', 'es-mx', 'es-ar', 'es-es'];
      for (let i = 0; i < pref.length; i += 1) {
        const m = es.find((v) => String(v.lang).replace('_', '-').toLowerCase() === pref[i]);
        if (m) return m;
      }
      return es[0] || null;
    } catch (err) {
      return null;
    }
  }

  function say(text) {
    if (muted || !useVoice()) return;
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return;
    try {
      const spoken = String(text).replace(/MEMO/g, 'memo').replace(/REX/g, 'rex').replace(/DIPRES/g, 'Dipres');
      const u = new SpeechSynthesisUtterance(spoken);
      const v = pickVoice();
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else {
        u.lang = 'es-CL';
      }
      u.rate = 0.92;
      u.pitch = 0.8;
      window.speechSynthesis.speak(u);
    } catch (err) {}
  }

  function stopVoice() {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (err) {}
  }

  /* -------------------------------------------------------------------------
   * Oráculo
   * ----------------------------------------------------------------------- */

  function pool() {
    const modo = CONFIG.modo ?? 'Simples + Finanzas';
    return modo === 'Solo simples' ? RESPUESTAS.simples : RESPUESTAS.simples.concat(RESPUESTAS.finanzas);
  }

  function registrar(pregunta, respuesta, via) {
    const entrada = {
      id: nuevoId(),
      fecha: new Date().toISOString(),
      pregunta: pregunta,
      respuesta: respuesta,
      modo: CONFIG.modo,
      via: via
    };
    let lista = state.registro.concat(entrada);
    if (lista.length > MAX_REGISTROS) lista = lista.slice(-MAX_REGISTROS);
    const ok = escribirRegistro(lista);
    return { registro: lista, version: state.version + 1, storageOk: ok };
  }

  function tienePregunta() {
    return String(state.question || '').trim() !== '';
  }

  // Intento sin pregunta: avisa y lleva el foco al campo.
  function pedirPregunta() {
    setState({ needQuestion: true });
    el.q.classList.remove('cmf-nudge');
    void el.q.offsetWidth; // reinicia la animación
    el.q.classList.add('cmf-nudge');
    el.q.focus();
  }

  // via: 'cuerda' | 'caracola' | 'teclado'
  function ask(via) {
    if (state.thinking) return;
    const q = String(state.question || '').trim();
    if (!q) return;
    stopVoice();
    playHum();
    setState({ thinking: true, answer: '' });
    later(() => {
      const list = pool();
      let a = list[Math.floor(Math.random() * list.length)];
      let tries = 0;
      while (a === lastAnswer && tries < 6) {
        a = list[Math.floor(Math.random() * list.length)];
        tries += 1;
      }
      lastAnswer = a;
      setState(Object.assign({
        thinking: false,
        answer: a,
        lastQ: q,
        question: ''
      }, registrar(q, a, via)));
      playChime();
      later(() => say(a), 420);
    }, 1100);
  }

  function tug(via) {
    if (state.thinking || state.dragging) return;
    if (!tienePregunta()) {
      pedirPregunta();
      return;
    }
    unlock();
    playZip();
    setState({ pull: 90 });
    later(() => {
      setState({ pull: 0 });
      ask(via);
    }, 280);
  }

  /* -------------------------------------------------------------------------
   * Eventos
   * ----------------------------------------------------------------------- */

  el.q.addEventListener('input', (e) => {
    setState({ question: String(e.target.value).slice(0, 140), needQuestion: false });
  });

  el.q.addEventListener('animationend', () => el.q.classList.remove('cmf-nudge'));

  el.q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      tug('teclado');
    }
  });

  el.shell.addEventListener('click', () => {
    if (state.thinking) return;
    if (!tienePregunta()) {
      pedirPregunta();
      return;
    }
    unlock();
    playBloop();
    ask('caracola');
  });

  el.ring.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (state.thinking || !tienePregunta()) return;
    startY = e.clientY;
    moved = false;
    armed = false;
    unlock();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    setState({ dragging: true });
  });

  el.ring.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const dy = Math.max(0, Math.min(140, e.clientY - startY));
    if (dy > 4) moved = true;
    if (dy >= 60 && !armed) {
      armed = true;
      playTick();
    }
    if (dy < 60) armed = false;
    setState({ pull: dy });
  });

  el.ring.addEventListener('pointerup', () => {
    if (!state.dragging) return;
    const fire = state.pull >= 60;
    setState({ dragging: false, pull: 0 });
    if (fire && tienePregunta()) {
      playZip();
      ask('cuerda');
    }
  });

  el.ring.addEventListener('pointercancel', () => setState({ dragging: false, pull: 0 }));

  el.ring.addEventListener('click', () => {
    if (moved) {
      moved = false;
      return;
    }
    tug('cuerda');
  });

  el.toggle.addEventListener('click', () => {
    muted = !muted;
    guardarSonido(!muted);
    setState({ soundOn: !muted });
    if (muted) {
      stopVoice();
    } else {
      unlock();
      playBloop();
    }
  });

  // Otra pestaña modificó el registro: sincroniza.
  window.addEventListener('storage', (e) => {
    if (e.key !== null && e.key !== KEY_REGISTRO) return;
    const leido = leerRegistro();
    setState({ registro: leido.lista, storageOk: leido.ok, version: state.version + 1 });
  });

  /* Panel del registro */

  const modalNativo = typeof el.log.showModal === 'function';

  function abrirPanel() {
    el.logSearch.value = '';
    el.logStatus.textContent = '';
    state.filtro = '';
    state.confirmClear = false;
    if (modalNativo) el.log.showModal();
    else el.log.setAttribute('open', '');
    render();
    el.logClose.focus();
  }

  function cerrarPanel() {
    if (modalNativo) el.log.close();
    else {
      el.log.removeAttribute('open');
      alCerrarPanel();
    }
  }

  function alCerrarPanel() {
    setState({ confirmClear: false });
    if (!el.history.hidden) el.openLog.focus();
    else el.q.focus();
  }

  el.openLog.addEventListener('click', abrirPanel);
  el.logClose.addEventListener('click', cerrarPanel);
  el.log.addEventListener('close', alCerrarPanel);

  // Clic en el fondo oscuro cierra el panel.
  el.log.addEventListener('click', (e) => {
    if (e.target === el.log) cerrarPanel();
  });

  if (!modalNativo) {
    el.log.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrarPanel();
      }
    });
  }

  el.logSearch.addEventListener('input', (e) => {
    setState({ filtro: String(e.target.value) });
  });

  el.logExport.addEventListener('click', exportarCSV);

  el.logClear.addEventListener('click', () => {
    if (!state.confirmClear) {
      if (state.registro.length === 0) return;
      confirmAt = Date.now();
      el.logStatus.textContent = 'Esto elimina todas las consultas guardadas en este navegador. ¿Confirmas?';
      setState({ confirmClear: true });
      el.logCancel.focus();
      return;
    }
    // Evita que un doble clic borre todo sin querer.
    if (Date.now() - confirmAt < 400) return;
    const ok = borrarRegistroGuardado();
    setState({
      registro: [],
      version: state.version + 1,
      confirmClear: false,
      storageOk: ok
    });
    el.logStatus.textContent = 'Registro borrado.';
    el.logSearch.focus();
  });

  el.logCancel.addEventListener('click', () => {
    el.logStatus.textContent = '';
    setState({ confirmClear: false });
    el.logClear.focus();
  });

  /* Inicio */

  try { if (window.speechSynthesis) window.speechSynthesis.getVoices(); } catch (err) {}
  render();
})();
