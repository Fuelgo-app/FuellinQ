-- 02_seed_fuellinq_pages.sql
-- Voegt standaardpagina's toe aan de `pages` tabel voor Fuellinq.

INSERT INTO pages (title, slug, content_md, status, show_in_footer, footer_order)
VALUES
-- Algemene Voorwaarden
('Algemene Voorwaarden', 'algemene-voorwaarden', '...CONTENT ALGEMENE VOORWAARDEN HIER...', 'published', true, 1),
-- Privacybeleid
('Privacybeleid', 'privacybeleid', '...CONTENT PRIVACYBELEID HIER...', 'published', true, 2),
-- Cookieverklaring
('Cookieverklaring', 'cookieverklaring', '...CONTENT COOKIEVERKLARING HIER...', 'published', true, 3),
-- Contact
('Contact', 'contact', '...CONTENT CONTACT HIER...', 'published', true, 4)
ON CONFLICT (slug) DO NOTHING;

-- LET OP: vervang de placeholder-teksten door de volledige content die ik in de vorige stap heb uitgewerkt.