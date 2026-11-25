/*
 * popup.js — Logic for the small window that opens from the toolbar icon.
 * ------------------------------------------------------------------
 * - Lets you choose the DEFAULT level and language (saved right away).
 * - Shows whether your Groq API key and model are set.
 * New cards use these defaults. You can still flip them on each card.
 */

const DEFAULTS = { defaultLevel: "student", defaultLanguage: "english" };

const savedEl = document.getElementById("saved");
const keyStatusEl = document.getElementById("keyStatus");
const keyRowEl = document.querySelector(".key-row");

// 1. When the popup opens, tick the saved choices.
chrome.storage.local
  .get({ ...DEFAULTS, groqApiKey: "", groqModel: "" })
  .then((saved) => {
    checkRadio("level", saved.defaultLevel);
    checkRadio("language", saved.defaultLanguage);
    showKeyStatus(saved.groqApiKey, saved.groqModel);
  });

// Tick the radio button with this name + value.
function checkRadio(name, value) {
  const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (radio) radio.checked = true;
}

// 2. Save as soon as a choice changes (no Save button needed).
let savedTimer = null;
document.querySelectorAll('input[type="radio"]').forEach((radio) => {
  radio.addEventListener("change", async () => {
    const key = radio.name === "level" ? "defaultLevel" : "defaultLanguage";
    await chrome.storage.local.set({ [key]: radio.value });

    // Show "Saved ✓" for 1.5 seconds.
    savedEl.textContent = "Saved ✓ — new cards will use this";
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (savedEl.textContent = ""), 1500);
  });
});

// 3. Show if the API key + model are set.
function showKeyStatus(apiKey, model) {
  if (apiKey && model) {
    keyStatusEl.textContent = "🔑 Groq key & model: set ✅";
    keyRowEl.classList.remove("missing");
  } else {
    keyStatusEl.textContent = apiKey ? "⚠️ Model name not set" : "⚠️ Groq API key not set";
    keyRowEl.classList.add("missing");
  }
}

// 4. Settings button opens the Options page.
document.getElementById("openSettings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
