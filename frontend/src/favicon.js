/*
  Favicon da marca — o "P" com o tick dourado — injetado via JS como SVG (data URI).
  Mesmo vetor da logomarca (viewBox do símbolo), sobre um "tile" navy arredondado.
*/
const P_PATH = 'M9758 6082c-27,19 -6,2 -27,25 -3,3 -17,21 -21,26l-107 164c-42,62 -133,164 -139,229 -26,281 -23,344 -187,520 -424,451 -1229,118 -1162,-578 37,-387 419,-672 799,-597 136,27 134,-20 225,-97 38,-32 59,-54 100,-83 29,-21 66,-47 89,-72 -128,-116 -448,-164 -658,-145 -226,21 -426,129 -557,241 -367,313 -379,607 -381,1219l2 1485 401 -114 -3 -981c45,24 34,23 72,59 523,502 1410,198 1610,-510 110,-388 -1,-542 -56,-791z';
const CHECK_PATH = 'M8784 6414c-58,-14 -130,-41 -200,-62l-175 -42c-61,2 27,-11 -26,3 -105,28 76,227 171,371 52,77 179,299 249,341 89,-24 271,-321 334,-407 102,-139 207,-290 310,-431 108,-149 202,-282 307,-434 102,-149 204,-281 309,-432 16,-22 194,-233 49,-198 -19,5 -174,154 -203,181 -280,260 -478,478 -745,736 -127,123 -263,248 -380,374z';

export function injectFavicon() {
  // O símbolo ocupa x 7732–10169, y 5119–8419; o tile de 64px envolve com folga.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#152641"/>
  <g transform="translate(32 33.5) scale(0.0163) translate(-8950 -6769)">
    <path fill="#F8F8F6" d="${P_PATH}"/>
    <path fill="#D8B55C" d="${CHECK_PATH}"/>
  </g>
</svg>`;
  const href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = href;
}
