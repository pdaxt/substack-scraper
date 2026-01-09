#!/usr/bin/env node
/**
 * Substack Subscriber Scraper
 *
 * Export your Substack subscriber list to CSV/JSON.
 * Works with any list size (tested up to 10k+ subscribers).
 *
 * Author: Pran (BSKiller.substack.com)
 * License: MIT
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    // Your Substack publication name (the part before .substack.com)
    // Example: for "mynewsletter.substack.com", use "mynewsletter"
    PUBLICATION: process.env.SUBSTACK_PUBLICATION || 'YOUR_PUBLICATION_NAME',

    // Chrome DevTools Protocol port (default 9222)
    CDP_PORT: process.env.CDP_PORT || 9222,

    // Output directory
    OUTPUT_DIR: process.env.OUTPUT_DIR || './exports'
};

// ============================================
// SCRAPER CLASS
// ============================================

class SubstackScraper {
    constructor() {
        this.ws = null;
        this.messageId = 0;
        this.pending = new Map();
        this.baseUrl = `https://${CONFIG.PUBLICATION}.substack.com`;
    }

    async connect() {
        const pages = await this.httpGet(`http://127.0.0.1:${CONFIG.CDP_PORT}/json/list`);

        let target = pages.find(p => p.type === 'page' && p.url.includes('substack.com'));
        if (!target) {
            target = pages.find(p => p.type === 'page' && !p.url.startsWith('chrome://'));
        }

        if (!target) {
            throw new Error('No browser tab found. Open a tab in your browser first.');
        }

        console.log(`Connecting to: ${target.title || target.url}`);

        return new Promise((resolve, reject) => {
            const WebSocket = require('ws');
            this.ws = new WebSocket(target.webSocketDebuggerUrl);

            this.ws.on('open', () => {
                console.log('Connected to browser\n');
                resolve();
            });

            this.ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.id && this.pending.has(msg.id)) {
                    const { resolve, reject } = this.pending.get(msg.id);
                    this.pending.delete(msg.id);
                    if (msg.error) reject(new Error(msg.error.message));
                    else resolve(msg.result);
                }
            });

            this.ws.on('error', reject);
        });
    }

    httpGet(url) {
        return new Promise((resolve, reject) => {
            http.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(e); }
                });
            }).on('error', reject);
        });
    }

    async send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));

            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error(`Timeout: ${method}`));
                }
            }, 30000);
        });
    }

    async navigate(url) {
        await this.send('Page.navigate', { url });
        await this.sleep(3000);
    }

    async evaluate(expression) {
        const result = await this.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        });
        return result.result?.value;
    }

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    disconnect() {
        if (this.ws) this.ws.close();
    }

    async scrapeSubscribers() {
        console.log('Scraping subscriber list...');
        await this.navigate(`${this.baseUrl}/publish/subscribers`);
        await this.sleep(2000);

        const allSubscribers = [];
        let previousCount = 0;
        let noNewDataCount = 0;
        const MAX_NO_NEW_DATA = 5;

        console.log('Scrolling to load all subscribers (this may take a while for large lists)...\n');

        while (noNewDataCount < MAX_NO_NEW_DATA) {
            const subscribers = await this.evaluate(`
                (() => {
                    const subs = [];
                    document.querySelectorAll('table tbody tr').forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 4) {
                            const email = cells[1]?.innerText?.trim() || '';
                            const tier = cells[2]?.innerText?.trim()?.toLowerCase() || '';
                            const date = cells[4]?.innerText?.trim() || '';
                            const amount = cells[5]?.innerText?.trim() || '$0.00';

                            if (email && email.includes('@')) {
                                subs.push({
                                    email,
                                    tier: tier.includes('found') ? 'founding' :
                                          tier.includes('paid') ? 'paid' : 'free',
                                    subscribeDate: date,
                                    amountSpent: amount
                                });
                            }
                        }
                    });
                    return subs;
                })()
            `);

            const existingEmails = new Set(allSubscribers.map(s => s.email));
            const newSubs = subscribers.filter(s => !existingEmails.has(s.email));
            allSubscribers.push(...newSubs);

            if (allSubscribers.length === previousCount) {
                noNewDataCount++;
            } else {
                noNewDataCount = 0;
                previousCount = allSubscribers.length;
                process.stdout.write(`\rFound ${allSubscribers.length} subscribers...`);
            }

            await this.evaluate(`
                (() => {
                    const table = document.querySelector('table');
                    const scrollContainer = table?.closest('[style*="overflow"]') ||
                                           document.querySelector('[class*="subscriber"]')?.parentElement ||
                                           document.documentElement;

                    if (scrollContainer) {
                        scrollContainer.scrollTop = scrollContainer.scrollHeight;
                    }
                    window.scrollTo(0, document.body.scrollHeight);

                    const btn = [...document.querySelectorAll('button')]
                        .find(b => b.innerText.toLowerCase().includes('load more') ||
                                   b.innerText.toLowerCase().includes('show more'));
                    if (btn) btn.click();

                    return true;
                })()
            `);

            await this.sleep(1500);
        }

        console.log(`\nTotal subscribers: ${allSubscribers.length}\n`);
        return allSubscribers;
    }

    async scrapeStats() {
        console.log('Scraping stats...');
        await this.navigate(`${this.baseUrl}/publish/stats`);

        const stats = await this.evaluate(`
            (() => {
                const metrics = {};
                const text = document.body.innerText;

                const totalMatch = text.match(/(\\d[\\d,]*)\\s*(?:total\\s*)?subscribers?/i);
                if (totalMatch) metrics.totalSubscribers = parseInt(totalMatch[1].replace(/,/g, ''));

                const paidMatch = text.match(/(\\d[\\d,]*)\\s*paid/i);
                if (paidMatch) metrics.paidSubscribers = parseInt(paidMatch[1].replace(/,/g, ''));

                const freeMatch = text.match(/(\\d[\\d,]*)\\s*free/i);
                if (freeMatch) metrics.freeSubscribers = parseInt(freeMatch[1].replace(/,/g, ''));

                const openMatch = text.match(/(\\d+(?:\\.\\d+)?)[%]\\s*(?:open|opened)/i);
                if (openMatch) metrics.openRate = parseFloat(openMatch[1]);

                const clickMatch = text.match(/(\\d+(?:\\.\\d+)?)[%]\\s*(?:click|clicked)/i);
                if (clickMatch) metrics.clickRate = parseFloat(clickMatch[1]);

                return metrics;
            })()
        `);

        console.log('Stats:', stats, '\n');
        return stats;
    }
}

// ============================================
// MAIN
// ============================================

async function main() {
    // Check configuration
    if (CONFIG.PUBLICATION === 'YOUR_PUBLICATION_NAME') {
        console.log('');
        console.log('ERROR: Please configure your publication name!');
        console.log('');
        console.log('Option 1: Edit scraper.js and change PUBLICATION');
        console.log('Option 2: Set environment variable:');
        console.log('  SUBSTACK_PUBLICATION=yourname node scraper.js');
        console.log('');
        process.exit(1);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('         SUBSTACK SUBSCRIBER SCRAPER');
    console.log(`         Publication: ${CONFIG.PUBLICATION}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
        fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
    }

    const scraper = new SubstackScraper();

    try {
        await scraper.connect();

        const subscribers = await scraper.scrapeSubscribers();
        const stats = await scraper.scrapeStats();

        const date = new Date().toISOString().split('T')[0];
        const output = {
            publication: CONFIG.PUBLICATION,
            scrapedAt: new Date().toISOString(),
            stats,
            subscriberCount: subscribers.length,
            tierBreakdown: {
                free: subscribers.filter(s => s.tier === 'free').length,
                paid: subscribers.filter(s => s.tier === 'paid').length,
                founding: subscribers.filter(s => s.tier === 'founding').length
            },
            subscribers
        };

        // Save JSON
        const jsonPath = path.join(CONFIG.OUTPUT_DIR, `subscribers-${date}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
        console.log(`Saved: ${jsonPath}`);

        // Save CSV
        const csvPath = path.join(CONFIG.OUTPUT_DIR, `subscribers-${date}.csv`);
        const csvHeader = 'Email,Tier,Subscribe Date,Amount Spent\n';
        const csvRows = subscribers.map(s =>
            `"${s.email}","${s.tier}","${s.subscribeDate}","${s.amountSpent}"`
        ).join('\n');
        fs.writeFileSync(csvPath, csvHeader + csvRows);
        console.log(`Saved: ${csvPath}`);

        // Summary
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('                    SUMMARY');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Total Subscribers: ${subscribers.length}`);
        console.log(`  - Free: ${output.tierBreakdown.free}`);
        console.log(`  - Paid: ${output.tierBreakdown.paid}`);
        console.log(`  - Founding: ${output.tierBreakdown.founding}`);
        if (stats.openRate) console.log(`Open Rate: ${stats.openRate}%`);
        if (stats.clickRate) console.log(`Click Rate: ${stats.clickRate}%`);
        console.log('═══════════════════════════════════════════════════════');
        console.log('');

    } catch (error) {
        console.error('\nError:', error.message);
        console.error('');
        console.error('Troubleshooting:');
        console.error('1. Make sure Chrome/Opera is running with: --remote-debugging-port=9222');
        console.error('2. Make sure you\'re logged into Substack in that browser');
        console.error('3. Try opening your Substack dashboard first, then run this script');
        console.error('');
        process.exit(1);
    } finally {
        scraper.disconnect();
    }
}

// Check for ws dependency
try {
    require('ws');
} catch (e) {
    console.log('Installing required dependency (ws)...');
    require('child_process').execSync('npm install ws', { stdio: 'inherit' });
}

main();
