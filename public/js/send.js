import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db, functions, waitForUser } from "./auth.js";
import { CONTENT_TYPES, LIKE_TAGS_BY_GENRE, DISCLOSURE_LEVELS } from "./constants.js";
import { YOUTUBE_CLIENT_ID } from "./youtube-config.js";

const state = {
  contentType: null,
  contentTitle: "",
  senderName: "",
  recipientMemo: "",
  tags: [],
  disclosureLevel: null,
  screenshotBase64: null,
  shareId: null,
  messageOuter: "",
  messageInner: "",
  imageUrl: null,
  knownImageUrl: null,
  sourceUrl: null
};

let currentUser = null;

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

function goToStep(stepNumber) {
  document.querySelectorAll(".step").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.step) === stepNumber);
  });
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

async function generateMessages() {
  const generatingCard = document.getElementById("generating-card");
  const previewCard = document.getElementById("preview-card");
  const previewInnerCard = document.getElementById("preview-inner-card");
  const nav = document.getElementById("preview-nav");

  generatingCard.classList.remove("hidden");
  previewCard.classList.add("hidden");
  previewInnerCard.classList.add("hidden");
  nav.classList.add("hidden");

  const generateMessage = httpsCallable(functions, "generateMessage");
  const result = await generateMessage({
    contentType: state.contentType,
    contentTitle: state.contentTitle,
    tags: state.tags,
    disclosureLevel: state.disclosureLevel,
    screenshotBase64: state.screenshotBase64,
    knownImageUrl: state.knownImageUrl
  });

  state.messageOuter = result.data.messageOuter;
  state.messageInner = result.data.messageInner;
  state.imageUrl = result.data.imageUrl || null;

  document.getElementById("message-outer").value = state.messageOuter;
  document.getElementById("message-inner").value = state.messageInner;

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
}

async function createShare() {
  const shareRef = doc(collection(db, "shares"));
  state.shareId = shareRef.id;

  await setDoc(shareRef, {
    contentType: state.contentType,
    contentTitle: state.contentTitle,
    contentTags: state.tags,
    disclosureLevel: state.disclosureLevel,
    messageOuter: state.messageOuter,
    messageInner: state.messageInner,
    imageUrl: state.imageUrl,
    sourceUrl: state.sourceUrl,
    scoreTriggerType: state.disclosureLevel === "deep" ? "cumulative" : "instant",
    createdAt: serverTimestamp(),
    senderId: currentUser.uid,
    senderName: state.senderName || "だれか",
    recipientMemo: state.recipientMemo
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
      <circle cx="115" cy="85" r="70" fill="#ff7a59" fill-opacity="0.22" stroke="#e85d3d" stroke-opacity="0.5" />
      <circle cx="185" cy="85" r="70" fill="#4f9ddb" fill-opacity="0.22" stroke="#2f7bb8" stroke-opacity="0.5" />
      <text x="50" y="35" text-anchor="middle" class="venn-label mine">あなた</text>
      <text x="50" y="52" text-anchor="middle" class="venn-label mine">${escapeHtml(venn.yourTendency)}</text>
      <text x="250" y="35" text-anchor="middle" class="venn-label theirs">相手</text>
      <text x="250" y="52" text-anchor="middle" class="venn-label theirs">${escapeHtml(venn.theirTendency)}</text>
      ${tagLines}
    </svg>
  `;
  container.classList.remove("hidden");
}

function renderCandidates(candidates, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (candidates.length === 0) {
    container.classList.add("hidden");
    alert("提案を作れなかったみたい。もう一度試してね");
    return;
  }

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

function setupPersonaSuggest() {
  document.getElementById("persona-suggest-btn").addEventListener("click", async () => {
    const personName = document.getElementById("persona-name").value.trim();
    const personDescription = document.getElementById("persona-description").value.trim();
    if (!personName || !personDescription) {
      alert("相手の名前と人物像を入力してね");
      return;
    }

    const loading = document.getElementById("persona-suggest-loading");
    const results = document.getElementById("persona-suggest-results");
    results.classList.add("hidden");
    loading.classList.remove("hidden");

    try {
      const suggestContentForPerson = httpsCallable(functions, "suggestContentForPerson");
      const result = await suggestContentForPerson({ personName, personDescription });
      renderCandidates(result.data.candidates || [], "persona-suggest-results");
    } catch (err) {
      console.error("suggestContentForPerson failed", err);
      alert("提案の生成に失敗しました。もう一度試してね");
    } finally {
      loading.classList.add("hidden");
    }
  });
}

function setupYoutubeSuggest() {
  document.getElementById("youtube-suggest-btn").addEventListener("click", () => {
    if (!window.google?.accounts?.oauth2) {
      alert("Googleログインの読み込みに失敗しました。ページを再読み込みしてね");
      return;
    }

    const loading = document.getElementById("youtube-suggest-loading");
    const results = document.getElementById("youtube-suggest-results");

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: YOUTUBE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      callback: async (response) => {
        if (response.error) {
          console.error("youtube oauth failed", response);
          alert("YouTubeとの連携に失敗しました");
          return;
        }

        const venn = document.getElementById("youtube-venn");
        results.classList.add("hidden");
        venn.classList.add("hidden");
        loading.classList.remove("hidden");

        const personName = document.getElementById("persona-name").value.trim();
        const personDescription = document.getElementById("persona-description").value.trim();

        try {
          const suggestFromYoutube = httpsCallable(functions, "suggestFromYoutube");
          const result = await suggestFromYoutube({
            accessToken: response.access_token,
            personName: personName || undefined,
            personDescription: personDescription || undefined
          });
          const sourceLabel = result.data.source === "likes" ? "YouTubeでいいねしてた動画" : "登録チャンネル";
          const candidates = (result.data.candidates || []).map((c) => ({
            ...c,
            reason: result.data.matchedPersona ? c.reason || sourceLabel : sourceLabel
          }));
          renderVennDiagram(result.data.matchedPersona ? result.data.venn : null, "youtube-venn");
          renderCandidates(candidates, "youtube-suggest-results");
        } catch (err) {
          console.error("suggestFromYoutube failed", err);
          alert("提案の生成に失敗しました。もう一度試してね");
        } finally {
          loading.classList.add("hidden");
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

  setupNav();
  setupPersonaSuggest();
  setupYoutubeSuggest();

  document.getElementById("content-title").addEventListener("input", () => {
    state.knownImageUrl = null;
    state.sourceUrl = null;
  });

  document.getElementById("generate-btn").addEventListener("click", async () => {
    state.contentTitle = document.getElementById("content-title").value.trim();
    state.senderName = document.getElementById("sender-name").value.trim();
    state.recipientMemo = document.getElementById("recipient-memo").value.trim();

    if (!state.contentType || !state.contentTitle) {
      alert("コンテンツの種類とタイトルを入力してね");
      return;
    }
    if (state.tags.length === 0) {
      alert("好きなところを1つ以上選んでね");
      return;
    }
    if (!state.disclosureLevel) {
      alert("温度感を選んでね");
      return;
    }

    const fileInput = document.getElementById("screenshot-input");
    if (fileInput.files[0]) {
      state.screenshotBase64 = await readFileAsBase64(fileInput.files[0]);
    }
    goToStep(2);
    await generateMessages();
  });

  document.getElementById("send-line-btn").addEventListener("click", async () => {
    state.messageOuter = document.getElementById("message-outer").value;
    state.messageInner = document.getElementById("message-inner").value;

    const shareUrl = await createShare();
    document.getElementById("share-url").value = shareUrl;

    const lineText = `${state.messageOuter}\n${shareUrl}`;
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`;
    window.open(lineUrl, "_blank");

    goToStep(3);
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
