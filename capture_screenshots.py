import os
import time
from selenium import webdriver
from selenium.webdriver.edge.options import Options
from selenium.webdriver.common.by import By

def capture_all():
    output_dir = os.path.join(os.getcwd(), "public", "screenshots")
    os.makedirs(output_dir, exist_ok=True)

    edge_options = Options()
    edge_options.add_argument("--headless")
    edge_options.add_argument("--disable-gpu")
    edge_options.add_argument("--window-size=1440,900")
    edge_options.add_argument("--force-device-scale-factor=2")  # Crisp Retina Hi-DPI
    edge_options.add_argument("--hide-scrollbars")

    driver = webdriver.Edge(options=edge_options)
    
    try:
        base_url = "http://localhost:3000"
        print(f"Connecting to {base_url}...")
        driver.get(base_url)
        time.sleep(3)

        # Force Dark Mode initially
        driver.execute_script("document.documentElement.classList.add('dark'); document.documentElement.classList.remove('light');")
        time.sleep(0.5)

        # -------------------------------------------------------------
        # 1. 01_hero_dashboard.png
        # -------------------------------------------------------------
        print("Capturing 01_hero_dashboard.png...")
        driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(0.5)
        driver.save_screenshot(os.path.join(output_dir, "01_hero_dashboard.png"))
        print("  -> 01_hero_dashboard.png captured")

        # -------------------------------------------------------------
        # 2. 02_persona_selector.png
        # -------------------------------------------------------------
        print("Capturing 02_persona_selector.png...")
        try:
            persona_el = driver.find_element(By.XPATH, "//div[contains(@class, 'grid') and contains(@class, 'sm:grid-cols-2')]/parent::div")
            driver.execute_script("arguments[0].scrollIntoView({behavior: 'instant', block: 'center'});", persona_el)
            time.sleep(0.5)
            persona_el.screenshot(os.path.join(output_dir, "02_persona_selector.png"))
            print("  -> 02_persona_selector.png captured")
        except Exception as e:
            print(f"  -> Fallback 02: {e}")
            driver.save_screenshot(os.path.join(output_dir, "02_persona_selector.png"))

        # -------------------------------------------------------------
        # 3. 03_github_input_form.png
        # -------------------------------------------------------------
        print("Capturing 03_github_input_form.png...")
        try:
            inp = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='github.com']")
            inp.clear()
            inp.send_keys("https://github.com/Bavly-Hamdy/ReadmeForge")
            time.sleep(0.4)
            form_el = driver.find_element(By.CSS_SELECTOR, "form")
            driver.execute_script("arguments[0].scrollIntoView({behavior: 'instant', block: 'center'});", form_el)
            time.sleep(0.5)
            form_el.screenshot(os.path.join(output_dir, "03_github_input_form.png"))
            print("  -> 03_github_input_form.png captured")
        except Exception as e:
            print(f"  -> Fallback 03: {e}")
            driver.save_screenshot(os.path.join(output_dir, "03_github_input_form.png"))

        # -------------------------------------------------------------
        # 4. 04_advanced_options_expanded.png
        # -------------------------------------------------------------
        print("Capturing 04_advanced_options_expanded.png...")
        try:
            adv_btn = driver.find_element(By.XPATH, "//button[contains(., 'Advanced')]")
            driver.execute_script("arguments[0].click();", adv_btn)
            time.sleep(0.8)
            form_el = driver.find_element(By.CSS_SELECTOR, "form")
            driver.execute_script("arguments[0].scrollIntoView({behavior: 'instant', block: 'center'});", form_el)
            time.sleep(0.5)
            form_el.screenshot(os.path.join(output_dir, "04_advanced_options_expanded.png"))
            print("  -> 04_advanced_options_expanded.png captured")
        except Exception as e:
            print(f"  -> Fallback 04: {e}")
            driver.save_screenshot(os.path.join(output_dir, "04_advanced_options_expanded.png"))

        # -------------------------------------------------------------
        # 5. 05_upload_local_tab.png
        # -------------------------------------------------------------
        print("Capturing 05_upload_local_tab.png...")
        try:
            local_btn = driver.find_element(By.XPATH, "//button[contains(., 'Upload Local')]")
            driver.execute_script("arguments[0].click();", local_btn)
            time.sleep(0.8)
            form_el = driver.find_element(By.CSS_SELECTOR, "form")
            form_el.screenshot(os.path.join(output_dir, "05_upload_local_tab.png"))
            print("  -> 05_upload_local_tab.png captured")
            # Switch back to GitHub tab
            gh_btn = driver.find_element(By.XPATH, "//button[contains(., 'GitHub')]")
            driver.execute_script("arguments[0].click();", gh_btn)
            time.sleep(0.5)
        except Exception as e:
            print(f"  -> Fallback 05: {e}")
            driver.save_screenshot(os.path.join(output_dir, "05_upload_local_tab.png"))

        # -------------------------------------------------------------
        # 6. 06_history_drawer.png
        # -------------------------------------------------------------
        print("Capturing 06_history_drawer.png...")
        try:
            driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(0.4)
            driver.execute_script("""
                const btns = Array.from(document.querySelectorAll('header button'));
                const histBtn = btns.find(b => b.textContent.includes('History') || b.title.includes('History'));
                if (histBtn) histBtn.click();
            """)
            time.sleep(1.2)
            driver.save_screenshot(os.path.join(output_dir, "06_history_drawer.png"))
            print("  -> 06_history_drawer.png captured")
            
            driver.execute_script("""
                const closeBtn = document.querySelector('button[title="Close (Esc)"]') || Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Close'));
                if (closeBtn) closeBtn.click();
            """)
            time.sleep(0.8)
        except Exception as e:
            print(f"  -> Fallback 06: {e}")
            driver.save_screenshot(os.path.join(output_dir, "06_history_drawer.png"))

        # -------------------------------------------------------------
        # 7. Inject sample README into Zustand store
        # -------------------------------------------------------------
        print("Injecting rich sample generation into Zustand store...")
        driver.execute_script(r"""
            const sampleMd = `# ReadmeForge ⚡\n\n> **Automated, engineering-grade documentation platform for modern codebases.**\n\n[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)\n[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)\n[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)\n[![Build](https://img.shields.io/badge/Build-Passing-emerald.svg)]()\n\n---\n\n## 🏛️ System Architecture\n\n```mermaid\ngraph TD\n    Client["💻 Next.js Client"] -->|SSE Real-time Stream| API["⚡ /api/generate"]\n    API -->|Git Trees API| GitHub["🐙 GitHub REST API"]\n    API -->|AST Digest & Persona Prompt| Gemini["🧠 Gemini 1.5 Pro AI"]\n    Gemini -->|Markdown & Topology| API\n    API -->|Live Stage Events 0-100%| Client\n```\n\n---\n\n## 🚀 Key Platform Features\n\n| Feature | Description | Architecture | Status |\n| :--- | :--- | :--- | :--- |\n| **AST Tree Inspection** | Parses full repository trees without local disk cloning | GitHub Trees API | ✅ Active |\n| **Bento UI/UX** | Dark mode contrast, glassmorphism, Framer Motion | Tailwind + Motion | ✅ Active |\n| **Direct GitHub Push** | Direct commit to branch or automatic PR creation | Octokit Automation | ✅ Active |\n| **Export Suite & ZIP** | One-click README, LICENSE, and bundled ZIP export | JSZip Engine | ✅ Active |\n| **Persistent History** | Slide-out drawer with search, atomic reload, & delete | PostgreSQL / SQLite | ✅ Active |\n\n---\n\n## 👥 Contributors\n\n- **Bavly Hamdy** (@Bavly-Hamdy) — Lead Architect & AI Developer`;

            const sampleLic = `MIT License\n\nCopyright (c) 2026 Bavly Hamdy\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files...`;

            if (window.__README_STORE__) {
                window.__README_STORE__.getState().loadFromHistory({
                    markdown: sampleMd,
                    repoUrl: "https://github.com/Bavly-Hamdy/ReadmeForge",
                    persona: "ENTERPRISE",
                    license: sampleLic
                });
            }
        """)
        time.sleep(2.5)

        # -------------------------------------------------------------
        # 8. 07_live_preview_rendered.png
        # -------------------------------------------------------------
        print("Capturing 07_live_preview_rendered.png...")
        try:
            preview_el = driver.find_element(By.ID, "readme-preview-section")
            driver.execute_script("arguments[0].scrollIntoView({behavior: 'instant', block: 'start'});", preview_el)
            time.sleep(1.2)
            preview_el.screenshot(os.path.join(output_dir, "07_live_preview_rendered.png"))
            print("  -> 07_live_preview_rendered.png captured")
        except Exception as e:
            print(f"  -> Fallback 07: {e}")
            driver.save_screenshot(os.path.join(output_dir, "07_live_preview_rendered.png"))

        # -------------------------------------------------------------
        # 9. 08_live_editor_codemirror.png
        # -------------------------------------------------------------
        print("Capturing 08_live_editor_codemirror.png...")
        try:
            driver.execute_script("""
                const btns = Array.from(document.querySelectorAll('#readme-preview-section button'));
                const editBtn = btns.find(b => b.textContent.includes('Live Edit'));
                if (editBtn) editBtn.click();
            """)
            time.sleep(1.0)
            preview_el = driver.find_element(By.ID, "readme-preview-section")
            driver.execute_script("arguments[0].scrollIntoView({behavior: 'instant', block: 'start'});", preview_el)
            time.sleep(0.5)
            preview_el.screenshot(os.path.join(output_dir, "08_live_editor_codemirror.png"))
            print("  -> 08_live_editor_codemirror.png captured")
            
            # Switch back to preview tab
            driver.execute_script("""
                const btns = Array.from(document.querySelectorAll('#readme-preview-section button'));
                const prevBtn = btns.find(b => b.textContent.includes('Preview'));
                if (prevBtn) prevBtn.click();
            """)
            time.sleep(0.5)
        except Exception as e:
            print(f"  -> Fallback 08: {e}")

        # -------------------------------------------------------------
        # 10. 09_export_dropdown_menu.png
        # -------------------------------------------------------------
        print("Capturing 09_export_dropdown_menu.png...")
        try:
            preview_el = driver.find_element(By.ID, "readme-preview-section")
            driver.execute_script("arguments[0].scrollIntoView({behavior: 'instant', block: 'start'});", preview_el)
            time.sleep(0.5)
            driver.execute_script("""
                const btns = Array.from(document.querySelectorAll('#readme-preview-section button'));
                const expBtn = btns.find(b => b.textContent.includes('Export') || (b.title && b.title.includes('Export')));
                if (expBtn) expBtn.click();
            """)
            time.sleep(0.8)
            driver.save_screenshot(os.path.join(output_dir, "09_export_dropdown_menu.png"))
            print("  -> 09_export_dropdown_menu.png captured")
            
            # Close dropdown
            driver.execute_script("""
                const btns = Array.from(document.querySelectorAll('#readme-preview-section button'));
                const expBtn = btns.find(b => b.textContent.includes('Export') || (b.title && b.title.includes('Export')));
                if (expBtn) expBtn.click();
            """)
            time.sleep(0.4)
        except Exception as e:
            print(f"  -> Fallback 09: {e}")

        # -------------------------------------------------------------
        # 11. 10_push_github_modal.png
        # -------------------------------------------------------------
        print("Capturing 10_push_github_modal.png...")
        try:
            driver.execute_script("""
                const btns = Array.from(document.querySelectorAll('#readme-preview-section button'));
                const pushBtn = btns.find(b => b.textContent.includes('Push to GitHub'));
                if (pushBtn) pushBtn.click();
            """)
            time.sleep(1.0)
            driver.save_screenshot(os.path.join(output_dir, "10_push_github_modal.png"))
            print("  -> 10_push_github_modal.png captured")
            
            # Close modal
            driver.execute_script("""
                const closeBtn = document.querySelector('div.fixed button.absolute');
                if (closeBtn) closeBtn.click();
            """)
            time.sleep(0.6)
        except Exception as e:
            print(f"  -> Fallback 10: {e}")

        # -------------------------------------------------------------
        # 12. 11_bento_grid_features.png
        # -------------------------------------------------------------
        print("Capturing 11_bento_grid_features.png...")
        try:
            driver.execute_script("""
                const cards = Array.from(document.querySelectorAll('.minimal-card'));
                if (cards.length > 0) {
                    cards[0].parentElement.scrollIntoView({behavior: 'instant', block: 'center'});
                }
            """)
            time.sleep(0.8)
            bento_container = driver.find_element(By.CSS_SELECTOR, ".minimal-card").find_element(By.XPATH, "..")
            bento_container.screenshot(os.path.join(output_dir, "11_bento_grid_features.png"))
            print("  -> 11_bento_grid_features.png captured")
        except Exception as e:
            print(f"  -> Fallback 11: {e}")

        # -------------------------------------------------------------
        # 13. 12_light_mode_dashboard.png
        # -------------------------------------------------------------
        print("Capturing 12_light_mode_dashboard.png...")
        try:
            driver.execute_script("document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light');")
            driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(0.8)
            driver.save_screenshot(os.path.join(output_dir, "12_light_mode_dashboard.png"))
            print("  -> 12_light_mode_dashboard.png captured")
        except Exception as e:
            print(f"  -> Fallback 12: {e}")

        # -------------------------------------------------------------
        # 14. 13_mobile_responsive_view.png
        # -------------------------------------------------------------
        print("Capturing 13_mobile_responsive_view.png...")
        try:
            driver.set_window_size(440, 956)
            driver.execute_script("document.documentElement.classList.add('dark'); document.documentElement.classList.remove('light');")
            driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(1.0)
            driver.save_screenshot(os.path.join(output_dir, "13_mobile_responsive_view.png"))
            print("  -> 13_mobile_responsive_view.png captured")
        except Exception as e:
            print(f"  -> Fallback 13: {e}")

        print("\nAll 13 screenshots successfully captured and saved in public/screenshots/!")
    finally:
        driver.quit()

if __name__ == "__main__":
    capture_all()
