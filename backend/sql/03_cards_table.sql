-- backend/sql/03_cards_table.sql
-- Maak "cards" tabel voor tankpassen per gebruiker

CREATE TABLE IF NOT EXISTS cards (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT    NOT NULL,
  last4      VARCHAR(4),
  active     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eén actieve pas per user afdwingen (optioneel, laat unique alleen TRUE toe)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_card_per_user
  ON cards(user_id)
  WHERE active = TRUE;

-- Handige index
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
