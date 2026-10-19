# 🧞 Job Genie

A Chrome extension that searches **LinkedIn, Indeed, Naukri, Monster/foundit and JobStreet** in one place, matches jobs to your CV, and shows posting age, salary and requirements on a single page.

## Features
- Upload your CV (PDF, DOCX or TXT). It is read **inside your browser** and never uploaded anywhere.
- Filters: job title, location, experience level, country, posted-within, salary range
- One results page for all portals, newest first, with posting age
- CV match %, matched skills and skill gaps for every job
- Seniority check, suitable positions, and a country scan for where your role is in demand
- "Open & apply" links straight to the posting

## Install (developer mode)
1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the folder that contains `manifest.json`.
4. Pin **Job Genie** and click **Upload CV & get matching jobs**.

## Project structure
| File | Purpose |
|---|---|
| `manifest.json` | Extension configuration (Manifest V3) |
| `popup.html / popup.js / popup.css` | Toolbar popup |
| `results.html / results.js / results.css` | Results page, CV matching, country scan |
| `common.js` | Shared helpers: search links, CV analysis, salary parsing |
| `icons/`, `images/` | Icons, banner and animated GIFs |
| `lib/` | Third-party libraries (pdf.js, JSZip) |

## Notes
- Job portals have no official public feeds and may block automated requests or change their formats. If a portal fails, its chip turns red with an "Open on site" link.
- Match %, seniority and country results are guides, not guarantees. Check visa and work-permit rules before applying abroad.
- Use responsibly and respect each portal's terms of service.

## Credits
Bundled libraries: [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0) and [JSZip](https://github.com/Stuk/jszip) (MIT or GPLv3).

## License
MIT. See [LICENSE](LICENSE).
