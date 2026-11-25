# Simple-ah Sollu 💬

> *"Simple-ah sollu"* = Tanglish for **"Say it simply."**

A Chrome extension (Manifest V3) for confusing text on any webpage, such as tech, finance or legal terms.
**Select the text → right-click → "Simple-ah Sollu 💬"**. A friendly card pops up next to the text with a simple explanation from the Groq AI.

> 🚧 **Build status:** Phase 3 of 5 done (explanation + real-life analogy + "Puriyala? Quiz me!", with Level + Language switches and a popup for defaults).

---

## 📁 Folder structure

| File | What it does |
|---|---|
| `manifest.json` | The extension's ID card: name, permissions, which files to use |
| `background.js` | The "brain": adds the right-click menu and calls the Groq API |
| `content.js` / `content.css` | Draws the floating card on the webpage |
| `prompts.js` | The instructions for the AI. **Edit this file to change the AI's style** |
| `popup.html` / `popup.js` / `popup.css` | Small window from the toolbar icon: default Level + Language, key status |
| `options.html` / `options.js` | Settings page for the API key and model name |
| `demo-page.html` | A test page full of confusing words |
| `icons/` | Extension icons |

---

## 🚀 How to load the extension

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (toggle, top-right)
3. Click **Load unpacked** and pick this folder (the one that has `manifest.json`)
4. You'll see **Simple-ah Sollu** with an orange speech-bubble icon. Click the 🧩 puzzle icon in the toolbar and pin it.
5. **For the demo page only:** on the extension's **Details** page, turn on **"Allow access to file URLs"**. Chrome needs this before an extension can work on files opened from your computer (`file:///...`).

**After you change any code:** click the 🔄 reload icon on the extension's card in `chrome://extensions`.

---

## 🔑 How to add your Groq API key and model name

1. Get a free key at **console.groq.com → API Keys** (it starts with `gsk_`).
2. Open Settings: right-click the extension icon → **Options**, or go to `chrome://extensions` → Simple-ah Sollu → **Details** → **Extension options**.
3. Paste the key, type a model ID (copy it exactly from **console.groq.com → Models**), and click **Save**.

The key is stored only in `chrome.storage.local` in your browser. It is **never** written in any code file, so it's safe to push this folder to GitHub.

**"How do I see my key again?"** Groq shows the full key **only once**, when you create it. Later it only shows `gsk_...abcd`. To see the key you saved, open the extension's Settings and tick **Show key**. If it's lost everywhere, create a new key in Groq, paste it into Settings, and delete the old one in Groq.

---

## ⚠️ Where it does NOT work

Chrome blocks every extension on these pages, so this is a Chrome rule and not a bug:
- `chrome://` pages (Settings, Extensions, New Tab)
- The Chrome Web Store
- Chrome's built-in PDF viewer
- Local `file:///` pages, unless "Allow access to file URLs" is on

---

## ✅ Test checklist

### Phase 1: Right-click → card → English explanation

**Positive**
| # | Steps | Expected |
|---|---|---|
| 1.1 | Open `demo-page.html`, select **API**, right-click | Menu shows `Simple-ah Sollu 💬 "API"` |
| 1.2 | Click the menu item | Card appears **just below the word** with spinner "Konjam wait pannunga…" |
| 1.3 | Wait 1–3 seconds | Spinner is replaced by "SIMPLE-AH SONNA 👇" + a 2–3 sentence simple English explanation |
| 1.4 | Repeat with Cloud, Cookie, EMI, Inflation, Indemnity | Each gives a sensible, simple explanation |
| 1.5 | Try on a real site (e.g. a Wikipedia article) | Works the same; card sits near the selection |
| 1.6 | Select a whole sentence | The sentence is explained |
| 1.7 | A tab that was **already open before** you installed the extension | Still works, no page refresh needed |

**Closing the card / layout**
| # | Steps | Expected |
|---|---|---|
| 1.8 | Click ✕ | Card disappears |
| 1.9 | Open the card, press **Esc** | Card disappears |
| 1.10 | Look at the page text around the card | Nothing on the page moved, resized or changed font |
| 1.11 | Select "Cryptocurrency" at the right edge of the demo page | Card stays fully on screen (doesn't go off the right edge) |
| 1.12 | Scroll the page while the card is open | Card scrolls along with the text it explains |

**Negative (error messages)**
| # | Steps | Expected |
|---|---|---|
| 1.13 | Settings → **Remove key** → explain a word | 🔑 "API key missing" + **Open Settings ⚙️** button, which opens Settings |
| 1.14 | Save a wrong key (e.g. `gsk_wrong123`) | 🚫 "API key not working" |
| 1.15 | Save a key that doesn't start with `gsk_` | Settings shows a yellow warning but still saves |
| 1.16 | Save a wrong model name (e.g. `llama-fake`) | 🧠 "Model not found" |
| 1.17 | Settings: leave key or model empty → Save | Red message "Please paste…/Please type…"; nothing saved |
| 1.18 | Turn off Wi-Fi → explain a word | 📡 "No internet" (see tip below) |
| 1.19 | Click the menu very quickly ~30+ times in a minute | 🐢 "Konjam slow pannunga!" (rate limit; may be hard to trigger on Groq's free tier) |

**Edge cases**
| # | Steps | Expected |
|---|---|---|
| 1.20 | Select the whole long paragraph on the demo page (> 300 chars) | Yellow note "I used only the first 300 characters", then an explanation |
| 1.21 | Select `xqzt blorf wumple` | AI kindly says it couldn't find a clear meaning |
| 1.22 | Select a word inside the text box | Card appears in the top-right corner of the screen (Chrome doesn't give the exact position inside text boxes) |
| 1.23 | Select one word, click menu, then quickly do another word | Card shows the answer for the **second** word only |
| 1.24 | Go to `chrome://settings`, select text, right-click | Menu item doesn't appear, or nothing happens (expected, see above) |
| 1.25 | Reload the extension, then use it on an already open tab without refreshing | Still works |
| 1.26 | Select text with emoji or Tamil script (e.g. "வணக்கம்") | Explanation appears, no crash |

> 💡 **QA tip: offline testing.** Turning on "Offline" in the *webpage's* DevTools does **not** affect the extension, because the API call happens in the service worker. Either turn off Wi-Fi, or go to `chrome://extensions` → Simple-ah Sollu → click **"service worker"**, then in *that* DevTools window open Network → Offline.
>
> 💡 **QA tip: debug logs.** Errors are logged in that same service-worker DevTools Console, starting with `[Simple-ah Sollu]`.

### Phase 2: Level switch + Language switch + popup defaults

**Positive**
| # | Steps | Expected |
|---|---|---|
| 2.1 | Click the toolbar icon | Popup opens with **Default level** and **Default language** choices; Student + English are selected the first time |
| 2.2 | Popup: choose **💼 Professional** | Green "Saved ✓" appears for a moment |
| 2.3 | Close and reopen the popup | Professional is still selected |
| 2.4 | Explain **API** | Card switches show **💼 Professional** + **English** highlighted; explanation uses terms like "endpoint", "request/response" and a workplace example |
| 2.5 | Popup: choose **Tanglish**, explain **EMI** | Explanation in Tanglish (Tamil in English letters, e.g. "EMI na…"), **no Tamil script** |
| 2.6 | On the card, click **🎒 Student** | Spinner shows, then a simpler explanation with an everyday Indian example |
| 2.7 | On the card, click **English** / **Tanglish** | Explanation reloads in that language |
| 2.8 | Check all 4 combinations for **Inflation** (Student/Professional × English/Tanglish) | All four give different, sensible answers |
| 2.9 | Flip a switch on the card, then open a **new** card | New card uses the **popup defaults**, not the last switch (card switches are for that card only) |
| 2.10 | Popup key status with key + model saved | "🔑 Groq key & model: set ✅" |
| 2.11 | Popup → **⚙️ Settings** | Settings page opens and the popup closes |

**Negative**
| # | Steps | Expected |
|---|---|---|
| 2.12 | Settings → Remove key, then open the popup | Yellow row "⚠️ Groq API key not set" |
| 2.13 | Without a key, flip a switch on an open card | 🔑 "API key missing" error card (switches stay visible) |
| 2.14 | Empty selection error (🫣) | Card shows **no** switches (nothing to explain) |

**Edge cases**
| # | Steps | Expected |
|---|---|---|
| 2.15 | Click Student → Professional → Student very quickly | Card ends on the **Student** answer; older answers never overwrite it |
| 2.16 | Click the already-selected switch button | Nothing happens (no extra API call) |
| 2.17 | Flip a switch, then press **Esc** while it's loading | Card closes and does **not** reappear when the answer arrives |
| 2.18 | Long selection (> 300 chars), then flip a switch | Yellow "300 characters" note stays visible |
| 2.19 | Use Tab + Enter/Space on the card switches and popup choices | Works with the keyboard; focus outline is visible |
| 2.20 | Reload the extension, then flip a switch on a card that was already open | 🔄 "Please refresh this page" (the old card can't reach the reloaded extension) |

### Phase 3: Real-life analogy + "Puriyala? Quiz me!"

**Positive**
| # | Steps | Expected |
|---|---|---|
| 3.1 | Student + English, explain **API** | Explanation, then a box "🌟 Real-life example" with an everyday Indian analogy, then the button **Puriyala? Quiz me! 🧠** |
| 3.2 | Flip to **💼 Professional** | Analogy box label changes to "💼 At work, for example" with a workplace example |
| 3.3 | Click **Puriyala? Quiz me!** | Button is replaced by "Quiz time! 🎯" with **Q1** and **Q2**, each with 4 options (A–D) |
| 3.4 | Click the **correct** option | It turns green; "✅ Correct! Super!" appears |
| 3.5 | Click a **wrong** option | Your pick turns red, the correct one turns green; "❌ Oops! Correct answer: …" appears |
| 3.6 | Answer both correctly | "🎉 Semma! 2/2 — you got it!" + **Try again 🔁** |
| 3.7 | Answer one right, one wrong | "👍 Nalla try! 1/2" |
| 3.8 | Answer both wrong | "💪 Paravaayilla! 0/2 …" |
| 3.9 | Click **Try again 🔁** | Fresh quiz, all options clickable again, score hidden |
| 3.10 | Tanglish, explain **GST** → Quiz me | Analogy, questions and options are all in Tanglish |
| 3.11 | Check the quiz answers yourself for 3–4 words | The answer marked correct is actually correct |

**Negative**
| # | Steps | Expected |
|---|---|---|
| 3.12 | After answering a question, click another option of the same question | Nothing happens (answers are locked) |
| 3.13 | Select gibberish `xqzt blorf wumple` | Only the kind "no clear meaning" explanation; **no** analogy box, **no** quiz button |
| 3.14 | Open the quiz, then flip Level or Language | Quiz disappears; new explanation loads with a fresh **Quiz me** button |

**Edge cases**
| # | Steps | Expected |
|---|---|---|
| 3.15 | Open the quiz on a small window / zoomed-in page (Ctrl +) | Card body scrolls inside the card; the page doesn't break |
| 3.16 | Long option text | Wraps onto 2 lines neatly, doesn't overflow the card |
| 3.17 | Keyboard: Tab to an option, press Enter | Answers the question; focus outline is visible |
| 3.18 | Explain a long sentence (> 300 chars) → Quiz me | Works; yellow "300 characters" note still shown |

> 🔍 **How the quiz is protected:** the AI sometimes sends the answer as `"1"`, `"B"` or the option text instead of the number `1`. `cleanQuiz()` in `background.js` turns all of these into a number, and drops any broken question, so the card never shows a quiz it can't mark.

### Phase 4–5
*Coming in the next phases.*

---

## 🎤 2-minute demo script
*Coming in Phase 5.*

## 🔮 Future scope
*Coming in Phase 5.*
