// Prompt construction and response parsing for converting manual test cases
// into Playwright or Selenium scripts. Generation is strictly grounded: the
// user's reference script fixes the format, and locators / data / URLs may only
// come from the recording and page snapshot.

// "languages" fills the Language dropdown; "supported" limits which of them the
// extension generates code for. The rest are shown as "coming soon" and cannot
// be selected. The first supported language is the default.
export const FRAMEWORKS = {
  playwright: {
    label: "Playwright",
    languages: ["TypeScript", "Python", "JavaScript", "Java", "C#"],
    supported: ["TypeScript", "Python"],
    defaults: {
      TypeScript: "@playwright/test with `import { test, expect } from '@playwright/test'`, one `test.describe` block, one `test()` per case, web-first `expect` assertions, `page.getByRole` / `getByLabel` / `getByPlaceholder` / `locator()`.",
      Python: "pytest-playwright with the synchronous API: `import re` if needed and `from playwright.sync_api import Page, expect`, one module-level `def test_tc001_<short_name>(page: Page) -> None:` function per case using the built-in `page` fixture (no manual browser launch), web-first `expect(...)` assertions such as `to_have_url` / `to_be_visible` / `to_have_text`, and `page.get_by_role` / `get_by_label` / `get_by_placeholder` / `locator()`. Use snake_case Python API names everywhere (for example `frame_locator`, `content_frame`), never the camelCase JavaScript names.",
    },
  },
  selenium: {
    label: "Selenium",
    languages: ["Java", "Python", "C#", "JavaScript"],
    supported: ["Java", "Python", "C#"],
    defaults: {
      Java: "Selenium 4 with JUnit 5, `ChromeDriver` created in `@BeforeEach` and quit in `@AfterEach`, `By` locators, `WebDriverWait` + `ExpectedConditions` (no Thread.sleep), JUnit `Assertions`.",
      Python: "Selenium 4 with pytest, a `driver` fixture that creates `webdriver.Chrome()` and quits it after the test (yield), one `def test_tc001_<short_name>(driver) -> None:` function per case, `By` locators, `WebDriverWait` + `expected_conditions as EC` (no time.sleep), plain `assert` statements. Use snake_case Python names (find_element, send_keys, switch_to), never Java names.",
      "C#": "Selenium 4 with NUnit, a `[TestFixture]` class, `ChromeDriver` created in `[SetUp]` and quit/disposed in `[TearDown]`, one `[Test]` method per case, `By` locators, `WebDriverWait` with a lambda condition such as `wait.Until(d => d.FindElement(...))` (no Thread.Sleep), NUnit `Assert.That(...)` assertions. Use C# PascalCase names (FindElement, SendKeys, SwitchTo).",
    },
  },
};

const FENCE = { TypeScript: "typescript", Python: "python", Java: "java", "C#": "csharp" };

// Selenium API names for iframes and shadow DOM, per language.
const SELENIUM_API = {
  Java: {
    frame: "driver.switchTo().frame(driver.findElement(By.cssSelector(hop.selector)))",
    back: "driver.switchTo().defaultContent()",
    shadow: "getShadowRoot()",
    css: "By.cssSelector",
  },
  Python: {
    frame: "driver.switch_to.frame(driver.find_element(By.CSS_SELECTOR, hop.selector))",
    back: "driver.switch_to.default_content()",
    shadow: "element.shadow_root",
    css: "By.CSS_SELECTOR",
  },
  "C#": {
    frame: "driver.SwitchTo().Frame(driver.FindElement(By.CssSelector(hop.selector)))",
    back: "driver.SwitchTo().DefaultContent()",
    shadow: "element.GetShadowRoot()",
    css: "By.CssSelector",
  },
};

// Extra naming rule so a pasted reference in another language is not copied verbatim.
const NAMING_RULE = {
  "playwright:Python": "Use the Playwright Python API with snake_case names (get_by_role, frame_locator, to_have_url, ...), never the camelCase JavaScript names.",
  "selenium:Python": "Use the Selenium Python API with snake_case names (find_element, send_keys, switch_to.frame, shadow_root, ...), never the Java names.",
  "selenium:C#": "Use the Selenium C# API with PascalCase names (FindElement, SendKeys, SwitchTo().Frame, GetShadowRoot, ...), never the Java names.",
};

/** Languages the extension generates for, and whether `language` is one of them. */
export const supportedLanguages = (fw) => fw.supported || fw.languages;
export const isSupported = (fw, language) => supportedLanguages(fw).includes(language);

export function buildAutomationPrompt({ framework, language, referenceScript, testCases, events, page }) {
  const fw = FRAMEWORKS[framework];
  const hasReference = Boolean(referenceScript?.trim());
  const n = testCases.length;
  const sel = SELENIUM_API[language] || SELENIUM_API.Java;
  const namingRule = NAMING_RULE[`${framework}:${language}`];

  const formatRules = hasReference
    ? `STRICT FORMAT — THE REFERENCE SCRIPT IS THE TEMPLATE
- The user message contains a REFERENCE SCRIPT. Reproduce its format exactly: language, imports, package/namespace, class and method structure, setup/teardown hooks, how the driver/browser/page is created, locator strategy and syntax, wait strategy, assertion library and style, naming conventions, comment and logging style, indentation and brace/quote style.
- Change only test-specific content: test names, steps, locators, data and assertions.
- Do not add any import, library, dependency, helper, base class, page object, fixture, config file or utility that the reference does not already use. If the reference calls helpers or page objects, call only the methods the reference itself calls; never invent new methods on them.
- Keep the reference's file layout: if it is one test class/file, output one file containing one test per manual test case, in the same order as the cases.
${fw.supported ? `- Write the output in ${language} only, even if the reference is written in another language: carry its structure and conventions over to ${language}.` : `- The ${fw.label} language is whatever the reference is written in; ignore any other default.`}${namingRule ? `\n- ${namingRule}` : ""}`
    : `FORMAT — NO REFERENCE SCRIPT PROVIDED
- Write ${fw.label} in ${language} using: ${fw.defaults[language]}
- One file, one test per manual test case, in the same order as the cases. No page objects, helpers or extra dependencies.`;

  const system = `# PERSONA
You are a senior SDET who converts approved manual test cases into ${fw.label} automation scripts.
You never guess. Every locator, URL, value and expected text you write must be traceable to the inputs in the user message.

# INSTRUCTION
Convert EXACTLY ${n} manual test case(s) into automated tests. Each test's name (or a comment directly above it, in the template's style) must contain the manual case ID (e.g. TC-001) and follow the case's steps in order.

${formatRules}

NO HALLUCINATION — LOCATORS
- Use only locators built from attributes that appear in the RECORDED ACTIONS (target.id, target.name, target.selector, target.label, target.ariaLabel, target.placeholder, target.role, target.text, target.shadowPath, frame) or the PAGE SNAPSHOT (field id / name / selector / label / shadowPath, button text / id / selector / shadowPath, link text, frames[].framePath).
- Prefer, in order: id; name or data-test attributes inside a recorded selector; label / aria-label / placeholder; role plus visible text; the recorded CSS selector verbatim. If the template prefers a strategy (for example By.id or getByRole), use it whenever the needed attribute exists in the inputs.
- Never invent ids, class names, XPath structures, test ids, URLs or visible text.
- If a step needs an element that appears in neither source, do not guess. At that point write a comment "TODO: locator not captured for <element description>" in the template's comment style, and list it under GAPS.

IFRAMES AND SHADOW DOM
- "selector" is relative to the element's own document or shadow root, never to the top page.
- "frame" on a recorded action, and "framePath" on a snapshot entry under "frames", list the <iframe> elements that contain it, outermost first. Each hop's "selector" locates that <iframe> inside the previous frame (inside the hop's own "shadowPath", if it has one).
  - ${framework === "playwright" ? "Playwright (in Python the same methods are snake_case: frame_locator, content_frame): chain one page.frameLocator(hop.selector) per hop (or locator(hop.selector).contentFrame() if the template uses that), then locate the element inside the last frame. Do not use page.frame({ url }) unless the template does." : `Selenium: switch into each hop in order (${sel.frame}), act, then switch back with ${sel.back} before using any element outside that frame. Never leave the driver inside a frame at the end of a test.`}
  - A hop with "unresolved": true means the containing <iframe> could not be identified. Do not guess its locator: add a TODO and list it under GAPS.
- "shadowPath" on a target or snapshot entry lists the shadow hosts that contain it, outermost first. Each "host" selector is relative to the previous shadow root.
  - ${framework === "playwright" ? "Playwright: CSS and getBy* locators pierce open shadow roots automatically, so locate the element directly, scoped by page.locator(host) when its own selector is not unique. XPath does not pierce shadow DOM: never use XPath for these elements." : `Selenium: for each host in order, find it and open its shadow root (${sel.shadow}), then find the element on the last shadow root. Inside a shadow root use ${sel.css} only: XPath and other strategies are not supported there.`}
  - A host with "closed": true is a closed shadow root. ${framework === "playwright" ? "Playwright cannot reach inside closed shadow roots." : "WebDriver support for closed shadow roots depends on the browser driver."} Do not invent a workaround: add a TODO and list it under GAPS.
- If the template already has a helper for frames or shadow DOM, use that helper instead.

TEST DATA
- Take data from these sources, in order: (1) the manual case's testData; (2) the values the user entered during the recorded navigation (change/select/check events); (3) field labels, placeholders, select options and constraints (required, minLength, maxLength, min, max, pattern) from the snapshot, for negative and boundary variations.
- Use values verbatim, with the exact spelling and case.
- Values recorded as "••••••" or "<masked>" were hidden on purpose. Never guess them: put them in a clearly named variable set to a placeholder such as "<PASSWORD>" with a TODO comment (if the template reads secrets from env/config, follow that pattern instead), and list it under GAPS.

NAVIGATION AND ASSERTIONS
- Use only URLs from recorded navigate events or the snapshot url.
- Assert each case's expected results using only text, elements or URLs present in the inputs or stated literally in the case's expected result. If an expected result cannot be checked with the available information, add a TODO comment and list it under GAPS.

# OUTPUT FORMAT
Return exactly one fenced code block (\`\`\`${hasReference ? "<language of the reference>" : FENCE[language]}) containing the complete file, followed by:
GAPS:
- TC-00X: <what could not be automated and why>
Write "GAPS: none" if there are none. No other text before or after.

# TONE
Production-quality, deterministic test code. No explanations outside the GAPS list.`;

  const user = [
    `Convert these ${n} manual test case(s) to ${fw.label}${hasReference ? " following the reference script exactly" : ` (${language})`}.`,
    "",
    ...(hasReference ? ["## REFERENCE SCRIPT (strict template — copy its format)", "```", referenceScript.trim(), "```", ""] : []),
    `## MANUAL TEST CASES (${n})`,
    JSON.stringify(testCases.map(compactCase), null, 1),
    "",
    `## RECORDED ACTIONS (${events.length}) — with locators and the values the user entered`,
    events.length ? events.map((e, i) => `${i + 1}. ${JSON.stringify(compactEvent(e))}`).join("\n") : "No actions were recorded.",
    "",
    "## PAGE SNAPSHOT (iframe content, if any, is under \"frames\")",
    JSON.stringify(page ?? {}, null, 1),
    "",
    `Reminder: exactly ${n} test(s), only locators and data from the inputs above, then the GAPS list.`,
  ];

  return { system, user: user.join("\n") };
}

function compactCase(tc) {
  return {
    id: tc.id,
    title: tc.title,
    type: tc.type,
    priority: tc.priority,
    preconditions: tc.preconditions,
    testData: tc.testData,
    steps: tc.steps,
    expectedResult: tc.expectedResult,
  };
}

function compactEvent(e) {
  const out = { type: e.type };
  if (e.type === "navigate") {
    out.url = e.url;
    if (e.title) out.title = e.title;
    return out;
  }
  if (e.value !== undefined) out.value = e.value;
  if (e.checked !== undefined) out.checked = e.checked;
  if (e.key) out.key = e.key;
  if (e.url) out.pageUrl = e.url;
  if (e.frame) out.frame = e.frame;
  if (e.target) out.target = Object.fromEntries(Object.entries(e.target).filter(([, v]) => v !== undefined && v !== ""));
  return out;
}

/** Pull the code block and GAPS list out of the model reply. */
export function parseScript(text) {
  const reply = String(text || "");
  const fences = [...reply.matchAll(/```([\w#+-]*)[^\n]*\n([\s\S]*?)```/g)];
  // Use the longest fenced block: some models echo a short snippet before the real file.
  const best = fences.sort((a, b) => b[2].length - a[2].length)[0];
  let code = best ? best[2] : "";
  if (!best) {
    // No closing fence (e.g. truncated): take everything after an opening fence, or the whole reply.
    const open = reply.match(/```[\w#+-]*[^\n]*\n([\s\S]*)$/);
    code = (open ? open[1] : reply).split(/\n\s*GAPS:/i)[0];
  }

  const gapsText = reply.slice(reply.search(/GAPS:/i) >= 0 ? reply.search(/GAPS:/i) : reply.length);
  const gaps = /GAPS:\s*none/i.test(gapsText)
    ? []
    : gapsText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^[-*]\s+/.test(l))
        .map((l) => l.replace(/^[-*]\s+/, ""));

  const trimmed = code.replace(/\s+$/, "");
  return { code: trimmed.trim() ? `${trimmed}\n` : "", fence: fenceToLanguage(best?.[1]), gaps };
}

function fenceToLanguage(tag) {
  const t = String(tag || "").toLowerCase();
  const map = { ts: "TypeScript", typescript: "TypeScript", js: "JavaScript", javascript: "JavaScript", py: "Python", python: "Python", java: "Java", cs: "C#", csharp: "C#", "c#": "C#" };
  return map[t] || null;
}
