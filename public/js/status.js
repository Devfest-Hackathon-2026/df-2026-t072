import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";
import { db, functions, waitForUser } from "./auth.js";
import { CONTENT_TYPES, FLAME_MESSAGES, REACTIONS } from "./constants.js";

const NEXT_ACTION_THRESHOLD = 3;
const HINT_THRESHOLD = 2;

function contentTypeLabel(value) {
  const found = CONTENT_TYPES.find((c) => c.value === value);
  return found ? found.label : value;
}

function daysSince(timestamp) {
  if (!timestamp) return 0;
  const createdMs = timestamp.toMillis ? timestamp.toMillis() : timestamp;
  return Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24));
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderReaction(reaction) {
  const found = REACTIONS.find((r) => r.value === reaction.emoji);
  const label = found ? `${found.emoji} ${found.label}` : reaction.emoji || "";
  document.getElementById("reaction-emoji-label").textContent = label;

  const commentEl = document.getElementById("reaction-comment");
  if (reaction.comment) {
    commentEl.textContent = `「${reaction.comment}」`;
    commentEl.classList.remove("hidden");
  }

  document.getElementById("reaction-card").classList.remove("hidden");
}

function renderHint(recipientName) {
  const card = document.getElementById("hint-card");
  const el = document.getElementById("hint-message");
  const name = recipientName ? escapeHtml(recipientName) : "その人";
  el.textContent = `${name}さん、いい反応だったみたい。今度会った時に話題に出してみるのもアリかも？`;
  card.classList.remove("hidden");
}

function renderFlames(flameLevel, shareCount, recipientName) {
  const el = document.getElementById("flame-display");
  const flames = "🔥".repeat(flameLevel) + "〇".repeat(4 - flameLevel);
  const label = recipientName ? `${escapeHtml(recipientName)}との盛り上がり` : "盛り上がり";
  el.innerHTML = `
    <div class="flames">${flames}</div>
    <div class="flame-text">${FLAME_MESSAGES[flameLevel] || ""}</div>
    <p class="sub" style="margin-top:8px;">${label}（これまで${shareCount}回送信）</p>
  `;
}

async function showAiCover(share, shareId) {
  const generateAiCover = httpsCallable(functions, "generateAiCover");
  const result = await generateAiCover({
    shareId,
    daysSinceSent: daysSince(share.createdAt),
    contentType: share.contentType,
    contentTitle: share.contentTitle
  });

  const coverCard = document.getElementById("cover-card");
  const coverMessage = document.getElementById("cover-message");
  if (result.data && result.data.message) {
    coverMessage.textContent = result.data.message;
    coverCard.classList.remove("hidden");
  }
}

function renderNextActionCandidate(candidate, share) {
  const list = document.getElementById("next-action-list");
  const item = document.createElement("div");
  item.className = "card";
  item.innerHTML = `
    <h2>${candidate.title}</h2>
    <p class="sub">${candidate.note}</p>
  `;
  const inviteBtn = document.createElement("button");
  inviteBtn.className = "btn btn-line";
  inviteBtn.textContent = "誘ってみる";
  inviteBtn.addEventListener("click", () => {
    const text = `${candidate.title}\n${candidate.note}${candidate.url ? "\n" + candidate.url : ""}`;
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text)}`, "_blank");
  });
  item.appendChild(inviteBtn);
  list.appendChild(item);
}

async function setupNextAction(share, shareId) {
  document.getElementById("next-action-card").classList.remove("hidden");
  document.getElementById("suggest-btn").addEventListener("click", async () => {
    const btn = document.getElementById("suggest-btn");
    btn.disabled = true;
    btn.textContent = "提案を考え中...";

    const suggestNextAction = httpsCallable(functions, "suggestNextAction");
    const result = await suggestNextAction({
      shareId,
      contentType: share.contentType,
      contentTitle: share.contentTitle,
      contentTags: share.contentTags
    });

    document.getElementById("next-action-list").innerHTML = "";
    (result.data.candidates || []).forEach((candidate) => renderNextActionCandidate(candidate, share));
    btn.classList.add("hidden");
  });
}

async function init() {
  await waitForUser();

  const shareId = new URLSearchParams(location.search).get("id");
  if (!shareId) return;

  const shareSnap = await getDoc(doc(db, "shares", shareId));
  if (!shareSnap.exists()) return;
  const share = shareSnap.data();

  document.getElementById("content-title").textContent = share.contentTitle;
  document.getElementById("content-type-label").textContent = contentTypeLabel(share.contentType);

  const reactionSnap = await getDoc(doc(db, "reactions", shareId));

  if (!reactionSnap.exists()) {
    document.getElementById("flame-display").innerHTML =
      '<p class="loading">まだリアクション待ち。ゆっくり待ってみよう</p>';

    const days = daysSince(share.createdAt);
    if (days >= 1) {
      await showAiCover(share, shareId);
    }
    return;
  }

  renderReaction(reactionSnap.data());

  if (!share.relationshipId) {
    document.getElementById("flame-display").innerHTML = '<p class="loading">集計中...</p>';
    return;
  }

  const relationshipSnap = await getDoc(doc(db, "relationships", share.relationshipId));

  if (relationshipSnap.exists()) {
    const relationship = relationshipSnap.data();
    renderFlames(relationship.flameLevel, relationship.shareCount, relationship.recipientName);
    if (relationship.flameLevel >= NEXT_ACTION_THRESHOLD) {
      await setupNextAction(share, shareId);
    } else if (relationship.flameLevel >= HINT_THRESHOLD) {
      renderHint(relationship.recipientName);
    }
  } else {
    document.getElementById("flame-display").innerHTML = '<p class="loading">集計中...</p>';
  }
}

init();
