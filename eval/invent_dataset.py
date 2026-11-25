"""Generate labeled synthetic offer messages with Adaption Invent.

Usage:  pip install -r requirements.txt
        ADAPTION_API_KEY=pt_live_... python invent_dataset.py            # estimate only; aborts if > 50 credits
        ADAPTION_API_KEY=pt_live_... python invent_dataset.py --yes      # generate and download

Writes eval/data/invent_scam.jsonl and eval/data/invent_legit.jsonl.
Instruction = the message; response = "SCAM: <tactic>" or "LEGIT".
"""
import argparse
import sys
import time
from pathlib import Path

from adaption import Adaption

ROWS = 250
DATA = Path(__file__).parent / "data"

DATASETS = {
    "invent_scam": (
        "Realistic scam job and internship messages received by students and early-career job-seekers in India and "
        "globally: email, WhatsApp, Telegram, SMS, LinkedIn DM. Include fee requests (registration, training, "
        "refundable deposits), task scams (like/review/rating, prepaid tasks), impersonation of real-sounding "
        "companies from free email or fake domains, requests for ID or bank documents before any interview, crypto "
        "deposits, pressure tactics. Vary tone, grammar quality, and include Hinglish. Instruction = the message only; "
        "response = 'SCAM: ' followed by the main tactic."
    ),
    "invent_legit": (
        "Realistic legitimate recruiter and HR messages to students and early-career job-seekers: interview "
        "scheduling, application acknowledgements, rejections, offer letters without any fees, onboarding emails "
        "after an offer, recruiter outreach from corporate email addresses, informal startup founders recruiting with "
        "no fee. Some informal, some with typos. Instruction = the message only; response = 'LEGIT'."
    ),
}


def invent(client, name, prompt, estimate):
    return client.datasets.invent(
        name=f"offerproof-{name}",
        training_type="instruction_dataset",
        rows=ROWS,
        dataset_prompt=prompt,
        estimate=estimate,
        idempotency_key=f"offerproof-{name}-v1",
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--yes", action="store_true", help="generate (required; also overrides the 50-credit guard)")
    args = ap.parse_args()
    client = Adaption()

    total = 0.0
    for name, prompt in DATASETS.items():
        est = invent(client, name, prompt, estimate=True)
        print(f"{name}: estimated {est.estimated_credits} credits (available {est.available_credits})")
        total += est.estimated_credits
    print(f"total estimate: {total} credits")
    if not args.yes:
        if total > 50:
            sys.exit("Estimate is over 50 credits. Re-run with --yes to generate anyway.")
        print("Estimate only. Re-run with --yes to generate.")
        return

    DATA.mkdir(exist_ok=True)
    for name, prompt in DATASETS.items():
        ds = invent(client, name, prompt, estimate=False)
        print(f"{name}: launched dataset {ds.id}")
        while True:
            st = client.datasets.get_status(ds.id)
            print(f"  {st.status} {st.progress.percent if st.progress else ''}%")
            if st.status in ("succeeded", "failed"):
                break
            time.sleep(15)
        if st.status != "succeeded":
            print(f"  {name} failed: {st.error_data}")
        out = DATA / f"{name}.jsonl"
        out.write_bytes(client.datasets.download(ds.id, file_format="jsonl").read())
        print(f"  wrote {out} ({st.row_count} rows)")


if __name__ == "__main__":
    main()
