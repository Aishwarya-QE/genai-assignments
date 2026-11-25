/*
 * content.js — Draws the floating card ON the webpage.
 * ------------------------------------------------------------------
 * background.js adds this script to the page only when you click our
 * right-click menu item, then sends one of these messages:
 *   OPEN_CARD  -> open the card with the text, level and language
 *   SHOW_ERROR -> open the card with an error (e.g. empty selection)
 *
 * The card then asks background.js for the explanation ("EXPLAIN").
 * When you flip the Level or Language switch, the card simply asks again.
 *
 * Two safety ideas used here:
 *  1. SHADOW DOM: the card lives inside a "shadow root", a private
 *     bubble. The website's CSS can't change our card, and our CSS
 *     can't break the website.
 *  2. textContent (not innerHTML): we always insert AI text as plain
 *     text, so even strange AI output can never run as code.
 */

// Everything is wrapped in (() => { ... })() so our variables stay
// private. This also means re-running the script on the same page
// doesn't cause "variable already declared" errors.
(() => {
  // If an older copy of this script is already on the page (for example
  // after you reloaded the extension), switch it off first.
  if (typeof window.__simpleAhSolluCleanup === "function") {
    try {
      window.__simpleAhSolluCleanup();
    } catch (e) {
      /* the old copy is already dead — ignore */
    }
  }

  const CARD_WIDTH = 340; // px
  const GAP = 8; // px space between selection and card

  // The choices shown on the card's switches.
  const LEVEL_OPTIONS = [
    { value: "student", label: "🎒 Student" },
    { value: "professional", label: "💼 Professional" },
  ];
  const LANGUAGE_OPTIONS = [
    { value: "english", label: "English" },
    { value: "tanglish", label: "Tanglish" },
  ];

  // Shown if we can't talk to background.js at all.
  const RELOADED_ERROR = {
    emoji: "🔄",
    title: "Please refresh this page",
    message: "The extension was updated. Refresh this page (F5) and try again.",
  };

  // What the card is currently showing.
  const state = { text: "", note: null, level: "student", language: "english" };

  // References to parts of the card (filled in by createCard).
  let host = null; // the outer element added to the page
  let termEl = null; // shows the selected text
  let noteEl = null; // shows notes like "only first 300 characters used"
  let controlsEl = null; // the Level + Language switches
  let bodyEl = null; // main area: loading / explanation / error

  // Every explanation request gets a number. If a newer request starts,
  // the older answer is ignored (so a slow old answer never overwrites a new one).
  let requestCounter = 0;

  // ---------- Listen for messages from background.js ----------
  function onMessage(msg) {
    if (!msg || msg.source !== "simple-ah-sollu") return;

    if (msg.type === "OPEN_CARD") {
      state.text = msg.text;
      state.note = msg.note;
      state.level = msg.level;
      state.language = msg.language;
      openFreshCard();
      explain();
    }

    if (msg.type === "SHOW_ERROR") {
      requestCounter++; // cancel any answer still on its way
      state.text = "";
      state.note = null;
      openFreshCard();
      showError(msg.error);
    }
  }

  // ---------- Close the card when Escape is pressed ----------
  function onKeyDown(event) {
    if (event.key === "Escape" && host) removeCard();
  }

  chrome.runtime.onMessage.addListener(onMessage);
  document.addEventListener("keydown", onKeyDown, true);

  // Save a cleanup function so a newer copy of this script can switch us off.
  window.__simpleAhSolluCleanup = () => {
    chrome.runtime.onMessage.removeListener(onMessage);
    document.removeEventListener("keydown", onKeyDown, true);
    removeCard();
  };

  // =================================================================
  //  Asking for an explanation
  // =================================================================

  async function explain() {
    const myRequest = ++requestCounter;
    showLoading();

    let response;
    try {
      response = await chrome.runtime.sendMessage({
        type: "EXPLAIN",
        text: state.text,
        level: state.level,
        language: state.language,
      });
    } catch (e) {
      response = { ok: false, error: RELOADED_ERROR };
    }

    // Ignore this answer if a newer request started, or the card was closed.
    if (myRequest !== requestCounter || !host) return;

    if (response && response.ok) {
      showResult(response.result);
    } else {
      showError((response && response.error) || RELOADED_ERROR);
    }
  }

  // =================================================================
  //  The three body states
  // =================================================================

  function showLoading() {
    bodyEl.replaceChildren(); // empty the body
    const loading = make("div", "loading");
    loading.append(make("div", "spinner"), make("span", "", "Konjam wait pannunga… yosichittu irukken 🤔"));
    bodyEl.append(loading);
  }

  function showResult(result) {
    bodyEl.replaceChildren();
    bodyEl.append(
      make("div", "label", "Simple-ah sonna 👇"),
      make("p", "explanation", result.explanation)
    );
  }

  function showError(error) {
    bodyEl.replaceChildren();

    const box = make("div", "error");
    box.append(
      make("div", "error-emoji", error.emoji),
      make("div", "error-title", error.title),
      make("p", "error-message", error.message)
    );

    // Some errors (missing key, wrong model) need the Settings page.
    if (error.showSettings) {
      const btn = make("button", "btn", "Open Settings ⚙️");
      btn.type = "button";
      btn.addEventListener("click", () => {
        try {
          chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
        } catch (e) {
          /* extension was reloaded — the user can right-click again */
        }
      });
      box.append(btn);
    }
    bodyEl.append(box);
  }

  // =================================================================
  //  Level + Language switches
  // =================================================================

  // Build one switch: a row of buttons where exactly one is "on".
  // key = "level" or "language" (which part of state it changes).
  function buildSwitch(key, options, groupName) {
    const group = make("div", "switch");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", groupName);

    for (const option of options) {
      const btn = make("button", "", option.label);
      btn.type = "button";
      btn.dataset.key = key;
      btn.dataset.value = option.value;
      btn.addEventListener("click", () => {
        if (state[key] === option.value) return; // already selected
        state[key] = option.value;
        updateSwitches();
        explain(); // ask again with the new choice
      });
      group.append(btn);
    }
    return group;
  }

  // Highlight the selected button in each switch.
  function updateSwitches() {
    if (!controlsEl) return;
    for (const btn of controlsEl.querySelectorAll("button")) {
      const isOn = state[btn.dataset.key] === btn.dataset.value;
      btn.setAttribute("aria-pressed", String(isOn));
    }
  }

  // =================================================================
  //  Building, placing and removing the card
  // =================================================================

  // Remove any old card and build a new one at the current selection.
  function openFreshCard() {
    removeCard();
    createCard();

    // Selected text (shortened if it is long).
    const shortText = state.text.length > 80 ? state.text.slice(0, 80) + "…" : state.text;
    termEl.textContent = shortText ? `“${shortText}”` : "";
    termEl.hidden = !shortText;

    noteEl.textContent = state.note || "";
    noteEl.hidden = !state.note;

    // Switches only make sense when there is text to explain.
    controlsEl.hidden = !state.text;
    updateSwitches();
  }

  function createCard() {
    // 1. The host: an empty box on the page that holds our private bubble.
    host = document.createElement("div");
    host.id = "simple-ah-sollu-host";
    // "all: initial" resets any website styles that might reach the host.
    // It starts hidden until our CSS has loaded (so it never looks broken).
    host.style.cssText = "all: initial; position: absolute; z-index: 2147483647; visibility: hidden;";

    // 2. The shadow root: the private bubble.
    const shadow = host.attachShadow({ mode: "open" });

    // 3. Load content.css inside the bubble.
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("content.css");
    const reveal = () => {
      if (host) host.style.visibility = "visible";
    };
    link.addEventListener("load", reveal);
    link.addEventListener("error", reveal);
    shadow.append(link);

    // 4. The card itself.
    const card = make("div", "card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Simple-ah Sollu explanation");

    const header = make("div", "header");
    const closeBtn = make("button", "close", "✕");
    closeBtn.type = "button";
    closeBtn.title = "Close (Esc)";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", removeCard);
    header.append(make("span", "title", "Simple-ah Sollu 💬"), closeBtn);

    termEl = make("div", "term");
    noteEl = make("div", "note");
    controlsEl = make("div", "controls");
    controlsEl.append(
      buildSwitch("level", LEVEL_OPTIONS, "Level"),
      buildSwitch("language", LANGUAGE_OPTIONS, "Language")
    );
    bodyEl = make("div", "body");
    const footer = make("div", "footer", "Powered by Groq ⚡");

    card.append(header, termEl, noteEl, controlsEl, bodyEl, footer);
    shadow.append(card);

    // 5. Add it to the page and place it next to the selection.
    document.documentElement.append(host);
    placeCard();
  }

  // Put the card just below the selected text, but never off-screen.
  function placeCard() {
    const width = Math.min(CARD_WIDTH, window.innerWidth - GAP * 2);
    const rect = getSelectionRect();

    let left;
    let top;
    if (rect) {
      // Convert "position on screen" to "position on the page" by adding scroll.
      left = rect.left + window.scrollX;
      top = rect.bottom + window.scrollY + GAP;
    } else {
      // No selection position found (e.g. text inside an input box):
      // show the card in the top-right corner of what you're looking at.
      left = window.scrollX + window.innerWidth - width - 16;
      top = window.scrollY + 16;
    }

    // Keep the card inside the visible width of the window.
    const minLeft = window.scrollX + GAP;
    const maxLeft = window.scrollX + window.innerWidth - width - GAP;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
    host.style.width = `${width}px`;
  }

  // Find where the selected text is on the screen.
  function getSelectionRect() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return rect;
  }

  function removeCard() {
    if (host) host.remove();
    host = termEl = noteEl = controlsEl = bodyEl = null;
  }

  // Small helper: make an element with a CSS class and some text.
  // textContent keeps text as plain text (safe — never runs as code).
  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
})();
