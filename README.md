# Substack Subscriber Scraper

Export your entire Substack subscriber list to CSV/JSON. Works with any list size (tested with 10k+ subscribers).

**Why?** Substack doesn't provide a built-in export for your full subscriber list with all details. This tool fills that gap.

## What You Get

- **CSV file** with: Email, Tier (free/paid/founding), Subscribe Date, Amount Spent
- **JSON file** with full data + stats (open rate, click rate, etc.)
- Works with **any subscriber count** (handles infinite scroll automatically)

## Quick Start

### 1. Install

```bash
git clone https://github.com/pdaxt/substack-scraper.git
cd substack-scraper
npm install
```

### 2. Start Browser with Debug Mode

**macOS:**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

**Windows:**
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**Linux:**
```bash
google-chrome --remote-debugging-port=9222
```

> You can also use Opera, Brave, or any Chromium-based browser.

### 3. Log Into Substack

In the browser you just opened, go to your Substack and log in.

### 4. Run the Scraper

```bash
SUBSTACK_PUBLICATION=yourname node scraper.js
```

Replace `yourname` with your publication name (the part before `.substack.com`).

**Example:** If your Substack is `coolnewsletter.substack.com`:
```bash
SUBSTACK_PUBLICATION=coolnewsletter node scraper.js
```

### 5. Get Your Files

Your exports will be in the `./exports` folder:
- `subscribers-YYYY-MM-DD.csv`
- `subscribers-YYYY-MM-DD.json`

### 6. Analyze Your Data

```bash
node analyze.js
```

This generates insights like:
- Conversion rate vs industry benchmarks
- Growth by month (visual chart)
- When your paying subscribers joined
- Conversion opportunities (engaged free subs)

## Sample Analysis Output

```
═══════════════════════════════════════════════════════════════
                    SUBSCRIBER ANALYSIS
═══════════════════════════════════════════════════════════════

OVERVIEW
─────────────────────────────────────
Total Subscribers:    854
  • Free:             848 (99.3%)
  • Paid:             3 (0.4%)
  • Founding:         3 (0.4%)

Conversion Rate:      0.70%
Total Revenue:        $1411.79
Revenue per Sub:      $1.65

═══════════════════════════════════════════════════════════════
                    ENGAGEMENT ANALYSIS
═══════════════════════════════════════════════════════════════

ENGAGEMENT BREAKDOWN
─────────────────────────────────────
Activity 5/5 (Superfans):      162 ████████████████
Activity 4/5 (Very Engaged):   155 ████████████████
Activity 1/5 (Minimal):        188 ███████████████████
Activity 0/5 (None):           349 ███████████████████████████████████

Highly Engaged (4-5):   317 (37.1% of list)

🎯 PRIME CONVERSION TARGETS
─────────────────────────────────────
Engaged FREE subscribers (4-5/5): 313
  • Activity 5/5: 159 superfans who haven't converted
  • Activity 4/5: 154 very engaged non-payers

═══════════════════════════════════════════════════════════════
                    CONVERSION OPPORTUNITIES
═══════════════════════════════════════════════════════════════

TIER 1: HOT LEADS (Engaged + 30-90 days old)
Count: 32
These subscribers are engaged AND have been around long enough.

TIER 2: WARM LEADS (Engaged + <30 days old)
Count: 64
Highly engaged but still new. Nurture them.

TIER 3: LOYAL BUT FREE (Engaged + 90+ days)
Count: 217
Consider: Special offer, founding member push, or direct outreach.

═══════════════════════════════════════════════════════════════
FILES SAVED:
  • exports/engaged-subscribers-2026-01-09.csv (313 engaged free subs)
  • exports/hot-leads-2026-01-09.csv (32 hot leads)
═══════════════════════════════════════════════════════════════
```

## Configuration Options

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `SUBSTACK_PUBLICATION` | (required) | Your publication name |
| `CDP_PORT` | 9222 | Browser debug port |
| `OUTPUT_DIR` | ./exports | Where to save files |

Or edit `scraper.js` directly and change the `CONFIG` object.

## Output Format

### CSV
```csv
Email,Tier,Subscribe Date,Amount Spent
"reader@email.com","free","9 Jan 2025","US$0.00"
"supporter@email.com","paid","5 Jan 2025","US$50.00"
"superfan@email.com","founding","1 Jan 2025","US$200.00"
```

### JSON
```json
{
  "publication": "yourname",
  "scrapedAt": "2025-01-09T12:00:00.000Z",
  "stats": {
    "totalSubscribers": 1234,
    "openRate": 45.2,
    "clickRate": 12.8
  },
  "subscriberCount": 1234,
  "tierBreakdown": {
    "free": 1200,
    "paid": 30,
    "founding": 4
  },
  "subscribers": [...]
}
```

## How It Works

1. Connects to your browser via Chrome DevTools Protocol (CDP)
2. Navigates to your Substack subscriber dashboard
3. Scrolls through the entire list (handles infinite scroll)
4. Extracts subscriber data from the page
5. Saves to CSV and JSON

**No API keys needed.** Uses your existing browser session.

## Troubleshooting

### "No browser tab found"
- Make sure Chrome/Opera is running with `--remote-debugging-port=9222`
- Open any tab in the browser before running the script

### "Connection refused"
- The browser isn't running in debug mode
- Check if another process is using port 9222: `lsof -i :9222`

### "Timeout" errors
- Your internet connection might be slow
- Try running the script again

### Script only gets ~50 subscribers
- The page might not be scrolling properly
- Try scrolling manually in the browser first, then run the script

## Requirements

- Node.js 18+
- Chrome, Opera, Brave, or any Chromium-based browser

## License

MIT - do whatever you want with it.

## Author

Built by [Pran](https://bskiller.substack.com) - I write about AI without the hype.

---

**Found this useful?** Star the repo and [subscribe to BSKiller](https://bskiller.substack.com) for more practical tools.
