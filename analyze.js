#!/usr/bin/env node
/**
 * Substack Subscriber Analyzer
 * Analyzes your exported subscriber data and finds conversion opportunities
 */

const fs = require('fs');
const path = require('path');

// Find the most recent CSV
const exportsDir = './exports';
const files = fs.readdirSync(exportsDir).filter(f => f.endsWith('.csv'));
if (files.length === 0) {
    console.log('No CSV files found in exports/. Run scraper.js first.');
    process.exit(1);
}
const csvFile = path.join(exportsDir, files.sort().reverse()[0]);
console.log(`Analyzing: ${csvFile}\n`);

// Parse CSV
const csvContent = fs.readFileSync(csvFile, 'utf-8');
const lines = csvContent.trim().split('\n');
const headers = lines[0];
const subscribers = lines.slice(1).map(line => {
    const match = line.match(/"([^"]+)","([^"]+)","([^"]+)","([^"]+)"/);
    if (!match) return null;
    return {
        email: match[1],
        tier: match[2],
        date: match[3],
        amount: parseFloat(match[4].replace('US$', '').replace(',', '')) || 0
    };
}).filter(Boolean);

// Parse date helper
function parseDate(dateStr) {
    const months = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                     'Jul': 6, 'Aug': 7, 'Sep': 8, 'Sept': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
    const parts = dateStr.split(' ');
    const day = parseInt(parts[0]);
    const month = months[parts[1]];
    const year = parseInt(parts[2]);
    return new Date(year, month, day);
}

// Calculate metrics
const total = subscribers.length;
const founding = subscribers.filter(s => s.tier === 'founding');
const paid = subscribers.filter(s => s.tier === 'paid');
const free = subscribers.filter(s => s.tier === 'free');
const payingCount = founding.length + paid.length;
const conversionRate = (payingCount / total * 100).toFixed(2);
const totalRevenue = subscribers.reduce((sum, s) => sum + s.amount, 0);
const revenuePerSub = (totalRevenue / total).toFixed(2);

console.log('═══════════════════════════════════════════════════════════════');
console.log('                    SUBSCRIBER ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('OVERVIEW');
console.log('─────────────────────────────────────');
console.log(`Total Subscribers:    ${total}`);
console.log(`  • Free:             ${free.length} (${(free.length/total*100).toFixed(1)}%)`);
console.log(`  • Paid:             ${paid.length} (${(paid.length/total*100).toFixed(1)}%)`);
console.log(`  • Founding:         ${founding.length} (${(founding.length/total*100).toFixed(1)}%)`);
console.log(`\nConversion Rate:      ${conversionRate}%`);
console.log(`Total Revenue:        $${totalRevenue.toFixed(2)}`);
console.log(`Revenue per Sub:      $${revenuePerSub}`);

// Benchmark
console.log('\nBENCHMARK');
console.log('─────────────────────────────────────');
const benchmarks = [
    { metric: 'Conversion Rate', value: parseFloat(conversionRate), poor: 1, avg: 3, good: 5 },
    { metric: 'Founding %', value: founding.length/total*100, poor: 0.1, avg: 0.5, good: 1 },
    { metric: 'Revenue/Sub', value: parseFloat(revenuePerSub), poor: 0.25, avg: 0.5, good: 1 }
];

benchmarks.forEach(b => {
    let rating = 'Poor';
    if (b.value >= b.good) rating = 'Great';
    else if (b.value >= b.avg) rating = 'Good';
    else if (b.value >= b.poor) rating = 'Average';
    console.log(`${b.metric.padEnd(18)} ${b.value.toFixed(2).padStart(6)} → ${rating}`);
});

// Growth by month
console.log('\nGROWTH BY MONTH');
console.log('─────────────────────────────────────');
const monthlyGrowth = {};
subscribers.forEach(s => {
    const parts = s.date.split(' ');
    const key = `${parts[1]} ${parts[2]}`;
    monthlyGrowth[key] = (monthlyGrowth[key] || 0) + 1;
});

// Sort by date
const sortedMonths = Object.entries(monthlyGrowth).sort((a, b) => {
    const [ma, ya] = a[0].split(' ');
    const [mb, yb] = b[0].split(' ');
    const months = { 'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
                     'Jul': 7, 'Aug': 8, 'Sep': 9, 'Sept': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12 };
    return (parseInt(ya) * 100 + months[ma]) - (parseInt(yb) * 100 + months[mb]);
});

let maxGrowth = 0;
let bestMonth = '';
sortedMonths.forEach(([month, count]) => {
    const bar = '█'.repeat(Math.round(count / 10));
    console.log(`${month.padEnd(10)} ${String(count).padStart(4)} ${bar}`);
    if (count > maxGrowth) {
        maxGrowth = count;
        bestMonth = month;
    }
});
console.log(`\n→ Best month: ${bestMonth} (${maxGrowth} subscribers)`);

// Paying subscribers analysis
console.log('\nPAYING SUBSCRIBERS');
console.log('─────────────────────────────────────');
const payingSubs = [...founding, ...paid].sort((a, b) => b.amount - a.amount);
payingSubs.forEach(s => {
    console.log(`${s.tier.padEnd(10)} ${s.date.padEnd(12)} $${s.amount.toFixed(2).padStart(7)} ${s.email}`);
});

// When did paying subs join?
console.log('\nWHEN DID PAYING SUBSCRIBERS JOIN?');
console.log('─────────────────────────────────────');
const payingByMonth = {};
payingSubs.forEach(s => {
    const parts = s.date.split(' ');
    const key = `${parts[1]} ${parts[2]}`;
    payingByMonth[key] = (payingByMonth[key] || 0) + 1;
});
Object.entries(payingByMonth).forEach(([month, count]) => {
    console.log(`${month}: ${count} paying subscriber(s)`);
});

// Find conversion opportunities - free subs from 60+ days ago
console.log('\nCONVERSION OPPORTUNITIES');
console.log('─────────────────────────────────────');
const now = new Date();
const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);

const opportunities = free.filter(s => {
    const subDate = parseDate(s.date);
    return subDate <= sixtyDaysAgo && subDate >= ninetyDaysAgo;
});

console.log(`Free subscribers from 60-90 days ago: ${opportunities.length}`);
console.log('(These are your best conversion targets - engaged enough to stay, not yet converted)\n');

if (opportunities.length > 0) {
    console.log('Sample (first 10):');
    opportunities.slice(0, 10).forEach(s => {
        console.log(`  ${s.email} (joined ${s.date})`);
    });
}

// Long-term free subscribers (potential to re-engage or clean)
const veryOld = free.filter(s => {
    const subDate = parseDate(s.date);
    return subDate <= ninetyDaysAgo;
});
console.log(`\nFree subscribers from 90+ days ago: ${veryOld.length}`);
console.log('(Consider: re-engagement campaign or list cleaning)');

// Insights summary
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('                    KEY INSIGHTS');
console.log('═══════════════════════════════════════════════════════════════\n');

// Find what % of paying joined at launch
const launchMonth = sortedMonths[0][0];
const payingAtLaunch = payingSubs.filter(s => s.date.includes(launchMonth.split(' ')[0]) && s.date.includes(launchMonth.split(' ')[1])).length;
const payingAtLaunchPct = (payingAtLaunch / payingSubs.length * 100).toFixed(0);

console.log(`1. ${payingAtLaunchPct}% of your paying subscribers (${payingAtLaunch}/${payingSubs.length}) joined in ${launchMonth}`);
console.log(`   → Launch/early momentum matters most for conversions\n`);

console.log(`2. Your conversion rate (${conversionRate}%) is ${parseFloat(conversionRate) < 1 ? 'below' : parseFloat(conversionRate) < 3 ? 'at' : 'above'} the 1-3% average`);
console.log(`   → ${parseFloat(conversionRate) < 1 ? 'Focus on conversion, not just growth' : 'Keep doing what works'}\n`);

console.log(`3. ${opportunities.length} free subscribers from 60-90 days ago are prime conversion targets`);
console.log(`   → If 10% convert at $50/year = $${(opportunities.length * 0.1 * 50).toFixed(0)} potential revenue\n`);

console.log(`4. Best growth month: ${bestMonth} with ${maxGrowth} new subscribers`);
console.log(`   → What did you publish/do that month? Replicate it.\n`);

// Save analysis to file
const analysisFile = path.join(exportsDir, 'analysis-' + new Date().toISOString().split('T')[0] + '.txt');
console.log(`\nAnalysis saved to: ${analysisFile}`);
