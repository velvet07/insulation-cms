-- ThermoDesk Website Database Schema
-- Run this in your Supabase SQL Editor

-- Demo Requests Table
CREATE TABLE IF NOT EXISTS demo_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  message TEXT,
  company_size TEXT,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'new' -- new, contacted, converted, closed
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_demo_requests_created_at ON demo_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_requests_status ON demo_requests(status);

-- Newsletter Subscriptions Table
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'footer',
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscriptions(email);

-- Contact Messages Table
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  replied_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE demo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Policies for anonymous insert (for website forms)
CREATE POLICY "Allow anonymous insert on demo_requests"
  ON demo_requests FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous insert on newsletter_subscriptions"
  ON newsletter_subscriptions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous insert on contact_messages"
  ON contact_messages FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policies for authenticated users (admin access)
CREATE POLICY "Allow authenticated read on demo_requests"
  ON demo_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated update on demo_requests"
  ON demo_requests FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on newsletter_subscriptions"
  ON newsletter_subscriptions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated update on newsletter_subscriptions"
  ON newsletter_subscriptions FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on contact_messages"
  ON contact_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated update on contact_messages"
  ON contact_messages FOR UPDATE
  TO authenticated
  USING (true);
