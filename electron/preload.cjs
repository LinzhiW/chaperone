// Bridge between the sandboxed page and the shell. Deliberately narrow: the page
// gets the backend's address and a folder picker, and nothing else — no fs, no
// child_process, no ipcRenderer.

const { contextBridge, ipcRenderer } = require('electron');

// Passed as a command-line switch by main.cjs, since the port is only known at runtime.
const arg = process.argv.find(a => a.startsWith('--chaperone-api-base='));
const apiBase = arg ? arg.split('=').slice(1).join('=') : undefined;

contextBridge.exposeInMainWorld('__CHAPERONE__', {
  apiBase,
  /**
   * Open the OS folder picker.
   * @returns {Promise<string|null>} absolute path, or null if cancelled
   */
  pickFolder: opts => ipcRenderer.invoke('chaperone:pick-folder', opts || {}),
});
