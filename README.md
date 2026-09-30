# ActiveSaddler Project Page

Project page for **ActiveSaddler: Automated Curriculum Learning for Agent Harness Optimization**: https://autosaddler-projectpage.github.io/activesaddler/

It is built with Astro 6, MDX, React 19 and Tailwind v4, on [Roman Hauksson-Neill's project page template](https://research-template.roman.technology), and follows the AutoSaddler page.

## Develop

```bash
npm ci
npm run dev      # http://localhost:4321
npm run build    # astro check + static build into dist/
```

- All page content lives in `src/paper.mdx`, including the frontmatter (authors, links, description).
- To enable the Code and arXiv buttons, set `url` and remove `disabled: true` in the frontmatter.
- Update the BibTeX block when the arXiv ID is available.

## Interactive demos

`src/components/Curriculum/` holds two React islands. Both are driven by the real GAIA2 run (paper Run 1).

- **Curriculum Replay** (`CurriculumReplay.tsx`) animates each iteration in turn:
  1. The Exploration Controller's Draw/Pull decision, with its verbatim rationale.
  2. The Arm Prioritizer's softmax over the arm pool: a bar race plus a sampling needle.
  3. The optimizer's outcome.
  4. A scrubbable timeline of best dev accuracy.
- **Arm Lifecycle Explorer** (`ArmLifecycle.tsx`) shows a heatmap of pull probability for all 35 arms at all 34 arm-selection iterations, plus per-arm trajectories.
- The hero streamgraph (`src/components/HeroStream.tsx`) reuses the same data.

### Regenerating the demo data

```bash
python3 scripts/export_demo_data.py \
  --run-dir      /path/to/Meta-ARE/autosaddler/20260811-043902 \
  --analysis-dir /path/to/analysis
```

The script writes two files:

- `src/components/Curriculum/data/replay.json`: the numbers, bundled with the page.
- `src/components/Curriculum/data/rationales.json`: the verbatim LLM text, lazy-loaded.

It also does the following:

- **Checks against the paper:** 34 pull iterations, arms growing from 6 to 35, final best dev accuracy of 63.1%, and q = softmax(φ/τ).
- **Scrubs** absolute paths and user names from the text.
- **Renames arms** from their hashes to the paper's P-numbers.

## Deploy

The site is live at **https://autosaddler-projectpage.github.io/activesaddler/**, as a project site of the `AutoSaddler-ProjectPage` organization (the AutoSaddler page stays at the organization root).

Pushing to `main` runs `.github/workflows/astro.yml`, which builds the site and deploys it to GitHub Pages (**Settings → Pages → Source: GitHub Actions**). The workflow passes the Pages origin and base path (`/activesaddler`) to `astro build`, so all asset links and the `og:image` URL resolve under that sub-path; no code change is needed if the repository is renamed.
