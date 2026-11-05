import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db, functions, waitForUser } from "./auth.js";
import { CONTENT_TYPES, LIKE_TAGS_BY_GENRE, DISCLOSURE_LEVELS } from "./constants.js";

const state = {
  contentType: null,
  contentTitle: "",
  senderName: "",
  tags: [],
  disclosureLevel: null,
  screenshotBase64: null,
  shareId: null,
  messageOuter: "",
  messageInner: ""
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
  const nav = document.getElementById("step4-nav");

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
    screenshotBase64: state.screenshotBase64
  });

  state.messageOuter = result.data.messageOuter;
  state.messageInner = result.data.messageInner;

  document.getElementById("message-outer").value = state.messageOuter;
  document.getElementById("message-inner").value = state.messageInner;

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
    scoreTriggerType: state.disclosureLevel === "deep" ? "cumulative" : "instant",
    createdAt: serverTimestamp(),
    senderId: currentUser.uid,
    senderName: state.senderName || "だれか"
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

  document.getElementById("step1-next").addEventListener("click", () => {
    state.contentTitle = document.getElementById("content-title").value.trim();
    state.senderName = document.getElementById("sender-name").value.trim();
    if (!state.contentType || !state.contentTitle) {
      alert("コンテンツの種類とタイトルを入力してね");
      return;
    }
    goToStep(2);
  });

  document.getElementById("step2-next").addEventListener("click", () => {
    if (state.tags.length === 0) {
      alert("好きなところを1つ以上選んでね");
      return;
    }
    goToStep(3);
  });

  document.getElementById("step3-next").addEventListener("click", async () => {
    if (!state.disclosureLevel) {
      alert("温度感を選んでね");
      return;
    }
    const fileInput = document.getElementById("screenshot-input");
    if (fileInput.files[0]) {
      state.screenshotBase64 = await readFileAsBase64(fileInput.files[0]);
    }
    goToStep(4);
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

    goToStep(5);
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
