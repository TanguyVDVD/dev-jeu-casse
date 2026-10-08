// Clavier par codes de touches physiques (identique en AZERTY et QWERTY) + manette.
const touches = new Set<string>();
let dashDemande = false;
let boutonsAvant: boolean[] = [];
const ecouteurs: ((code: string) => void)[] = [];

const BLOQUEES = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const DASH = ['Space', 'KeyJ'];
const AGRIPPE = ['ShiftLeft', 'ShiftRight', 'KeyK'];

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (BLOQUEES.includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  touches.add(e.code);
  if (DASH.includes(e.code)) dashDemande = true;
  for (const f of ecouteurs) f(e.code);
});
addEventListener('keyup', (e) => touches.delete(e.code));
addEventListener('blur', () => touches.clear());

/** Appelé une fois par appui : touches du clavier, et « Pad0 »… pour les boutons de manette. */
export const surAppui = (f: (code: string) => void) => { ecouteurs.push(f); };

const une = (...codes: string[]) => codes.some((c) => touches.has(c));

/** L'état des commandes pour ce pas ; le dash n'est rendu qu'une fois par appui. */
export function lire(): { mx: number; my: number; dash: boolean; agrippe: boolean } {
  let mx = (une('KeyD', 'ArrowRight') ? 1 : 0) - (une('KeyA', 'ArrowLeft') ? 1 : 0);
  let my = (une('KeyS', 'ArrowDown') ? 1 : 0) - (une('KeyW', 'ArrowUp') ? 1 : 0);
  let agrippe = une(...AGRIPPE);
  const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
  if (pad) {
    const [ax = 0, ay = 0] = pad.axes;
    if (Math.hypot(ax, ay) > 0.25) { mx = ax; my = ay; }
    const b = pad.buttons.map((k) => k.pressed);
    if (b[14]) mx = -1; if (b[15]) mx = 1; if (b[12]) my = -1; if (b[13]) my = 1;
    agrippe ||= !!(b[2] || b[5] || b[7]);
    if (b[0] && !boutonsAvant[0]) dashDemande = true;
    // Y, LB, Start, Select : les quatre émotes
    [3, 4, 9, 8].forEach((k, n) => { if (b[k] && !boutonsAvant[k]) for (const f of ecouteurs) f(`Digit${n + 1}`); });
    boutonsAvant = b;
  }
  const n = Math.hypot(mx, my);
  if (n > 1) { mx /= n; my /= n; }
  const dash = dashDemande;
  dashDemande = false;
  return { mx: Math.round(mx * 100) / 100, my: Math.round(my * 100) / 100, dash, agrippe };
}
