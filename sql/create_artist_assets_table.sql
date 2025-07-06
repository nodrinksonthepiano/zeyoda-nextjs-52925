-- Phase B: Create artist_assets table
-- Execute this SQL in your Supabase SQL Editor

-- Create the artist_assets table
CREATE TABLE IF NOT EXISTS public.artist_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id text REFERENCES public.artists(id),
  asset_number int NOT NULL,
  file_url text NOT NULL,
  file_type text DEFAULT 'video/mp4',
  file_size_bytes bigint,
  price_usd numeric DEFAULT 1,
  download_count int DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (artist_id, asset_number)
);

-- Enable Row Level Security
ALTER TABLE public.artist_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public read assets"
  ON public.artist_assets FOR SELECT USING (true);

CREATE POLICY "Admin manage assets"
  ON public.artist_assets FOR INSERT, UPDATE, DELETE
  USING (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_artist_assets_artist_id ON public.artist_assets(artist_id);
CREATE INDEX idx_artist_assets_created ON public.artist_assets(created_at DESC);

-- Seed the table with existing assets
INSERT INTO public.artist_assets
  (artist_id, asset_number, file_url, metadata)
VALUES
  ('gosheesh', 1, '/assets/1GOSHEESH.mp4',
   '{"title":"NLi10 #1","desc":"Cosmic Bloom primary artwork"}'),
  ('jaitea',   1, '/assets/2JAITEA.mp4',
   '{"title":"Earth #2","desc":"Serenity Streams primary artwork"}');

-- Verify the setup
SELECT 
  'artist_assets table created' as status,
  COUNT(*) as row_count,
  MIN(created_at) as first_asset,
  MAX(created_at) as last_asset
FROM public.artist_assets; 