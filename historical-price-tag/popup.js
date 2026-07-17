const DEFAULT_SETTINGS = {
  enabled: true,
  refYear: 1995,
  badgeStyle: "icon",
  currencies: ["USD", "GBP", "EUR", "KES"],
  disabledSites: []
};

const enabledEl = document.getElementById("enabled");
const refYearEl = document.getElementById("refYear");
const refYearSliderEl = document.getElementById("refYearSlider");
const yearRangeNoteEl = document.getElementById("yearRangeNote");
const disableSiteEl = document.getElementById("disableSite");
const hostnameEl = document.getElementById("hostname");
const segBtns = document.querySelectorAll(".seg-btn");
const currencyListEl = document.getElementById("currencyList");
const quickCurrencyEl = document.getElementById("quickCurrency");
const quickAmountEl = document.getElementById("quickAmount");
const quickFromYearEl = document.getElementById("quickFromYear");
const quickResultEl = document.getElementById("quickResult");
const quickResultYearEl = document.getElementById("quickResultYear");

let currentHostname = null;
let settings = { ...DEFAULT_SETTINGS };

function save() {
  chrome.storage.sync.set(settings);
}

function setActiveSeg(style) {
  segBtns.forEach(b => b.classList.toggle("active", b.dataset.style === style));
}

function overallYearRange() {
  const codes = Object.keys(CURRENCIES);
  const min = Math.min(...codes.map(c => CURRENCIES[c].minYear));
  const max = Math.max(...codes.map(c => CURRENCIES[c].maxYear));
  return { min, max };
}

function renderCurrencyList() {
  currencyListEl.innerHTML = "";
  Object.keys(CURRENCIES).forEach(code => {
    const c = CURRENCIES[code];
    const row = document.createElement("label");
    row.className = "currency-row";
    row.innerHTML = `
      <input type="checkbox" class="currency-checkbox" data-code="${code}">
      <span class="currency-symbol">${c.symbol}</span>
      <span class="currency-name">${c.name}</span>
      <span class="currency-range">${c.minYear}–${c.maxYear}</span>
    `;
    currencyListEl.appendChild(row);
  });

  currencyListEl.querySelectorAll(".currency-checkbox").forEach(cb => {
    cb.checked = settings.currencies.includes(cb.dataset.code);
    cb.addEventListener("change", () => {
      const set = new Set(settings.currencies);
      if (cb.checked) set.add(cb.dataset.code);
      else set.delete(cb.dataset.code);
      settings.currencies = [...set];
      save();
    });
  });
}

function renderQuickCurrencyOptions() {
  quickCurrencyEl.innerHTML = "";
  Object.keys(CURRENCIES).forEach(code => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = `${CURRENCIES[code].symbol} ${code}`;
    quickCurrencyEl.appendChild(opt);
  });
  quickCurrencyEl.value = DEFAULT_CURRENCY;
}

function renderConverter() {
  const code = quickCurrencyEl.value;
  const amount = parseFloat(quickAmountEl.value);
  const fromYear = parseInt(quickFromYearEl.value, 10);
  const toYear = clampYearForCurrency(settings.refYear, code);
  const currency = CURRENCIES[code];

  if (isNaN(amount) || isNaN(fromYear) || !currency || !currency.data[fromYear]) {
    quickResultEl.textContent = "—";
    quickResultYearEl.textContent = "";
    return;
  }
  const result = cpiConvert(amount, fromYear, toYear, code);
  quickResultEl.textContent = result === null
    ? "—"
    : currency.symbol + result.toLocaleString("en-US", { maximumFractionDigits: 2 });
  quickResultYearEl.textContent = result === null ? "" : `in ${toYear}`;
}

function updateYearRangeNote() {
  const { min, max } = overallYearRange();
  refYearSliderEl.min = min;
  refYearSliderEl.max = max;
  refYearEl.min = min;
  refYearEl.max = max;
  yearRangeNoteEl.textContent = `Each currency clamps to its own available range (e.g. GBP from 1950, EUR from 1996, KES from 1960) if you pick a year outside it.`;
}

function init() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, stored => {
    settings = { ...DEFAULT_SETTINGS, ...stored };
    enabledEl.checked = settings.enabled;
    updateYearRangeNote();
    refYearEl.value = settings.refYear;
    refYearSliderEl.value = settings.refYear;
    setActiveSeg(settings.badgeStyle);
    renderCurrencyList();
    renderQuickCurrencyOptions();
    renderConverter();
  });

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0] && tabs[0].url) {
      try {
        currentHostname = new URL(tabs[0].url).hostname;
        hostnameEl.textContent = currentHostname;
        disableSiteEl.checked = settings.disabledSites.includes(currentHostname);
      } catch (e) {
        hostnameEl.textContent = "";
      }
    }
  });
}

enabledEl.addEventListener("change", () => {
  settings.enabled = enabledEl.checked;
  save();
});

refYearSliderEl.addEventListener("input", () => {
  refYearEl.value = refYearSliderEl.value;
  settings.refYear = parseInt(refYearSliderEl.value, 10);
  save();
  renderConverter();
});

refYearEl.addEventListener("change", () => {
  const { min, max } = overallYearRange();
  let y = parseInt(refYearEl.value, 10);
  y = Math.min(max, Math.max(min, y));
  refYearEl.value = y;
  refYearSliderEl.value = y;
  settings.refYear = y;
  save();
  renderConverter();
});

segBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    settings.badgeStyle = btn.dataset.style;
    setActiveSeg(settings.badgeStyle);
    save();
  });
});

disableSiteEl.addEventListener("change", () => {
  if (!currentHostname) return;
  const set = new Set(settings.disabledSites);
  if (disableSiteEl.checked) {
    set.add(currentHostname);
  } else {
    set.delete(currentHostname);
  }
  settings.disabledSites = [...set];
  save();
});

quickCurrencyEl.addEventListener("change", renderConverter);
quickAmountEl.addEventListener("input", renderConverter);
quickFromYearEl.addEventListener("input", renderConverter);

init();
