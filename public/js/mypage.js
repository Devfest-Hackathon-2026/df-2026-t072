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
  const user = await waitForUser();

  const q = query(
    collection(db, "shares"),
    where("senderId", "==", user.uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);

  const listEl = document.getElementById("share-list");
  const emptyEl = document.getElementById("empty-state");

  if (snap.empty) {
    emptyEl.style.display = "block";
    return;
  }

  snap.forEach((docSnap) => {
    const share = docSnap.data();
    const item = document.createElement("a");
    item.className = "share-item";
    item.href = `status.html?id=${docSnap.id}`;
    item.innerHTML = `
      <span>${share.contentTitle}</span>
      <span class="badge">${contentTypeLabel(share.contentType)}</span>
    `;
    listEl.appendChild(item);
  });
}

init();
