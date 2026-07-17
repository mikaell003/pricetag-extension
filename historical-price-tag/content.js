// Historical Price Tag — content script
// Finds amounts in page text (USD, GBP, EUR, KES) and attaches a small badge
// showing what that price would have been (or will be) in a chosen reference
// year, using CPI data bundled in cpi-data.js. No network requests are made.

(function () {
  const DEFAULT_SETTINGS = {
    enabled: true,
    refYear: 1995,
    badgeStyle: "icon", // "icon" | "inline"
    currencies: ["USD", "GBP", "EUR", "KES"], // which currencies to detect
    disabledSites: []
  };

  // Each pattern captures the numeric amount in group 1. Order matters:
  // more specific / prefixed patterns are tried before bare-symbol ones so
  // "KSh" isn't accidentally swallowed by something looser.
  const NUM = "\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,2})?";
  const CURRENCY_PATTERNS = [
    { code: "KES", regex: new RegExp(`\\b(?:KSh|Ksh|KES|kes)\\.?\\s?(${NUM})\\b`, "gi") },
    { code: "KES", regex: new RegExp(`\\b(${NUM})\\s?(?:KSh|Ksh|KES|kes)\\b`, "gi") },
    { code: "GBP", regex: new RegExp(`£\\s?(${NUM})`, "g") },
    { code: "EUR", regex: new RegExp(`€\\s?(${NUM})`, "g") },
    { code: "EUR", regex: new RegExp(`(${NUM})\\s?€`, "g") },
    { code: "USD", regex: new RegExp(`\\$\\s?(${NUM})`, "g") }
  ];

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "NOSCRIPT", "SVG", "IFRAME"]);
  const PROCESSED_ATTR = "data-hpt-done";

  let settings = { ...DEFAULT_SETTINGS };
  let observer = null;

  function hostnameMatches(list, hostname) {
    return list.some(d => hostname === d || hostname.endsWith("." + d));
  }

  function parseAmount(text) {
    return parseFloat(text.replace(/[^0-9.]/g, ""));
  }

  function formatAmount(n, symbol) {
    const val = n >= 1000
      ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return symbol === "€" ? `${val} €` : `${symbol}${val}`;
  }

  function findMatches(text) {
    if (!settings.currencies.some(c => CURRENCY_PATTERNS.some(p => p.code === c))) return [];
    const found = [];
    for (const { code, regex } of CURRENCY_PATTERNS) {
      if (!settings.currencies.includes(code)) continue;
      regex.lastIndex = 0;
      let m;
      while ((m = regex.exec(text)) !== null) {
        found.push({ code, index: m.index, length: m[0].length, raw: m[0], amount: parseAmount(m[1]) });
      }
    }
    // Sort by position, drop overlaps (keep the first found at a given start).
    found.sort((a, b) => a.index - b.index);
    const result = [];
    let lastEnd = -1;
    for (const f of found) {
      if (f.index < lastEnd) continue;
      result.push(f);
      lastEnd = f.index + f.length;
    }
    return result;
  }

  function makeBadge(match) {
    const currency = CURRENCIES[match.code];
    if (!currency || isNaN(match.amount) || match.amount <= 0) return null;

    const toYear = clampYearForCurrency(settings.refYear, match.code);
    const fromYear = clampYearForCurrency(CPI_CURRENT_YEAR, match.code);
    const converted = cpiConvert(match.amount, fromYear, toYear, match.code);
    if (converted === null) return null;

    const wrapper = document.createElement("span");
    wrapper.className = "hpt-wrapper";
    wrapper.setAttribute(PROCESSED_ATTR, "1");

    const priceText = document.createElement("span");
    priceText.textContent = match.raw;
    if (settings.badgeStyle === "inline") {
      priceText.className = "hpt-inline-hidden";
    }
    wrapper.appendChild(priceText);

    const clampedNote = toYear !== settings.refYear ? ` (nearest available: ${toYear})` : "";
    const convertedText = formatAmount(converted, currency.symbol);

    const badge = document.createElement("span");
    badge.className = "hpt-badge";
    badge.textContent = settings.badgeStyle === "icon" ? "⏱" : `≈ ${convertedText} in ${toYear}`;

    const tooltip = document.createElement("span");
    tooltip.className = "hpt-tooltip";
    tooltip.textContent = `≈ ${convertedText} in ${toYear}${clampedNote}`;
    badge.appendChild(tooltip);

    wrapper.appendChild(badge);
    return wrapper;
  }

  function processTextNode(node) {
    const text = node.nodeValue;
    if (!text) return;
    const matches = findMatches(text);
    if (matches.length === 0) return;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    for (const m of matches) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      const badge = makeBadge(m);
      frag.appendChild(badge || document.createTextNode(m.raw));
      lastIndex = m.index + m.length;
    }
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    node.parentNode.replaceChild(frag, node);
  }

  function looksLikeCandidate(text) {
    if (!text) return false;
    return /[$€£]/.test(text) || /\b(ksh|kes)\b/i.test(text);
  }

  function walk(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const parent = n.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest(`[${PROCESSED_ATTR}], .hpt-wrapper`)) return NodeFilter.FILTER_REJECT;
        if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
        if (!looksLikeCandidate(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(processTextNode);
  }

  function startObserving() {
    if (observer) observer.disconnect();
    let pending = false;
    observer = new MutationObserver(mutations => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        for (const m of mutations) {
          m.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) walk(node);
          });
        }
      }, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    if (!settings.enabled) return;
    if (hostnameMatches(settings.disabledSites, location.hostname)) return;
    walk(document.body);
    startObserving();
  }

  function loadSettingsAndInit() {
    chrome.storage.sync.get(DEFAULT_SETTINGS, stored => {
      settings = { ...DEFAULT_SETTINGS, ...stored };
      init();
    });
  }

  chrome.storage.onChanged.addListener(changes => {
    for (const key of Object.keys(changes)) {
      settings[key] = changes[key].newValue;
    }
    // Settings changes apply on next page load, kept simple intentionally.
  });

  loadSettingsAndInit();
})();
