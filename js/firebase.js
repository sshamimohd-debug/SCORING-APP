// Optional Firebase realtime sync.
// If you don't configure Firebase, app runs in offline/localStorage mode.

export const RT = {
  ready:false,
  mode:"local", // "firebase" | "local"
  onUpdate:null,
  async init(){ /* wired in app.js */ },
  async pushState(_state){ /* wired in app.js */ }
};
