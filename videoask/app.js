const $ = (id) => document.getElementById(id);

const host = $("host");
const stage = $("stage");
const hud = $("hud");
const bottom = $("bottom");
const sheet = $("sheet");
const recorder = $("recorder");
const progress = $("progress");
const mediaTitle = $("mediaTitle");
const chromeTitle = $("chromeTitle");
const playWrap = $("playWrap");
const playBtn = $("playBtn");
const controls = $("controls");
const timeEl = $("time");
const live = $("live");
const banner = $("banner");

const state = {
  flow: null,
  index: 0,
  answers: {},
  playing: false,
  rate: 1,
  captions: false,
  stream: null,
  rec: null,
  chunks: [],
  recTimer: null,
  recStarted: 0,
  openMode: null,
  draft: null,
};

const fmt = (s) => {
  const n = Math.max(0, Math.floor(s || 0));
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};

const announce = (msg) => {
  live.textContent = msg;
};

const step = () => state.flow.steps[state.index];

const setProgress = () => {
  const n = state.flow.steps.length;
  progress.style.width = `${((state.index + 1) / n) * 100}%`;
};

function toast(msg) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

async function loadFlow() {
  const res = await fetch("./flow.json", { cache: "no-store" });
  state.flow = await res.json();
  if (!host.querySelector("source")) host.src = state.flow.media.src;
  host.poster = state.flow.media.poster;
  banner.hidden = !state.flow.preview;
  host.play().then(() => host.classList.add("is-on")).catch(() => {});
  render();
}

function hideOverlays() {
  sheet.hidden = true;
  sheet.innerHTML = "";
  recorder.hidden = true;
  recorder.innerHTML = "";
  hud.hidden = false;
  stage.classList.remove("is-dim");
}

function go(i) {
  stopCapture();
  state.index = Math.max(0, Math.min(i, state.flow.steps.length - 1));
  state.openMode = null;
  state.draft = null;
  render();
}

function next() {
  go(state.index + 1);
}

function render() {
  hideOverlays();
  setProgress();
  const s = step();
  chromeTitle.textContent = "ventura.ask";
  mediaTitle.textContent = s.title || "";
  announce(s.title || s.prompt || "");

  if (s.type === "permissions") return renderPermissions(s);
  if (s.type === "complete") return renderComplete(s);
  if (s.type === "open" && state.openMode === "record") return renderRecorder(s);
  if (s.type === "open" && state.openMode === "text") return renderText(s);
  if (s.type === "open" && state.openMode === "review") return renderReview(s);

  controls.hidden = s.type === "intro" || s.type === "yesno";
  playWrap.hidden = false;
  playBtn.hidden = !(s.type === "intro" && !state.playing);
  stage.classList.toggle("is-dim", false);
  renderBottom(s);
  syncTime();
}

function renderBottom(s) {
  if (s.type === "intro") {
    bottom.innerHTML = `<button class="cta" id="startBtn" type="button">${s.cta}</button>`;
    $("startBtn").onclick = startAsk;
    return;
  }
  if (s.type === "choice") {
    bottom.innerHTML = `
      <div class="choices" role="listbox" aria-label="${s.prompt}">
        ${s.options
          .map(
            (o) => `
          <button class="choice" type="button" role="option" data-id="${o.id}">
            <b class="badge">${o.label}</b>
            <span>${o.text}</span>
          </button>`
          )
          .join("")}
      </div>
      <p class="prompt">${s.prompt}</p>
    `;
    bottom.querySelectorAll(".choice").forEach((btn) => {
      btn.onclick = () => pickChoice(s, btn.dataset.id, btn);
    });
    return;
  }
  if (s.type === "yesno") {
    bottom.innerHTML = `
      <p class="prompt">${s.prompt}</p>
      <div class="yesno">
        <button class="circle yes" type="button" data-v="yes">YES</button>
        <button class="circle no" type="button" data-v="no">NO</button>
      </div>
    `;
    bottom.querySelectorAll(".circle").forEach((btn) => {
      btn.onclick = () => {
        state.answers[s.id] = { type: "yesno", value: btn.dataset.v };
        next();
      };
    });
    return;
  }
  if (s.type === "open") {
    bottom.innerHTML = `
      <div class="types">
        ${s.accepts
          .map(
            (m) => `
          <button class="type" type="button" data-m="${m}">
            <i class="ph ${iconFor(m)}" aria-hidden="true" style="font-size:26px"></i>
            ${m.toUpperCase()}
          </button>`
          )
          .join("")}
      </div>
      <div class="select-copy">
        <p>Select answer type:</p>
        <em>Video, voice or text</em>
      </div>
      <button class="cta" id="contOpen" type="button" disabled>Continue →</button>
    `;
    let picked = null;
    bottom.querySelectorAll(".type").forEach((btn) => {
      btn.onclick = () => {
        picked = btn.dataset.m;
        bottom.querySelectorAll(".type").forEach((b) => b.classList.toggle("is-on", b === btn));
        const c = $("contOpen");
        c.disabled = false;
      };
    });
    $("contOpen").onclick = () => {
      if (!picked) return;
      if (picked === "text") {
        state.openMode = "text";
      } else {
        state.openMode = "record";
        state.draft = { kind: picked };
      }
      render();
    };
  }
}

function iconFor(m) {
  if (m === "video") return "ph-video-camera";
  if (m === "audio") return "ph-microphone";
  return "ph-text-t";
}

function pickChoice(s, id, btn) {
  bottom.querySelectorAll(".choice").forEach((b) => b.classList.toggle("is-on", b === btn));
  state.answers[s.id] = { type: "choice", value: id };
  setTimeout(next, 220);
}

async function startAsk() {
  try {
    host.muted = false;
    await host.play();
    state.playing = true;
  } catch {
    state.playing = false;
  }
  next();
}

function renderPermissions(s) {
  hud.hidden = true;
  sheet.hidden = false;
  sheet.innerHTML = `
    <button class="sheet-close" type="button" id="permClose" aria-label="Close">
      <i class="ph ph-x" aria-hidden="true"></i>
    </button>
    <div class="sheet-body">
      <p class="kicker">${s.kicker}</p>
      <h1>${s.title}</h1>
      <div class="perm-row" aria-hidden="true">
        <i class="ph ph-microphone"></i>
        <span class="plus">+</span>
        <i class="ph ph-video-camera"></i>
      </div>
      <button class="cta is-dark" id="permGo" type="button">Continue →</button>
    </div>
  `;
  $("permClose").onclick = () => go(0);
  $("permGo").onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((t) => t.stop());
      state.answers.permissions = { granted: true };
    } catch {
      state.answers.permissions = { granted: false };
    }
    next();
  };
}

function renderComplete(s) {
  hud.hidden = true;
  sheet.hidden = false;
  const count = Object.keys(state.answers).filter((k) => k !== "permissions").length;
  sheet.innerHTML = `
    <button class="sheet-close" type="button" id="doneClose" aria-label="Close">
      <i class="ph ph-x" aria-hidden="true"></i>
    </button>
    <div class="sheet-body done-copy">
      <h1>${s.title}</h1>
      <p>${s.body}</p>
      <p>${count} answers saved on this device for the preview.</p>
      <button class="cta" id="again" type="button" style="margin-top:28px">Replay demo</button>
    </div>
  `;
  $("doneClose").onclick = () => go(0);
  $("again").onclick = () => {
    state.answers = {};
    go(0);
  };
}

function renderText(s) {
  stage.classList.add("is-dim");
  playWrap.hidden = true;
  controls.hidden = true;
  bottom.innerHTML = `
    <div class="text-box">
      <p class="prompt">${s.prompt}</p>
      <label class="sr-only" for="answerText">${s.prompt}</label>
      <textarea id="answerText" name="story" maxlength="1200" autocomplete="off" placeholder="Type your answer…"></textarea>
      <button class="cta" id="sendText" type="button">Continue →</button>
    </div>
  `;
  $("sendText").onclick = () => {
    const value = $("answerText").value.trim();
    if (!value) {
      $("answerText").focus();
      return;
    }
    state.answers[s.id] = { type: "text", value };
    next();
  };
}

async function renderRecorder(s) {
  hud.hidden = true;
  recorder.hidden = false;
  const kind = state.draft?.kind || "video";
  recorder.innerHTML = `
    <button class="icon-btn" type="button" id="recClose" aria-label="Cancel recording" style="align-self:flex-end">
      <i class="ph ph-x" aria-hidden="true"></i>
    </button>
    ${kind === "video" ? `<video id="previewCam" autoplay muted playsinline></video>` : ""}
    <div class="rec-timer" id="recClock">0:00</div>
    <button class="stop" id="stopBtn" type="button" aria-label="Stop recording"><i></i></button>
  `;
  $("recClose").onclick = () => {
    stopCapture();
    state.openMode = null;
    render();
  };

  const constraints = kind === "video" ? { audio: true, video: { facingMode: "user" } } : { audio: true };
  try {
    state.stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    toast("Could not open your camera or mic. Try text instead.");
    state.openMode = "text";
    render();
    return;
  }

  const preview = $("previewCam");
  if (preview) {
    preview.srcObject = state.stream;
    preview.play().catch(() => {});
  }

  const mime = pickMime(kind);
  state.chunks = [];
  state.rec = new MediaRecorder(state.stream, mime ? { mimeType: mime } : undefined);
  state.rec.ondataavailable = (e) => {
    if (e.data.size) state.chunks.push(e.data);
  };
  state.rec.onstop = () => {
    const blob = new Blob(state.chunks, { type: state.rec.mimeType || "video/webm" });
    state.draft = { ...state.draft, blob, url: URL.createObjectURL(blob) };
    state.openMode = "review";
    render();
  };
  state.rec.start();
  state.recStarted = Date.now();
  tickRec(s.maxSeconds || 90);
  $("stopBtn").onclick = () => state.rec?.state === "recording" && state.rec.stop();
}

function pickMime(kind) {
  const list =
    kind === "audio"
      ? ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
      : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4"];
  return list.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function tickRec(max) {
  clearInterval(state.recTimer);
  const clock = $("recClock");
  const loop = () => {
    const sec = Math.floor((Date.now() - state.recStarted) / 1000);
    if (clock) clock.textContent = fmt(sec).replace(/^00:/, "0:");
    if (sec >= max && state.rec?.state === "recording") state.rec.stop();
  };
  loop();
  state.recTimer = setInterval(loop, 250);
}

function renderReview(s) {
  hud.hidden = true;
  recorder.hidden = false;
  const { kind, url } = state.draft;
  recorder.innerHTML = `
    ${
      kind === "video"
        ? `<video src="${url}" controls playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1"></video>`
        : `<audio src="${url}" controls style="margin:auto;width:min(420px,90%)"></audio>`
    }
    <div class="rec-actions">
      <button class="cta is-ghost" id="retake" type="button">Retake</button>
      <button class="cta" id="useTake" type="button">Use this</button>
    </div>
  `;
  $("retake").onclick = () => {
    if (state.draft?.url) URL.revokeObjectURL(state.draft.url);
    state.openMode = "record";
    render();
  };
  $("useTake").onclick = () => {
    state.answers[s.id] = { type: kind, preview: true };
    if (state.draft?.url) URL.revokeObjectURL(state.draft.url);
    next();
  };
}

function stopCapture() {
  clearInterval(state.recTimer);
  if (state.rec && state.rec.state === "recording") {
    try { state.rec.stop(); } catch { /* ignore */ }
  }
  state.rec = null;
  state.stream?.getTracks().forEach((t) => t.stop());
  state.stream = null;
}

function syncTime() {
  timeEl.textContent = `${fmt(host.currentTime)} / ${fmt(host.duration || 8)}`;
}

playBtn.onclick = async () => {
  try {
    host.muted = false;
    await host.play();
    state.playing = true;
    playBtn.hidden = true;
    controls.hidden = step().type === "intro";
  } catch {
    toast("Tap again to play the clip.");
  }
};

host.addEventListener("timeupdate", syncTime);
host.addEventListener("loadedmetadata", syncTime);
host.addEventListener("playing", () => host.classList.add("is-on"));
host.addEventListener("play", () => {
  host.classList.add("is-on");
  if (step()?.type !== "intro") {
    state.playing = true;
    playBtn.hidden = true;
  }
});
host.addEventListener("pause", () => {
  if (step()?.type === "intro") {
    state.playing = false;
    playBtn.hidden = false;
  }
});

$("muteBtn").onclick = () => {
  host.muted = !host.muted;
  $("muteBtn").innerHTML = host.muted
    ? '<i class="ph ph-speaker-slash" aria-hidden="true"></i>'
    : '<i class="ph ph-speaker-high" aria-hidden="true"></i>';
};

$("ccBtn").onclick = () => {
  state.captions = !state.captions;
  $("ccBtn").setAttribute("aria-pressed", String(state.captions));
  const p = bottom.querySelector(".prompt");
  if (p && step().type === "choice") p.hidden = !state.captions;
  else if (state.captions && step().prompt) toast(step().prompt);
};

$("rateBtn").onclick = () => {
  state.rate = state.rate === 1 ? 1.5 : state.rate === 1.5 ? 2 : 1;
  host.playbackRate = state.rate;
  $("rateBtn").textContent = `${state.rate}×`.replace(".0", "");
};

$("fsBtn").onclick = async () => {
  const root = document.querySelector(".phone") || document.documentElement;
  if (!document.fullscreenElement) await root.requestFullscreen?.();
  else await document.exitFullscreen?.();
};

$("closeBtn").onclick = () => {
  if (state.index === 0) return;
  if (confirm("Leave this ask? Preview answers will be cleared.")) {
    state.answers = {};
    go(0);
  }
};

$("infoBtn").onclick = () => {
  toast("Demo intake. Later this lives inside the Ventura dashboard.");
};

document.addEventListener("keydown", (e) => {
  const s = step();
  if (e.key === "Escape") $("closeBtn").click();
  if (e.key === " " && s?.type === "intro") {
    e.preventDefault();
    playBtn.click();
  }
  if (s?.type === "choice" && ["1", "2", "3", "a", "b", "c"].includes(e.key.toLowerCase())) {
    const map = { 1: "a", 2: "b", 3: "c" };
    const id = map[e.key] || e.key.toLowerCase();
    const btn = bottom.querySelector(`[data-id="${id}"]`);
    btn?.click();
  }
});

window.addEventListener("beforeunload", (e) => {
  if (Object.keys(state.answers).length) {
    e.preventDefault();
    e.returnValue = "";
  }
  stopCapture();
});

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reduce) host.removeAttribute("autoplay");

loadFlow().catch((err) => {
  console.error(err);
  toast("Could not load this ask.");
});
