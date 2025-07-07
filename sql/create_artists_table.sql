-- Create the artists table
CREATE TABLE IF NOT EXISTS public.artists (
  id text PRIMARY KEY,
  name text NOT NULL,
  display_name text NOT NULL,
  token_name text NOT NULL,
  artwork_title text NOT NULL,
  artwork_year text NOT NULL,
  token_price numeric DEFAULT 0,
  video_src text NOT NULL,
  primary_color text NOT NULL,
  accent_color text NOT NULL,
  gradient_start text NOT NULL,
  gradient_middle text NOT NULL,
  gradient_end text NOT NULL,
  font_family text DEFAULT 'Geist',
  orbital_tokens jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public read artists"
  ON public.artists FOR SELECT USING (true);

CREATE POLICY "Admin manage artists"
  ON public.artists FOR INSERT, UPDATE, DELETE
  USING (auth.role() = 'service_role');

-- Create indexes
CREATE INDEX idx_artists_token_name ON public.artists(token_name);

-- Seed initial data
INSERT INTO public.artists (
  id,
  name,
  display_name,
  token_name,
  artwork_title,
  artwork_year,
  token_price,
  video_src,
  primary_color,
  accent_color,
  gradient_start,
  gradient_middle,
  gradient_end,
  font_family,
  orbital_tokens
) VALUES
(
  'gosheesh',
  'GOSHEESH',
  'GOSHEESH',
  'GOSHEESH',
  'NLi10 #1',
  '2024',
  20,
  '/assets/1GOSHEESH.mp4',
  '#FF3366',
  '#33FF99',
  '#FF3366',
  '#9933FF',
  '#33FF99',
  'Bungee',
  '[{"name": "GOSHEESH", "angle": 0}, {"name": "JAITEA", "angle": 120}]'
),
(
  'jaitea',
  'JAITEA',
  'JAITEA',
  'JAITEA',
  'Earth #2',
  '2024',
  20,
  '/assets/2JAITEA.mp4',
  '#33FF99',
  '#FF3366',
  '#33FF99',
  '#FF3366',
  '#9933FF',
  'Bungee',
  '[{"name": "JAITEA", "angle": 0}, {"name": "GOSHEESH", "angle": 240}]'
);

-- Verify the setup
SELECT 
  'artists table created' as status,
  COUNT(*) as row_count,
  MIN(created_at) as first_artist,
  MAX(created_at) as last_artist
FROM public.artists; 