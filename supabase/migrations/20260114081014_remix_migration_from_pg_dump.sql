CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    version_name text NOT NULL,
    content text,
    important_notes text,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false
);


--
-- Name: desc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."desc" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lo_id uuid,
    video_id uuid,
    CONSTRAINT desc_type_check CHECK ((type = ANY (ARRAY['LODesc'::text, 'VideoDesc'::text])))
);


--
-- Name: desc_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.desc_version (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    desc_id uuid NOT NULL,
    version_name text NOT NULL,
    content text,
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dsl_script; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dsl_script (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    desc_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false
);


--
-- Name: dsl_script_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dsl_script_version (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dsl_script_id uuid NOT NULL,
    version_name text NOT NULL,
    content text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false
);


--
-- Name: lo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false
);


--
-- Name: lo_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lo_version (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lo_id uuid NOT NULL,
    version_name text NOT NULL,
    content text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false
);


--
-- Name: video; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: video_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_version (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    video_id uuid NOT NULL,
    version_name text NOT NULL,
    content text,
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: config config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config
    ADD CONSTRAINT config_pkey PRIMARY KEY (id);


--
-- Name: config config_type_version_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config
    ADD CONSTRAINT config_type_version_unique UNIQUE (type, version_name);


--
-- Name: desc desc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."desc"
    ADD CONSTRAINT desc_pkey PRIMARY KEY (id);


--
-- Name: desc_version desc_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desc_version
    ADD CONSTRAINT desc_version_pkey PRIMARY KEY (id);


--
-- Name: dsl_script dsl_script_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsl_script
    ADD CONSTRAINT dsl_script_pkey PRIMARY KEY (id);


--
-- Name: dsl_script_version dsl_script_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsl_script_version
    ADD CONSTRAINT dsl_script_version_pkey PRIMARY KEY (id);


--
-- Name: lo lo_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lo
    ADD CONSTRAINT lo_code_key UNIQUE (code);


--
-- Name: lo lo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lo
    ADD CONSTRAINT lo_pkey PRIMARY KEY (id);


--
-- Name: lo_version lo_version_lo_id_version_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lo_version
    ADD CONSTRAINT lo_version_lo_id_version_name_key UNIQUE (lo_id, version_name);


--
-- Name: lo_version lo_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lo_version
    ADD CONSTRAINT lo_version_pkey PRIMARY KEY (id);


--
-- Name: video video_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video
    ADD CONSTRAINT video_pkey PRIMARY KEY (id);


--
-- Name: video_version video_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_version
    ADD CONSTRAINT video_version_pkey PRIMARY KEY (id);


--
-- Name: idx_lo_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lo_code ON public.lo USING btree (code);


--
-- Name: idx_lo_version_lo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lo_version_lo_id ON public.lo_version USING btree (lo_id);


--
-- Name: config update_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_config_updated_at BEFORE UPDATE ON public.config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: desc update_desc_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_desc_updated_at BEFORE UPDATE ON public."desc" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: desc_version update_desc_version_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_desc_version_updated_at BEFORE UPDATE ON public.desc_version FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: dsl_script update_dsl_script_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_dsl_script_updated_at BEFORE UPDATE ON public.dsl_script FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: dsl_script_version update_dsl_script_version_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_dsl_script_version_updated_at BEFORE UPDATE ON public.dsl_script_version FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lo update_lo_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lo_updated_at BEFORE UPDATE ON public.lo FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lo_version update_lo_version_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lo_version_updated_at BEFORE UPDATE ON public.lo_version FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: video update_video_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_video_updated_at BEFORE UPDATE ON public.video FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: video_version update_video_version_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_video_version_updated_at BEFORE UPDATE ON public.video_version FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: desc desc_lo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."desc"
    ADD CONSTRAINT desc_lo_id_fkey FOREIGN KEY (lo_id) REFERENCES public.lo(id) ON DELETE SET NULL;


--
-- Name: desc_version desc_version_desc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desc_version
    ADD CONSTRAINT desc_version_desc_id_fkey FOREIGN KEY (desc_id) REFERENCES public."desc"(id) ON DELETE CASCADE;


--
-- Name: desc desc_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."desc"
    ADD CONSTRAINT desc_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.video(id) ON DELETE SET NULL;


--
-- Name: dsl_script dsl_script_desc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsl_script
    ADD CONSTRAINT dsl_script_desc_id_fkey FOREIGN KEY (desc_id) REFERENCES public."desc"(id) ON DELETE CASCADE;


--
-- Name: dsl_script_version dsl_script_version_dsl_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsl_script_version
    ADD CONSTRAINT dsl_script_version_dsl_script_id_fkey FOREIGN KEY (dsl_script_id) REFERENCES public.dsl_script(id) ON DELETE CASCADE;


--
-- Name: lo_version lo_version_lo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lo_version
    ADD CONSTRAINT lo_version_lo_id_fkey FOREIGN KEY (lo_id) REFERENCES public.lo(id) ON DELETE CASCADE;


--
-- Name: video_version video_version_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_version
    ADD CONSTRAINT video_version_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.video(id) ON DELETE CASCADE;


--
-- Name: lo_version Anyone can create LO versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create LO versions" ON public.lo_version FOR INSERT WITH CHECK (true);


--
-- Name: lo Anyone can create LOs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create LOs" ON public.lo FOR INSERT WITH CHECK (true);


--
-- Name: config Anyone can create configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create configs" ON public.config FOR INSERT WITH CHECK (true);


--
-- Name: desc_version Anyone can create desc versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create desc versions" ON public.desc_version FOR INSERT WITH CHECK (true);


--
-- Name: desc Anyone can create descs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create descs" ON public."desc" FOR INSERT WITH CHECK (true);


--
-- Name: dsl_script_version Anyone can create dsl_script versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create dsl_script versions" ON public.dsl_script_version FOR INSERT WITH CHECK (true);


--
-- Name: dsl_script Anyone can create dsl_scripts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create dsl_scripts" ON public.dsl_script FOR INSERT WITH CHECK (true);


--
-- Name: video_version Anyone can create video versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create video versions" ON public.video_version FOR INSERT WITH CHECK (true);


--
-- Name: video Anyone can create videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create videos" ON public.video FOR INSERT WITH CHECK (true);


--
-- Name: lo_version Anyone can delete LO versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete LO versions" ON public.lo_version FOR DELETE USING (true);


--
-- Name: lo Anyone can delete LOs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete LOs" ON public.lo FOR DELETE USING (true);


--
-- Name: config Anyone can delete configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete configs" ON public.config FOR DELETE USING (true);


--
-- Name: desc_version Anyone can delete desc versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete desc versions" ON public.desc_version FOR DELETE USING (true);


--
-- Name: desc Anyone can delete descs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete descs" ON public."desc" FOR DELETE USING (true);


--
-- Name: dsl_script_version Anyone can delete dsl_script versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete dsl_script versions" ON public.dsl_script_version FOR DELETE USING (true);


--
-- Name: dsl_script Anyone can delete dsl_scripts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete dsl_scripts" ON public.dsl_script FOR DELETE USING (true);


--
-- Name: video_version Anyone can delete video versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete video versions" ON public.video_version FOR DELETE USING (true);


--
-- Name: video Anyone can delete videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete videos" ON public.video FOR DELETE USING (true);


--
-- Name: lo_version Anyone can update LO versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update LO versions" ON public.lo_version FOR UPDATE USING (true);


--
-- Name: lo Anyone can update LOs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update LOs" ON public.lo FOR UPDATE USING (true);


--
-- Name: config Anyone can update configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update configs" ON public.config FOR UPDATE USING (true);


--
-- Name: desc_version Anyone can update desc versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update desc versions" ON public.desc_version FOR UPDATE USING (true);


--
-- Name: desc Anyone can update descs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update descs" ON public."desc" FOR UPDATE USING (true);


--
-- Name: dsl_script_version Anyone can update dsl_script versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update dsl_script versions" ON public.dsl_script_version FOR UPDATE USING (true);


--
-- Name: dsl_script Anyone can update dsl_scripts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update dsl_scripts" ON public.dsl_script FOR UPDATE USING (true);


--
-- Name: video_version Anyone can update video versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update video versions" ON public.video_version FOR UPDATE USING (true);


--
-- Name: video Anyone can update videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update videos" ON public.video FOR UPDATE USING (true);


--
-- Name: lo_version Anyone can view LO versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view LO versions" ON public.lo_version FOR SELECT USING (true);


--
-- Name: lo Anyone can view LOs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view LOs" ON public.lo FOR SELECT USING (true);


--
-- Name: config Anyone can view configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view configs" ON public.config FOR SELECT USING (true);


--
-- Name: desc_version Anyone can view desc versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view desc versions" ON public.desc_version FOR SELECT USING (true);


--
-- Name: desc Anyone can view descs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view descs" ON public."desc" FOR SELECT USING (true);


--
-- Name: dsl_script_version Anyone can view dsl_script versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view dsl_script versions" ON public.dsl_script_version FOR SELECT USING (true);


--
-- Name: dsl_script Anyone can view dsl_scripts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view dsl_scripts" ON public.dsl_script FOR SELECT USING (true);


--
-- Name: video_version Anyone can view video versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view video versions" ON public.video_version FOR SELECT USING (true);


--
-- Name: video Anyone can view videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view videos" ON public.video FOR SELECT USING (true);


--
-- Name: config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

--
-- Name: desc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."desc" ENABLE ROW LEVEL SECURITY;

--
-- Name: desc_version; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.desc_version ENABLE ROW LEVEL SECURITY;

--
-- Name: dsl_script; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dsl_script ENABLE ROW LEVEL SECURITY;

--
-- Name: dsl_script_version; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dsl_script_version ENABLE ROW LEVEL SECURITY;

--
-- Name: lo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lo ENABLE ROW LEVEL SECURITY;

--
-- Name: lo_version; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lo_version ENABLE ROW LEVEL SECURITY;

--
-- Name: video; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video ENABLE ROW LEVEL SECURITY;

--
-- Name: video_version; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_version ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;