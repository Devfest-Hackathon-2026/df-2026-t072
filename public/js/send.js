import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db, functions, waitForUser } from "./auth.js";
import { CONTENT_TYPES, LIKE_TAGS_BY_GENRE, DISCLOSURE_LEVELS, RELATIONSHIP_STAGES } from "./constants.js";
import { YOUTUBE_CLIENT_ID } from "./youtube-config.js";

const TOTAL_STEPS = 5;

const state = {
  personName: "",
  personDescription: "",
  contentType: null,
  contentTitle: "",
  senderName: "",
  tags: [],
  disclosureLevel: null,
  relationshipStage: null,
  screenshotBase64: null,
  shareId: null,
  messageOuter: "",
  messageInner: "",
  imageUrl: null,
  knownImageUrl: null,
  sourceUrl: null
};

let currentUser = null;

function updateCharCount(textareaId, countId) {
  const value = document.getElementById(textareaId).value;
  document.getElementById(countId).textContent = `${value.length}文字`;
}

function onClickOnce(button, handler) {
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await handler();
    } finally {
      button.disabled = false;
    }
  });
}

function renderChipGroup(container, items, getKey, getLabel, onToggle, multi) {
  container.innerHTML = "";
  items.forEach((item) => {
    const key = getKey(item);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = getLabel(item);
    chip.dataset.key = key;
    chip.addEventListener("click", () => {
      if (!multi) {
        container.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
        chip.classList.add("selected");
      } else {
        chip.classList.toggle("selected");
      }
      onToggle(key, chip.classList.contains("selected"));
    });
    container.appendChild(chip);
  });
}

function renderStepIndicator(stepNumber) {
  const el = document.getElementById("step-indicator");
  el.innerHTML = "";
  for (let i = 1; i <= TOTAL_STEPS; i += 1) {
    const dot = document.createElement("span");
    dot.className = "step-dot";
    if (i === stepNumber) dot.classList.add("current");
    if (i < stepNumber) dot.classList.add("done");
    dot.textContent = String(i);
    el.appendChild(dot);
  }
}

function goToStep(stepNumber) {
  document.querySelectorAll(".step").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.step) === stepNumber);
  });
  renderStepIndicator(stepNumber);
  window.scrollTo(0, 0);
}

function setupNav() {
  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const current = Number(btn.closest(".step").dataset.step);
      goToStep(current - 1);
    });
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const LOADING_PHRASES = [
  "あなたの好みを分析中…",
  "相手のことを考えています…",
  "2人の共鳴ポイントを探しています…",
  "メッセージを組み立てています…",
  "もうすぐできあがります…"
];

const MIN_LOADING_MS = 3000;
const PHRASE_INTERVAL_MS = 650;
const PHRASE_FADE_MS = 250;
const FINISH_FLASH_MS = 650;

function startLoadingTextCycle() {
  const textEl = document.getElementById("house-loading-text");
  textEl.classList.remove("fade-out", "pulsing");
  textEl.textContent = LOADING_PHRASES[0];

  let index = 0;
  const timer = setInterval(() => {
    if (index >= LOADING_PHRASES.length - 1) {
      clearInterval(timer);
      textEl.classList.add("pulsing");
      return;
    }
    textEl.classList.add("fade-out");
    setTimeout(() => {
      index += 1;
      textEl.textContent = LOADING_PHRASES[index];
      textEl.classList.remove("fade-out");
    }, PHRASE_FADE_MS);
  }, PHRASE_INTERVAL_MS);

  return () => clearInterval(timer);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateMessages() {
  state.shareId = null;

  const generatingCard = document.getElementById("generating-card");
  const previewCard = document.getElementById("preview-card");
  const previewInnerCard = document.getElementById("preview-inner-card");
  const nav = document.getElementById("preview-nav");
  const houseLoading = document.getElementById("house-loading");
  const houseSvg = houseLoading.querySelector(".house-svg");

  document.getElementById("done-card").classList.add("hidden");
  document.getElementById("done-nav").classList.add("hidden");
  document.getElementById("done-nav-2").classList.add("hidden");

  generatingCard.classList.remove("hidden");
  previewCard.classList.add("hidden");
  previewInnerCard.classList.add("hidden");
  nav.classList.add("hidden");

  houseSvg.classList.remove("complete");
  houseLoading.classList.remove("complete");
  const stopTextCycle = startLoadingTextCycle();

  try {
    const generateMessage = httpsCallable(functions, "generateMessage");
    const resultPromise = generateMessage({
      contentType: state.contentType,
      contentTitle: state.contentTitle,
      tags: state.tags,
      disclosureLevel: state.disclosureLevel,
      screenshotBase64: state.screenshotBase64,
      knownImageUrl: state.knownImageUrl,
      personName: state.personName || undefined,
      personDescription: state.personDescription || undefined,
      relationshipStage: state.relationshipStage
    });

    const [result] = await Promise.all([resultPromise, wait(MIN_LOADING_MS)]);

    stopTextCycle();
    houseSvg.classList.add("complete");
    houseLoading.classList.add("complete");
    await wait(FINISH_FLASH_MS);

    state.messageOuter = result.data.messageOuter;
    state.messageInner = result.data.messageInner;
    state.imageUrl = result.data.imageUrl || null;

    document.getElementById("message-outer").value = state.messageOuter;
    document.getElementById("message-inner").value = state.messageInner;
    updateCharCount("message-outer", "message-outer-count");
    updateCharCount("message-inner", "message-inner-count");

    const previewImage = document.getElementById("preview-image");
    if (state.imageUrl) {
      previewImage.src = state.imageUrl;
      previewImage.classList.remove("hidden");
    } else {
      previewImage.classList.add("hidden");
    }

    generatingCard.classList.add("hidden");
    previewCard.classList.remove("hidden");
    previewInnerCard.classList.remove("hidden");
    nav.classList.remove("hidden");
    document.getElementById("other-share-nav").classList.toggle("hidden", typeof navigator.share !== "function");
  } catch (err) {
    stopTextCycle();
    console.error("generateMessage failed", err);
    alert("メッセージの生成に失敗しました。もう一度試してね");
    goToStep(4);
  }
}

async function ensureShareCreated() {
  if (state.shareId) {
    return `${location.origin}/share/${state.shareId}`;
  }

  const shareRef = doc(collection(db, "shares"));
  state.shareId = shareRef.id;

  await setDoc(shareRef, {
    contentType: state.contentType,
    contentTitle: state.contentTitle,
    contentTags: state.tags,
    disclosureLevel: state.disclosureLevel,
    relationshipStage: state.relationshipStage,
    messageOuter: state.messageOuter,
    messageInner: state.messageInner,
    imageUrl: state.imageUrl,
    sourceUrl: state.sourceUrl,
    scoreTriggerType: state.disclosureLevel === "deep" ? "cumulative" : "instant",
    createdAt: serverTimestamp(),
    senderId: currentUser.uid,
    senderName: state.senderName || "だれか",
    recipientMemo: state.personName
  });

  return `${location.origin}/share/${state.shareId}`;
}

function renderTagGroup(genre) {
  state.tags = [];
  renderChipGroup(
    document.getElementById("tag-group"),
    LIKE_TAGS_BY_GENRE[genre] || [],
    (i) => i,
    (i) => i,
    (key, selected) => {
      if (selected) {
        state.tags.push(key);
      } else {
        state.tags = state.tags.filter((t) => t !== key);
      }
    },
    true
  );
}

function selectCandidate(c) {
  const chip = document.querySelector(`#content-type-group .chip[data-key="${c.contentType}"]`);
  if (chip) chip.click();
  document.getElementById("content-title").value = c.contentTitle;
  state.knownImageUrl = c.thumbnailUrl || null;
  state.sourceUrl = c.sourceUrl || null;
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderVennDiagram(venn, containerId) {
  const container = document.getElementById(containerId);

  if (!venn || (!venn.yourTendency && !venn.theirTendency && (venn.overlapTags || []).length === 0)) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  const tagLines = (venn.overlapTags || [])
    .map((tag, i) => `<text x="150" y="${78 + i * 15}" text-anchor="middle" class="venn-tag">${escapeHtml(tag)}</text>`)
    .join("");

  container.innerHTML = `
    <svg viewBox="0 0 300 170" role="img" aria-label="あなたと相手の好みが重なる図">
      <circle cx="115" cy="85" r="70" fill="#378adb" fill-opacity="0.22" stroke="#2868a8" stroke-opacity="0.5" />
      <circle cx="185" cy="85" r="70" fill="#ff8c5a" fill-opacity="0.22" stroke="#e06a3a" stroke-opacity="0.5" />
      <text x="50" y="35" text-anchor="middle" class="venn-label mine">あなた</text>
      <text x="50" y="52" text-anchor="middle" class="venn-label mine">${escapeHtml(venn.yourTendency)}</text>
      <text x="250" y="35" text-anchor="middle" class="venn-label theirs">相手</text>
      <text x="250" y="52" text-anchor="middle" class="venn-label theirs">${escapeHtml(venn.theirTendency)}</text>
      ${tagLines}
    </svg>
  `;
  container.classList.remove("hidden");
}

function renderCandidates(candidates, containerId, onClose) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (candidates.length === 0) {
    container.classList.add("hidden");
    return;
  }

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "candidates-close";
  closeBtn.textContent = "閉じる ×";
  closeBtn.addEventListener("click", () => {
    container.classList.add("hidden");
    if (onClose) onClose();
  });
  container.appendChild(closeBtn);

  candidates.forEach((c) => {
    const genreLabel = (CONTENT_TYPES.find((g) => g.value === c.contentType) || {}).label || c.contentType;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "persona-candidate";

    if (c.thumbnailUrl) {
      const thumbEl = document.createElement("img");
      thumbEl.className = "candidate-thumbnail";
      thumbEl.src = c.thumbnailUrl;
      thumbEl.alt = "";
      btn.appendChild(thumbEl);
    }

    const genreEl = document.createElement("span");
    genreEl.className = "candidate-genre";
    genreEl.textContent = genreLabel;

    const titleEl = document.createElement("div");
    titleEl.className = "candidate-title";
    titleEl.textContent = c.contentTitle;

    const reasonEl = document.createElement("div");
    reasonEl.className = "candidate-reason";
    reasonEl.textContent = c.reason || "";

    btn.append(genreEl, titleEl, reasonEl);
    btn.addEventListener("click", () => {
      selectCandidate(c);
      container.classList.add("hidden");
    });
    container.appendChild(btn);
  });

  container.classList.remove("hidden");
}

async function fetchPersonaOnlyCandidates() {
  if (!state.personDescription) {
    return;
  }
  const suggestContentForPerson = httpsCallable(functions, "suggestContentForPerson");
  const result = await suggestContentForPerson({
    personName: state.personName,
    personDescription: state.personDescription
  });
  renderCandidates(result.data.candidates || [], "step3-candidates");
}

function setupStep2() {
  const connectBtn = document.getElementById("youtube-connect-btn");
  const skipBtn = document.getElementById("youtube-skip-btn");
  const loading = document.getElementById("youtube-connect-loading");

  skipBtn.addEventListener("click", async () => {
    if (skipBtn.disabled) return;
    document.getElementById("step3-venn").classList.add("hidden");

    const hasDescription = Boolean(state.personDescription);
    if (hasDescription) {
      skipBtn.disabled = true;
      skipBtn.textContent = "候補を考え中...";
    }

    try {
      await fetchPersonaOnlyCandidates();
    } catch (err) {
      console.error("suggestContentForPerson failed", err);
    } finally {
      skipBtn.disabled = false;
      skipBtn.textContent = "連携しない場合はスキップ";
    }
    goToStep(3);
  });

  connectBtn.addEventListener("click", () => {
    if (connectBtn.disabled) return;

    if (!window.google?.accounts?.oauth2) {
      alert("Googleログインの読み込みに失敗しました。ページを再読み込みしてね");
      return;
    }

    connectBtn.disabled = true;

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: YOUTUBE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      error_callback: () => {
        connectBtn.disabled = false;
      },
      callback: async (response) => {
        if (response.error) {
          console.error("youtube oauth failed", response);
          alert("YouTubeとの連携に失敗しました");
          connectBtn.disabled = false;
          return;
        }

        loading.classList.remove("hidden");

        try {
          const suggestFromYoutube = httpsCallable(functions, "suggestFromYoutube");
          const result = await suggestFromYoutube({
            accessToken: response.access_token,
            personName: state.personName || undefined,
            personDescription: state.personDescription || undefined
          });
          const sourceLabel = result.data.source === "likes" ? "YouTubeでいいねしてた動画" : "登録チャンネル";
          const candidates = (result.data.candidates || []).map((c) => ({
            ...c,
            reason: result.data.matchedPersona ? c.reason || sourceLabel : sourceLabel
          }));
          renderVennDiagram(result.data.matchedPersona ? result.data.venn : null, "step3-venn");
          renderCandidates(candidates, "step3-candidates", () =>
            document.getElementById("step3-venn").classList.add("hidden")
          );
          goToStep(3);
        } catch (err) {
          console.error("suggestFromYoutube failed", err);
          alert("候補の生成に失敗しました。スキップして自分で入力してね");
          goToStep(3);
        } finally {
          loading.classList.add("hidden");
          connectBtn.disabled = false;
        }
      }
    });

    tokenClient.requestAccessToken();
  });
}

function init() {
  renderChipGroup(
    document.getElementById("content-type-group"),
    CONTENT_TYPES,
    (i) => i.value,
    (i) => i.label,
    (key) => {
      state.contentType = key;
      renderTagGroup(key);
    },
    false
  );

  renderChipGroup(
    document.getElementById("disclosure-group"),
    DISCLOSURE_LEVELS,
    (i) => i.value,
    (i) => i.label,
    (key) => (state.disclosureLevel = key),
    false
  );

  renderChipGroup(
    document.getElementById("relationship-group"),
    RELATIONSHIP_STAGES,
    (i) => i.value,
    (i) => i.label,
    (key) => (state.relationshipStage = key),
    false
  );

  setupNav();
  setupStep2();
  renderStepIndicator(1);

  document.getElementById("content-title").addEventListener("input", () => {
    state.knownImageUrl = null;
    state.sourceUrl = null;
  });

  document.getElementById("screenshot-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById("screenshot-preview");
    if (file) {
      preview.src = URL.createObjectURL(file);
      preview.classList.remove("hidden");
    } else {
      preview.classList.add("hidden");
    }
  });

  document.getElementById("message-outer").addEventListener("input", () =>
    updateCharCount("message-outer", "message-outer-count")
  );
  document.getElementById("message-inner").addEventListener("input", () =>
    updateCharCount("message-inner", "message-inner-count")
  );

  document.getElementById("step1-next").addEventListener("click", () => {
    state.personName = document.getElementById("persona-name").value.trim();
    state.personDescription = document.getElementById("persona-description").value.trim();

    if (!state.personName) {
      alert("相手の名前を入力してね");
      return;
    }
    goToStep(2);
  });

  document.getElementById("step3-next").addEventListener("click", () => {
    state.contentTitle = document.getElementById("content-title").value.trim();

    if (!state.contentType || !state.contentTitle) {
      alert("コンテンツの種類とタイトルを選んでね");
      return;
    }
    goToStep(4);
  });

  onClickOnce(document.getElementById("generate-btn"), async () => {
    state.senderName = document.getElementById("sender-name").value.trim();

    if (state.tags.length === 0) {
      alert("好きなところを1つ以上選んでね");
      return;
    }
    if (!state.disclosureLevel) {
      alert("温度感を選んでね");
      return;
    }
    if (!state.relationshipStage) {
      alert("相手との関係性を選んでね");
      return;
    }

    const fileInput = document.getElementById("screenshot-input");
    if (fileInput.files[0]) {
      state.screenshotBase64 = await readFileAsBase64(fileInput.files[0]);
    }
    goToStep(5);
    await generateMessages();
  });

  function captureMessageEdits() {
    state.messageOuter = document.getElementById("message-outer").value;
    state.messageInner = document.getElementById("message-inner").value;
  }

  function showDoneScreen(shareUrl) {
    document.getElementById("share-url").value = shareUrl;
    document.getElementById("done-card").classList.remove("hidden");
    document.getElementById("done-nav").classList.remove("hidden");
    document.getElementById("done-nav-2").classList.remove("hidden");
  }

  onClickOnce(document.getElementById("send-line-btn"), async () => {
    captureMessageEdits();

    const shareUrl = await ensureShareCreated();

    const lineText = `${state.messageOuter}\n${shareUrl}`;
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`;
    window.open(lineUrl, "_blank");

    showDoneScreen(shareUrl);
  });

  onClickOnce(document.getElementById("other-share-btn"), async () => {
    captureMessageEdits();

    const shareUrl = await ensureShareCreated();

    try {
      await navigator.share({ text: `${state.messageOuter}\n${shareUrl}` });
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("navigator.share failed", err);
      }
    }

    showDoneScreen(shareUrl);
  });

  document.getElementById("copy-link-btn").addEventListener("click", () => {
    const input = document.getElementById("share-url");
    input.select();
    navigator.clipboard.writeText(input.value);
  });
}

waitForUser().then((user) => {
  currentUser = user;
  init();
});
