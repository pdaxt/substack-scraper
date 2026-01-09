#!/usr/bin/env node
/**
 * Substack Subscriber Analyzer
 * Analyzes your exported subscriber data and finds conversion opportunities
 */

const fs = require('fs');
const path = require('path');

// Find the most recent CSV
const exportsDir = './exports';
const files = fs.readdirSync(exportsDir).filter(f => f.startsWith('subscribers-') && f.endsWith('.csv'));
if (files.length === 0) {
    console.log('No CSV files found in exports/. Run scraper.js first.');
    process.exit(1);
}
const csvFile = path.join(exportsDir, files.sort().reverse()[0]);
console.log(`Analyzing: ${csvFile}\n`);

// Parse CSV (new format with Activity column)
const csvContent = fs.readFileSync(csvFile, 'utf-8');
const lines = csvContent.trim().split('\n');
const headers = lines[0];
const subscribers = lines.slice(1).map(line => {
    const match = line.match(/"([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)"/);
    if (!match) return null;
    return {
        email: match[1],
        tier: match[2],
        activity: parseInt(match[3]) || 0,
        date: match[4],
        amount: parseFloat(match[5].replace('US$', '').replace(',', '')) || 0
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

// Engagement Analysis
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('                    ENGAGEMENT ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════\n');

const activity5 = subscribers.filter(s => s.activity === 5);
const activity4 = subscribers.filter(s => s.activity === 4);
const activity3 = subscribers.filter(s => s.activity === 3);
const activity2 = subscribers.filter(s => s.activity === 2);
const activity1 = subscribers.filter(s => s.activity === 1);
const activity0 = subscribers.filter(s => s.activity === 0);

console.log('ENGAGEMENT BREAKDOWN');
console.log('─────────────────────────────────────');
console.log(`Activity 5/5 (Superfans):     ${String(activity5.length).padStart(4)} ${'█'.repeat(Math.round(activity5.length/10))}`);
console.log(`Activity 4/5 (Very Engaged):  ${String(activity4.length).padStart(4)} ${'█'.repeat(Math.round(activity4.length/10))}`);
console.log(`Activity 3/5 (Moderate):      ${String(activity3.length).padStart(4)} ${'█'.repeat(Math.round(activity3.length/10))}`);
console.log(`Activity 2/5 (Low):           ${String(activity2.length).padStart(4)} ${'█'.repeat(Math.round(activity2.length/10))}`);
console.log(`Activity 1/5 (Minimal):       ${String(activity1.length).padStart(4)} ${'█'.repeat(Math.round(activity1.length/10))}`);
console.log(`Activity 0/5 (None):          ${String(activity0.length).padStart(4)} ${'█'.repeat(Math.round(activity0.length/10))}`);

const highlyEngaged = activity5.length + activity4.length;
const engagementRate = (highlyEngaged / total * 100).toFixed(1);
console.log(`\nHighly Engaged (4-5):   ${highlyEngaged} (${engagementRate}% of list)`);

// Engaged free subscribers - PRIME TARGETS
const engagedFree5 = activity5.filter(s => s.tier === 'free');
const engagedFree4 = activity4.filter(s => s.tier === 'free');
const engagedFreeTotal = engagedFree5.length + engagedFree4.length;

console.log('\n🎯 PRIME CONVERSION TARGETS');
console.log('─────────────────────────────────────');
console.log(`Engaged FREE subscribers (4-5/5): ${engagedFreeTotal}`);
console.log(`  • Activity 5/5: ${engagedFree5.length} superfans who haven't converted`);
console.log(`  • Activity 4/5: ${engagedFree4.length} very engaged non-payers`);
console.log(`\nThese people READ EVERYTHING you send but haven't paid.`);
console.log(`They're your best conversion opportunity.\n`);

// Show paying subscriber engagement
const payingEngagement = [...founding, ...paid];
const payingHigh = payingEngagement.filter(s => s.activity >= 4).length;
console.log('PAYING SUBSCRIBER ENGAGEMENT');
console.log('─────────────────────────────────────');
console.log(`Paying subs with 4-5/5 activity: ${payingHigh}/${payingCount} (${(payingHigh/payingCount*100).toFixed(0)}%)`);
if (payingHigh === payingCount) {
    console.log('→ Great! All your paying subscribers are highly engaged.');
} else {
    console.log('→ Some paying subscribers have low engagement - churn risk.');
}

// Benchmark
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('                    BENCHMARKS');
console.log('═══════════════════════════════════════════════════════════════\n');

const benchmarks = [
    { metric: 'Conversion Rate', value: parseFloat(conversionRate), poor: 1, avg: 3, good: 5 },
    { metric: 'Founding %', value: founding.length/total*100, poor: 0.1, avg: 0.5, good: 1 },
    { metric: 'Revenue/Sub', value: parseFloat(revenuePerSub), poor: 0.25, avg: 0.5, good: 1 },
    { metric: 'Engagement (4-5)', value: parseFloat(engagementRate), poor: 20, avg: 30, good: 40 }
];

benchmarks.forEach(b => {
    let rating = 'Poor';
    if (b.value >= b.good) rating = 'Great';
    else if (b.value >= b.avg) rating = 'Good';
    else if (b.value >= b.poor) rating = 'Average';
    console.log(`${b.metric.padEnd(18)} ${b.value.toFixed(2).padStart(6)} → ${rating}`);
});

// Growth by month
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('                    GROWTH BY MONTH');
console.log('═══════════════════════════════════════════════════════════════\n');

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
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('                    PAYING SUBSCRIBERS');
console.log('═══════════════════════════════════════════════════════════════\n');

const payingSubs = [...founding, ...paid].sort((a, b) => b.amount - a.amount);
payingSubs.forEach(s => {
    const activityStars = '★'.repeat(s.activity) + '☆'.repeat(5 - s.activity);
    console.log(`${s.tier.padEnd(10)} ${activityStars} ${s.date.padEnd(12)} $${s.amount.toFixed(2).padStart(7)} ${s.email}`);
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

// Conversion opportunities by tenure + engagement
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('                    CONVERSION OPPORTUNITIES');
console.log('═══════════════════════════════════════════════════════════════\n');

const now = new Date();
const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);

// Best targets: Engaged (4-5) + been around 30-90 days
const primeTargets = free.filter(s => {
    const subDate = parseDate(s.date);
    return s.activity >= 4 && subDate <= thirtyDaysAgo && subDate >= ninetyDaysAgo;
});

console.log('TIER 1: HOT LEADS (Engaged + 30-90 days old)');
console.log('─────────────────────────────────────');
console.log(`Count: ${primeTargets.length}`);
console.log('These subscribers are engaged AND have been around long enough to know your value.\n');
if (primeTargets.length > 0) {
    console.log('Top 15:');
    primeTargets.slice(0, 15).forEach(s => {
        const activityStars = '★'.repeat(s.activity) + '☆'.repeat(5 - s.activity);
        console.log(`  ${activityStars} ${s.date.padEnd(12)} ${s.email}`);
    });
}

// Second tier: Highly engaged but newer (< 30 days)
const newEngaged = free.filter(s => {
    const subDate = parseDate(s.date);
    return s.activity >= 4 && subDate > thirtyDaysAgo;
});

console.log('\n\nTIER 2: WARM LEADS (Engaged + <30 days old)');
console.log('─────────────────────────────────────');
console.log(`Count: ${newEngaged.length}`);
console.log('Highly engaged but still new. Nurture them.\n');

// Third tier: Long-term engaged (90+ days)
const loyalFree = free.filter(s => {
    const subDate = parseDate(s.date);
    return s.activity >= 4 && subDate < ninetyDaysAgo;
});

console.log('TIER 3: LOYAL BUT FREE (Engaged + 90+ days)');
console.log('─────────────────────────────────────');
console.log(`Count: ${loyalFree.length}`);
console.log('These people love your content but haven\'t converted.');
console.log('Consider: Special offer, founding member push, or direct outreach.\n');

// Dead weight: Low engagement + old
const deadWeight = free.filter(s => {
    const subDate = parseDate(s.date);
    return s.activity <= 1 && subDate < ninetyDaysAgo;
});

console.log('⚠️  LIST CLEANING CANDIDATES (Low engagement + 90+ days)');
console.log('─────────────────────────────────────');
console.log(`Count: ${deadWeight.length}`);
console.log('Consider a re-engagement campaign or removing these to improve deliverability.\n');

// Insights summary
console.log('═══════════════════════════════════════════════════════════════');
console.log('                    ACTION PLAN');
console.log('═══════════════════════════════════════════════════════════════\n');

// Find what % of paying joined at launch
const launchMonth = sortedMonths[0][0];
const payingAtLaunch = payingSubs.filter(s => s.date.includes(launchMonth.split(' ')[0]) && s.date.includes(launchMonth.split(' ')[1])).length;
const payingAtLaunchPct = (payingAtLaunch / payingSubs.length * 100).toFixed(0);

console.log('IMMEDIATE ACTIONS:');
console.log('─────────────────────────────────────');
console.log(`1. Target your ${primeTargets.length} hot leads with a conversion CTA`);
console.log(`   → They read everything. Your next post IS your targeting.`);
console.log(`   → Potential: ${primeTargets.length} × 10% × $50 = $${(primeTargets.length * 0.1 * 50).toFixed(0)}/year\n`);

console.log(`2. Nurture your ${newEngaged.length} warm leads`);
console.log(`   → They're engaged but new. Keep delivering value.\n`);

console.log(`3. Special campaign for ${loyalFree.length} loyal-but-free subscribers`);
console.log(`   → They've been reading for 90+ days without converting.`);
console.log(`   → Try: Limited founding member offer, exclusive content, or direct ask.\n`);

if (deadWeight.length > 50) {
    console.log(`4. Consider cleaning ${deadWeight.length} unengaged subscribers`);
    console.log(`   → They hurt deliverability and don't add value.\n`);
}

console.log('INSIGHTS:');
console.log('─────────────────────────────────────');
console.log(`• ${payingAtLaunchPct}% of paying subs joined at launch → recreate launch energy`);
console.log(`• ${engagementRate}% engagement rate → ${parseFloat(engagementRate) >= 30 ? 'healthy list' : 'need to improve content or clean list'}`);
console.log(`• Conversion rate: ${conversionRate}% → ${parseFloat(conversionRate) < 1 ? 'focus on conversion, not just growth' : 'keep optimizing'}`);

// Save engaged subscribers to file
const engagedFile = path.join(exportsDir, 'engaged-subscribers-' + new Date().toISOString().split('T')[0] + '.csv');
const engagedContent = 'Email,Tier,Activity,Subscribe Date,Amount Spent\n' +
    [...engagedFree5, ...engagedFree4].map(s =>
        `"${s.email}","${s.tier}","${s.activity}","${s.date}","US$${s.amount.toFixed(2)}"`
    ).join('\n');
fs.writeFileSync(engagedFile, engagedContent);

// Save hot leads to file
const hotLeadsFile = path.join(exportsDir, 'hot-leads-' + new Date().toISOString().split('T')[0] + '.csv');
const hotLeadsContent = 'Email,Activity,Subscribe Date\n' +
    primeTargets.map(s => `"${s.email}","${s.activity}","${s.date}"`).join('\n');
fs.writeFileSync(hotLeadsFile, hotLeadsContent);

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`FILES SAVED:`);
console.log(`  • ${engagedFile} (${engagedFree5.length + engagedFree4.length} engaged free subs)`);
console.log(`  • ${hotLeadsFile} (${primeTargets.length} hot leads)`);
console.log(`═══════════════════════════════════════════════════════════════\n`);
