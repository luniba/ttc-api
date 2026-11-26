# Certificate & transcript templates

Used by `CertificateDocumentsService` (`src/modules/candidates/certificate-documents/`) to generate
the candidate PDFs. nest-cli copies this folder to `dist/assets/certificates`.

| File | Page | Source |
|---|---|---|
| `certificate-digital.pdf` | 2560 × 1808 pt | `Certificate_Digital.pdf` |
| `certificate-print.pdf` | A4 landscape | `Certificate_Print.pdf` |
| `transcript-digital.pdf` | 1808 × 2560 pt | `Transcript_Digital_Editable.pdf` |
| `transcript-print.pdf` | 1808 × 2560 pt | `Transcript_Print_Editable.pdf` |

No blank originals exist, so these were made from filled-in examples with PyMuPDF:

- Redacted the name, the "issued upon completion of … course by" line, the certificate number and
  date (certificates), and a hidden stale number (`TTC‐1132‐0657`) left under the visible one.
- Digital certificate: painted the off-colour cover patches the editor left behind with the page
  colour `rgb(1, 0.941, 0.847)`, keeping the name underline.
- Transcripts: removed the form fields and the values printed beneath them. The 12 TEFL modules and
  their "A" results are part of the template.

Text positions are in `CERTIFICATE_LAYOUT` / `TRANSCRIPT_LAYOUT` in the service. If a designer
supplies new blanks, keep the page sizes or re-measure those positions.

## Fonts (SIL Open Font License, see `fonts/OFL-*.txt`)

- `EBGaramond-Italic.ttf`: the name on certificates. Made from Google Fonts' variable
  `EBGaramond-Italic[wght].ttf`:
  `fonttools varLib.instancer … wght=400 --static`, then
  `pyftsubset … --unicodes="U+0020-007E,U+00A0-024F,U+1E00-1EFF,U+2010-2027" --layout-features=kern`.
  It's embedded whole: pdf-lib's own subsetter drops glyphs from it.
- `Lato-Bold.ttf`: the course line on the digital certificate.
- `Lato-Regular.ttf`: fallback for characters the other fonts lack (e.g. "Ł", "Ş").
- Helvetica / Helvetica-Bold are PDF standard fonts, not files.
