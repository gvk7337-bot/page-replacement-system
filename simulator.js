/* ============================================================
   algorithms.js - Page Replacement Algorithm Implementations
   Contains: FIFO, LRU, Optimal
   Each function returns a full step-by-step trace object.
   ============================================================ */

/**
 * Checks if a page is currently loaded in any frame.
 * @param {number[]} frames - current memory frames
 * @param {number}   page   - page number to look for
 * @returns {boolean}
 */
function isPageInFrames(frames, page) {
  return frames.includes(page);
}

/**
 * Creates an independent copy of the frames array so
 * each step stores its own snapshot (avoids reference bugs).
 * @param {number[]} frames
 * @returns {number[]}
 */
function snapshotFrames(frames) {
  return [...frames]; // spread = shallow copy
}

/* ============================================================
   ALGORITHM 1: FIFO  (First-In, First-Out)

   IDEA: Replace the page that was loaded FIRST (oldest page).
   DATA STRUCTURE: Circular pointer over the frames array.
     - pointer always points to the frame that will be replaced next.
     - After a replacement, advance pointer using modulo arithmetic.

   TIME COMPLEXITY: O(n * f)   n=pages, f=frames
   ============================================================ */
function runFIFO(pages, numFrames) {
  let frames  = new Array(numFrames).fill(-1); // -1 = empty slot
  let pointer = 0;   // FIFO replacement pointer (circular)
  let steps   = [];
  let pageFaults = 0;
  let pageHits   = 0;

  for (let i = 0; i < pages.length; i++) {
    let page  = pages[i];
    let isHit = isPageInFrames(frames, page);

    if (isHit) {
      // Page already in memory, no action needed
      pageHits++;
    } else {
      // Page fault: load into frame at pointer position
      pageFaults++;
      frames[pointer] = page;
      pointer = (pointer + 1) % numFrames; // advance circularly
    }

    steps.push({
      page:       page,
      frames:     snapshotFrames(frames),
      isFault:    !isHit,
      faultCount: pageFaults,
      hitCount:   pageHits
    });
  }

  return {
    algorithmName: 'FIFO',
    steps:         steps,
    totalFaults:   pageFaults,
    totalHits:     pageHits,
    totalPages:    pages.length,
    hitRatio:      ((pageHits / pages.length) * 100).toFixed(2)
  };
}

/* ============================================================
   ALGORITHM 2: LRU  (Least Recently Used)

   IDEA: Replace the page that has NOT been accessed for the
   LONGEST time. Uses access timestamps to decide.

   DATA STRUCTURE: lastUsed[] array parallel to frames[].
     - lastUsed[j] = step number when frames[j] was last used.
     - On fault, find frame with smallest lastUsed value.

   TIME COMPLEXITY: O(n * f)
   ============================================================ */
function runLRU(pages, numFrames) {
  let frames   = new Array(numFrames).fill(-1);
  let lastUsed = new Array(numFrames).fill(-1); // access timestamps
  let steps    = [];
  let pageFaults = 0;
  let pageHits   = 0;

  for (let i = 0; i < pages.length; i++) {
    let page       = pages[i];
    let frameIndex = frames.indexOf(page); // -1 if not found
    let isHit      = frameIndex !== -1;

    if (isHit) {
      // Page hit: update last-used time for this frame
      lastUsed[frameIndex] = i;
      pageHits++;
    } else {
      // Page fault: find the best frame to replace
      pageFaults++;
      let targetIndex = frames.indexOf(-1); // look for empty slot first

      if (targetIndex === -1) {
        // No empty slot: find the Least Recently Used frame
        let minTime = Infinity;
        for (let j = 0; j < numFrames; j++) {
          if (lastUsed[j] < minTime) {
            minTime     = lastUsed[j];
            targetIndex = j;
          }
        }
      }

      frames[targetIndex]   = page;
      lastUsed[targetIndex] = i; // record access time
    }

    steps.push({
      page:       page,
      frames:     snapshotFrames(frames),
      isFault:    !isHit,
      faultCount: pageFaults,
      hitCount:   pageHits
    });
  }

  return {
    algorithmName: 'LRU',
    steps:         steps,
    totalFaults:   pageFaults,
    totalHits:     pageHits,
    totalPages:    pages.length,
    hitRatio:      ((pageHits / pages.length) * 100).toFixed(2)
  };
}

/* ============================================================
   ALGORITHM 3: OPTIMAL  (Belady's Algorithm)

   IDEA: Replace the page whose NEXT USE is farthest in the
   future. If a page will never be used again, evict it first.

   Requires knowledge of ALL future references - impossible in
   a real OS, so this is used purely as a theoretical benchmark.

   TIME COMPLEXITY: O(n^2 * f)
   ============================================================ */
function runOptimal(pages, numFrames) {
  let frames     = new Array(numFrames).fill(-1);
  let steps      = [];
  let pageFaults = 0;
  let pageHits   = 0;

  for (let i = 0; i < pages.length; i++) {
    let page  = pages[i];
    let isHit = isPageInFrames(frames, page);

    if (isHit) {
      pageHits++;
    } else {
      pageFaults++;
      let emptyIndex = frames.indexOf(-1); // check for free slot

      if (emptyIndex !== -1) {
        // Free slot available - use it directly
        frames[emptyIndex] = page;
      } else {
        // All frames full: find the optimal page to replace
        let farthestUse = -1;
        let replaceIdx  = 0;

        for (let j = 0; j < numFrames; j++) {
          let nextUse = Infinity; // assume never used again

          // Look ahead in future references
          for (let k = i + 1; k < pages.length; k++) {
            if (pages[k] === frames[j]) {
              nextUse = k; // found next occurrence
              break;
            }
          }

          // Pick the frame whose page is used farthest in the future
          if (nextUse > farthestUse) {
            farthestUse = nextUse;
            replaceIdx  = j;
          }
        }

        frames[replaceIdx] = page;
      }
    }

    steps.push({
      page:       page,
      frames:     snapshotFrames(frames),
      isFault:    !isHit,
      faultCount: pageFaults,
      hitCount:   pageHits
    });
  }

  return {
    algorithmName: 'Optimal',
    steps:         steps,
    totalFaults:   pageFaults,
    totalHits:     pageHits,
    totalPages:    pages.length,
    hitRatio:      ((pageHits / pages.length) * 100).toFixed(2)
  };
}

/* Expose functions globally (no module system in vanilla JS) */
window.runFIFO    = runFIFO;
window.runLRU     = runLRU;
window.runOptimal = runOptimal;
