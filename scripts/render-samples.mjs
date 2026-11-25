// Renders fictional chat screenshots from HTML mocks (no real people, numbers or accounts).
// Usage: node scripts/render-samples.mjs   → public/samples/*.png and eval/screenshots/*.png
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const telegram = (title, lines, dark = false) => `
<html><body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:${dark ? "#0e1621" : "#c9d9b5"}">
<div style="width:420px;min-height:0;padding-bottom:16px;background:${dark ? "#0e1621" : "linear-gradient(#cfe1b9,#b7cfa2)"}">
  <div style="display:flex;justify-content:space-between;padding:8px 18px;font-size:13px;color:${dark ? "#fff" : "#111"}"><b>9:41</b><span>▂▄▆ 82%</span></div>
  <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;background:${dark ? "#17212b" : "#fff"};color:${dark ? "#fff" : "#000"}">
    <span style="font-size:22px;color:#3390ec">‹</span>
    <div style="width:38px;height:38px;border-radius:50%;background:#e8a33d;color:#fff;display:grid;place-items:center;font-weight:700">H</div>
    <div><div style="font-weight:600;font-size:15px">${esc(title)}</div><div style="font-size:12px;color:#8a9aa9">last seen recently</div></div>
  </div>
  <div style="padding:16px 12px;display:flex;flex-direction:column;gap:8px">
    ${lines
      .map(
        (l, i) => `<div style="max-width:84%;background:${dark ? "#182533" : "#fff"};color:${dark ? "#e9eef3" : "#111"};padding:8px 11px;border-radius:12px 12px 12px 4px;font-size:15px;line-height:1.38;box-shadow:0 1px 1px rgba(0,0,0,.12)">${esc(l)}<span style="float:right;margin:6px 0 0 10px;font-size:11px;color:#8a9aa9">10:2${i}</span></div>`
      )
      .join("")}
  </div>
</div></body></html>`;

const whatsapp = (title, lines, dark) => `
<html><body style="margin:0;font-family:Segoe UI,Roboto,Helvetica,sans-serif">
<div style="width:420px;min-height:0;padding-bottom:16px;background:${dark ? "#0b141a" : "#efeae2"}">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:${dark ? "#1f2c34" : "#008069"};color:#fff">
    <span>←</span><div style="width:36px;height:36px;border-radius:50%;background:#7a8a94"></div>
    <div><div style="font-weight:600">${esc(title)}</div><div style="font-size:12px;opacity:.8">online</div></div>
  </div>
  <div style="padding:14px 10px;display:flex;flex-direction:column;gap:6px">
    ${lines
      .map(
        (l, i) => `<div style="max-width:85%;background:${dark ? "#202c33" : "#fff"};color:${dark ? "#e9edef" : "#111b21"};padding:7px 10px;border-radius:0 8px 8px 8px;font-size:14.5px;line-height:1.4">${esc(l)}<div style="text-align:right;font-size:11px;color:#8696a0">11:0${i + 1} am</div></div>`
      )
      .join("")}
  </div>
</div></body></html>`;

const email = (from, subject, body) => `
<html><body style="margin:0;font-family:Arial,sans-serif;background:#f6f8fc">
<div style="width:720px;padding:24px;background:#fff">
  <div style="font-size:22px;color:#1f1f1f">${esc(subject)}</div>
  <div style="margin-top:14px;display:flex;gap:10px;align-items:center"><div style="width:40px;height:40px;border-radius:50%;background:#5f6368"></div>
  <div style="font-size:14px"><b>${esc(from)}</b><div style="color:#5f6368;font-size:12px">to me</div></div></div>
  <div style="margin-top:18px;font-size:14px;line-height:1.6;white-space:pre-wrap;color:#222">${esc(body)}</div>
</div></body></html>`;

const linkedin = (name, lines) => `
<html><body style="margin:0;font-family:-apple-system,Segoe UI,sans-serif;background:#f4f2ee">
<div style="width:460px;background:#fff;border:1px solid #ddd">
  <div style="padding:12px 16px;border-bottom:1px solid #eee;font-weight:600">${esc(name)} <span style="font-weight:400;color:#666;font-size:13px">· Talent Partner</span></div>
  <div style="padding:16px;display:flex;flex-direction:column;gap:12px;font-size:14px;line-height:1.5;color:#222">
    ${lines.map((l) => `<p style="margin:0">${esc(l)}</p>`).join("")}
  </div>
</div></body></html>`;

const SHOTS = [
  {
    out: "public/samples/telegram-task.png",
    html: telegram("HR Priya (Part-time Jobs)", [
      "Hello! Are you looking for a part-time job? 😊",
      "Earn ₹3,000–₹8,000 daily by rating hotels on Google Maps. No experience needed, work from home, 20 minutes a day.",
      "Each task pays ₹150. Join our Telegram group to start: t.me/hotelrate_daily_tasks",
      "Your first prepaid task is ₹1,000 and you get ₹1,300 back instantly.",
      "Register now at www.hotelrate-daily-earn.xyz — only 15 seats left today!",
      "Contact: +91 90000 00000",
    ]),
  },
  {
    out: "eval/screenshots/whatsapp-light-fee.png",
    html: whatsapp("+91 90000 00001", [
      "Congratulations!! You are selected for Data Entry work from home job in Amazon. Salary 28,000/month.",
      "Pay registration fees Rs 1,250 on this UPI amazon.jobs.hr@ybl to get your joining letter today.",
      "Send Aadhaar card and PAN card photo also. Limited seats!",
    ]),
  },
  {
    out: "eval/screenshots/whatsapp-dark-task.png",
    html: whatsapp("Ritu (YouTube Promotion)", [
      "Hi dear, simple online job: like YouTube videos and earn ₹50 per like.",
      "Daily income ₹2,000-₹5,000. Message me on Telegram @ritu_tasks_hr to start.",
      "First do 3 free tasks, then merchant task deposit ₹2,000 for 30% commission.",
    ], true),
  },
  {
    out: "eval/screenshots/telegram-dark-crypto.png",
    html: telegram("Global Remote Jobs HR", [
      "Remote product reviewer role, $120 a day, no interview required.",
      "To activate your work account, deposit 50 USDT (TRC20). It is fully refundable after your first week.",
      "Visit job-portal-remote.top/login to sign up within 24 hours.",
    ], true),
  },
  {
    out: "eval/screenshots/email-legit.png",
    html: email(
      "University Recruiting <university-recruiting@microsoft.com>",
      "Next steps: Software Engineering Intern interview",
      "Hi Rohan,\n\nThanks for your interest in the Software Engineering Intern role. We'd like to invite you to a 45-minute technical interview over Microsoft Teams.\n\nPlease choose a slot here: https://careers.microsoft.com/v2/global/en/schedule\n\nThere is no fee at any stage of our process.\n\nBest regards,\nUniversity Recruiting, Microsoft"
    ),
  },
  {
    out: "eval/screenshots/linkedin-lookalike.png",
    html: linkedin("Neha S.", [
      "Hi! I'm hiring for Infosys's remote QA internship (₹30,000/month).",
      "You're shortlisted based on your profile. Please complete onboarding at infosys-hr-onboarding.online and pay the ₹2,499 refundable laptop deposit.",
      "Reply ASAP, onboarding closes today.",
    ]),
  },
];

mkdirSync("public/samples", { recursive: true });
mkdirSync("eval/screenshots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const s of SHOTS) {
  await page.setContent(s.html, { waitUntil: "load" });
  const el = await page.$("body > div");
  await el.screenshot({ path: s.out });
  console.log("wrote", s.out);
}
await browser.close();
