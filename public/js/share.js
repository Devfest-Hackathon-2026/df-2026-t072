import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db, waitForUser } from "./auth.js";
import { CONTENT_TYPES, REACTIONS } from "./constants.js";

function getShareId() {
  if (window.RESONATE_SHARE_ID) {
    return window.RESONATE_SHARE_ID;
  }
  const pathMatch = location.pathname.match(/\/share\/([^/]+)/);
  if (pathMatch) {
    return pathMatch[1];
  }
  return new URLSearchParams(location.search).get("id");
}

function showCard(id) {
  ["loading-card", "content-card", "reaction-card", "thanks-card", "not-found-card"].forEach(
    (cardId) => {
      document.getElementById(cardId).classList.toggle("hidden", cardId !== id);
    }
  );
}

function contentTypeLabel(value) {
  const found = CONTENT_TYPES.find((c) => c.value === value);
  return found ? found.label : value;
}

let selectedReaction = null;

function renderReactionGrid(shareId, reactorUid) {
  const grid = document.getElementById("reaction-grid");
  grid.innerHTML = "";
  REACTIONS.forEach((reaction) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reaction-btn";
    btn.innerHTML = `<span class="emoji">${reaction.emoji}</span><span>${reaction.label}</span>`;
    btn.addEventListener("click", () => {
      grid.querySelectorAll(".reaction-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedReaction = reaction.value;
      document.getElementById("submit-reaction-btn").disabled = false;
    });
    grid.appendChild(btn);
  });

  document.getElementById("submit-reaction-btn").addEventListener("click", async () => {
    if (!selectedReaction) return;
    const comment = document.getElementById("comment-input").value.trim();
    await setDoc(doc(db, "reactions", shareId), {
      emoji: selectedReaction,
      comment,
      reactedAt: serverTimestamp(),
      reactorId: reactorUid
    });
    showCard("thanks-card");
  });
}

async function init() {
  const shareId = getShareId();
  if (!shareId) {
    showCard("not-found-card");
    return;
  }

  const shareSnap = await getDoc(doc(db, "shares", shareId));
  if (!shareSnap.exists()) {
    showCard("not-found-card");
    return;
  }

  const share = shareSnap.data();
  document.getElementById("from-label").textContent = `${share.senderName || "だれか"} から`;
  document.getElementById("content-title").textContent = share.contentTitle;
  document.getElementById("content-type-label").textContent = contentTypeLabel(share.contentType);
  document.getElementById("message-inner").textContent = share.messageInner;

  showCard("content-card");
  document.getElementById("reaction-card").classList.remove("hidden");

  const user = await waitForUser();
  renderReactionGrid(shareId, user.uid);
}

init();
