--
-- PostgreSQL database dump
--

\restrict zNErU6dkuazKffbgD81tuFT6Fbh47dxy3WzEPIc7HUTFeiyC3eG50HSjL04uoku

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'superadmin',
    'admin',
    'user'
);


ALTER TYPE public.user_role OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alphanumeric_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alphanumeric_records (
    id integer NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.alphanumeric_records OWNER TO postgres;

--
-- Name: alphanumeric_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alphanumeric_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alphanumeric_records_id_seq OWNER TO postgres;

--
-- Name: alphanumeric_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alphanumeric_records_id_seq OWNED BY public.alphanumeric_records.id;


--
-- Name: audit_captures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_captures (
    id integer NOT NULL,
    unit_number integer NOT NULL,
    week_number integer NOT NULL,
    date date NOT NULL,
    skill_number text,
    panel_id integer,
    side_id integer,
    visual_zone_id integer,
    alphanumeric_id integer,
    grid_col integer NOT NULL,
    grid_row text NOT NULL,
    defect_id integer,
    defect_other text,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    zone_id integer
);


ALTER TABLE public.audit_captures OWNER TO postgres;

--
-- Name: audit_captures_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_captures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_captures_id_seq OWNER TO postgres;

--
-- Name: audit_captures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_captures_id_seq OWNED BY public.audit_captures.id;


--
-- Name: defects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.defects (
    id integer NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.defects OWNER TO postgres;

--
-- Name: defects_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.defects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.defects_id_seq OWNER TO postgres;

--
-- Name: defects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.defects_id_seq OWNED BY public.defects.id;


--
-- Name: panels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.panels (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    diagram_url text,
    columns integer DEFAULT 5 NOT NULL,
    rows integer DEFAULT 5 NOT NULL,
    zone_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    side_id integer,
    visual_zone_id integer,
    alphanumeric_ids integer[] DEFAULT '{}'::integer[],
    column_start integer DEFAULT 1 NOT NULL,
    row_start integer DEFAULT 0 NOT NULL,
    columns_asc boolean DEFAULT true NOT NULL,
    rows_asc boolean DEFAULT true NOT NULL,
    diagram_offset_x real DEFAULT 0 NOT NULL,
    diagram_offset_y real DEFAULT 0 NOT NULL,
    diagram_opacity real DEFAULT 0.5 NOT NULL,
    diagram_scale_x real DEFAULT 1.0 NOT NULL,
    diagram_scale_y real DEFAULT 1.0 NOT NULL,
    cell_width integer DEFAULT 48 NOT NULL,
    cell_height integer DEFAULT 32 NOT NULL,
    grid_offset_x integer DEFAULT 0 NOT NULL,
    grid_offset_y integer DEFAULT 0 NOT NULL,
    column_widths integer[] DEFAULT '{}'::integer[] NOT NULL,
    row_heights integer[] DEFAULT '{}'::integer[] NOT NULL
);


ALTER TABLE public.panels OWNER TO postgres;

--
-- Name: panels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.panels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.panels_id_seq OWNER TO postgres;

--
-- Name: panels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.panels_id_seq OWNED BY public.panels.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.profiles_id_seq OWNER TO postgres;

--
-- Name: profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.profiles_id_seq OWNED BY public.profiles.id;


--
-- Name: sides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sides (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sides OWNER TO postgres;

--
-- Name: sides_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sides_id_seq OWNER TO postgres;

--
-- Name: sides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sides_id_seq OWNED BY public.sides.id;


--
-- Name: udns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.udns (
    id integer NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.udns OWNER TO postgres;

--
-- Name: udns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.udns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.udns_id_seq OWNER TO postgres;

--
-- Name: udns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.udns_id_seq OWNED BY public.udns.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    puesto text DEFAULT ''::text NOT NULL,
    area text DEFAULT ''::text NOT NULL,
    profile_id integer,
    udn_id integer,
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: visual_zones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.visual_zones (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.visual_zones OWNER TO postgres;

--
-- Name: visual_zones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.visual_zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.visual_zones_id_seq OWNER TO postgres;

--
-- Name: visual_zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.visual_zones_id_seq OWNED BY public.visual_zones.id;


--
-- Name: zones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zones (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    udn_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.zones OWNER TO postgres;

--
-- Name: zones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.zones_id_seq OWNER TO postgres;

--
-- Name: zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.zones_id_seq OWNED BY public.zones.id;


--
-- Name: alphanumeric_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alphanumeric_records ALTER COLUMN id SET DEFAULT nextval('public.alphanumeric_records_id_seq'::regclass);


--
-- Name: audit_captures id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_captures ALTER COLUMN id SET DEFAULT nextval('public.audit_captures_id_seq'::regclass);


--
-- Name: defects id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defects ALTER COLUMN id SET DEFAULT nextval('public.defects_id_seq'::regclass);


--
-- Name: panels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panels ALTER COLUMN id SET DEFAULT nextval('public.panels_id_seq'::regclass);


--
-- Name: profiles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles ALTER COLUMN id SET DEFAULT nextval('public.profiles_id_seq'::regclass);


--
-- Name: sides id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sides ALTER COLUMN id SET DEFAULT nextval('public.sides_id_seq'::regclass);


--
-- Name: udns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.udns ALTER COLUMN id SET DEFAULT nextval('public.udns_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: visual_zones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visual_zones ALTER COLUMN id SET DEFAULT nextval('public.visual_zones_id_seq'::regclass);


--
-- Name: zones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zones ALTER COLUMN id SET DEFAULT nextval('public.zones_id_seq'::regclass);


--
-- Data for Name: alphanumeric_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alphanumeric_records (id, name, code, description, created_at) FROM stdin;
1	Posición 1	P1	\N	2026-07-01 20:28:20.040543
2	Posición 2	P2	\N	2026-07-01 20:28:20.040543
3	Posición 3	P3	\N	2026-07-01 20:28:20.040543
4	Posición 4	P4	\N	2026-07-01 20:28:20.040543
5	Posición 5	P5	\N	2026-07-01 20:28:20.040543
6	Zona A	ZA	\N	2026-07-01 20:28:20.040543
7	Zona B	ZB	\N	2026-07-01 20:28:20.040543
8	Zona C	ZC	\N	2026-07-01 20:28:20.040543
9	Zona D	ZD	\N	2026-07-01 20:28:20.040543
10	Zona E	ZE	\N	2026-07-01 20:28:20.040543
\.


--
-- Data for Name: audit_captures; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_captures (id, unit_number, week_number, date, skill_number, panel_id, side_id, visual_zone_id, alphanumeric_id, grid_col, grid_row, defect_id, defect_other, quantity, created_at, zone_id) FROM stdin;
\.


--
-- Data for Name: defects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.defects (id, name, code, description, created_at) FROM stdin;
1	Fibra (Body)	FIB	\N	2026-07-01 18:51:40.876316
2	Retrabajo Body	REB	\N	2026-07-01 18:51:40.876316
3	Soldadura Dispersa	SOD	\N	2026-07-01 18:51:40.876316
4	Contaminante	CON	\N	2026-07-01 18:51:40.876316
5	Fino Metalico	FIM	\N	2026-07-01 18:51:40.876316
6	Sello carrocero	SEC	\N	2026-07-01 18:51:40.876316
7	Diente de leon	DID	\N	2026-07-01 18:51:40.876316
8	Lubricante excedente	LUE	\N	2026-07-01 18:51:40.876316
9	Insecto	INS	\N	2026-07-01 18:51:40.876316
10	Chisporroteo	CHI	\N	2026-07-01 18:51:40.876316
13	Marca de plumon	MAD	\N	2026-07-01 18:51:40.876316
14	Gota aceite	GOA	\N	2026-07-01 18:51:40.876316
15	Flameado	FLA	\N	2026-07-01 18:51:40.876316
16	Oxido	OXI	\N	2026-07-01 18:51:40.876316
18	Cacarilla de clip	CAD	\N	2026-07-01 18:51:40.876316
19	Suciedad de cadena	SUD	\N	2026-07-01 18:51:40.876316
20	GOTA AGUA	GAG		2026-07-01 18:51:40.876316
\.


--
-- Data for Name: panels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.panels (id, name, description, diagram_url, columns, rows, zone_id, created_at, side_id, visual_zone_id, alphanumeric_ids, column_start, row_start, columns_asc, rows_asc, diagram_offset_x, diagram_offset_y, diagram_opacity, diagram_scale_x, diagram_scale_y, cell_width, cell_height, grid_offset_x, grid_offset_y, column_widths, row_heights) FROM stdin;
1	PUERTA TRASERA		/api/uploads/1783033690867-365883.png	5	5	\N	2026-07-01 21:18:30.306641	1	1	{}	11	0	f	f	0	10	0.5	0.27657142	0.31829897	48	32	0	0	{49,50,49,47,49}	{39,54,57,52,55}
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profiles (id, name, description, permissions, created_at) FROM stdin;
\.


--
-- Data for Name: sides; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sides (id, name, description, created_at) FROM stdin;
1	IZQUIERDO	IZQUIERDO	2026-07-01 18:15:52.96087
2	DERECHO	DERECHO	2026-07-01 18:15:59.709376
\.


--
-- Data for Name: udns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.udns (id, name, code, description, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password_hash, puesto, area, profile_id, udn_id, role, created_at) FROM stdin;
2	Bivian Esmeray Hernandez Gomez	b.hernandez@qis-servicio.com	$2b$10$kuETyXPxZHoOJRWVqs9MFu4bj3wYCC9f/PfPyuSr8yyNOtFZPQZni	Encargado de Sitio	Operaciones	\N	\N	user	2026-07-01 17:56:37.0262
1	José Alberto Osornio Morales	sistemas@qis-servicio.com	$2b$10$7H4QcsbMnTwy88t6ACuvHOMjjggIziiGWRzw1uwgOj1ru80yD2RmO	Administrador General	Sistemas	\N	\N	superadmin	2026-07-01 17:06:38.765511
\.


--
-- Data for Name: visual_zones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.visual_zones (id, name, description, created_at) FROM stdin;
1	INTERIOR		2026-07-01 18:28:27.846227
2	EXTERIOR		2026-07-01 18:28:32.528825
\.


--
-- Data for Name: zones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.zones (id, name, description, udn_id, created_at) FROM stdin;
1	TRANFERENCIA	TRANSFERENCIA O COLGADO	\N	2026-07-01 18:10:47.101558
\.


--
-- Name: alphanumeric_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.alphanumeric_records_id_seq', 10, true);


--
-- Name: audit_captures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_captures_id_seq', 1, false);


--
-- Name: defects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.defects_id_seq', 20, true);


--
-- Name: panels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.panels_id_seq', 1, true);


--
-- Name: profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.profiles_id_seq', 1, false);


--
-- Name: sides_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sides_id_seq', 2, true);


--
-- Name: udns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.udns_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: visual_zones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.visual_zones_id_seq', 2, true);


--
-- Name: zones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.zones_id_seq', 1, true);


--
-- Name: alphanumeric_records alphanumeric_records_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alphanumeric_records
    ADD CONSTRAINT alphanumeric_records_code_unique UNIQUE (code);


--
-- Name: alphanumeric_records alphanumeric_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alphanumeric_records
    ADD CONSTRAINT alphanumeric_records_pkey PRIMARY KEY (id);


--
-- Name: audit_captures audit_captures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_captures
    ADD CONSTRAINT audit_captures_pkey PRIMARY KEY (id);


--
-- Name: defects defects_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defects
    ADD CONSTRAINT defects_code_unique UNIQUE (code);


--
-- Name: defects defects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defects
    ADD CONSTRAINT defects_pkey PRIMARY KEY (id);


--
-- Name: panels panels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panels
    ADD CONSTRAINT panels_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: sides sides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sides
    ADD CONSTRAINT sides_pkey PRIMARY KEY (id);


--
-- Name: udns udns_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.udns
    ADD CONSTRAINT udns_code_unique UNIQUE (code);


--
-- Name: udns udns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.udns
    ADD CONSTRAINT udns_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: visual_zones visual_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visual_zones
    ADD CONSTRAINT visual_zones_pkey PRIMARY KEY (id);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: audit_captures audit_captures_defect_id_defects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_captures
    ADD CONSTRAINT audit_captures_defect_id_defects_id_fk FOREIGN KEY (defect_id) REFERENCES public.defects(id) ON DELETE SET NULL;


--
-- Name: audit_captures audit_captures_panel_id_panels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_captures
    ADD CONSTRAINT audit_captures_panel_id_panels_id_fk FOREIGN KEY (panel_id) REFERENCES public.panels(id) ON DELETE SET NULL;


--
-- Name: audit_captures audit_captures_side_id_sides_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_captures
    ADD CONSTRAINT audit_captures_side_id_sides_id_fk FOREIGN KEY (side_id) REFERENCES public.sides(id) ON DELETE SET NULL;


--
-- Name: audit_captures audit_captures_visual_zone_id_visual_zones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_captures
    ADD CONSTRAINT audit_captures_visual_zone_id_visual_zones_id_fk FOREIGN KEY (visual_zone_id) REFERENCES public.visual_zones(id) ON DELETE SET NULL;


--
-- Name: audit_captures audit_captures_zone_id_zones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_captures
    ADD CONSTRAINT audit_captures_zone_id_zones_id_fk FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: panels panels_side_id_sides_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panels
    ADD CONSTRAINT panels_side_id_sides_id_fk FOREIGN KEY (side_id) REFERENCES public.sides(id) ON DELETE SET NULL;


--
-- Name: panels panels_visual_zone_id_visual_zones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panels
    ADD CONSTRAINT panels_visual_zone_id_visual_zones_id_fk FOREIGN KEY (visual_zone_id) REFERENCES public.visual_zones(id) ON DELETE SET NULL;


--
-- Name: panels panels_zone_id_zones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panels
    ADD CONSTRAINT panels_zone_id_zones_id_fk FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: users users_profile_id_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_profile_id_profiles_id_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: users users_udn_id_udns_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_udn_id_udns_id_fk FOREIGN KEY (udn_id) REFERENCES public.udns(id) ON DELETE SET NULL;


--
-- Name: zones zones_udn_id_udns_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_udn_id_udns_id_fk FOREIGN KEY (udn_id) REFERENCES public.udns(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict zNErU6dkuazKffbgD81tuFT6Fbh47dxy3WzEPIc7HUTFeiyC3eG50HSjL04uoku

