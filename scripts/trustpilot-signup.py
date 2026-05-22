"""Open Trustpilot Business signup, fill in Top Cash Cellular's info,
   stop at the verification step. Screenshots each step so we can show
   Skywalker where we got stuck (e.g. captcha)."""
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / "trustpilot-screens"
OUT.mkdir(exist_ok=True)

EMAIL = "sondorceus@gmail.com"
COMPANY = "Top Cash Cellular"
WEBSITE = "topcashcellular.com"
COUNTRY = "United States"
PASSWORD = "TopCash2026!Cellular"   # Skywalker can change after first login

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
)


def snap(pg, label):
    p = OUT / f"{label}.png"
    pg.screenshot(path=str(p), full_page=True)
    print(f"  saved {p.name}")


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(
            headless=False,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-site-isolation-trials",
            ],
        )
        ctx = b.new_context(
            user_agent=UA,
            viewport={"width": 1400, "height": 900},
            locale="en-US",
        )
        # Mask the standard webdriver flag — looks more human.
        ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
        )
        pg = ctx.new_page()
        print("Opening Trustpilot Business signup...")
        try:
            pg.goto("https://business.trustpilot.com/signup", wait_until="domcontentloaded", timeout=45000)
            pg.wait_for_load_state("load", timeout=20000)
            time.sleep(3)
        except Exception as e:
            print(f"  goto fail: {e}")
            snap(pg, "00-goto-fail")
            b.close()
            return 1
        time.sleep(2)
        snap(pg, "01-landing")

        # Dismiss any cookie banner — Trustpilot uses "Got it".
        for sel in [
            'button:has-text("Got it")',
            'button:has-text("Accept all")',
            'button:has-text("Accept")',
            'button:has-text("Allow all")',
        ]:
            try:
                # Click ALL matches in case there's nested banners.
                for handle in pg.query_selector_all(sel):
                    try:
                        handle.click(timeout=1500)
                        print(f"  dismissed: {sel}")
                    except Exception:
                        pass
                time.sleep(1)
            except Exception:
                pass

        snap(pg, "02-after-cookies")

        # Trustpilot's signup form lives inside a same-origin iframe
        # served by signup.business.trustpilot.com. Wait for it then
        # operate inside it directly.
        form_frame = None
        for _ in range(30):
            for f in pg.frames:
                if "signup.business.trustpilot.com" in (f.url or ""):
                    form_frame = f
                    break
            if form_frame:
                break
            time.sleep(0.5)

        if not form_frame:
            print("  signup-form-frame never appeared")
            snap(pg, "03-no-form-frame")
            b.close()
            return 1

        print(f"Form iframe: {form_frame.url}")
        try:
            form_frame.wait_for_load_state("load", timeout=10000)
        except Exception:
            pass
        time.sleep(2)

        # Dump what's inside the frame for diagnosis.
        frame_inputs = form_frame.evaluate("""
            () => Array.from(document.querySelectorAll('input,select,textarea'))
                .filter(el => { const r = el.getBoundingClientRect(); return r.width > 5 && r.height > 5; })
                .map(el => ({
                    tag: el.tagName, type: el.type, name: el.name||'', id: el.id||'',
                    placeholder: el.placeholder||'', ariaLabel: el.getAttribute('aria-label')||'',
                    autocomplete: el.autocomplete||'',
                }));
        """)
        print("Inputs inside signup iframe:")
        for fi in frame_inputs:
            print(f"  {fi}")

        def fill_by_id(input_id, value):
            try:
                form_frame.locator(f'#{input_id}').first.fill(value, timeout=3000)
                print(f"  filled #{input_id}")
                return True
            except Exception as e:
                print(f"  miss #{input_id}: {e}")
                return False

        fill_by_id("website", WEBSITE)
        fill_by_id("companyName", COMPANY)
        fill_by_id("firstName", "Top Cash")
        fill_by_id("lastName", "Cellular")
        fill_by_id("jobTitle", "Owner")
        fill_by_id("emailRoot", EMAIL)
        fill_by_id("phone", "5125550000")
        # Country: a styled dropdown — try clicking and picking US.
        try:
            pg.get_by_text("Country", exact=True).click(timeout=2000)
        except Exception:
            try:
                pg.locator('select').first.select_option(label="United States")
                print("  selected country via <select>")
            except Exception:
                pass
        try:
            pg.get_by_text("United States", exact=True).first.click(timeout=2000)
            print("  picked United States")
        except Exception:
            pass
        # Number of employees: pick smallest tier.
        try:
            pg.get_by_text("Number of employees", exact=True).click(timeout=2000)
            pg.get_by_text("1 - 10", exact=True).first.click(timeout=2000)
            print("  picked employees: 1-10")
        except Exception:
            pass

        # Keep the existing dump for debugging too.
        fields = pg.evaluate("""
            () => {
                const inputs = Array.from(document.querySelectorAll('input,select,textarea'));
                return inputs
                  .filter(el => {
                      const r = el.getBoundingClientRect();
                      return r.width > 5 && r.height > 5;
                  })
                  .map(el => ({
                      tag: el.tagName,
                      type: el.type,
                      name: el.name || '',
                      id: el.id || '',
                      placeholder: el.placeholder || '',
                      ariaLabel: el.getAttribute('aria-label') || '',
                      autocomplete: el.autocomplete || '',
                      value: el.value || '',
                  }));
            }
        """)
        print("Field state after fill attempt:")
        for f in fields:
            print(f"  {f}")

        snap(pg, "03-after-fill")

        # Try to click the primary submit / signup button (DON'T solve captcha).
        for sel in [
            'button:has-text("Sign up")',
            'button:has-text("Get started")',
            'button:has-text("Continue")',
            'button:has-text("Create account")',
            'button[type="submit"]',
        ]:
            try:
                if pg.is_visible(sel):
                    pg.click(sel, timeout=3000)
                    print(f"  clicked: {sel}")
                    break
            except Exception:
                pass
        time.sleep(4)
        snap(pg, "04-after-submit")

        # Final HTML title for debugging.
        title = pg.title()
        url = pg.url
        print(f"Final URL: {url}")
        print(f"Final title: {title}")

        b.close()
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
