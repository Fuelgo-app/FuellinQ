-- schema.sql  — MaxAndGo / FuelGo backend

/* ======================= Companies ======================= */
create table if not exists companies (
  id serial primary key,
  name text not null,
  created_at timestamptz default now(),
  -- Stripe / billing
  stripe_customer_id         text,
  stripe_subscription_id     text,
  stripe_subscription_status text,
  plan_price_id              text,
  stripe_metered_price_id    text,
  stripe_metered_item_id     text
);

alter table companies
  add column if not exists stripe_customer_id         text,
  add column if not exists stripe_subscription_id     text,
  add column if not exists stripe_subscription_status text,
  add column if not exists plan_price_id              text,
  add column if not exists stripe_metered_price_id    text,
  add column if not exists stripe_metered_item_id     text;

create index if not exists companies_stripe_customer_idx on companies (stripe_customer_id);
create index if not exists companies_stripe_sub_idx      on companies (stripe_subscription_id);


/* ========================= Users ========================= */
create table if not exists users (
  id serial primary key,
  company_id int references companies(id) on delete set null,
  email text unique not null,
  password_hash text not null,
  role text not null default 'user',
  first_name text,
  last_name  text,
  created_at timestamptz default now()
);

create index if not exists users_email_idx on users (lower(email));


/* =================== Dashboard data ====================== */
-- Vehicles
create table if not exists vehicles (
  id serial primary key,
  company_id int references companies(id) on delete cascade,
  plate text not null,
  label text,
  limit_daily int default 0,
  geofence_required boolean default false,
  created_at timestamptz default now()
);

-- Cards / passen
create table if not exists cards (
  id serial primary key,
  company_id int references companies(id) on delete cascade,
  label text not null,
  last4 text,
  created_at timestamptz default now()
);

-- Invoices (demo)
create table if not exists invoices (
  id serial primary key,
  company_id int references companies(id) on delete cascade,
  number text unique,
  amount_cents int not null default 0,
  status text not null default 'open',
  created_at timestamptz default now()
);


/* ================= Branding / settings =================== */
create table if not exists company_settings (
  company_id int primary key references companies(id) on delete cascade,
  brand_name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  font_family text,
  updated_at timestamptz default now()
);


/* ============ Company-specifieke CMS pagina's ============ */
create table if not exists company_pages (
  company_id int references companies(id) on delete cascade,
  slug text not null,              -- 'overview' | 'about' | 'contact' | etc.
  title text,
  body  text,
  media_url text,                  -- /uploads/...
  updated_at timestamptz default now(),
  primary key (company_id, slug)
);


/* ================ Company footer-inhoud =================== */
create table if not exists company_footer (
  company_id int primary key references companies(id) on delete cascade,
  -- bijv. { "termsUrl":"...", "privacyUrl":"...", "legalUrl":"...", "text":"..." }
  links jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);


/* ================== Publieke site-pagina's =================
   (globaal, NIET company-specifiek)                          */
create table if not exists pages (
  id serial primary key,
  slug  text unique not null,             -- 'overview','about','contact','privacy','terms','download', ...
  title text not null,
  body  text not null default '',
  status text not null default 'published',
  media_url text,
  show_in_footer boolean not null default false,
  footer_order int not null default 9999,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Migratie: als oude kolom 'content_md' bestaat en 'body' niet, hernoem
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name='pages' and column_name='content_md'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name='pages' and column_name='body'
  ) then
    alter table pages rename column content_md to body;
  end if;
end$$;

-- Backfill ontbrekende kolommen (veilig voor bestaande DB's)
alter table pages
  add column if not exists status        text not null default 'published',
  add column if not exists media_url     text,
  add column if not exists show_in_footer boolean not null default false,
  add column if not exists footer_order  int not null default 9999,
  add column if not exists created_at    timestamptz default now(),
  add column if not exists updated_at    timestamptz default now();

create unique index if not exists pages_slug_idx   on pages (lower(slug));
create index        if not exists idx_pages_footer on pages (show_in_footer, footer_order);
create index        if not exists idx_pages_status on pages (status);

-- Seed standaardpagina's (één keer; volgende runs slaan over)
insert into pages (slug, title, body, show_in_footer, footer_order, media_url)
values
  ('overview',  'Dashboard',             '', false,  5,  null),
  ('contact',   'Service & Contact',     '', true,  10,  null),
  ('faq',       'Meest gestelde vragen', '', true,  20,  null),
  ('about',     'Over ons',              '', true,  30,  null),
  ('jobs',      'Vacatures',             '', true,  40,  null),
  ('partners',  'Samenwerkingen',        '', true,  50,  null),
  ('privacy',   'Privacyverklaring',     '', true,  90,  null),
  ('terms',     'Algemene voorwaarden',  '', true,  95,  null),
  ('download',  'Download de App',       '', true,  15,  null)
on conflict (slug) do nothing;
/* ======================= Stations ======================== */
create table if not exists stations (
  id              serial primary key,
  name            text not null,
  address         text,
  owner_user_id   int references users(id) on delete set null, -- eigenaar (stationhouder)
  created_at      timestamptz default now()
);

create index if not exists stations_owner_idx on stations (owner_user_id);
create index if not exists stations_name_idx  on stations (lower(name));


/* ======================== Offers ========================= */
create table if not exists offers (
  id          serial primary key,
  station_id  int not null references stations(id) on delete cascade,
  title       text not null,
  subtitle    text,
  badge       text,
  image_url   text,
  valid_from  date,
  valid_until date,
  created_at  timestamptz default now()
);

create index if not exists offers_station_idx  on offers (station_id);
create index if not exists offers_created_idx  on offers (created_at desc);


/* ===================== Fuel prices ======================= */
create table if not exists fuel_prices (
  id           serial primary key,
  station_id   int not null references stations(id) on delete cascade,
  fuel_type    text not null,     -- e10, e5_98, diesel, diesel_plus, lpg, ac_kwh, dc_kwh
  price_cents  int  not null,     -- 1999 = €19,99 (of 1,999 → 1999 bij liters/kWh)
  updated_at   timestamptz default now(),
  unique (station_id, fuel_type)
);

create index if not exists fuel_prices_station_idx on fuel_prices (station_id);
create index if not exists fuel_prices_type_idx    on fuel_prices (fuel_type);
