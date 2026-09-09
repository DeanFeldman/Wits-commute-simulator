// GPU-side frame timing for shader work, via EXT_disjoint_timer_query_webgl2.
//
// Wall-clock timing from requestAnimationFrame cannot resolve a fragment
// shader change on this project: rAF deltas are set by the browser's frame
// scheduling, so a build that shades more per pixel and one that shades less
// both land on whatever cadence the compositor is running, and run-to-run
// variance swamps the difference. This asks the GPU how long it actually
// spent on the commands between begin() and end() instead.
//
// It is a measurement instrument, not a gameplay system. Nothing constructs
// it unless the page is loaded with ?gpuTimer=1, and it returns null on any
// context that will not give a usable timer.

// Only one TIME_ELAPSED_EXT query can be in flight at a time, and a result is
// not readable on the frame it was issued, so queries are recycled through a
// pool and harvested a few frames later.
const POOL_SIZE = 8;

export function createGpuTimer(renderer) {
  const gl = renderer.getContext();

  // WebGL1 contexts expose a different, less usable extension. Three gives a
  // WebGL2 context on anything current, so this is the only one worth asking
  // for, and an honest null is better than a number that does not mean what
  // the caller thinks.
  if (typeof WebGL2RenderingContext === "undefined" || !(gl instanceof WebGL2RenderingContext)) {
    return null;
  }
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  if (!ext) return null;

  const free = [];
  for (let index = 0; index < POOL_SIZE; index++) free.push(gl.createQuery());
  const inFlight = [];
  let active = null;
  let samplesMs = [];
  let discarded = 0;

  return {
    // Chrome exposes the extension but can still refuse to time; the caller
    // finds out from stats().count rather than from construction.
    supported: true,

    begin() {
      if (active || free.length === 0) return;
      active = free.pop();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, active);
    },

    end() {
      if (!active) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      inFlight.push(active);
      active = null;
    },

    // A disjoint means the GPU was interrupted (clock change, context switch)
    // and every result currently in flight is meaningless, so they are thrown
    // away rather than averaged in.
    poll() {
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        while (inFlight.length) {
          free.push(inFlight.shift());
          discarded++;
        }
        return;
      }
      while (inFlight.length) {
        const query = inFlight[0];
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return;
        inFlight.shift();
        samplesMs.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
        free.push(query);
      }
    },

    reset() {
      samplesMs = [];
      discarded = 0;
    },

    stats() {
      if (samplesMs.length === 0) return { count: 0, discarded };
      const sorted = [...samplesMs].sort((a, b) => a - b);
      const quantile = (fraction) => sorted[Math.floor(fraction * (sorted.length - 1))];
      return {
        count: sorted.length,
        discarded,
        mean: sorted.reduce((total, value) => total + value, 0) / sorted.length,
        p05: quantile(0.05),
        p50: quantile(0.5),
        p95: quantile(0.95)
      };
    }
  };
}
