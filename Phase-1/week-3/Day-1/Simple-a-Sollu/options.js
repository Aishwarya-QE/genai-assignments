/*
 * options.js — Logic for the Settings page.
 * ------------------------------------------------------------------
 * Saves your Groq API key and model name in chrome.storage.local.
 * That storage is private to this extension in this browser, so the
 * key is never written in any code file.
 * (Phase 5 will add a "Test connection" button here.)
 */

const keyInput = document.getElementById("apiKey");
const modelInput = document.getElementById("model");
const showKeyBox = document.getElementById("showKey");
const saveBtn = document.getElementById("save");
const clearKeyBtn = document.getElementById("clearKey");
const statusEl = document.getElementById("status");

// Show a coloured message under the buttons. type = "ok" | "warn" | "error"
function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type;
}

// 1. When the page opens, fill in anything saved earlier.
chrome.storage.local.get(["groqApiKey", "groqModel"]).then((saved) => {
  keyInput.value = saved.groqApiKey || "";
  modelInput.value = saved.groqModel || "";
});

// 2. "Show key" checkbox: switch between hidden dots and readable text.
showKeyBox.addEventListener("change", () => {
  keyInput.type = showKeyBox.checked ? "text" : "password";
});

// 3. Save button.
saveBtn.addEventListener("click", async () => {
  const apiKey = keyInput.value.trim();
  const model = modelInput.value.trim();

  if (!apiKey) return showStatus("Please paste your Groq API key.", "error");
  if (!model) return showStatus("Please type a model name.", "error");

  await chrome.storage.local.set({ groqApiKey: apiKey, groqModel: model });

  // Groq keys normally start with "gsk_". Save anyway, but warn gently.
  if (!apiKey.startsWith("gsk_")) {
    showStatus("Saved — but Groq keys usually start with “gsk_”. Please double-check it.", "warn");
  } else {
    showStatus("Saved! ✅ Ippo select pannitu right-click pannunga.", "ok");
  }
});

// 4. Remove key button (handy for testing the "no API key" error).
clearKeyBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("groqApiKey");
  keyInput.value = "";
  showStatus("API key removed.", "warn");
});
