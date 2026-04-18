# Mealdice

A static web app that rolls a random recipe. Mobile-first. No backend.

## Adding a recipe

1. Create a new markdown file in `recipes/`, e.g. `recipes/my-new-recipe.md`.
2. Use YAML frontmatter (see [below](#recipe-format)) and a markdown body.
3. Rebuild the index:

   ```sh
   npm run build-index
   ```

4. Commit the `.md` and the regenerated `recipes/index.json`, then push. GitHub Pages serves the update.

If the build script rejects the recipe, fix the reported field and re-run.

## Previewing locally

No build step. Just serve the directory:

```sh
npm run serve   # → python3 -m http.server 8000
```

Then open <http://localhost:8000>.

(You can also use `npx serve` or any other static server.)

## Recipe format

```markdown
---
name: Instant Pot Chicken and Rice
meal_types: [lunch, dinner]
prep_time_min: 25
method: [instant_pot]
ingredients:
  - chicken thighs
  - long-grain rice
  - chicken broth
description: One-pot weeknight dinner with minimal cleanup.
servings: 4
notes: Double the rice for leftovers.
---

## Steps

1. Season the chicken…
2. Sauté the onion…
```

### Required frontmatter fields

| Field | Type | Allowed values |
|-------|------|----------------|
| `name` | string | — |
| `meal_types` | list | `breakfast`, `lunch`, `dinner` |
| `prep_time_min` | integer | positive |
| `method` | list | `instant_pot`, `stove`, `air_fryer`, `oven`, `microwave`, `no_cook` |
| `ingredients` | list of strings | lowercase, no quantities |

### Optional frontmatter fields

| Field | Type | Notes |
|-------|------|-------|
| `description` | string | One-line summary shown under the title |
| `servings` | integer | — |
| `notes` | string | Shown in a callout at the bottom |

Ingredient names are normalized with `.trim().toLowerCase()`. The build script warns about near-duplicates (e.g. `tomato` vs `tomatoes`) — resolve those by hand.

## Project layout

```
mealdice/
├── index.html              Single-page shell
├── style.css               Dark mode, mobile-first
├── app.js                  Filter logic, state, rendering
├── scripts/build-index.js  Validates recipes, emits recipes/index.json
└── recipes/
    ├── index.json          Generated. Commit this.
    └── *.md                One recipe per file.
```

Runtime dependencies (loaded from CDN): `js-yaml`, `marked`.
Build-time dependencies: `gray-matter`, `js-yaml`.
