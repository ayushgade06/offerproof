# Handwritten eval cases: provenance

`data/handwritten_cases.jsonl` holds 70 cases (35 scam, 35 legit). They were written by an AI agent (Claude) that did not see the detector's code, rules, tests or bundled data, so the cases were not tuned to what the detector looks for.

**No case is a real message, and no case was copied from a source.** Every message is fictional. Phone numbers use reserved or dummy ranges (+91 90000 0xxxx, +1 555-01xx), scam domains are made up, and people's names are invented. Real company names appear only in two ways: in scams that impersonate them (from free-mail or made-up lookalike domains), or in legit messages that use the company's real primary domain and never ask for money.

The scam patterns follow these public write-ups:

- [FTC: Job scams](https://consumer.ftc.gov/articles/job-scams): fake checks and equipment purchases, reshipping, upfront fees, and interviews over chat apps.
- [FTC: 2024 fraud data ($12.5B in reported losses)](https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024): the jump in job and task-scam losses.
- [Bitdefender: task scams](https://www.bitdefender.com/en-us/blog/hotforsecurity/easy-tasks-real-money-the-hidden-danger-behind-task-scams): like, review and rating tasks, prepaid "merchant" levels, and crypto top-ups.
- [Careers360: IIT Roorkee fake-internship warning](https://news.careers360.com/iit-roorkee-fake-internship-scam-warning-third-party-training-fraud-students-launched-global-spark-ihub): third parties that claim an IIT link and charge for "training" internships.
- [Business Today: internship offer that asked the intern to pay](https://www.businesstoday.in/latest/trends/story/company-ko-pocket-money-chahiye-techie-shares-rs23000-internship-offer-letter-but-with-an-unexpected-demand-533454-2026-05-27): an offer letter that pays a stipend but also asks the intern to pay the company.
