// src/components/Footer.jsx
import React from "react";
import { Link } from "react-router-dom";
import { getFooterLinks } from "../lib/footer";

export default function Footer() {
  const links = [...getFooterLinks()].sort(
    (a, b) => (a.footer_order ?? 0) - (b.footer_order ?? 0)
  );

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container">
        <nav className="footer-nav" aria-label="Footer links">
          {links.map(({ slug, title }) => {
            const isExternal = /^(https?:)?\/\//i.test(slug) || /^mailto:|^tel:/i.test(slug);
            if (isExternal) {
              return (
                <a key={slug} href={slug} target="_blank" rel="noreferrer">
                  {title}
                </a>
              );
            }

            // interne pagina: werkt met "/:slug" of "/page/:slug"
            const path =
              slug.startsWith("/") || slug.startsWith("page/")
                ? (slug.startsWith("page/") ? `/${slug}` : slug)
                : `/${slug}`;

            return (
              <Link key={slug} to={path}>
                {title}
              </Link>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}
