# Historical Price Tag

A Chrome extension that reframes prices on any web page in another year's money — so "$49.99" stops being an abstract number and becomes something you can actually feel.

It detects prices in **USD, GBP, EUR, and KES** as you browse, and adds a small badge next to each one showing what it would have cost (or will cost) in a year you choose, using real inflation data — not an exchange rate, not a guess.

---

## Features

- **Automatic detection** — scans page text for `$49.99`, `£849`, `899 €`, `KSh 100`, `Ksh45,000`, `500 KES`, etc.
- **Inflation-adjusted badges** — hover the ⏱ icon to see the equivalent price in your chosen reference year
- **Four currencies, four independent CPI series** — each currency is converted using its own country's inflation history, never a cross-currency exchange rate
- **Adjustable reference year** — pick any year via a slider (1913–2026, clamped per currency's available range)
- **Two badge styles** — subtle icon badge, or inline strikethrough with the converted price shown directly
- **Per-site disable** — turn it off for specific domains from the popup
- **Quick converter** — type any amount + year in the popup to get an instant conversion, independent of any page
- **Fully offline** — all CPI data is bundled with the extension; no network requests, no tracking, no accounts

---

## Currency coverage

| Currency | Symbol | Years covered | Source |
|---|---|---|---|
| US Dollar | `$` | 1913–2026 | U.S. Bureau of Labor Statistics, CPI-U (U.S. city average, all items) |
| British Pound | `£` | 1950–2026 | UK Office for National Statistics, CPI (2015=100). 1950–1987 uses a rescaled historical RPI series as an indicative estimate. |
| Euro | `€` | 1996–2026 | Eurostat / European Central Bank HICP, euro area (2025=100). The euro didn't circulate until 2002, so pre-2002 figures are a retrospective aggregate rather than a price anyone paid in euro notes. |
| Kenyan Shilling | `KSh` | 1960–2026 | World Bank / Kenya National Bureau of Statistics CPI (2010=100). 2018–2026 is chain-linked forward from reported annual inflation rates. |

If you set a reference year outside a currency's range (e.g. 1970 for EUR), the extension automatically clamps to the nearest year it has data for and notes this in the tooltip.

All data is annual averages. 2026 figures are partial-year estimates.

---

## Installation

This extension isn't on the Chrome Web Store yet, so it needs to be loaded manually:

1. Download and unzip the extension folder
2. Open `chrome://extensions` in Chrome
3. Turn on **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the unzipped folder
5. Reload any open tab — badges will start appearing automatically wherever a supported price format is found

---

## Using it

- Click the extension icon to open the popup:
  - Toggle the extension on/off
  - Set the reference year (slider or number input)
  - Choose which currencies to detect on the page
  - Pick badge style: icon only, or inline with the converted amount shown
  - Disable detection on the current site
  - Use the quick converter to check any amount/year combination directly
- **Settings changes apply on the next page load** — reload open tabs to see them take effect

---

## How it works

- A content script (`content.js`) walks the page's text nodes with a `TreeWalker`, matching currency patterns via regex, and wraps matched prices in a badge using data from `cpi-data.js`
- A `MutationObserver` catches dynamically loaded content (infinite scroll, SPAs) and re-scans new nodes
- All CPI tables are static JS objects bundled in `cpi-data.js` — conversion is just `amount × (index[toYear] / index[fromYear])`, computed entirely client-side
- Settings (`enabled`, `refYear`, `badgeStyle`, `currencies`, `disabledSites`) are stored via `chrome.storage.sync`

## File structure

```
historical-price-tag/
├── manifest.json      # Manifest V3 config
├── cpi-data.js        # Bundled CPI datasets for USD, GBP, EUR, KES
├── content.js         # Detects prices on the page and renders badges
├── content.css         # Badge and tooltip styling
├── popup.html/.css/.js # Extension popup UI (settings + quick converter)
└── icons/             # Extension icons
```

---

## Known limitations

- Only recognizes the specific formats above — no support for written-out amounts ("forty-nine dollars"), or currencies beyond USD/GBP/EUR/KES yet
- Pre-1988 GBP and 2018+ KES figures are reconstructed from reported inflation rates rather than pulled directly from a published index table — flagged in `cpi-data.js` comments
- Badge rendering doesn't currently re-run automatically when you change settings — a page reload is required
- CPI reflects a broad basket of goods; it won't perfectly match how any one category (housing, tech, groceries) has actually moved

---

## Disclaimer

Figures are provided for illustrative and educational comparison only, based on publicly available government and international statistical sources. They are not financial or investment advice.
