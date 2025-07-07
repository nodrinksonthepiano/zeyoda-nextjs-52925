CREATE OR REPLACE FUNCTION increment_download_count(p_artist_id TEXT, p_asset_number INT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.artist_assets
  SET download_count = download_count + 1
  WHERE artist_id = p_artist_id AND asset_number = p_asset_number;
END;
$$ LANGUAGE plpgsql; 