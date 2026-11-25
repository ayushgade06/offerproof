// Fictional examples. No real people, numbers or accounts. Domains in the scam samples were
// checked via RDAP on 2026-11-26 and were unregistered; the live result is whatever RDAP says today.

export interface Sample {
  id: string;
  label: string;
  hint: string;
  kind: "text" | "image";
  text?: string;
  imageSrc?: string;
}

export const SAMPLES: Sample[] = [
  {
    id: "fee-internship",
    label: "Internship with a fee",
    hint: "Email · asks for ₹1,999",
    kind: "text",
    text: `Dear Candidate,

Congratulations! You have been selected for the Python Developer Internship at Infosys Ltd. (6 months, stipend ₹25,000/month, work from home).

To confirm your seat, pay the ₹1,999 refundable training kit fee via UPI to hrdesk.infosys@ybl. The amount will be returned with your first stipend.

Download your offer letter and joining form at www.infosys-internship-desk.online and send a photo of your Aadhaar card and PAN card.

Please complete the payment within 24 hours, as seats are limited.

For queries contact hr.infosys.recruit@gmail.com

Regards,
Talent Acquisition Team
Infosys`,
  },
  {
    id: "telegram-task",
    label: "Telegram task job",
    hint: "Screenshot · \"rate hotels, earn daily\"",
    kind: "image",
    imageSrc: "/samples/telegram-task.png",
  },
  {
    id: "legit-interview",
    label: "Real-style interview invite",
    hint: "Email · no fees, real domain",
    kind: "text",
    text: `Hi Ananya,

Thanks for applying to the Software Engineering Intern (Summer 2027) role at Microsoft. Your application has moved to the next stage.

We'd like to schedule a 45-minute technical interview over Microsoft Teams next week. Please pick a slot that works for you here:
https://careers.microsoft.com/v2/global/en/schedule

The interview covers data structures and one coding problem. There is no preparation material to buy.

Best,
University Recruiting Team
Microsoft`,
  },
];

/** Text shown inside the screenshot sample (used to render the PNG and in tests). */
export const TELEGRAM_SAMPLE_TEXT = `HR Priya (Part-time Jobs)
Hello! Are you looking for a part-time job? 😊
Earn ₹3,000–₹8,000 daily by rating hotels on Google Maps. No experience needed, work from home, 20 minutes a day.
Each task pays ₹150. Join our Telegram group to start: t.me/hotelrate_daily_tasks
Your first prepaid task is ₹1,000 and you get ₹1,300 back instantly.
Register now at www.hotelrate-daily-earn.xyz — only 15 seats left today!
Contact: +91 90000 00000`;
