import type { CampusEvent } from "./models";

const cache = new Map<string, string>();
const ink = "#101010";
const paper = "#eeeeec";
const muted = "#a6a6a2";
const escapeXml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const svgUrl = (body: string, viewBox: string) =>
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
      viewBox +
      '">' +
      body +
      "</svg>",
  );

export function avatar(name: string, index = 0) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((n) => n[0] || "")
    .slice(0, 2)
    .join("");
  const shades = [
    "#e9e9e8",
    "#b7b7b4",
    "#393938",
    "#d4d4d0",
    "#30302f",
    "#ccc",
    "#434341",
    "#dedede",
  ];
  const dark = [2, 4, 6].includes(index % 8);
  return svgUrl(
    '<rect width="64" height="64" rx="32" fill="' +
      shades[index % 8] +
      '"/><text x="32" y="40" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="24" fill="' +
      (dark ? paper : ink) +
      '">' +
      escapeXml(initials) +
      "</text>",
    "0 0 64 64",
  );
}
export function clubLogo(i: number) {
  const shapes = [
    '<path d="m22 28-14 12 14 12m36-24 14 12-14 12M47 18 32 62"/>',
    '<path d="m40 8 30 32-30 32L10 40Zm0 14v34m-11-9h21m-17-9h14"/>',
    '<path d="m12 58 8-36 14 24 6-29 8 29 12-24 8 36z"/>',
    '<circle cx="40" cy="40" r="29"/><path d="m40 11 14 24m14 7-28-1M53 65 39 40M26 64l15-24M12 40h29M26 15l15 25"/>',
    '<path d="m10 54 60-38-16 46-14-14-12 11 4-18z"/>',
    '<path d="m12 56 20-32h12L24 56zm19 0 20-32h12L43 56z"/>',
  ];
  return svgUrl(
    '<rect width="80" height="80" fill="' +
      (i % 2 ? ink : paper) +
      '"/><g fill="none" stroke="' +
      (i % 2 ? paper : ink) +
      '" stroke-width="4" stroke-linejoin="round">' +
      shapes[i % 6] +
      "</g>",
    "0 0 80 80",
  );
}
const circles = (
  cx: number,
  cy: number,
  radii: number[],
  fill = "none",
  stroke = "currentColor",
) =>
  radii
    .map(
      (r) =>
        '<circle cx="' +
        cx +
        '" cy="' +
        cy +
        '" r="' +
        r +
        '" fill="' +
        fill +
        '" stroke="' +
        stroke +
        '" stroke-width="1.4"/>',
    )
    .join("");
const bolts = (x: number, y: number, r: number) =>
  '<g transform="translate(' +
  x +
  " " +
  y +
  ')"><circle r="' +
  r +
  '" fill="' +
  muted +
  '" stroke="' +
  ink +
  '" stroke-width="2"/><circle r="' +
  r * 0.55 +
  '" fill="' +
  ink +
  '"/><path d="M-' +
  r * 0.4 +
  " 0h" +
  r * 0.8 +
  '" stroke="' +
  paper +
  '" stroke-width="1.5"/></g>';
const repeat = (n: number, fn: (i: number) => string) =>
  Array.from({ length: n }, (_, i) => fn(i)).join("");
const robot =
  '<g stroke="' +
  ink +
  '" stroke-width="3" stroke-linejoin="round">' +
  '<path fill="#999" d="m47 321 76-31 72 18-76 34z"/><path fill="#444" d="m47 321 72 21v14l-72-22z"/><path fill="#777" d="m119 342 76-34v15l-76 33z"/>' +
  '<path fill="#bebebb" d="M77 295q34-21 77-2v26q-44 22-77-1z"/><ellipse cx="115" cy="294" rx="39" ry="15" fill="' +
  paper +
  '"/>' +
  '<path d="m94 291 8-67 23-11 23 13-8 67-24 16z" fill="#c0c0bd"/><path d="m125 213 23 13-8 67-24 16 9-81z" fill="#70706c"/>' +
  '<path d="m104 244-43-80 13-25 23-3 47 85-15 22z" fill="#bdbdb9"/><path d="m61 164 13-25 47 80-13 25z" fill="#e4e4df"/>' +
  '<path d="m70 154 81-75 26 3 13 19-85 78-23 1z" fill="#c7c7c4"/><path d="m82 165 82-75 16 10-84 73z" fill="#757573"/>' +
  '<path d="m165 83 15-9 23 7 17 27-14 13-14-2z" fill="#92928f"/><path d="m178 85 19-1 18 24-13 5z" fill="#ececea"/>' +
  '<path d="m197 118 18-16 30 17-13 16z" fill="#bdbdb9"/><path d="m220 119 17 10-4 13-22 14-13-1 26-22zM233 113l18 1 23 16 4 11-29-16-15 1z" fill="#a6a6a2"/>' +
  '<path d="M129 226Q92 161 90 156Q119 117 166 97" fill="none" stroke="' +
  ink +
  '" stroke-width="6"/><path d="M129 226Q92 161 90 156Q119 117 166 97" fill="none" stroke="#aaa" stroke-width="2" stroke-dasharray="2 4"/>' +
  bolts(116, 236, 21) +
  bolts(82, 155, 20) +
  bolts(168, 93, 17) +
  bolts(202, 110, 10) +
  '<path d="m98 283 11 4 3-29-11-7zm-15-97 9 16 6-3-10-16zm30-48 29-26 6 4-29 26z" fill="' +
  ink +
  '"/></g>';
const camera =
  '<g transform="rotate(-13 195 245)" stroke="#0a0a0a" stroke-width="3" stroke-linejoin="round">' +
  '<path d="m46 181 37-18 242 3 19 18v132l-20 14-263-6-15-12z" fill="#9a9a96"/><path d="m46 181 269 3v145l-254-5-15-12z" fill="#d6d6d2"/>' +
  '<path d="m60 211 244 3v89l-244-3z" fill="#232323"/><path d="m60 211 244 3v89l-244-3z" fill="url(#grain)"/>' +
  '<path d="m86 173 30-18h70l17 19 105 2 8 9-269-4z" fill="#ecece8"/><path d="M155 172l14-27h45l22 32z" fill="#bbb"/>' +
  '<rect x="66" y="187" width="40" height="14" fill="#282828"/><rect x="274" y="192" width="23" height="15" fill="#333"/>' +
  '<path d="m69 172 2-13h33v12zm195 4 1-10h23v10z" fill="#888"/>' +
  repeat(
    9,
    (i) => '<path d="m' + (72 + i * 3.5) + ' 160v9" stroke-width="1"/>',
  ) +
  '<circle cx="191" cy="248" r="66" fill="#242424"/><circle cx="179" cy="254" r="66" fill="#858581"/>' +
  repeat(
    84,
    (i) =>
      '<path d="M179 190v8" transform="rotate(' +
      (i * 360) / 84 +
      ' 179 254)" stroke-width="2"/>',
  ) +
  '<circle cx="175" cy="257" r="53" fill="#111"/>' +
  circles(175, 257, [51, 48, 40, 38, 33], "none", "#b8b8b3") +
  '<path d="m175 222 27 15 5 28-21 24-30-5-14-26 13-28z" fill="#686863"/><path d="m175 235 20 13-3 20-16 11-19-11-1-18z" fill="#252525"/>' +
  '<path d="m157 246 8-13 16-4-7 6-9 12z" fill="white"/><circle cx="188" cy="268" r="3" fill="#ccc"/>' +
  '<path d="m316 192 17-9v122l-17 12z" fill="#595955"/>' +
  bolts(56, 192, 3) +
  bolts(302, 317, 3) +
  "</g>";
function otherArt(i: number) {
  switch (i) {
    case 2:
    case 10:
      return (
        '<g transform="translate(20 6)">' +
        repeat(
          9,
          (n) =>
            '<g transform="translate(' +
            n * 7 +
            " " +
            -n * 5 +
            ')"><rect x="48" y="172" width="220" height="146" fill="var(--bg)" stroke="currentColor" stroke-width="2"/><path d="M48 190h220" stroke="currentColor"/><circle cx="59" cy="181" r="2" fill="currentColor"/></g>',
        ) +
        '<path d="m155 194-30 24 30 24m45-48 30 24-30 24m-11-63-16 75" fill="none" stroke="currentColor" stroke-width="9"/></g>'
      );
    case 3:
      return repeat(
        17,
        (n) =>
          '<rect x="' +
          (64 + n * 5) +
          '" y="' +
          (154 + n * 0.6) +
          '" width="' +
          (211 - n * 7) +
          '" height="' +
          (166 - n * 3) +
          '" transform="rotate(' +
          (n * 4 - 30) +
          ' 200 235)" fill="none" stroke="currentColor" stroke-width="2.5"/>',
      );
    case 4:
      return repeat(
        42,
        (n) =>
          '<path d="M40 ' +
          (190 + n * 3) +
          "q65 " +
          (-178 + n * 3) +
          ' 137 -15t170 14" fill="none" stroke="currentColor" stroke-width="1.6"/>',
      );
    case 5:
    case 11:
      return (
        '<g transform="rotate(-16 200 250)">' +
        repeat(
          2,
          (n) =>
            '<g transform="translate(' +
            n * 133 +
            " " +
            -14 * n +
            ')"><rect x="72" y="155" width="118" height="182" fill="#1c1c1b" stroke="#eee" stroke-width="2"/>' +
            circles(131, 207, [36, 34, 28, 20, 12, 7], "none", "#bbb") +
            circles(131, 285, [46, 43, 39, 32, 24, 17, 8], "none", "#eee") +
            "</g>",
        ) +
        "</g>"
      );
    case 6:
      return (
        '<g stroke="currentColor" stroke-width="3" fill="none"><ellipse cx="190" cy="299" rx="117" ry="18"/><path d="M100 218q8 84 84 86t83-86m0 8q58-16 36 20-8 13-46 23"/><ellipse cx="183" cy="219" rx="83" ry="19"/>' +
        repeat(
          11,
          (n) =>
            '<path d="M' +
            (141 + n * 8) +
            ' 200q34-22 4-42t8-33" stroke-width="1.7"/>',
        ) +
        "</g>"
      );
    case 7:
      return repeat(
        11,
        (n) =>
          '<rect x="' +
          (35 + 6 * n) +
          '" y="' +
          (151 + 6 * n) +
          '" width="' +
          (330 - n * 12) +
          '" height="' +
          (177 - n * 12) +
          '" rx="' +
          (88 - n * 6) +
          '" transform="rotate(-22 200 240)" fill="none" stroke="currentColor" stroke-width="2"/>',
      );
    case 8:
      return '<g transform="rotate(18 200 250)" stroke="currentColor" stroke-width="3" fill="none"><path d="M140 210v-36a56 56 0 1 1 112 0v36m-18 0v-36a38 38 0 1 0-76 0v36"/><rect x="120" y="210" width="153" height="111"/><circle cx="196" cy="253" r="11"/><path d="M196 264v23"/></g>';
    default:
      return (
        '<g fill="none" stroke="currentColor" stroke-width="3"><path d="m105 177 185 113m0-113L105 290" stroke-width="19"/><rect x="171" y="207" width="54" height="61" rx="8" fill="var(--bg)"/>' +
        [
          [105, 177],
          [290, 177],
          [105, 290],
          [290, 290],
        ]
          .map(
            ([x, y]) =>
              circles(x, y, [47, 43, 6]) +
              '<path d="m' +
              (x - 38) +
              " " +
              (y + 16) +
              'q24-23 38-16t38-16q-23 25-38 16t-38 16" fill="currentColor"/>',
          )
          .join("") +
        "</g>"
      );
  }
}
const posterHeadings = [
  ["BOT", "ARENA"],
  ["PHOTO", "WALK"],
  ["WEB + AI", "SPRINT"],
  ["DESIGN", "SYSTEMS"],
  ["OVERNIGHT", "HACKATHON"],
  ["BATTLE OF", "BANDS"],
  ["MIDNIGHT", "CHAI"],
  ["NIGHT RUN", "5K"],
  ["AFTER", "PARTY"],
  ["DRONE", "ASSEMBLY"],
  ["FRESHERS", "CODE JAM"],
  ["ACOUSTIC", "NIGHT"],
];
const clubPrint = [
  "CODERIT",
  "IEEE RIT-B",
  "UDBHAV",
  "LENSCRAFT RIT",
  "ROBOTICS & AERO",
  "RAMAIAH SPORTS",
];
export function poster(e: CampusEvent): string {
  if (e.posterUrl) return e.posterUrl;
  const key = [
    e.id,
    e.title,
    e.startTime,
    e.category,
    e.clubId,
    e.isPollMode,
  ].join("|");
  const existing = cache.get(key);
  if (existing) return existing;
  const idx = /^e([1-9]|1[0-2])$/.test(e.id) ? Number(e.id.slice(1)) - 1 : -1;
  const themeIndex = idx < 0 ? e.title.length : idx;
  const dark = [1, 4, 5, 8, 11].includes(themeIndex % 12);
  const bg = dark ? "#1b1b1a" : themeIndex === 0 ? "#dcdcd6" : "#e8e8e4";
  const fg = dark ? paper : ink;
  const titles = idx < 0 ? [e.title.toUpperCase()] : posterHeadings[idx];
  const titleSize = titles.some((t) => t.length > 12)
    ? 25
    : titles.some((t) => t.length > 7)
      ? 47
      : 65;
  const head = titles
    .map(
      (line, i) =>
        '<text x="22" y="' +
        (93 + i * (titleSize * 0.87)) +
        '" font-size="' +
        titleSize +
        '" font-family="Arial, sans-serif" font-weight="900" letter-spacing="-3.5">' +
        escapeXml(line) +
        "</text>",
    )
    .join("");
  const art =
    idx === 0
      ? '<g transform="translate(57 54)">' + robot + "</g>"
      : idx === 1
        ? '<g transform="translate(0 38)">' + camera + "</g>"
        : otherArt(idx);
  const date = e.isPollMode
    ? "DATE POLL OPEN"
    : new Date(e.startTime)
        .toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
        .toUpperCase();
  const footer =
    '<g font-family="monospace" font-size="11" letter-spacing="1"><text x="23" y="34">' +
    escapeXml(clubPrint[Number(e.clubId.slice(1)) - 1] || "PLUGGED") +
    '</text><text x="377" y="34" text-anchor="end">' +
    escapeXml(e.category.toUpperCase()) +
    '</text><text x="23" y="470">' +
    escapeXml(date) +
    '</text><text x="377" y="470" text-anchor="end">RIT / BENGALURU</text></g>';
  const url = svgUrl(
    '<defs><pattern id="grain" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#777"/></pattern><pattern id="dot" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".6" fill="' +
      fg +
      '"/></pattern></defs><g style="color:' +
      fg +
      ";--bg:" +
      bg +
      '" fill="' +
      fg +
      '"><rect width="400" height="500" fill="' +
      bg +
      '"/><rect x="17" y="160" width="366" height="264" fill="url(#dot)" opacity=".48"/>' +
      head +
      art +
      '<g fill="none" stroke="currentColor" stroke-width=".8"><path d="M22 45h356M22 447h356M20 405v12h10m350-255v-12h-12"/></g>' +
      footer +
      "</g>",
    "0 0 400 500",
  );
  cache.set(key, url);
  return url;
}
export function albumArt(i: number) {
  const screens = repeat(
    3,
    (n) =>
      '<g transform="translate(' +
      (45 + n * 126) +
      " " +
      (57 + (n % 2) * 22) +
      ')"><path d="m0 16 81-11v58L0 80z" fill="#181818" stroke="#aaa"/><path d="m6 22 67-10v43L6 68z" fill="#555"/>' +
      repeat(
        6,
        (m) => '<path d="m11 ' + (26 + m * 5) + ' 36-5" stroke="#bbb"/>',
      ) +
      '<path d="m0 80 81-17 21 9-78 20z" fill="#a9a9a3"/></g>',
  );
  return svgUrl(
    '<rect width="440" height="240" fill="#bbb"/><path d="m0 155 440-81v166H0" fill="#6e6e6a"/><g transform="translate(' +
      -27 * i +
      " " +
      i * 3 +
      ") scale(" +
      (1 + 0.11 * i) +
      ')">' +
      screens +
      '</g><path d="M0 207l440-83v116H0z" fill="#383836"/><path d="m0 205 440-82" stroke="#eee"/><text x="15" y="223" font-family="monospace" font-size="12" fill="#eee">CODERIT / OPEN LAB</text>',
    "0 0 440 240",
  );
}
