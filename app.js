(() => {
  'use strict';

  const STORAGE_KEY_OUT_OF = 'mealdice:out_of';

  const state = {
    index: null,
    mealType: null,
    cookState: 'any', // 'any' | 'scratch' | 'assembly'
    methods: new Set(),
    prepTime: 'any',
    outOf: new Set(),
    dontWant: new Set(),
  };

  const el = {
    bootError: document.getElementById('boot-error'),
    bootErrorMsg: document.getElementById('boot-error-msg'),
    reloadBtn: document.getElementById('reload-btn'),
    filters: document.getElementById('filters'),
    filtersDetails: document.getElementById('filters-details'),
    mealTypeGroup: document.getElementById('meal-type-group'),
    cookStateGroup: document.getElementById('cook-state-group'),
    methodGroup: document.getElementById('method-group'),
    prepTimeGroup: document.getElementById('prep-time-group'),
    outOfChips: document.getElementById('out-of-chips'),
    outOfSearch: document.getElementById('out-of-search'),
    outOfSuggestions: document.getElementById('out-of-suggestions'),
    dontWantChips: document.getElementById('dont-want-chips'),
    dontWantSearch: document.getElementById('dont-want-search'),
    dontWantSuggestions: document.getElementById('dont-want-suggestions'),
    resetBtn: document.getElementById('reset-btn'),
    rollBtn: document.getElementById('roll-btn'),
    result: document.getElementById('result'),
  };

  // --- Helpers ---
  const norm = (s) => String(s).trim().toLowerCase();
  const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function loadPersistedOutOf() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_OUT_OF);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr.map(norm) : []);
    } catch {
      return new Set();
    }
  }

  function persistOutOf() {
    try {
      localStorage.setItem(STORAGE_KEY_OUT_OF, JSON.stringify([...state.outOf]));
    } catch {
      // Storage full or disabled; ignore.
    }
  }

  // --- Bootstrap ---
  async function boot() {
    el.reloadBtn.addEventListener('click', () => location.reload());
    try {
      const resp = await fetch('recipes/index.json', { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      state.index = await resp.json();
    } catch (err) {
      el.bootErrorMsg.textContent = `Couldn't load recipes (${err.message}). Check that recipes/index.json exists.`;
      el.bootError.hidden = false;
      return;
    }
    state.outOf = loadPersistedOutOf();
    el.filters.hidden = false;
    bindUI();
    renderAll();
  }

  // --- UI binding ---
  function bindUI() {
    // Meal type (radio)
    el.mealTypeGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      state.mealType = btn.dataset.value;
      updateRadioGroup(el.mealTypeGroup, state.mealType);
    });

    // Cooking state (radio)
    el.cookStateGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      state.cookState = btn.dataset.value;
      updateRadioGroup(el.cookStateGroup, state.cookState);
    });

    // Method (multi)
    el.methodGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      const v = btn.dataset.value;
      if (state.methods.has(v)) state.methods.delete(v);
      else state.methods.add(v);
      btn.setAttribute('aria-pressed', state.methods.has(v) ? 'true' : 'false');
    });

    // Prep time (radio)
    el.prepTimeGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      state.prepTime = btn.dataset.value;
      updateRadioGroup(el.prepTimeGroup, state.prepTime);
    });

    setupChipField(el.outOfSearch, el.outOfSuggestions, el.outOfChips, state.outOf, {
      onAdd: persistOutOf,
      onRemove: persistOutOf,
    });
    setupChipField(el.dontWantSearch, el.dontWantSuggestions, el.dontWantChips, state.dontWant);

    el.resetBtn.addEventListener('click', resetFilters);
    el.rollBtn.addEventListener('click', () => roll());
  }

  function updateRadioGroup(group, value) {
    group.querySelectorAll('button[data-value]').forEach(b => {
      b.setAttribute('aria-checked', b.dataset.value === value ? 'true' : 'false');
    });
  }

  function renderAll() {
    updateRadioGroup(el.prepTimeGroup, state.prepTime);
    updateRadioGroup(el.cookStateGroup, state.cookState);
    renderChipsFor('outOf');
    renderChipsFor('dontWant');
  }

  function renderChipsFor(which) {
    const [set, container, onChange] = which === 'outOf'
      ? [state.outOf, el.outOfChips, persistOutOf]
      : [state.dontWant, el.dontWantChips, null];
    container.innerHTML = '';
    [...set].sort().forEach(v => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = v;
      const x = document.createElement('button');
      x.type = 'button';
      x.setAttribute('aria-label', `Remove ${v}`);
      x.textContent = '×';
      x.addEventListener('click', () => {
        set.delete(v);
        if (onChange) onChange();
        renderChipsFor(which);
      });
      chip.appendChild(x);
      container.appendChild(chip);
    });
  }

  // --- Chip field (search + suggestions) ---
  function setupChipField(input, suggestionList, chipsEl, set, hooks = {}) {
    let activeIdx = -1;
    let current = [];

    const hide = () => {
      suggestionList.hidden = true;
      suggestionList.innerHTML = '';
      activeIdx = -1;
      current = [];
    };

    const render = (query) => {
      const q = norm(query);
      const all = state.index.all_ingredients;
      const pool = q
        ? all.filter(i => i.includes(q) && !set.has(i))
        : all.filter(i => !set.has(i));
      current = pool.slice(0, 30);
      suggestionList.innerHTML = '';
      if (current.length === 0) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = q ? 'No matches' : 'No more ingredients';
        suggestionList.appendChild(li);
      } else {
        current.forEach((ing, i) => {
          const li = document.createElement('li');
          li.textContent = ing;
          li.dataset.value = ing;
          if (i === activeIdx) li.classList.add('active');
          li.addEventListener('mousedown', (e) => {
            // mousedown (not click) so it fires before input blur.
            e.preventDefault();
            addValue(ing);
          });
          suggestionList.appendChild(li);
        });
      }
      suggestionList.hidden = false;
    };

    const addValue = (v) => {
      const vn = norm(v);
      if (!vn) return;
      if (!state.index.all_ingredients.includes(vn)) return;
      if (set.has(vn)) return;
      set.add(vn);
      if (hooks.onAdd) hooks.onAdd();
      input.value = '';
      const which = (set === state.outOf) ? 'outOf' : 'dontWant';
      renderChipsFor(which);
      render('');
      input.focus();
    };

    input.addEventListener('focus', () => render(input.value));
    input.addEventListener('input', () => {
      activeIdx = -1;
      render(input.value);
    });
    input.addEventListener('blur', () => setTimeout(hide, 100));
    input.addEventListener('keydown', (e) => {
      if (suggestionList.hidden) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (current.length === 0) return;
        activeIdx = (activeIdx + 1) % current.length;
        render(input.value);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (current.length === 0) return;
        activeIdx = (activeIdx - 1 + current.length) % current.length;
        render(input.value);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && current[activeIdx]) {
          addValue(current[activeIdx]);
        } else if (current.length === 1) {
          addValue(current[0]);
        } else {
          // Try exact match
          const q = norm(input.value);
          if (q && state.index.all_ingredients.includes(q) && !set.has(q)) {
            addValue(q);
          }
        }
      } else if (e.key === 'Escape') {
        hide();
        input.blur();
      }
    });
  }

  // --- Filters and roll ---
  function resetFilters() {
    state.mealType = null;
    state.cookState = 'any';
    state.methods.clear();
    state.prepTime = 'any';
    state.outOf.clear();
    state.dontWant.clear();
    persistOutOf();
    // Reset UI
    el.mealTypeGroup.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', 'false'));
    el.methodGroup.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false'));
    updateRadioGroup(el.cookStateGroup, state.cookState);
    el.prepTimeGroup.querySelectorAll('button').forEach(b => {
      b.setAttribute('aria-checked', b.dataset.value === 'any' ? 'true' : 'false');
    });
    el.outOfSearch.value = '';
    el.dontWantSearch.value = '';
    renderChipsFor('outOf');
    renderChipsFor('dontWant');
    el.result.hidden = true;
    el.result.innerHTML = '';
    if (el.filtersDetails) el.filtersDetails.open = true;
  }

  function candidateSet() {
    if (!state.mealType) return state.index.recipes.slice();
    return state.index.recipes.filter(r => r.meal_types.includes(state.mealType));
  }

  function softScore(r) {
    let score = 0;
    // Method
    if (state.methods.size === 0 || r.method.some(m => state.methods.has(m))) score++;
    // Prep time
    if (state.prepTime === 'any' || r.prep_time_min <= parseInt(state.prepTime, 10)) score++;
    // Don't want
    if (state.dontWant.size === 0 || !r.ingredients.some(i => state.dontWant.has(i))) score++;
    return score;
  }

  function filteredAfterHard() {
    return candidateSet().filter(r => {
      if (r.ingredients.some(i => state.outOf.has(i))) return false;
      if (state.cookState === 'scratch' && r.needs_precooked) return false;
      if (state.cookState === 'assembly' && !r.needs_precooked) return false;
      return true;
    });
  }

  async function roll(prevSlug = null) {
    const pool = filteredAfterHard();
    if (pool.length === 0) {
      renderNoMatch();
      return;
    }

    const fullMatches = pool.filter(r => softScore(r) === 3);
    let chosen, closest = false;
    if (fullMatches.length > 0) {
      chosen = randomPick(fullMatches);
    } else {
      // Closest match by score
      const scored = pool.map(r => ({ r, s: softScore(r) }));
      const maxScore = Math.max(...scored.map(x => x.s));
      const best = scored.filter(x => x.s === maxScore).map(x => x.r);
      chosen = randomPick(best);
      closest = true;
    }

    // Avoid showing the same recipe twice in a row when a pool has options.
    if (prevSlug && chosen.slug === prevSlug) {
      const altPool = fullMatches.length > 0
        ? fullMatches.filter(r => r.slug !== prevSlug)
        : pool.filter(r => r.slug !== prevSlug && softScore(r) === softScore(chosen));
      if (altPool.length > 0) chosen = randomPick(altPool);
    }

    await renderRecipe(chosen, { closest, triedSlugs: new Set() });
  }

  // --- Rendering ---
  function renderNoMatch() {
    el.result.hidden = false;
    el.result.className = 'result no-match';
    el.result.innerHTML = `
      <p>No recipes fit your constraints — try removing an "out of" ingredient.</p>
    `;
  }

  async function renderRecipe(recipe, { closest, triedSlugs }) {
    let body = '';
    try {
      const resp = await fetch(`recipes/${recipe.slug}.md`, { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.text();
      body = extractBody(raw);
    } catch (err) {
      console.warn(`[mealdice] failed to load recipes/${recipe.slug}.md:`, err);
      triedSlugs.add(recipe.slug);
      const remaining = filteredAfterHard().filter(r => !triedSlugs.has(r.slug));
      if (remaining.length === 0) {
        el.result.hidden = false;
        el.result.className = 'result no-match';
        el.result.innerHTML = `<p>Couldn't load any matching recipes. Check the console.</p>`;
        return;
      }
      // Re-pick from remaining (preserving score preference).
      const fullMatches = remaining.filter(r => softScore(r) === 3);
      const nextPool = fullMatches.length > 0 ? fullMatches : remaining;
      const next = randomPick(nextPool);
      return renderRecipe(next, { closest: fullMatches.length === 0 || closest, triedSlugs });
    }

    const methodLabels = recipe.method.map(methodLabel).join(', ');
    const parts = [];
    if (closest) parts.push(`<div class="closest-badge">Closest match</div>`);
    parts.push(`<h2>${escapeHtml(recipe.name)}</h2>`);

    const meta = [
      `${recipe.prep_time_min} min`,
      methodLabels,
    ];
    if (recipe.servings !== undefined) meta.push(`${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}`);
    parts.push(`<div class="meta">${meta.map(m => `<span>${escapeHtml(m)}</span>`).join('')}</div>`);

    if (recipe.description) {
      parts.push(`<p class="description">${escapeHtml(recipe.description)}</p>`);
    }

    parts.push(`<h3 class="section-heading">Ingredients</h3>`);
    parts.push(`<ul class="ingredients-list">${
      recipe.ingredients.map(i => `<li>${escapeHtml(i)}</li>`).join('')
    }</ul>`);

    const rendered = window.marked ? window.marked.parse(body) : escapeHtml(body);
    parts.push(`<div class="recipe-body">${rendered}</div>`);

    if (recipe.notes) {
      parts.push(`<div class="notes"><span class="notes-label">Notes</span>${escapeHtml(recipe.notes)}</div>`);
    }

    parts.push(`<button type="button" class="roll-again" id="roll-again-btn">Roll again</button>`);

    el.result.className = 'result';
    el.result.hidden = false;
    el.result.innerHTML = parts.join('');

    // Attach strikethrough handlers
    el.result.querySelectorAll('.ingredients-list li, .recipe-body li').forEach(li => {
      li.addEventListener('click', () => li.classList.toggle('struck'));
    });

    const again = document.getElementById('roll-again-btn');
    if (again) {
      again.addEventListener('click', () => {
        roll(recipe.slug);
        window.scrollTo({ top: el.result.offsetTop - 8, behavior: 'smooth' });
      });
    }

    // Collapse filters so the result takes the screen.
    if (el.filtersDetails) el.filtersDetails.open = false;
  }

  function extractBody(raw) {
    // Strip YAML frontmatter delimited by --- on its own lines at the top.
    const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    return m ? raw.slice(m[0].length) : raw;
  }

  function methodLabel(m) {
    return ({
      instant_pot: 'Instant Pot',
      stove: 'Stove',
      air_fryer: 'Air Fryer',
      oven: 'Oven',
      microwave: 'Microwave',
      no_cook: 'No-Cook',
    })[m] || m;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  boot();
})();
