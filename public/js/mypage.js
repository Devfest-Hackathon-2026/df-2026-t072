import {
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db, waitForUser } from "./auth.js";
import { CONTENT_TYPES } from "./constants.js";

function contentTypeLabel(value) {
  const found = CONTENT_TYPES.find((c) => c.value === value);
  return found ? found.label : value;
}

async function init() {
  const loadingEl = document.getElementById("loading-state");
  const emptyEl = document.getElementById("empty-state");
  const listEl = document.getElementById("share-list");

  let snap;
  try {
    const user = await waitForUser();
    const q = query(
      collection(db, "shares"),
      where("senderId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    snap = await getDocs(q);
  } catch (err) {
    console.error("failed to load share history", err);
    loadingEl.textContent = "読み込みに失敗しました。ページを再読み込みしてね";
    return;
  }

  loadingEl.style.display = "none";

  if (snap.empty) {
    emptyEl.style.display = "block";
    return;
  }

  snap.forEach((docSnap) => {
    const share = docSnap.data();
    const item = document.createElement("a");
    item.className = "share-item";
    item.href = `status.html?id=${docSnap.id}`;

    const mainEl = document.createElement("span");
    mainEl.className = "share-item-main";

    const titleEl = document.createElement("span");
    titleEl.textContent = share.contentTitle;
    mainEl.appendChild(titleEl);

    if (share.recipientMemo) {
      const recipientEl = document.createElement("span");
      recipientEl.className = "share-item-recipient";
      recipientEl.textContent = `→ ${share.recipientMemo}`;
      mainEl.appendChild(recipientEl);
    }

    const badgeEl = document.createElement("span");
    badgeEl.className = "badge";
    badgeEl.textContent = contentTypeLabel(share.contentType);

    item.append(mainEl, badgeEl);
    listEl.appendChild(item);
  });
}

init();
