import {
  nid,
  putBlob,
  saveAsk,
  getAsk,
  listAsks,
  listReplies,
  takeUrl,
  currentAskId,
} from "./store.js";

const $ = (id) => document.getElementById(id);

const state = {
  ask: null,
  screen: "home",
  stream: null,
  rec: null,
  chunks: [],
  facing: "user",
  notesOn: false,
  recording: false,
  draft: null,
  replies: [],
};

const toast = (msg) => {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
};

function pickMime() {
  return (
    ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4"].find((t) =>
      MediaRecorder.isTypeSupported(t)
    ) || ""
  );
}

function stopStream() {
  if (state.rec && state.rec.state === "recording") {
    try { state.rec.stop(); } catch { /* ignore */ }
  }
  state.rec = null;
  state.recording = false;
  state.stream?.getTracks().forEach((t) => t.stop());
  state.stream = null;
}

function blankAsk() {
  return {
    id: nid(7),
    title: "Untitled",
    live: false,
    steps: [],
  };
}

function root() {
  return $("adminRoot");
}

function hideTakeChrome() {
  $("hud").hidden = true;
  $("stage").hidden = true;
  $("sheet").hidden = true;
  $("recorder").hidden = true;
  $("progress").hidden = true;
  const foot = document.querySelector(".powered");
  if (foot) foot.hidden = state.screen === "rec";
}

export async function bootAdmin() {
  document.title = "Ventura Ask · Studio";
  document.body.dataset.mode = "admin";
  root().hidden = false;
  const existing = currentAskId() ? await getAsk(currentAskId()) : null;
  const asks = await listAsks();
  if (!existing && asks.length === 0) {
    startNew();
    return;
  }
  state.ask = existing;
  showHome();
}

function startNew() {
  stopStream();
  state.ask = blankAsk();
  state.draft = null;
  goPermissions();
}

function render(html) {
  hideTakeChrome();
  root().hidden = false;
  root().innerHTML = html;
}

function goPermissions() {
  state.screen = "perm";
  render(`
    <section class="sheet admin-sheet">
      <button class="sheet-close" type="button" id="aClose" aria-label="Close">
        <i class="ph ph-x" aria-hidden="true"></i>
      </button>
      <div class="sheet-body">
        <p class="kicker">Let’s get started by giving Ventura…</p>
        <h1>Access to your mic and cam</h1>
        <div class="perm-row" aria-hidden="true">
          <i class="ph ph-microphone"></i>
          <span class="plus">+</span>
          <i class="ph ph-video-camera"></i>
        </div>
        <button class="cta is-dark" id="aPerm" type="button">Continue →</button>
      </div>
    </section>
  `);
  $("aClose").onclick = showHome;
  $("aPerm").onclick = async () => {
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: state.facing, width: { ideal: 720 }, height: { ideal: 1280 } },
      });
      goRec();
    } catch {
      toast("Camera blocked. You can still use a sample clip.");
      goRec({ sample: true });
    }
  };
}

async function ensureStream() {
  if (state.stream) return state.stream;
  state.stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: { facingMode: state.facing },
  });
  return state.stream;
}

function stepLabel() {
  const n = (state.ask.steps || []).filter((s) => s.type !== "complete").length;
  return n === 0 ? "Introduction" : `Question ${n}`;
}

function goRec(opts = {}) {
  state.screen = "rec";
  state.recording = false;
  render(`
    <section class="admin-rec">
      <video id="adminCam" autoplay muted playsinline></video>
      <div class="admin-rec-top">
        <i class="rec-tick" aria-hidden="true"></i>
        <button class="icon-btn" type="button" id="aClose" aria-label="Close">
          <i class="ph ph-x" aria-hidden="true"></i>
        </button>
      </div>
      <div class="hold-copy">Hold <b>REC</b> to ask</div>
      <div class="hold-row">
        <button class="notes-toggle" id="notesToggle" type="button" aria-pressed="false">
          <span class="switch ${state.notesOn ? "on" : ""}"></span>
          <small>+ Notes</small>
        </button>
        <button class="hold-rec" id="holdRec" type="button" aria-label="Hold to record"></button>
        <button class="icon-btn ghost" id="flipCam" type="button" aria-label="Flip camera">
          <i class="ph ph-arrows-clockwise" aria-hidden="true"></i>
        </button>
      </div>
      <div class="notes-dock ${state.notesOn ? "open" : ""}" id="notesDock">
        <label class="sr-only" for="noteField">Notes</label>
        <textarea id="noteField" maxlength="400" placeholder="Write notes here to stay on track…"></textarea>
      </div>
      ${opts.sample ? `<button class="cta sample-cta" id="useSample" type="button">Use sample clip</button>` : ""}
    </section>
  `);

  const cam = $("adminCam");
  if (state.stream) {
    cam.srcObject = state.stream;
    cam.play().catch(() => {});
  } else if (!opts.sample) {
    ensureStream()
      .then((stream) => {
        cam.srcObject = stream;
        cam.play().catch(() => {});
      })
      .catch(() => toast("Could not open camera."));
  }

  $("aClose").onclick = () => {
    if (confirm("Leave this survey?")) {
      stopStream();
      showHome();
    }
  };

  $("notesToggle").onclick = () => {
    state.notesOn = !state.notesOn;
    $("notesToggle").querySelector(".switch").classList.toggle("on", state.notesOn);
    $("notesToggle").setAttribute("aria-pressed", String(state.notesOn));
    $("notesDock").classList.toggle("open", state.notesOn);
    if (state.notesOn) $("noteField").focus();
  };

  $("flipCam").onclick = async () => {
    state.facing = state.facing === "user" ? "environment" : "user";
    stopStream();
    try {
      await ensureStream();
      cam.srcObject = state.stream;
      await cam.play();
    } catch {
      toast("Could not flip camera.");
    }
  };

  if ($("useSample")) $("useSample").onclick = useSampleClip;

  wireHold($("holdRec"));
}

function wireHold(btn) {
  let downAt = 0;
  const start = async (e) => {
    e.preventDefault();
    if (state.recording) {
      finishRecording();
      return;
    }
    downAt = Date.now();
    try {
      btn.setPointerCapture(e.pointerId);
      await beginRecording();
    } catch {
      toast("Could not start recording.");
    }
  };
  const end = (e) => {
    e.preventDefault();
    if (!state.recording) return;
    if (Date.now() - downAt < 400) return;
    finishRecording();
  };
  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", end);
  btn.addEventListener("pointercancel", end);
}

async function beginRecording() {
  if (!state.stream) await ensureStream();
  state.chunks = [];
  const mime = pickMime();
  state.rec = new MediaRecorder(state.stream, mime ? { mimeType: mime } : undefined);
  state.rec.ondataavailable = (e) => {
    if (e.data.size) state.chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => {
    state.rec.onstop = () => resolve();
  });
  state.rec._stopped = stopped;
  state.rec.start(200);
  state.recording = true;
  $("holdRec")?.classList.add("hot");
  document.querySelector(".hold-copy")?.classList.add("hot");
}

async function finishRecording() {
  if (!state.rec || state.rec.state !== "recording") return;
  const rec = state.rec;
  rec.stop();
  await rec._stopped;
  state.recording = false;
  $("holdRec")?.classList.remove("hot");
  const blob = new Blob(state.chunks, { type: rec.mimeType || "video/webm" });
  if (blob.size < 800) {
    toast("Hold a little longer to capture the question.");
    return;
  }
  await commitClip(blob);
}

async function useSampleClip() {
  const res = await fetch("./assets/host-loop.mp4");
  await commitClip(await res.blob());
}

async function commitClip(blob) {
  const mediaKey = `clip-${nid(8)}`;
  await putBlob(mediaKey, blob);
  const n = state.ask.steps.filter((s) => s.type !== "complete").length;
  state.draft = {
    id: nid(6),
    type: n === 0 ? "intro" : "open",
    title: stepLabel(),
    prompt: n === 0 ? "" : "Your question",
    accepts: ["video", "audio", "text"],
    options: [
      { id: "a", label: "A", text: "Option A" },
      { id: "b", label: "B", text: "Option B" },
      { id: "c", label: "C", text: "Option C" },
    ],
    mediaKey,
    preview: URL.createObjectURL(blob),
    notes: $("noteField")?.value || "",
    cta: "Start",
  };
  goType();
}

function goType() {
  state.screen = "type";
  const d = state.draft;
  render(`
    <section class="admin-type">
      <button class="sheet-close light" type="button" id="aClose" aria-label="Close">
        <i class="ph ph-x" aria-hidden="true"></i>
      </button>
      <div class="type-card">
        <video src="${d.preview}" playsinline muted loop autoplay></video>
        <input class="type-title" id="stepTitle" maxlength="48" value="${escapeAttr(d.title)}" aria-label="Step title">
        <div class="types on-card">
          ${["video", "audio", "text"]
            .map(
              (m) => `
            <button class="type ${d.accepts.includes(m) ? "is-on" : ""}" type="button" data-m="${m}">
              <i class="ph ${m === "video" ? "ph-video-camera" : m === "audio" ? "ph-microphone" : "ph-text-t"}" aria-hidden="true"></i>
              ${m.toUpperCase()}
            </button>`
            )
            .join("")}
        </div>
      </div>
      <div class="select-copy">
        <p>Select answer type:</p>
        <em>Video, voice or text</em>
      </div>
      <div class="tool-row" role="tablist">
        <button class="tool is-on" type="button" data-kind="open" aria-label="Open reply">
          <i class="ph ph-video-camera" aria-hidden="true"></i>
        </button>
        <button class="tool" type="button" data-kind="choice" aria-label="Multiple choice">
          <i class="ph ph-list" aria-hidden="true"></i>
        </button>
        <button class="tool" type="button" data-kind="yesno" aria-label="Yes or no">
          <i class="ph ph-square" aria-hidden="true"></i>
        </button>
        <button class="tool" type="button" data-kind="intro" aria-label="Intro only">
          <i class="ph ph-calendar-blank" aria-hidden="true"></i>
        </button>
      </div>
      <div class="choice-edit" id="choiceEdit" hidden>
        ${d.options
          .map(
            (o, i) => `
          <label class="choice-field">
            <b class="badge">${o.label}</b>
            <input data-opt="${i}" maxlength="48" value="${escapeAttr(o.text)}" />
          </label>`
          )
          .join("")}
      </div>
      <button class="cta" id="typeGo" type="button">Continue →</button>
    </section>
  `);

  $("aClose").onclick = () => {
    stopStream();
    showHome();
  };

  const setKind = (kind) => {
    d.type = kind === "intro" ? "intro" : kind;
    document.querySelectorAll(".tool").forEach((b) => b.classList.toggle("is-on", b.dataset.kind === kind));
    $("choiceEdit").hidden = kind !== "choice";
  };
  document.querySelectorAll(".tool").forEach((btn) => {
    btn.onclick = () => setKind(btn.dataset.kind);
  });
  setKind(d.type === "intro" ? "open" : d.type);

  document.querySelectorAll(".type").forEach((btn) => {
    btn.onclick = () => {
      const m = btn.dataset.m;
      if (d.accepts.includes(m)) d.accepts = d.accepts.filter((x) => x !== m);
      else d.accepts.push(m);
      if (!d.accepts.length) d.accepts = [m];
      btn.classList.toggle("is-on", d.accepts.includes(m));
    };
  });

  $("typeGo").onclick = publishDraft;
}

function escapeAttr(s) {
  return String(s || "").replace(/"/g, "&quot;");
}

async function publishDraft() {
  const d = state.draft;
  d.title = $("stepTitle")?.value.trim() || d.title;
  if (d.type === "choice") {
    document.querySelectorAll("[data-opt]").forEach((input) => {
      const i = Number(input.dataset.opt);
      if (d.options[i]) d.options[i].text = input.value.trim() || d.options[i].text;
    });
  }
  if (d.type === "intro") d.cta = "Start";
  if (d.type === "open" && !d.prompt) d.prompt = d.title;
  const n = state.ask.steps.filter((s) => s.type !== "complete").length;
  if (n === 0) {
    d.type = "intro";
    d.cta = "Start";
  }
  const { preview, ...step } = d;
  if (preview) URL.revokeObjectURL(preview);
  state.ask.steps = state.ask.steps.filter((s) => s.type !== "complete");
  state.ask.steps.push(step);
  state.ask.steps.push({
    id: "done",
    type: "complete",
    title: "You’re in",
    body: "We got your answers. A Ventura partner will review this and follow up.",
  });
  state.ask.live = true;
  if (state.ask.title === "Untitled") state.ask.title = step.title || "Untitled";
  await saveAsk(state.ask);
  goLive();
}

function goLive() {
  state.screen = "live";
  const url = takeUrl(state.ask.id);
  const last = [...state.ask.steps].reverse().find((s) => s.mediaKey);
  render(`
    <section class="admin-live">
      <video id="liveBg" playsinline muted loop autoplay></video>
      <div class="live-dim"></div>
      <p class="live-kicker">${escapeAttr(last?.title || "First question")}</p>
      <div class="live-body">
        <label class="sr-only" for="askName">Survey name</label>
        <input id="askName" class="live-name" maxlength="40" value="${escapeAttr(state.ask.title)}" />
        <p class="is-live">IS LIVE!</p>
        <a class="live-url" id="liveUrl" href="${url}">${url.replace(/^https?:\/\//, "")}</a>
        <button class="share-btn" id="shareBtn" type="button">Share</button>
      </div>
      <div class="live-actions">
        <p class="live-hint">Want to create a multi-step ask?</p>
        <button class="cta" id="addStep" type="button">+ Add more steps</button>
        <button class="cta is-ghost" id="doneAsk" type="button">Done</button>
      </div>
    </section>
  `);

  const bg = $("liveBg");
  import("./store.js").then(async ({ blobUrl }) => {
    if (!last?.mediaKey || !bg) return;
    bg.src = await blobUrl(last.mediaKey);
    bg.classList.add("is-on");
    bg.play().catch(() => {});
  });

  $("askName").onchange = async () => {
    state.ask.title = $("askName").value.trim() || "Untitled";
    await saveAsk(state.ask);
  };
  $("shareBtn").onclick = async () => {
    try {
      if (navigator.share) await navigator.share({ title: state.ask.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied.");
      }
    } catch {
      await navigator.clipboard.writeText(url);
      toast("Link copied.");
    }
  };
  $("liveUrl").onclick = async (e) => {
    e.preventDefault();
    await navigator.clipboard.writeText(url);
    toast("Link copied.");
  };
  $("addStep").onclick = () => goRec();
  $("doneAsk").onclick = showHome;
}

async function showHome() {
  stopStream();
  state.screen = "home";
  const asks = await listAsks();
  const current = state.ask?.id || currentAskId();
  const replies = current ? await listReplies(current) : [];
  render(`
    <section class="admin-home">
      <header class="home-head">
        <p>Studio</p>
        <h1>New survey</h1>
      </header>
      <button class="cta" id="newAsk" type="button">Create a new ask</button>
      <div class="ask-list">
        ${
          asks.length
            ? asks
                .map(
                  (a) => `
          <article class="ask-row">
            <div>
              <strong>${escapeAttr(a.title)}</strong>
              <small>${a.steps.filter((s) => s.type !== "complete").length} steps</small>
            </div>
            <div class="ask-actions">
              <a class="chip" href="${takeUrl(a.id)}">Open live</a>
              <button class="chip is-ghost" type="button" data-replies="${a.id}">Replies</button>
            </div>
          </article>`
                )
                .join("")
            : `<p class="empty">No surveys yet. Record your first question.</p>`
        }
      </div>
      <div id="replyPane" class="reply-pane" ${replies.length ? "" : "hidden"}></div>
    </section>
  `);
  $("newAsk").onclick = startNew;
  root().querySelectorAll("[data-replies]").forEach((btn) => {
    btn.onclick = () => showReplies(btn.dataset.replies);
  });
  if (replies.length && current) showReplies(current);
}

async function showReplies(askId) {
  const rows = await listReplies(askId);
  const pane = $("replyPane");
  if (!pane) return;
  pane.hidden = false;
  if (!rows.length) {
    pane.innerHTML = "<p class='empty'>No replies yet. Open the live link and take it as a user.</p>";
    return;
  }
  pane.innerHTML = `<h2>Replies</h2>${rows
    .map((r) => {
      const bits = Object.entries(r.answers || {})
        .filter(([k]) => k !== "permissions")
        .map(([k, v]) => `${k}: ${v.value || v.type || "saved"}`)
        .join(" · ");
      return `<article class="reply-row"><strong>${new Date(r.at).toLocaleString()}</strong><p>${escapeAttr(bits)}</p></article>`;
    })
    .join("")}`;
}
