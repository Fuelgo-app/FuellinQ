// src/lib/footer.js

// Standaardlinks voor je publieke footer (volgorde zoals jij wilt)
export const DEFAULT_FOOTER_LINKS = [
  { title: "Algemene Voorwaarden",     slug: "algemene-voorwaarden",     inFooter: true },
  { title: "Privacybeleid",             slug: "privacybeleid",             inFooter: true },
  { title: "Cookieverklaring",          slug: "cookieverklaring",          inFooter: true },
  { title: "Contact",                   slug: "contact",                   inFooter: true },
  { title: "Download de App",           slug: "download-de-app",           inFooter: true },
  { title: "Meest gestelde vragen",     slug: "meest-gestelde-vragen",     inFooter: true },
  { title: "Over ons",                  slug: "over-ons",                  inFooter: true },
  { title: "Vacatures",                 slug: "vacatures",                 inFooter: true },
  { title: "Samenwerkingen",            slug: "samenwerkingen",            inFooter: true },
];

// Leest de footer-links (uit localStorage als die bestaan, anders defaults)
// - Haalt dubbels weg op basis van 'slug'
// - Toont alleen items met inFooter !== false
export function getFooterLinks() {
  try {
    const raw = localStorage.getItem("footer_links");
    const arr = raw ? JSON.parse(raw) : DEFAULT_FOOTER_LINKS;

    const seen = new Set();
    return arr.filter((it) => {
      const key = (it.slug || "").toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return it.inFooter !== false;
    });
  } catch {
    return DEFAULT_FOOTER_LINKS;
  }
}

// Slaat de bewerkte lijst op in localStorage
export function saveFooterLinks(arr) {
  if (!Array.isArray(arr)) return;
  localStorage.setItem("footer_links", JSON.stringify(arr));
}
