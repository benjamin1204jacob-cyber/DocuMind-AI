/*
  # Create Users and Analyses Tables

  ## Summary
  This migration sets up the core data tables for DocuMind AI, replacing Firebase/Firestore with Supabase.

  ## New Tables

  ### 1. `profiles`
  Stores user profile information linked to Supabase Auth.
  - `id` (uuid, primary key) - matches auth.users id
  - `email` (text, unique) - user email address
  - `display_name` (text) - user's display name
  - `photo_url` (text) - URL to profile photo
  - `tier` (text) - subscription tier: 'free', 'pro', 'premium'
  - `created_at` (timestamptz) - account creation time
  - `updated_at` (timestamptz) - last update time

  ### 2. `analyses`
  Stores AI analysis results for each user.
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to profiles.id)
  - `file_name` (text) - name(s) of analyzed files
  - `question` (text) - user's question
  - `answer` (text) - AI generated answer
  - `created_at` (timestamptz) - analysis creation time

  ## Security
  - RLS enabled on both tables
  - Users can only read/write their own data
  - Profiles auto-created on user signup via trigger

  ## Notes
  1. Trigger function `handle_new_user` auto-creates profile on auth signup
  2. Indexes on user_id and created_at for efficient history queries
  3. Cascade delete: when a user is deleted, their analyses are deleted too
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  display_name text DEFAULT '',
  photo_url text DEFAULT '',
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'premium')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analyses_user_id_idx ON analyses(user_id);
CREATE INDEX IF NOT EXISTS analyses_created_at_idx ON analyses(created_at DESC);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own analyses"
  ON analyses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON analyses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON analyses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
  ON analyses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, photo_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    photo_url = COALESCE(EXCLUDED.photo_url, profiles.photo_url),
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
