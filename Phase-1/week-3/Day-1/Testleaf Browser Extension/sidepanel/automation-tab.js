// Ledge-3.0 side panel — Automation tab (P4). Flow follows NaviCase
// sidepanel.js automate(): the ticked manual cases + the recording they came
// from go to the service worker's automate job over the job port.

import { KEYS, SETTINGS_DEFAULTS } from "../shared/constants.js";
import { FRAMEWORKS, isSupported, supportedLanguages } from "../background/prompts/automationPrompt.js";
import { runJob, pageSnapshot } from "./job.js";
import { frameworkLabel, scriptFilename, download, copyText } from "./export.js";
import { selection } from "./selection.js";

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") node.textContent = v;
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  node.append(...[].concat(children).filter((c) => c !== null && c !== undefined));
  return node;
}

function status(kind, text) {
  const s = $("automationStatus");
  s.hidden = !text;
  s.className = `banner${kind ? ` ${kind}` : ""}`;
  s.textContent = text || "";
}

async function getSettings() {
  const { [KEYS.settings]: stored = {} } = await chrome.storage.local.get(KEYS.settings);
  return { ...SETTINGS_DEFAULTS, ...stored };
}

async function saveSettings(patch) {
  const settings = await getSettings();
  await chrome.storage.local.set({ [KEYS.settings]: { ...settings, ...patch } });
}

const formatUsd = (v) => (v === null || v === undefined ? "—" : `$${v < 0.01 ? v.toFixed(4) : v.toFixed(2)}`);

// Reference-script placeholders, as NaviCase AUTOMATION.
const PLACEHOLDERS = {
  playwright: "Paste a working Playwright test from your project, e.g.\n\nimport { test, expect } from '@playwright/test';\n\ntest('TC-000 login', async ({ page }) => {\n  await page.goto('https://app.example.com/login');\n  await page.getByLabel('Email').fill('user@example.com');\n  await expect(page).toHaveURL(/dashboard/);\n});",
  "playwright:Python": "Paste a working Playwright Python test from your project, e.g.\n\nimport re\nfrom playwright.sync_api import Page, expect\n\ndef test_tc000_login(page: Page) -> None:\n    page.goto(\"https://app.example.com/login\")\n    page.get_by_label(\"Email\").fill(\"user@example.com\")\n    expect(page).to_have_url(re.compile(\"dashboard\"))",
  selenium: "Paste a working Selenium test from your project, e.g.\n\npublic class LoginTest extends BaseTest {\n  @Test\n  public void tc000_login() {\n    driver.get(\"https://app.example.com/login\");\n    driver.findElement(By.id(\"email\")).sendKeys(\"user@example.com\");\n    Assert.assertTrue(driver.getCurrentUrl().contains(\"dashboard\"));\n  }\n}",
  "selenium:Python": "Paste a working Selenium Python test from your project, e.g.\n\nimport pytest\nfrom selenium import webdriver\nfrom selenium.webdriver.common.by import By\n\n@pytest.fixture\ndef driver():\n    d = webdriver.Chrome()\n    yield d\n    d.quit()\n\ndef test_tc000_login(driver) -> None:\n    driver.get(\"https://app.example.com/login\")\n    driver.find_element(By.ID, \"email\").send_keys(\"user@example.com\")\n    assert \"dashboard\" in driver.current_url",
  "selenium:C#": "Paste a working Selenium C# test from your project, e.g.\n\n[TestFixture]\npublic class LoginTest\n{\n    private IWebDriver driver;\n\n    [SetUp] public void SetUp() => driver = new ChromeDriver();\n    [TearDown] public void TearDown() => driver.Quit();\n\n    [Test]\n    public void Tc000_Login()\n    {\n        driver.Navigate().GoToUrl(\"https://app.example.com/login\");\n        driver.FindElement(By.Id(\"email\")).SendKeys(\"user@example.com\");\n        Assert.That(driver.Url, Does.Contain(\"dashboard\"));\n    }\n}",
};

let framework = SETTINGS_DEFAULTS.automationFramework;
let busy = false;
let lastAutomation = null;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

function renderOptions(s) {
  framework = FRAMEWORKS[s.automationFramework] ? s.automationFramework : SETTINGS_DEFAULTS.automationFramework;
  for (const b of $("automationFramework").querySelectorAll("button")) b.setAttribute("aria-checked", String(b.dataset.value === framework));
  const fw = FRAMEWORKS[framework];
  // A saved choice that is not generated yet falls back to the first supported language.
  const saved = s.automationLanguage?.[framework];
  const lang = isSupported(fw, saved) ? saved : supportedLanguages(fw)[0];
  $("automationLanguage").replaceChildren(
    ...fw.languages.map((l) =>
      isSupported(fw, l) ? el("option", { value: l, text: l }) : el("option", { value: l, text: `${l} (coming soon)`, disabled: "" }),
    ),
  );
  $("automationLanguage").value = lang;
  $("referenceLabel").textContent = `Reference ${frameworkLabel(framework)} script for this navigation`;
  renderPlaceholder(lang);
  $("referenceScript").value = s.referenceScripts?.[framework] || "";
  updateButton();
}

function renderPlaceholder(lang) {
  $("referenceScript").placeholder = PLACEHOLDERS[`${framework}:${lang}`] || PLACEHOLDERS[framework];
}

function updateButton() {
  const n = selection.size;
  $("autoSelected").textContent = n ? `${n} test case${n === 1 ? "" : "s"} selected: ${selection.selectedCases().map((tc) => tc.id).join(", ")}` : "No test cases selected. Tick them in Results.";
  $("automateBtn").disabled = busy || !n;
  $("automateBtn").classList.toggle("is-busy", busy);
  $("autoProgress").hidden = !busy;
  $("automateBtn").querySelector(".btn-ico use")?.setAttribute("href", busy ? "#i-loader" : "#i-wand");
  if (busy) return;
  ($("automateBtn").querySelector(".btn-label") || $("automateBtn")).textContent = n ? `Generate ${frameworkLabel(framework)} script for ${n} test case${n === 1 ? "" : "s"}` : "Select test cases to automate";
}

$("automationFramework").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-value]");
  if (!b) return;
  await saveSettings({ automationFramework: b.dataset.value });
  renderOptions(await getSettings());
});
$("automationLanguage").addEventListener("change", async (e) => {
  const s = await getSettings();
  await saveSettings({ automationLanguage: { ...s.automationLanguage, [framework]: e.target.value } });
  renderPlaceholder(e.target.value);
});
$("referenceScript").addEventListener("input", async (e) => {
  const s = await getSettings();
  await saveSettings({ referenceScripts: { ...s.referenceScripts, [framework]: e.target.value } });
});
selection.subscribe(updateButton);

// ---------------------------------------------------------------------------
// Automate
// ---------------------------------------------------------------------------

const STAGE_TEXT = { calling: "Waiting for the model…", parsing: "Reading the response…" };

async function automate() {
  const testCases = selection.selectedCases();
  if (!testCases.length) return;
  const fw = framework;
  busy = true;
  $("automateBtn").disabled = true;
  $("automateBtn").classList.add("is-busy");
  $("autoProgress").hidden = false;
  $("automateBtn").querySelector(".btn-ico use")?.setAttribute("href", "#i-loader");
  ($("automateBtn").querySelector(".btn-label") || $("automateBtn")).textContent = `Generating ${frameworkLabel(fw)} script…`;
  status("", `Converting ${testCases.length} test case(s) to ${frameworkLabel(fw)}…`);
  try {
    const s = await getSettings();
    // Prefer the recording the manual cases were generated from.
    let { [KEYS.context]: ctx } = await chrome.storage.local.get(KEYS.context);
    if (!ctx) {
      const [{ [KEYS.events]: events = [] }, page] = await Promise.all([chrome.storage.local.get(KEYS.events), pageSnapshot()]);
      ctx = { events, page };
    }
    const payload = {
      provider: s.provider,
      model: $("model").value,
      temperature: Number(s.temperature),
      reasoningEffort: s.reasoningEffort,
      framework: fw,
      language: $("automationLanguage").value,
      referenceScript: $("referenceScript").value,
      testCases,
      events: ctx.events,
      page: ctx.page,
    };
    const reply = await runJob("automate", payload, (stage) => status("", STAGE_TEXT[stage] || "Generating script…"));
    if (!reply.ok) throw new Error(reply.error || "Script generation failed.");
    // The SW has already stored it on the result as `.automation`.
    renderAutomation(reply.result);
    status("", `Generated ${frameworkLabel(fw)} script for ${reply.result.caseIds.length} test case(s) in ${(reply.result.meta.durationMs / 1000).toFixed(1)}s.`);
  } catch (err) {
    status("err", err.message);
  } finally {
    busy = false;
    updateButton();
  }
}

$("automateBtn").addEventListener("click", automate);

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

function renderAutomation(auto) {
  lastAutomation = auto?.code ? auto : null;
  $("automationResult").hidden = !lastAutomation;
  if (!lastAutomation) return;
  $("automationTitle").textContent = `${frameworkLabel(auto.framework)} script${auto.language ? ` · ${auto.language}` : ""}`;
  const u = auto.usage;
  $("automationMeta").textContent = [
    auto.caseIds?.length ? auto.caseIds.join(", ") : null,
    auto.meta?.usedReference === false ? "default conventions" : auto.meta?.usedReference ? "follows reference script" : null,
    auto.meta?.model,
    u ? `${u.inputTokens.toLocaleString()} in · ${u.outputTokens.toLocaleString()} out · ${formatUsd(u.cost)}` : null,
  ].filter(Boolean).join(" · ");
  $("automationWarnings").replaceChildren(...(auto.warnings || []).map((w) => el("div", { class: "banner warn", role: "alert", text: w })));
  $("automationGaps").hidden = !auto.gaps?.length;
  $("gapList").replaceChildren(...(auto.gaps || []).map((g) => el("li", { text: g })));
  $("automationCode").textContent = auto.code;
}

$("copyCode").addEventListener("click", (e) => lastAutomation && copyText(lastAutomation.code, e.currentTarget).catch((err) => status("err", err.message)));
$("downloadCode").addEventListener("click", () => {
  if (lastAutomation) download({ filename: scriptFilename(lastAutomation), content: lastAutomation.code, type: "text/plain;charset=utf-8" });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[KEYS.results]) renderAutomation(changes[KEYS.results].newValue?.automation);
});

(async function init() {
  const [settings, stored, session] = await Promise.all([
    getSettings(),
    chrome.storage.local.get(KEYS.results),
    chrome.storage.session.get(KEYS.job).catch(() => ({})),
  ]);
  renderOptions(settings);
  renderAutomation(stored[KEYS.results]?.automation);
  const job = session[KEYS.job]?.kind === "automate" ? session[KEYS.job] : null;
  if (job?.interrupted) {
    status("err", "Script generation interrupted, try again.");
    await chrome.storage.session.remove(KEYS.job);
  } else if (job) {
    status("", "A script generation started earlier is still running; the script will appear here.");
  }
})();
