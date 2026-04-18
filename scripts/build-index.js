#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const REPO_ROOT = path.resolve(__dirname, '..');
const RECIPES_DIR = path.join(REPO_ROOT, 'recipes');
const INDEX_PATH = path.join(RECIPES_DIR, 'index.json');

const ALLOWED_MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner']);
const ALLOWED_METHODS = new Set(['instant_pot', 'stove', 'air_fryer', 'oven', 'microwave', 'no_cook']);

const REQUIRED_FIELDS = ['name', 'meal_types', 'prep_time_min', 'method', 'ingredients'];

function normalizeIngredient(raw) {
  return String(raw).trim().toLowerCase();
}

function fail(file, message) {
  console.error(`\x1b[31m[error]\x1b[0m ${path.basename(file)}: ${message}`);
  process.exit(1);
}

function validateRecipe(file, data) {
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      fail(file, `missing required field "${field}"`);
    }
  }
  if (typeof data.name !== 'string' || data.name.trim() === '') {
    fail(file, `"name" must be a non-empty string`);
  }
  if (!Array.isArray(data.meal_types) || data.meal_types.length === 0) {
    fail(file, `"meal_types" must be a non-empty list`);
  }
  for (const mt of data.meal_types) {
    if (!ALLOWED_MEAL_TYPES.has(mt)) {
      fail(file, `"meal_types" contains invalid value "${mt}" (allowed: ${[...ALLOWED_MEAL_TYPES].join(', ')})`);
    }
  }
  if (!Number.isInteger(data.prep_time_min) || data.prep_time_min <= 0) {
    fail(file, `"prep_time_min" must be a positive integer`);
  }
  if (!Array.isArray(data.method) || data.method.length === 0) {
    fail(file, `"method" must be a non-empty list`);
  }
  for (const m of data.method) {
    if (!ALLOWED_METHODS.has(m)) {
      fail(file, `"method" contains invalid value "${m}" (allowed: ${[...ALLOWED_METHODS].join(', ')})`);
    }
  }
  if (!Array.isArray(data.ingredients) || data.ingredients.length === 0) {
    fail(file, `"ingredients" must be a non-empty list`);
  }
  for (const ing of data.ingredients) {
    if (typeof ing !== 'string' || ing.trim() === '') {
      fail(file, `"ingredients" contains a non-string or empty entry`);
    }
  }
}

function warnNearDuplicates(allIngredients) {
  const set = new Set(allIngredients);
  const warned = new Set();
  const pair = (a, b) => [a, b].sort().join('||');
  for (const ing of set) {
    const withoutTrailingS = ing.endsWith('s') ? ing.slice(0, -1) : null;
    if (withoutTrailingS && set.has(withoutTrailingS)) {
      const key = pair(ing, withoutTrailingS);
      if (!warned.has(key)) {
        console.warn(`\x1b[33m[warn]\x1b[0m near-duplicate ingredients: "${ing}" and "${withoutTrailingS}"`);
        warned.add(key);
      }
    }
    if (ing.includes('-')) {
      const spaced = ing.replace(/-/g, ' ');
      if (set.has(spaced)) {
        const key = pair(ing, spaced);
        if (!warned.has(key)) {
          console.warn(`\x1b[33m[warn]\x1b[0m near-duplicate ingredients: "${ing}" and "${spaced}"`);
          warned.add(key);
        }
      }
    }
  }
}

function main() {
  if (!fs.existsSync(RECIPES_DIR)) {
    console.error(`[error] recipes directory not found: ${RECIPES_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(RECIPES_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(RECIPES_DIR, f))
    .sort();

  const recipes = [];
  const allIngredientsSet = new Set();

  for (const file of files) {
    let parsed;
    try {
      parsed = matter.read(file);
    } catch (e) {
      fail(file, `malformed YAML frontmatter: ${e.message}`);
    }

    const data = parsed.data;
    validateRecipe(file, data);

    const slug = path.basename(file, '.md');
    const normIngredients = data.ingredients.map(normalizeIngredient);
    normIngredients.forEach(i => allIngredientsSet.add(i));

    const needsPrecooked = normIngredients.some(i => i.startsWith('cooked '));

    const entry = {
      slug,
      name: data.name,
      meal_types: data.meal_types,
      prep_time_min: data.prep_time_min,
      method: data.method,
      ingredients: normIngredients,
      needs_precooked: needsPrecooked,
    };
    if (data.description !== undefined) entry.description = data.description;
    if (data.servings !== undefined) entry.servings = data.servings;
    if (data.notes !== undefined) entry.notes = data.notes;

    recipes.push(entry);
  }

  const allIngredients = [...allIngredientsSet].sort();
  warnNearDuplicates(allIngredients);

  const index = { recipes, all_ingredients: allIngredients };
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n', 'utf8');
  console.log(`\x1b[32m[ok]\x1b[0m wrote ${path.relative(REPO_ROOT, INDEX_PATH)} — ${recipes.length} recipe(s), ${allIngredients.length} unique ingredient(s)`);
}

main();
