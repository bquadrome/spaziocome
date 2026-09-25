const ICONS = {
  starlink: (
    <img className="starlink" src="/assets/icon-starlink.png" alt="" width={34} height={28} />
  ),
  desk: (
    <img src="/assets/icon-desk.svg" alt="" width={28} height={28} />
  ),
  people: (
    <img src="/assets/icon-network.svg" alt="" width={28} height={28} />
  ),
  av: (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        fill="#002EC1"
        d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm0 14H3V5h18v12Z"
      />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        fill="#002EC1"
        d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2Zm0 16H5V10h14v10Zm0-12H5V6h14v2Z"
      />
    </svg>
  ),
  access: (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        fill="#002EC1"
        d="M2 21h18v-2H2v2Zm18-13h-2V5H4v12h12c1.66 0 3-1.34 3-3v-3c0-1.66-1.34-3-3-3Zm0 5h-2v-3h2v3Z"
      />
    </svg>
  ),
  layout: (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        fill="#002EC1"
        d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z"
      />
    </svg>
  ),
  audience: (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        fill="#002EC1"
        d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z"
      />
    </svg>
  ),
  visibility: (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="6" r="2.4" fill="#002EC1" />
      <circle cx="6" cy="18" r="2.4" fill="#002EC1" />
      <circle cx="18" cy="18" r="2.4" fill="#002EC1" />
      <path
        d="M10.4 7.6 7.2 16.1M13.6 7.6l3.2 8.5M8.4 18h7.2"
        stroke="#002EC1"
        strokeWidth="1.8"
        fill="none"
      />
    </svg>
  ),
  grant: (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        fill="#002EC1"
        d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2Zm0 14H4v-6h16v6Zm0-10H4V6h16v2Z"
      />
    </svg>
  ),
  codesign: (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        fill="#002EC1"
        d="M10 9c0-1.66-1.34-3-3-3S4 7.34 4 9s1.34 3 3 3 3-1.34 3-3Zm10 0c0-1.66-1.34-3-3-3s-3 1.34-3 3 1.34 3 3 3 3-1.34 3-3ZM7 14c-2.33 0-7 1.17-7 3.5V20h10v-2.5C10 15.17 9.33 14 7 14Zm10 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V20h6v-2.5c0-2.33-4.67-3.5-7-3.5Z"
      />
    </svg>
  ),
  training: (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        fill="#002EC1"
        d="M16.5 13c1.38 0 2.5-1.12 2.5-2.5S17.88 8 16.5 8 14 9.12 14 10.5s1.12 2.5 2.5 2.5Zm-9 0C8.88 13 10 11.88 10 10.5S8.88 8 7.5 8 5 9.12 5 10.5 6.12 13 7.5 13ZM12 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3Zm0 1c.83 0 1.6-.17 2.28-.46C13.5 15.2 13 16.2 13 17.5V20h8v-2.5c0-1.93-3.22-3.5-6-3.5-.34 0-.67.02-1 .06.66.5 1.16 1.16 1.42 1.94H12Zm-5 0c-2.78 0-6 1.57-6 3.5V20h8v-2.5c0-1.3-.5-2.3-1.28-2.96A7.3 7.3 0 0 0 7 15Z"
      />
    </svg>
  ),
}

export default function SpaceTagIcon({ name }) {
  return ICONS[name] ?? null
}
