-- 01_pages_table.sql
CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content_md TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published', -- 'draft' | 'published'
  show_in_footer BOOLEAN NOT NULL DEFAULT false,
  footer_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);
CREATE INDEX IF NOT EXISTS idx_pages_footer ON pages(show_in_footer, footer_order);

-- 02_seed_default_pages.sql (optional: run separately if you want starter pages)
-- INSERT INTO pages (title, slug, content_md, status, show_in_footer, footer_order) VALUES
-- ('Algemene Voorwaarden', 'algemene-voorwaarden', '# Algemene Voorwaarden\n…', 'published', true, 1),
-- ('Privacybeleid', 'privacybeleid', '# Privacybeleid\n…', 'published', true, 2),
-- ('Cookieverklaring', 'cookieverklaring', '# Cookieverklaring\n…', 'published', true, 3),
-- ('Contact', 'contact', 'Mail ons op support@fuellinq.com', 'published', true, 4)
-- ON CONFLICT (slug) DO NOTHING;