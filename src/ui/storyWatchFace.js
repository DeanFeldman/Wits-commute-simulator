// Full-frame vector layer: fixed angles avoid inconsistencies in generated hands.
const WATCHES = [
  // Dial centre, canvas width, and inner bezel radii measured on each PNG.
  [834.5, 705.5, 1672, 63.5, 60.5], [835, 705, 1672, 63, 60],
  [834.5, 704.5, 1672, 61.5, 59.5], [836.5, 706, 1670, 67.5, 61],
  [834.5, 705.5, 1672, 61.5, 60.5], [836, 705, 1672, 62, 59]
];

export function storyWatchFace(variant) {
  const [centreX, centreY, width, radiusX, radiusY] = WATCHES[Number.isInteger(variant) ? variant : 0] ?? WATCHES[0];
  const cx = 0;
  const cy = 0;
  const point = (degrees, length) => {
    const radians = degrees * Math.PI / 180;
    return [cx + Math.sin(radians) * length, cy - Math.cos(radians) * length];
  };
  const numbers = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 1;
    const [x, y] = point(hour * 30, 49);
    return `<text x="${x}" y="${y}" dominant-baseline="central" text-anchor="middle">${hour}</text>`;
  }).join("");
  const [mx, my] = point(330, 45); // 55 minutes: exactly 11.
  const [hx, hy] = point(237.5, 27); // 7 + 55/60 hours: just before 8.
  // Small, repeatable flecks echo the painted raster artwork without animated noise.
  const grain = Array.from({ length: 180 }, (_, i) => {
    const x = ((i * 47) % 118) - 59;
    const y = ((i * 71 + Math.floor(i / 7) * 13) % 118) - 59;
    return `<rect x="${x}" y="${y}" width="${1 + i % 3}" height="${1 + i % 2}" fill="${i % 2 ? '#fff4d9' : '#7e7057'}" opacity="0.075"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 941">
    <defs>
      <radialGradient id="dial" cx="35%" cy="28%" r="76%">
        <stop stop-color="#eee3cb"/><stop offset="0.66" stop-color="#dfd0b3"/><stop offset="1" stop-color="#bdac8e"/>
      </radialGradient>
      <radialGradient id="bezel-shadow">
        <stop offset="0.79" stop-color="#463b2b" stop-opacity="0"/>
        <stop offset="0.94" stop-color="#463b2b" stop-opacity="0.09"/>
        <stop offset="1" stop-color="#352e24" stop-opacity="0.42"/>
      </radialGradient>
      <radialGradient id="edge"><stop offset="0.975" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#fff6df" stop-opacity="0.16"/><stop offset="0.5" stop-color="#fff6df" stop-opacity="0"/>
        <stop offset="1" stop-color="#4c4336" stop-opacity="0.05"/>
      </linearGradient>
      <mask id="feather"><circle r="60" fill="url(#edge)"/></mask>
      <clipPath id="face"><circle r="60"/></clipPath>
    </defs>
    <g transform="translate(${centreX} ${centreY}) scale(${radiusX / 60} ${radiusY / 60})">
    <g mask="url(#feather)">
    <circle cx="0" cy="0" r="60" fill="url(#dial)"/>
    <g clip-path="url(#face)">${grain}</g>
    <g fill="#4a4030" font-family="Arial,sans-serif" font-size="11" font-weight="bold">${numbers}</g>
    <g stroke="#684324" stroke-linecap="round">
      <path d="M ${cx} ${cy} L ${mx} ${my}" stroke-width="3"/>
      <path d="M ${cx} ${cy} L ${hx} ${hy}" stroke-width="5.5"/>
    </g><circle cx="${cx}" cy="${cy}" r="3.5" fill="#805022"/>
    <circle r="60" fill="url(#glass)"/>
    <circle r="60" fill="url(#bezel-shadow)"/>
    </g>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
