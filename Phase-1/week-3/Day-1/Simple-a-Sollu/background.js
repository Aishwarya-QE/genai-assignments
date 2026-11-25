/*
 * background.js — The "brain" of the extension (a service worker).
 * ------------------------------------------------------------------
 * It runs in the background, separately from any webpage. It:
 *   1. Adds the "Simple-ah Sollu" item to the right-click menu.
 *   2. When you click it, puts our card script (content.js) on the page
 *      and tells the card which text, level and language to use.
 *   3. When the card asks ("EXPLAIN"), calls the Groq AI API and
 *      replies with the answer (or a friendly error).
 *
 * Why call the API from here and not from the webpage?
 *  - The webpage can't see your API key, so it stays private.
 *  - Websites can't block or interfere with the request.
 */

// importScripts loads another JS file into this service worker.
// After this line we can use buildMessages() from prompts.js.
importScripts("prompts.js");

// ---------- Settings you might want to change ----------
const MENU_ID = "simple-ah-sollu";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_CHARS = 300;          // longest selection we send to the AI
const TIMEOUT_MS = 20000;       // give up after 20 seconds

// Allowed choices (anything else falls back to the first one).
const LEVELS = ["student", "professional"];
const LANGUAGES = ["english", "tanglish"];

// ---------- Friendly error messages ----------
// Each error has a code (like "NO_KEY"). The card shows the matching message.
const ERRORS = {
  EMPTY: {
    emoji: "🫣",
    title: "Onnum select pannala!",
    message: "Please select some text first (a word or a short sentence), then right-click.",
  },
  NO_KEY: {
    emoji: "🔑",
    title: "API key missing",
    message: "Please add your Groq API key in Settings, then try again.",
    showSettings: true,
  },
  NO_MODEL: {
    emoji: "🧠",
    title: "Model name missing",
    message: "Please add a Groq model name in Settings, then try again.",
    showSettings: true,
  },
  INVALID_KEY: {
    emoji: "🚫",
    title: "API key not working",
    message: "Groq says this API key is invalid. Please check that you copied it fully in Settings.",
    showSettings: true,
  },
  BAD_MODEL: {
    emoji: "🧠",
    title: "Model not found",
    message: "Groq doesn't recognise this model name. Please check the spelling in Settings.",
    showSettings: true,
  },
  RATE_LIMIT: {
    emoji: "🐢",
    title: "Konjam slow pannunga!",
    message: "Too many requests in a short time. Please wait a minute and try again.",
  },
  NO_INTERNET: {
    emoji: "📡",
    title: "No internet",
    message: "I couldn't reach Groq. Please check your internet connection and try again.",
  },
  TIMEOUT: {
    emoji: "⏳",
    title: "Taking too long",
    message: "Groq didn't reply within 20 seconds. Please try again.",
  },
  SERVER: {
    emoji: "🛠️",
    title: "Groq is having trouble",
    message: "The AI service had a problem on its side. Please try again in a moment.",
  },
  BAD_RESPONSE: {
    emoji: "🤔",
    title: "Confusing answer",
    message: "The AI sent an answer I couldn't read. Please try again.",
  },
  UNKNOWN: {
    emoji: "😕",
    title: "Something went wrong",
    message: "An unexpected error happened. Please try again.",
  },
};

// Helper: create an Error that carries one of the codes above.
function appError(code, detail) {
  const err = new Error(detail || code);
  err.code = code;
  return err;
}

// ---------- 1. Create the right-click menu item ----------
// onInstalled runs when the extension is installed, updated or reloaded.
chrome.runtime.onInstalled.addListener(() => {
  // Remove old items first, so reloading doesn't cause a "duplicate id" error.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Simple-ah Sollu 💬 "%s"', // Chrome replaces %s with the selected text
      contexts: ["selection"],          // only show when text is selected
    });
  });
});

// ---------- 2. When the menu item is clicked ----------
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab || tab.id === undefined) return;
  const tabId = tab.id;

  // Put the card script on the page. If this page doesn't allow it
  // (for example chrome:// pages), stop here.
  const injected = await injectCardScript(tabId);
  if (!injected) return;

  // Clean up the selected text (remove extra spaces at the start and end).
  let text = (info.selectionText || "").trim();

  // Edge case: nothing (or only spaces) selected.
  if (!text) {
    sendToCard(tabId, { type: "SHOW_ERROR", error: ERRORS.EMPTY });
    return;
  }

  // Edge case: very long selection. Keep only the first 300 characters.
  let note = null;
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
    note = `That's a long selection! I used only the first ${MAX_CHARS} characters.`;
  }

  // Read the default level + language chosen in the popup.
  const { level, language } = await getDefaults();

  // Tell the card to open. The card will then ask us to "EXPLAIN".
  sendToCard(tabId, { type: "OPEN_CARD", text, note, level, language });
});

// ---------- 3. Messages FROM the card ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only accept messages from our own extension.
  if (sender.id !== chrome.runtime.id || !msg) return false;

  // The card can't open the Settings page itself, so it asks us to.
  if (msg.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    return false;
  }

  // The card wants an explanation.
  if (msg.type === "EXPLAIN") {
    handleExplain(msg).then(sendResponse);
    return true; // "true" = "I'll reply later" (because the API call takes time)
  }

  return false;
});

async function handleExplain(msg) {
  const text = String(msg.text || "").trim().slice(0, MAX_CHARS);
  if (!text) return { ok: false, error: ERRORS.EMPTY };

  // Only allow known values (safety: never trust messages blindly).
  const level = LEVELS.includes(msg.level) ? msg.level : LEVELS[0];
  const language = LANGUAGES.includes(msg.language) ? msg.language : LANGUAGES[0];

  try {
    const result = await explainWithGroq(text, level, language);
    return { ok: true, result };
  } catch (err) {
    console.warn("[Simple-ah Sollu] Error:", err.code, err.message);
    return { ok: false, error: ERRORS[err.code] || ERRORS.UNKNOWN };
  }
}

// ---------- Helper: read default level + language from storage ----------
async function getDefaults() {
  // Passing an object means "use these values if nothing is saved yet".
  const saved = await chrome.storage.local.get({
    defaultLevel: LEVELS[0],
    defaultLanguage: LANGUAGES[0],
  });
  return {
    level: LEVELS.includes(saved.defaultLevel) ? saved.defaultLevel : LEVELS[0],
    language: LANGUAGES.includes(saved.defaultLanguage) ? saved.defaultLanguage : LANGUAGES[0],
  };
}

// ---------- Helper: put content.js on the page ----------
async function injectCardScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    return true;
  } catch (err) {
    // This happens on chrome:// pages, the Chrome Web Store, PDF viewer, etc.
    console.warn("[Simple-ah Sollu] Can't run on this page:", err.message);
    return false;
  }
}

// ---------- Helper: send a message to the card ----------
function sendToCard(tabId, message) {
  // "source" helps the card know this message is really from us.
  chrome.tabs
    .sendMessage(tabId, { source: "simple-ah-sollu", ...message })
    .catch((err) => console.warn("[Simple-ah Sollu] Card not reachable:", err.message));
}

// ---------- 4. Call the Groq API ----------
async function explainWithGroq(text, level, language) {
  // Read the key and model the user saved on the Settings page.
  const { groqApiKey, groqModel } = await chrome.storage.local.get(["groqApiKey", "groqModel"]);
  if (!groqApiKey) throw appError("NO_KEY");
  if (!groqModel) throw appError("NO_MODEL");

  // Quick check: is the computer offline?
  if (!navigator.onLine) throw appError("NO_INTERNET");

  // AbortController lets us cancel the request if it takes too long.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: groqModel,
        // buildMessages (in prompts.js) = system prompt + example answers + your text
        messages: buildMessages(text, level, language),
        response_format: { type: "json_object" }, // ask Groq for JSON only
        temperature: 0.4, // lower = more focused, less random
      }),
      signal: controller.signal,
    });
  } catch (err) {
    // fetch() itself fails when there's no network, or when we aborted it.
    if (err.name === "AbortError") throw appError("TIMEOUT");
    throw appError("NO_INTERNET", err.message);
  } finally {
    clearTimeout(timer);
  }

  // The request reached Groq, but Groq said "no" (status 4xx / 5xx).
  if (!response.ok) {
    let apiMessage = "";
    let apiCode = "";
    try {
      const errBody = await response.json();
      apiMessage = (errBody && errBody.error && errBody.error.message) || "";
      apiCode = (errBody && errBody.error && errBody.error.code) || "";
    } catch (e) {
      /* the error body wasn't JSON — that's okay */
    }
    const details = `${response.status} ${apiCode} ${apiMessage}`;

    if (response.status === 401) throw appError("INVALID_KEY", details);
    if (response.status === 429) throw appError("RATE_LIMIT", details);
    if (apiCode === "json_validate_failed") throw appError("BAD_RESPONSE", details);
    if (response.status === 404 || /model/i.test(apiCode + " " + apiMessage)) {
      throw appError("BAD_MODEL", details);
    }
    if (response.status >= 500) throw appError("SERVER", details);
    throw appError("UNKNOWN", details);
  }

  // Success! Dig out the AI's text and turn it from a JSON string into an object.
  const data = await response.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : "";

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw appError("BAD_RESPONSE", "Not valid JSON: " + content);
  }

  if (!parsed || typeof parsed.explanation !== "string" || !parsed.explanation.trim()) {
    throw appError("BAD_RESPONSE", "Missing 'explanation': " + content);
  }

  return { explanation: parsed.explanation.trim() };
}
