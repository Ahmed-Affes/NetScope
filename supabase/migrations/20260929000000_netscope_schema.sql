-- NetScope Supabase Schema Migration
-- Cloud-only persistence layer for devices, sessions, chunks, and threats

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. User Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Registered Devices
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    device_name TEXT NOT NULL,
    os TEXT NOT NULL,
    hostname TEXT,
    last_seen TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Recorded Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    mode TEXT DEFAULT 'live' NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    total_bytes_in BIGINT DEFAULT 0 NOT NULL,
    total_bytes_out BIGINT DEFAULT 0 NOT NULL,
    total_packets BIGINT DEFAULT 0 NOT NULL,
    peak_nodes INT DEFAULT 0 NOT NULL,
    peak_links INT DEFAULT 0 NOT NULL,
    sample_count INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Session Nodes (Topology summary per session)
CREATE TABLE IF NOT EXISTS public.session_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    node_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    ip TEXT,
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,
    total_bytes_in BIGINT DEFAULT 0 NOT NULL,
    total_bytes_out BIGINT DEFAULT 0 NOT NULL
);

-- 5. Session Links
CREATE TABLE IF NOT EXISTS public.session_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    link_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    proto TEXT NOT NULL,
    port INT NOT NULL,
    total_bytes BIGINT DEFAULT 0 NOT NULL
);

-- 6. Sample Chunks (10s batched samples)
CREATE TABLE IF NOT EXISTS public.sample_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    chunk_index INT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    data_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_session_chunk UNIQUE (session_id, chunk_index)
);

-- 7. Security Alerts
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    severity TEXT NOT NULL,
    rule TEXT NOT NULL,
    node_id TEXT,
    link_id TEXT,
    description TEXT NOT NULL,
    acked BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Blocked IPs (Firewall blocklist)
CREATE TABLE IF NOT EXISTS public.blocked_ips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    ip TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_blocked_ip UNIQUE (user_id, ip)
);

-- 9. IP Intelligence Cache (Public read cache)
CREATE TABLE IF NOT EXISTS public.ip_intel (
    ip TEXT PRIMARY KEY,
    hostname TEXT,
    country TEXT,
    asn TEXT,
    org TEXT,
    threat_score INT DEFAULT 0 NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Shared Sessions (Link sharing / phone viewer)
CREATE TABLE IF NOT EXISTS public.shared_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    share_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMPTZ
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_intel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can view and update own profile
CREATE POLICY "Users can manage own profile"
    ON public.profiles FOR ALL
    USING (auth.uid() = id);

-- Devices: Users can manage own devices
CREATE POLICY "Users can manage own devices"
    ON public.devices FOR ALL
    USING (auth.uid() = user_id);

-- Sessions: Users can manage own sessions
CREATE POLICY "Users can manage own sessions"
    ON public.sessions FOR ALL
    USING (auth.uid() = user_id);

-- Session Nodes: Users can manage nodes in their sessions
CREATE POLICY "Users can manage own session nodes"
    ON public.session_nodes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.sessions
            WHERE sessions.id = session_nodes.session_id
            AND sessions.user_id = auth.uid()
        )
    );

-- Session Links: Users can manage links in their sessions
CREATE POLICY "Users can manage own session links"
    ON public.session_links FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.sessions
            WHERE sessions.id = session_links.session_id
            AND sessions.user_id = auth.uid()
        )
    );

-- Sample Chunks: Users can manage chunks in their sessions, or read if shared
CREATE POLICY "Users can manage own sample chunks"
    ON public.sample_chunks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.sessions
            WHERE sessions.id = sample_chunks.session_id
            AND sessions.user_id = auth.uid()
        )
    );

-- Alerts: Users can manage own alerts
CREATE POLICY "Users can manage own alerts"
    ON public.alerts FOR ALL
    USING (auth.uid() = user_id);

-- Blocked IPs: Users can manage own blocked IPs
CREATE POLICY "Users can manage own blocked ips"
    ON public.blocked_ips FOR ALL
    USING (auth.uid() = user_id);

-- IP Intel: Authenticated users can read intelligence
CREATE POLICY "Users can read IP intel"
    ON public.ip_intel FOR SELECT
    TO authenticated
    USING (true);

-- Shared Sessions: Public read with valid token, user manages own shares
CREATE POLICY "Anyone can view shared session by token"
    ON public.shared_sessions FOR SELECT
    USING (expires_at IS NULL OR expires_at > now());

CREATE POLICY "Users can manage own shared sessions"
    ON public.shared_sessions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.sessions
            WHERE sessions.id = shared_sessions.session_id
            AND sessions.user_id = auth.uid()
        )
    );

-- RPC for optimized chunk batch insertion
CREATE OR REPLACE FUNCTION public.insert_session_chunk(
    p_session_id UUID,
    p_chunk_index INT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_data JSONB
) RETURNS UUID AS $$
DECLARE
    v_chunk_id UUID;
BEGIN
    INSERT INTO public.sample_chunks (session_id, chunk_index, start_time, end_time, data_json)
    VALUES (p_session_id, p_chunk_index, p_start_time, p_end_time, p_data)
    ON CONFLICT (session_id, chunk_index) DO UPDATE
    SET data_json = EXCLUDED.data_json, end_time = EXCLUDED.end_time
    RETURNING id INTO v_chunk_id;

    RETURN v_chunk_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
