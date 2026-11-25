import { describe, expect, it } from "vitest";
import { extractEntities } from "../lib/extract";
import { runRule, runRules, RULE_IDS } from "../lib/rules";
import { SAMPLES, TELEGRAM_SAMPLE_TEXT } from "../lib/samples";

type Id = (typeof RULE_IDS)[number];
const fires = (id: Id, t: string) => runRule(id, t, extractEntities(t)).length > 0;

const FIXTURES: Record<Id, { pos: string[]; neg: string[] }> = {
  R_PAYMENT_REQUEST: {
    pos: [
      "Pay the registration fee of ₹1,500 to confirm your internship.",
      "A refundable security deposit of Rs. 2000 is required before joining.",
      "Training kit charges ₹999 must be paid today.",
      "Registration ke liye ₹499 bhejo is UPI pe.",
      "Please pay via UPI to hr.jobs@okaxis to activate your ID.",
      "Scan the QR code and send the amount to book your slot.",
    ],
    neg: [
      "Your CTC is ₹6,00,000 per annum. The interview is on Monday.",
      "There is no fee at any stage of our hiring process.",
      "Reimbursement of travel up to ₹2,000 will be paid with your first salary.",
      "We will pay your stipend of ₹20,000 into your bank account monthly after joining.",
    ],
  },
  R_UPI_OR_CRYPTO: {
    pos: ["Send to 9876543210@paytm", "Deposit 50 USDT (TRC20) to start earning", "Buy an Amazon gift card and share the code", "UPI id: hr.desk@ybl"],
    neg: ["Email us at jobs@tcs.com", "Our crypto-free payroll runs on the 1st", "Upload your resume on the portal"],
  },
  R_PERSONAL_DOCS: {
    pos: [
      "Send your Aadhaar card and PAN card on WhatsApp to get selected.",
      "Share the OTP you receive to verify your job ID.",
      "Send a selfie with your ID and bank account details.",
      "Please provide your debit card number for salary setup.",
    ],
    neg: [
      "After your interview, HR will collect your PAN card for payroll onboarding.",
      "Please bring your college ID to the interview.",
      "Your offer letter is attached. No documents needed yet.",
    ],
  },
  R_FREEMAIL_RECRUITER: {
    pos: [
      "HR Team, Wipro — contact wipro.hr.desk@gmail.com",
      "Recruitment cell: careers.tcs.jobs@yahoo.com",
      "For the internship, reply to accenture-hiring@outlook.com",
    ],
    neg: [
      "HR Team — contact campus@wipro.com",
      "My personal email is priya@gmail.com, lets catch up for coffee",
      "Recruiting: university@microsoft.com",
    ],
  },
  R_TASK_SCAM: {
    pos: [
      "Like YouTube videos and earn ₹50 per like, ₹3000 daily!",
      "Rate hotels on Google Maps. Each task pays ₹150.",
      "Complete simple tasks and get daily income. First prepaid task ₹1,000.",
    ],
    neg: [
      "Please review the attached offer letter and sign it.",
      "You will write daily reports for the product team.",
      "Rate your interview experience on our feedback form.",
    ],
  },
  R_TOO_GOOD_PAY: {
    pos: [
      "Earn ₹5,000 per day, part-time, no skills needed.",
      "Make $200 a day from your phone.",
      "Earn money from home! No experience required.",
    ],
    neg: [
      "Stipend: ₹15,000 per month.",
      "Daily standup at 10am. Salary ₹40,000 monthly.",
      "Earn certificates from home courses with prior experience in Python.",
    ],
  },
  R_NO_INTERVIEW: {
    pos: [
      "You are selected without interview for Data Entry.",
      "Direct joining available, no interview required.",
      "Congratulations, you have been selected for the role. Pay the fee to proceed.",
    ],
    neg: [
      "You have been shortlisted for the technical interview round.",
      "Your interview is scheduled for Friday at 3 PM.",
      "Thanks for applying. We will review your application.",
    ],
  },
  R_OFF_PLATFORM: {
    pos: [
      "Join our group: t.me/earn_daily_jobs",
      "Contact HR on Telegram for the next steps.",
      "Message us on WhatsApp: wa.me/919000000000",
    ],
    neg: [
      "Contact us at hiring@zomato.com for questions.",
      "Join the Teams call at the scheduled time.",
      "The interview will happen on Google Meet.",
      "Reply to campus@infosys.com or ping HR on WhatsApp for logistics.",
    ],
  },
  R_URL_SHORTENER: {
    pos: ["Apply: https://bit.ly/job-apply", "Form: tinyurl.com/intern2026", "Details at https://cutt.ly/xyz"],
    neg: ["Apply: https://careers.google.com", "Form: https://forms.gle/abc", "Read www.infosys.com/careers"],
  },
  R_SUSPICIOUS_TLD: {
    pos: ["Visit www.hr-careers.online", "Register at quickjobs.xyz", "Login: https://tasks-earn.top/login"],
    neg: ["Visit www.tcs.com", "Apply at careers.wipro.com", "Portal: https://internshala.com/x"],
  },
  R_URGENCY: {
    pos: ["Reply within 24 hours or the offer lapses.", "Limited seats! Last date today.", "Join immediately to secure your spot."],
    neg: ["Take your time to review the offer.", "The deadline is December 15.", "Let us know at your convenience."],
  },
  R_GENERIC_GREETING_OFFER: {
    pos: [
      "Dear Candidate, you have been selected.",
      "Dear Applicant, congratulations on your offer.",
      "Dear Student, you are shortlisted for the internship.",
    ],
    neg: ["Dear Ananya, you have been selected.", "Dear Candidate, thank you for attending the career fair.", "Hello, your offer is attached."],
  },
};

describe("rule fixtures", () => {
  for (const id of RULE_IDS) {
    const f = FIXTURES[id];
    it(`${id} has ≥3 positive and ≥3 negative fixtures`, () => {
      expect(f.pos.length).toBeGreaterThanOrEqual(3);
      expect(f.neg.length).toBeGreaterThanOrEqual(3);
    });
    for (const t of f.pos) it(`${id} fires on: ${t.slice(0, 50)}`, () => expect(fires(id, t)).toBe(true));
    for (const t of f.neg) it(`${id} stays quiet on: ${t.slice(0, 50)}`, () => expect(fires(id, t)).toBe(false));
  }
});

const LEGIT_OFFER = `Dear Rahul,

Following your interviews on 12 November, we are pleased to offer you the position of Graduate Engineer Trainee at Tata Consultancy Services, Pune. Your annual CTC will be ₹7,00,000.

Please review the attached offer letter and confirm acceptance on the NextStep portal by 10 December. Your joining date is 2 January 2027.

For questions, write to campus.hiring@tcs.com.

Regards,
Campus Recruitment Team, TCS`;

describe("legitimate offer letter", () => {
  it("triggers no rule with weight ≥ 0.3", () => {
    const fired = runRules(LEGIT_OFFER, extractEntities(LEGIT_OFFER));
    expect(fired.filter((s) => s.weight >= 0.3).map((s) => s.id)).toEqual([]);
  });
  it("legit sample triggers no rule with weight ≥ 0.3", () => {
    const t = SAMPLES.find((s) => s.id === "legit-interview")!.text!;
    expect(runRules(t, extractEntities(t)).filter((s) => s.weight >= 0.3)).toEqual([]);
  });
});

describe("samples", () => {
  it("fee internship fires the expected rules", () => {
    const t = SAMPLES[0].text!;
    const ids = runRules(t, extractEntities(t)).map((s) => s.id);
    for (const id of ["R_PAYMENT_REQUEST", "R_UPI_OR_CRYPTO", "R_FREEMAIL_RECRUITER", "R_URGENCY", "R_SUSPICIOUS_TLD"]) {
      expect(ids).toContain(id);
    }
  });
  it("telegram task text fires task-scam rules", () => {
    const ids = runRules(TELEGRAM_SAMPLE_TEXT, extractEntities(TELEGRAM_SAMPLE_TEXT)).map((s) => s.id);
    for (const id of ["R_TASK_SCAM", "R_TOO_GOOD_PAY", "R_OFF_PLATFORM", "R_SUSPICIOUS_TLD"]) expect(ids).toContain(id);
  });
});

describe("property: evidence offsets are exact", () => {
  const all = [
    ...Object.values(FIXTURES).flatMap((f) => [...f.pos, ...f.neg]),
    LEGIT_OFFER,
    TELEGRAM_SAMPLE_TEXT,
    ...SAMPLES.filter((s) => s.text).map((s) => s.text!),
  ];
  it(`text.slice(start, end) === quote for all evidence across ${all.length} texts`, () => {
    let n = 0;
    for (const t of all) {
      for (const s of runRules(t, extractEntities(t))) {
        for (const e of s.evidence) {
          expect(t.slice(e.start, e.end)).toBe(e.quote);
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(50);
  });
});
