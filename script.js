/* ============================================================
   script.js  -  DOM Manipulation & UI Logic
   Handles: nav active states, input validation, table rendering,
            simulator events, comparison rendering, FAQ accordion
   ============================================================ */

/* ============================================================
   SECTION 1: NAVIGATION  -  Active link + mobile toggle
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  // Determine current page filename from URL
  let currentPage = window.location.pathname.split('/').pop() || 'index.html';

  // Mark the matching nav link as active
  document.querySelectorAll('.nav-links a').forEach(function (link) {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
    }
  });

  // Mobile hamburger menu toggle
  let toggle  = document.getElementById('nav-toggle');
  let navMenu = document.getElementById('nav-menu');
  if (toggle && navMenu) {
    toggle.addEventListener('click', function () {
      navMenu.classList.toggle('open');
    });
  }

  // Initialize FAQ accordion (only runs on theory.html)
  initFAQ();
});

/* ============================================================
   SECTION 2: INPUT VALIDATION
   ============================================================ */

/**
 * Parses a comma-separated string of integers into an array.
 * Returns null if the input is empty or contains invalid values.
 * @param {string} inputStr
 * @returns {number[]|null}
 */
function parsePageString(inputStr) {
  let trimmed = inputStr.trim();
  if (!trimmed) return null;

  let parts = trimmed.split(',');
  let pages = [];

  for (let i = 0; i < parts.length; i++) {
    let num = parseInt(parts[i].trim(), 10);
    if (isNaN(num) || num < 0) return null;
    pages.push(num);
  }

  return pages.length > 0 ? pages : null;
}

/**
 * Displays an error alert inside the given container element.
 * @param {HTMLElement} container
 * @param {string}      message
 */
function showError(container, message) {
  container.innerHTML = '<div class="alert alert-error">' + message + '</div>';
}

/* ============================================================
   SECTION 3: TABLE RENDERING  (DOM manipulation)

   Table layout:
     Row 0 (thead): Step   | 1  | 2  | 3  | ... | n
     Row 1: Page Ref        | p1 | p2 | p3 | ...
     Rows 2..F: Frame N     | -- | p  | p  | ...
     Last row: Status       | F  | H  | F  | ...

   Cells are colored: fault = red bg, hit = green bg
   ============================================================ */

/**
 * Dynamically builds the result table into the given <table> element.
 * @param {Object}      result    - returned by algorithm functions
 * @param {number}      numFrames
 * @param {HTMLElement} tableEl   - the <table> to populate
 */
function buildSimulationTable(result, numFrames, tableEl) {
  let steps    = result.steps;
  tableEl.innerHTML = ''; // clear old content

  /* ---- THEAD: step numbers ---- */
  let thead     = document.createElement('thead');
  let headerRow = document.createElement('tr');
  headerRow.classList.add('ref-row');

  let thLabel = document.createElement('th');
  thLabel.textContent = 'Step';
  headerRow.appendChild(thLabel);

  for (let i = 0; i < steps.length; i++) {
    let th = document.createElement('th');
    th.textContent = i + 1;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  tableEl.appendChild(thead);

  /* ---- TBODY ---- */
  let tbody = document.createElement('tbody');

  /* Row: Page Reference */
  let refRow   = document.createElement('tr');
  refRow.classList.add('ref-row');
  let refLabel = document.createElement('td');
  refLabel.classList.add('row-label');
  refLabel.textContent = 'Page Ref';
  refRow.appendChild(refLabel);

  for (let i = 0; i < steps.length; i++) {
    let td = document.createElement('td');
    td.textContent = steps[i].page;
    refRow.appendChild(td);
  }
  tbody.appendChild(refRow);

  /* Rows: one per frame */
  for (let f = 0; f < numFrames; f++) {
    let frameRow  = document.createElement('tr');
    let frameLabel = document.createElement('td');
    frameLabel.classList.add('row-label');
    frameLabel.textContent = 'Frame ' + (f + 1);
    frameRow.appendChild(frameLabel);

    for (let i = 0; i < steps.length; i++) {
      let td  = document.createElement('td');
      let val = steps[i].frames[f];

      if (val === -1) {
        td.textContent = '-';
        td.style.color = 'var(--text-muted)';
      } else {
        td.textContent = val;
      }

      // Highlight entire column by fault/hit status
      td.classList.add(steps[i].isFault ? 'fault' : 'hit');
      td.classList.add('anim-in');
      frameRow.appendChild(td);
    }
    tbody.appendChild(frameRow);
  }

  /* Row: Status (F / H) */
  let statusRow   = document.createElement('tr');
  statusRow.classList.add('fault-row');
  let statusLabel = document.createElement('td');
  statusLabel.classList.add('row-label');
  statusLabel.textContent = 'Status';
  statusRow.appendChild(statusLabel);

  for (let i = 0; i < steps.length; i++) {
    let td = document.createElement('td');
    if (steps[i].isFault) {
      td.textContent = 'F';
      td.classList.add('fault-mark');
    } else {
      td.textContent = 'H';
      td.classList.add('hit-mark');
    }
    statusRow.appendChild(td);
  }
  tbody.appendChild(statusRow);

  tableEl.appendChild(tbody);
}

/**
 * Updates the three metric display cards.
 * @param {Object} result
 */
function updateMetrics(result) {
  let faultEl = document.getElementById('metric-faults');
  let hitEl   = document.getElementById('metric-hits');
  let algoEl  = document.getElementById('metric-algo');
  if (faultEl) faultEl.textContent = result.totalFaults;
  if (hitEl)   hitEl.textContent   = result.hitRatio + '%';
  if (algoEl)  algoEl.textContent  = result.algorithmName;
}

/* ============================================================
   SECTION 4: SIMULATOR PAGE  -  Run button event
   ============================================================ */
let runBtn = document.getElementById('run-btn');
if (runBtn) {
  runBtn.addEventListener('click', function () {
    runSimulation();
  });
}

/**
 * Main simulation runner.
 * Reads inputs, validates, calls algorithm, renders results.
 * Uses async/await + setTimeout for non-blocking UI updates.
 */
async function runSimulation() {
  let pageInput      = document.getElementById('page-string');
  let framesInput    = document.getElementById('num-frames');
  let algoSelect     = document.getElementById('algorithm');
  let outputArea     = document.getElementById('output-area');
  let tableEl        = document.getElementById('sim-table');
  let runBtn         = document.getElementById('run-btn');
  let resultsSection = document.getElementById('results-section');
  let emptyState     = document.getElementById('empty-state');

  // Validate page reference string
  let pages = parsePageString(pageInput.value);
  if (!pages) {
    showError(outputArea, 'Invalid page string. Use comma-separated non-negative integers. Example: 7,0,1,2,0,3');
    return;
  }

  // Validate frame count
  let numFrames = parseInt(framesInput.value, 10);
  if (isNaN(numFrames) || numFrames < 1 || numFrames > 10) {
    showError(outputArea, 'Number of frames must be between 1 and 10.');
    return;
  }

  outputArea.innerHTML = '';
  runBtn.disabled      = true;
  runBtn.textContent   = 'Running...';

  await sleep(50); // brief pause so the button state repaints

  // Run selected algorithm
  let algo   = algoSelect.value;
  let result;
  if      (algo === 'fifo')    result = runFIFO(pages, numFrames);
  else if (algo === 'lru')     result = runLRU(pages, numFrames);
  else if (algo === 'optimal') result = runOptimal(pages, numFrames);
  else {
    showError(outputArea, 'Unknown algorithm selected.');
    runBtn.disabled    = false;
    runBtn.textContent = 'Run Simulation';
    return;
  }

  // Render table and metrics
  buildSimulationTable(result, numFrames, tableEl);
  updateMetrics(result);

  // Show results, hide empty state
  if (emptyState)     emptyState.classList.add('hidden');
  if (resultsSection) resultsSection.classList.remove('hidden');

  await sleep(200);
  runBtn.disabled    = false;
  runBtn.textContent = 'Run Simulation';
}

/* ============================================================
   SECTION 5: COMPARISON PAGE  -  Run all three & display
   ============================================================ */
let compareBtn = document.getElementById('compare-btn');
if (compareBtn) {
  compareBtn.addEventListener('click', function () {
    runComparison();
  });
}

/**
 * Runs FIFO, LRU, and Optimal on the same input,
 * then renders cards + bar chart + winner announcement.
 */
async function runComparison() {
  let pageInput   = document.getElementById('compare-pages');
  let framesInput = document.getElementById('compare-frames');
  let outputArea  = document.getElementById('compare-output');
  let btn         = document.getElementById('compare-btn');

  let pages = parsePageString(pageInput.value);
  if (!pages) {
    showError(outputArea, 'Invalid page string. Example: 7,0,1,2,0,3,0,4,2,3');
    return;
  }
  let numFrames = parseInt(framesInput.value, 10);
  if (isNaN(numFrames) || numFrames < 1 || numFrames > 10) {
    showError(outputArea, 'Number of frames must be between 1 and 10.');
    return;
  }

  outputArea.innerHTML = '';
  btn.disabled         = true;
  btn.textContent      = 'Comparing...';
  await sleep(100);

  // Run all three algorithms
  let fifoResult = runFIFO(pages, numFrames);
  let lruResult  = runLRU(pages, numFrames);
  let optResult  = runOptimal(pages, numFrames);
  let results    = [fifoResult, lruResult, optResult];

  // Find best (fewest faults)
  let minFaults = Math.min(fifoResult.totalFaults, lruResult.totalFaults, optResult.totalFaults);
  let bestName  = results.find(r => r.totalFaults === minFaults).algorithmName;

  // Build result cards HTML
  let cardsHtml = '<div class="compare-cards">';
  results.forEach(function (r) {
    let isBest = r.totalFaults === minFaults;
    cardsHtml += `
      <div class="compare-card ${isBest ? 'best' : ''}">
        <div class="compare-card-head">
          <h3>${r.algorithmName}</h3>
          ${isBest ? '<span class="best-badge">Best</span>' : ''}
        </div>
        <div class="compare-card-body">
          <div class="compare-stat"><span>Total Pages</span><span class="stat-val">${r.totalPages}</span></div>
          <div class="compare-stat"><span>Page Faults</span><span class="stat-val fault">${r.totalFaults}</span></div>
          <div class="compare-stat"><span>Page Hits</span><span class="stat-val hit">${r.totalHits}</span></div>
          <div class="compare-stat"><span>Hit Ratio</span><span class="stat-val hit">${r.hitRatio}%</span></div>
        </div>
      </div>`;
  });
  cardsHtml += '</div>';

  // Build bar chart
  let maxFaults = Math.max(fifoResult.totalFaults, lruResult.totalFaults, optResult.totalFaults) || 1;
  let chartHtml = `
    <div class="compare-chart">
      <h2>Page Faults Comparison &mdash; fewer is better</h2>
      <div class="bar-chart">
        ${buildBar('FIFO', fifoResult.totalFaults, maxFaults, 'fifo')}
        ${buildBar('LRU',  lruResult.totalFaults,  maxFaults, 'lru')}
        ${buildBar('OPT',  optResult.totalFaults,  maxFaults, 'opt')}
      </div>
    </div>`;

  // Winner box
  let winnerHtml = `
    <div class="winner-box">
      <div class="winner-icon">[*]</div>
      <div class="winner-text">
        <h3>Best performing algorithm for this input:</h3>
        <strong>${bestName}</strong>
        &nbsp;&mdash;&nbsp;
        <span style="color:var(--text-secondary);font-size:0.95rem;">
          ${minFaults} page fault${minFaults !== 1 ? 's' : ''} out of ${pages.length} references
        </span>
      </div>
    </div>`;

  outputArea.innerHTML = cardsHtml + chartHtml + winnerHtml;

  await sleep(200);
  btn.disabled    = false;
  btn.textContent = 'Compare All Algorithms';
}

/**
 * Builds one bar row for the comparison chart.
 */
function buildBar(label, faults, maxFaults, cssClass) {
  let pct = Math.max((faults / maxFaults) * 100, 8);
  return `
    <div class="bar-row">
      <span class="bar-label">${label}</span>
      <div class="bar-track">
        <div class="bar-fill ${cssClass}" style="width:${pct}%">${faults}</div>
      </div>
    </div>`;
}

/* ============================================================
   SECTION 6: FAQ ACCORDION  (theory.html)
   Clicking a question toggles the .open class on .faq-item.
   CSS max-height transition handles the animation.
   ============================================================ */
function initFAQ() {
  let faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function (item) {
    let btn = item.querySelector('.faq-question');
    if (!btn) return;

    btn.addEventListener('click', function () {
      let isOpen = item.classList.contains('open');

      // Close all other open items (accordion: one open at a time)
      faqItems.forEach(function (other) {
        other.classList.remove('open');
      });

      // Toggle clicked item (if it was closed, open it)
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });
}

/* ============================================================
   SECTION 7: UTILITIES
   ============================================================ */

/**
 * Returns a Promise that resolves after ms milliseconds.
 * Used with await to create non-blocking UI pauses.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/**
 * Fills inputs with sample values for quick testing.
 */
function loadSample() {
  let pageEl  = document.getElementById('page-string')  || document.getElementById('compare-pages');
  let frameEl = document.getElementById('num-frames')   || document.getElementById('compare-frames');
  if (pageEl)  pageEl.value  = '7,0,1,2,0,3,0,4,2,3,0,3,2';
  if (frameEl) frameEl.value = '3';
}

let sampleBtn        = document.getElementById('sample-btn');
let sampleBtnCompare = document.getElementById('sample-btn-compare');
if (sampleBtn)        sampleBtn.addEventListener('click', loadSample);
if (sampleBtnCompare) sampleBtnCompare.addEventListener('click', loadSample);
