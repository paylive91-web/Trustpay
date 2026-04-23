--
-- PostgreSQL database dump
--

\restrict t0wtavBzP3Ccuza2aWGNOwiwWnOz6G3rELkRPGdrEGWuHbgqyeZob1yKFjjP6EA

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
-- Name: dispute_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dispute_status AS ENUM (
    'open',
    'buyer_won',
    'seller_won',
    'auto_resolved'
);


ALTER TYPE public.dispute_status OWNER TO postgres;

--
-- Name: fraud_severity; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.fraud_severity AS ENUM (
    'info',
    'warn',
    'critical'
);


ALTER TYPE public.fraud_severity OWNER TO postgres;

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'available',
    'locked',
    'pending_confirmation',
    'confirmed',
    'disputed',
    'refunded',
    'expired',
    'cancelled'
);


ALTER TYPE public.order_status OWNER TO postgres;

--
-- Name: order_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.order_type AS ENUM (
    'deposit',
    'withdrawal'
);


ALTER TYPE public.order_type OWNER TO postgres;

--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transaction_type AS ENUM (
    'credit',
    'debit'
);


ALTER TYPE public.transaction_type OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'user',
    'admin'
);


ALTER TYPE public.user_role OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_logs (
    id integer NOT NULL,
    admin_id integer NOT NULL,
    action_type text NOT NULL,
    target_type text,
    target_id integer,
    details text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_logs OWNER TO postgres;

--
-- Name: admin_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_logs_id_seq OWNER TO postgres;

--
-- Name: admin_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_logs_id_seq OWNED BY public.admin_logs.id;


--
-- Name: deposit_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deposit_tasks (
    id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    reward_percent numeric(5,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.deposit_tasks OWNER TO postgres;

--
-- Name: deposit_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.deposit_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deposit_tasks_id_seq OWNER TO postgres;

--
-- Name: deposit_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.deposit_tasks_id_seq OWNED BY public.deposit_tasks.id;


--
-- Name: device_fingerprints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.device_fingerprints (
    id integer NOT NULL,
    user_id integer NOT NULL,
    fingerprint text NOT NULL,
    ip text,
    user_agent text,
    last_seen_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.device_fingerprints OWNER TO postgres;

--
-- Name: device_fingerprints_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.device_fingerprints_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.device_fingerprints_id_seq OWNER TO postgres;

--
-- Name: device_fingerprints_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.device_fingerprints_id_seq OWNED BY public.device_fingerprints.id;


--
-- Name: disputes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.disputes (
    id integer NOT NULL,
    order_id integer NOT NULL,
    buyer_id integer NOT NULL,
    seller_id integer NOT NULL,
    reason text,
    status public.dispute_status DEFAULT 'open'::public.dispute_status NOT NULL,
    buyer_bank_statement_url text,
    seller_bank_statement_url text,
    seller_recording_url text,
    seller_last_txn_screenshot_url text,
    buyer_proof_deadline timestamp without time zone,
    seller_proof_deadline timestamp without time zone,
    buyer_proof_at timestamp without time zone,
    seller_proof_at timestamp without time zone,
    resolved_at timestamp without time zone,
    resolved_by integer,
    admin_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    trigger_reason text,
    buyer_tx_history_url text
);


ALTER TABLE public.disputes OWNER TO postgres;

--
-- Name: disputes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.disputes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.disputes_id_seq OWNER TO postgres;

--
-- Name: disputes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.disputes_id_seq OWNED BY public.disputes.id;


--
-- Name: fraud_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fraud_alerts (
    id integer NOT NULL,
    user_id integer,
    order_id integer,
    rule text NOT NULL,
    severity public.fraud_severity DEFAULT 'warn'::public.fraud_severity NOT NULL,
    evidence text,
    resolved boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    notified_at timestamp without time zone,
    notified_by integer
);


ALTER TABLE public.fraud_alerts OWNER TO postgres;

--
-- Name: fraud_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.fraud_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fraud_alerts_id_seq OWNER TO postgres;

--
-- Name: fraud_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.fraud_alerts_id_seq OWNED BY public.fraud_alerts.id;


--
-- Name: high_value_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.high_value_events (
    id integer NOT NULL,
    user_id integer NOT NULL,
    order_id integer,
    amount text NOT NULL,
    tier text NOT NULL,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.high_value_events OWNER TO postgres;

--
-- Name: high_value_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.high_value_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.high_value_events_id_seq OWNER TO postgres;

--
-- Name: high_value_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.high_value_events_id_seq OWNED BY public.high_value_events.id;


--
-- Name: image_hashes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.image_hashes (
    id integer NOT NULL,
    hash text NOT NULL,
    user_id integer NOT NULL,
    order_id integer NOT NULL,
    kind text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.image_hashes OWNER TO postgres;

--
-- Name: image_hashes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.image_hashes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.image_hashes_id_seq OWNER TO postgres;

--
-- Name: image_hashes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.image_hashes_id_seq OWNED BY public.image_hashes.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type public.order_type NOT NULL,
    amount numeric(12,2) NOT NULL,
    reward_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    reward_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    upi_id text,
    upi_name text,
    user_upi_id text,
    user_upi_name text,
    user_name text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    utr_number text,
    screenshot_url text,
    recording_url text,
    parent_sell_id integer,
    locked_at timestamp without time zone,
    locked_by_user_id integer,
    submitted_at timestamp without time zone,
    confirm_deadline timestamp without time zone,
    confirmed_at timestamp without time zone,
    held_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    fee_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    sell_reward_percent numeric(5,2) DEFAULT 0 NOT NULL,
    sell_reward_amount numeric(12,2) DEFAULT 0 NOT NULL,
    ocr_utr text,
    ocr_amount text,
    ocr_timestamp text,
    ocr_bank text,
    ocr_raw_text text,
    ocr_status text,
    ocr_amount_match text,
    ocr_utr_match text
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referrals (
    id integer NOT NULL,
    referrer_id integer NOT NULL,
    referred_user_id integer NOT NULL,
    order_id integer,
    level integer DEFAULT 1 NOT NULL,
    commission_amount numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.referrals OWNER TO postgres;

--
-- Name: referrals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.referrals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.referrals_id_seq OWNER TO postgres;

--
-- Name: referrals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.referrals_id_seq OWNED BY public.referrals.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.settings (
    id integer NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.settings OWNER TO postgres;

--
-- Name: settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.settings_id_seq OWNER TO postgres;

--
-- Name: settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.settings_id_seq OWNED BY public.settings.id;


--
-- Name: sms_active_patterns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_active_patterns (
    id integer NOT NULL,
    sender_key text NOT NULL,
    template_label text NOT NULL,
    utr_regex text NOT NULL,
    amount_regex text NOT NULL,
    credit_only boolean DEFAULT true NOT NULL,
    reversal_blocked boolean DEFAULT true NOT NULL,
    source_candidate_id integer,
    created_by integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sms_active_patterns OWNER TO postgres;

--
-- Name: sms_active_patterns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sms_active_patterns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sms_active_patterns_id_seq OWNER TO postgres;

--
-- Name: sms_active_patterns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sms_active_patterns_id_seq OWNED BY public.sms_active_patterns.id;


--
-- Name: sms_candidate_patterns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_candidate_patterns (
    id integer NOT NULL,
    sender_key text NOT NULL,
    template_hash text NOT NULL,
    template_body text NOT NULL,
    utr_sample text,
    amount_sample text,
    sample_count integer DEFAULT 0 NOT NULL,
    sample_ids text,
    status text DEFAULT 'proposed'::text NOT NULL,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sms_candidate_patterns OWNER TO postgres;

--
-- Name: sms_candidate_patterns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sms_candidate_patterns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sms_candidate_patterns_id_seq OWNER TO postgres;

--
-- Name: sms_candidate_patterns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sms_candidate_patterns_id_seq OWNED BY public.sms_candidate_patterns.id;


--
-- Name: sms_learning_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_learning_queue (
    id integer NOT NULL,
    sender text NOT NULL,
    sender_key text NOT NULL,
    body text NOT NULL,
    bucket text NOT NULL,
    parsed_utr text,
    parsed_amount text,
    is_debit boolean DEFAULT false NOT NULL,
    has_reversal boolean DEFAULT false NOT NULL,
    template_body text,
    template_hash text,
    user_id integer,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    reason text
);


ALTER TABLE public.sms_learning_queue OWNER TO postgres;

--
-- Name: sms_learning_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sms_learning_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sms_learning_queue_id_seq OWNER TO postgres;

--
-- Name: sms_learning_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sms_learning_queue_id_seq OWNED BY public.sms_learning_queue.id;


--
-- Name: sms_safe_senders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_safe_senders (
    id integer NOT NULL,
    sender_key text NOT NULL,
    label text,
    added_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sms_safe_senders OWNER TO postgres;

--
-- Name: sms_safe_senders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sms_safe_senders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sms_safe_senders_id_seq OWNER TO postgres;

--
-- Name: sms_safe_senders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sms_safe_senders_id_seq OWNED BY public.sms_safe_senders.id;


--
-- Name: trade_pair_blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trade_pair_blocks (
    id integer NOT NULL,
    user_id_1 integer NOT NULL,
    user_id_2 integer NOT NULL,
    reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.trade_pair_blocks OWNER TO postgres;

--
-- Name: trade_pair_blocks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trade_pair_blocks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trade_pair_blocks_id_seq OWNER TO postgres;

--
-- Name: trade_pair_blocks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trade_pair_blocks_id_seq OWNED BY public.trade_pair_blocks.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    order_id integer,
    type public.transaction_type NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: trust_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trust_events (
    id integer NOT NULL,
    user_id integer NOT NULL,
    delta integer NOT NULL,
    reason text NOT NULL,
    order_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.trust_events OWNER TO postgres;

--
-- Name: trust_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trust_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trust_events_id_seq OWNER TO postgres;

--
-- Name: trust_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trust_events_id_seq OWNED BY public.trust_events.id;


--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    severity public.fraud_severity DEFAULT 'info'::public.fraud_severity NOT NULL,
    fraud_alert_id integer,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_notifications OWNER TO postgres;

--
-- Name: user_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_notifications_id_seq OWNER TO postgres;

--
-- Name: user_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_notifications_id_seq OWNED BY public.user_notifications.id;


--
-- Name: user_upi_ids; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_upi_ids (
    id integer NOT NULL,
    user_id integer NOT NULL,
    upi_id text NOT NULL,
    platform text NOT NULL,
    bank_name text NOT NULL,
    holder_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_upi_ids OWNER TO postgres;

--
-- Name: user_upi_ids_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_upi_ids_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_upi_ids_id_seq OWNER TO postgres;

--
-- Name: user_upi_ids_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_upi_ids_id_seq OWNED BY public.user_upi_ids.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    phone text,
    balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_deposits numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_withdrawals numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    invite_earnings numeric(12,2) DEFAULT 0 NOT NULL,
    invite_earnings_l2 numeric(12,2) DEFAULT 0 NOT NULL,
    referral_code text,
    referred_by integer,
    held_balance numeric(12,2) DEFAULT 0 NOT NULL,
    trust_score integer DEFAULT 0 NOT NULL,
    successful_trades integer DEFAULT 0 NOT NULL,
    is_blocked boolean DEFAULT false NOT NULL,
    blocked_reason text,
    blocked_at timestamp without time zone,
    is_frozen boolean DEFAULT false NOT NULL,
    auto_sell_enabled boolean DEFAULT false NOT NULL,
    last_seen_at timestamp without time zone,
    fraud_warning_count integer DEFAULT 0 NOT NULL,
    matching_expires_at timestamp without time zone,
    display_name text,
    must_install_app boolean DEFAULT false NOT NULL,
    email text,
    google_sub text,
    is_verified_agent boolean DEFAULT false NOT NULL,
    agent_tier_awarded_date date,
    agent_tier_awarded_level integer DEFAULT 0 NOT NULL,
    is_trusted boolean DEFAULT false NOT NULL,
    freeze_reason text
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
-- Name: utr_index; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.utr_index (
    id integer NOT NULL,
    utr text NOT NULL,
    user_id integer NOT NULL,
    order_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.utr_index OWNER TO postgres;

--
-- Name: utr_index_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.utr_index_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.utr_index_id_seq OWNER TO postgres;

--
-- Name: utr_index_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.utr_index_id_seq OWNED BY public.utr_index.id;


--
-- Name: admin_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_logs ALTER COLUMN id SET DEFAULT nextval('public.admin_logs_id_seq'::regclass);


--
-- Name: deposit_tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposit_tasks ALTER COLUMN id SET DEFAULT nextval('public.deposit_tasks_id_seq'::regclass);


--
-- Name: device_fingerprints id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_fingerprints ALTER COLUMN id SET DEFAULT nextval('public.device_fingerprints_id_seq'::regclass);


--
-- Name: disputes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes ALTER COLUMN id SET DEFAULT nextval('public.disputes_id_seq'::regclass);


--
-- Name: fraud_alerts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fraud_alerts ALTER COLUMN id SET DEFAULT nextval('public.fraud_alerts_id_seq'::regclass);


--
-- Name: high_value_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.high_value_events ALTER COLUMN id SET DEFAULT nextval('public.high_value_events_id_seq'::regclass);


--
-- Name: image_hashes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.image_hashes ALTER COLUMN id SET DEFAULT nextval('public.image_hashes_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: referrals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals ALTER COLUMN id SET DEFAULT nextval('public.referrals_id_seq'::regclass);


--
-- Name: settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings ALTER COLUMN id SET DEFAULT nextval('public.settings_id_seq'::regclass);


--
-- Name: sms_active_patterns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_active_patterns ALTER COLUMN id SET DEFAULT nextval('public.sms_active_patterns_id_seq'::regclass);


--
-- Name: sms_candidate_patterns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_candidate_patterns ALTER COLUMN id SET DEFAULT nextval('public.sms_candidate_patterns_id_seq'::regclass);


--
-- Name: sms_learning_queue id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_learning_queue ALTER COLUMN id SET DEFAULT nextval('public.sms_learning_queue_id_seq'::regclass);


--
-- Name: sms_safe_senders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_safe_senders ALTER COLUMN id SET DEFAULT nextval('public.sms_safe_senders_id_seq'::regclass);


--
-- Name: trade_pair_blocks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trade_pair_blocks ALTER COLUMN id SET DEFAULT nextval('public.trade_pair_blocks_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: trust_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trust_events ALTER COLUMN id SET DEFAULT nextval('public.trust_events_id_seq'::regclass);


--
-- Name: user_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notifications ALTER COLUMN id SET DEFAULT nextval('public.user_notifications_id_seq'::regclass);


--
-- Name: user_upi_ids id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_upi_ids ALTER COLUMN id SET DEFAULT nextval('public.user_upi_ids_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: utr_index id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.utr_index ALTER COLUMN id SET DEFAULT nextval('public.utr_index_id_seq'::regclass);


--
-- Data for Name: admin_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_logs (id, admin_id, action_type, target_type, target_id, details, created_at) FROM stdin;
1	1	sms_safe_sender_add	\N	\N	Added safe sender TESTBNK	2026-04-23 04:24:38.174256
2	1	sms_propose_patterns	\N	\N	Proposed 0 patterns, skipped 0	2026-04-23 04:24:38.394893
3	1	sms_safe_sender_add	\N	\N	Added safe sender NEWCOOP	2026-04-23 04:27:26.183375
4	1	sms_propose_patterns	\N	\N	Proposed 0 patterns, skipped 0	2026-04-23 04:31:50.934396
5	1	sms_safe_sender_remove	\N	\N	Removed safe sender TESTBNK	2026-04-23 04:33:00.922504
6	1	sms_safe_sender_add	\N	\N	Added safe sender SBIBNK	2026-04-23 04:38:14.757202
7	1	sms_safe_sender_remove	\N	\N	Removed safe sender SBIBNK	2026-04-23 04:38:41.978583
8	1	sms_safe_sender_add	\N	\N	Added safe sender SBIBNK	2026-04-23 04:40:11.492693
9	1	sms_safe_sender_remove	\N	\N	Removed safe sender SBIBNK	2026-04-23 04:40:32.058743
10	1	sms_safe_sender_add	\N	\N	Added safe sender HDFCBNK	2026-04-23 04:45:14.585803
11	1	sms_safe_sender_remove	\N	\N	Removed safe sender HDFCBNK	2026-04-23 04:46:06.66589
12	1	sms_safe_sender_add	\N	\N	Added safe sender AXIS	2026-04-23 04:52:22.057185
13	1	sms_safe_sender_remove	\N	\N	Removed safe sender AXIS	2026-04-23 04:52:32.850129
14	1	sms_safe_sender_add	\N	\N	Added safe sender ICICI	2026-04-23 04:56:39.61809
15	1	sms_safe_sender_remove	\N	\N	Removed safe sender ICICI	2026-04-23 04:56:54.724656
16	1	sms_safe_sender_add	\N	\N	Added safe sender AXIS	2026-04-23 05:06:33.541394
17	1	sms_safe_sender_remove	\N	\N	Removed safe sender AXIS	2026-04-23 05:06:50.615474
\.


--
-- Data for Name: deposit_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deposit_tasks (id, amount, reward_percent, is_active, created_at) FROM stdin;
1	101.00	4.00	t	2026-04-16 10:44:07.439641
2	106.00	4.00	t	2026-04-16 10:44:07.439641
3	110.00	4.00	t	2026-04-16 10:44:07.439641
4	113.00	4.00	t	2026-04-16 10:44:07.439641
5	117.00	4.00	t	2026-04-16 10:44:07.439641
6	119.00	4.00	t	2026-04-16 10:44:07.439641
7	150.00	4.00	t	2026-04-16 10:44:07.439641
8	200.00	4.00	t	2026-04-16 10:44:07.439641
9	500.00	4.00	t	2026-04-16 10:44:07.439641
10	1000.00	4.00	t	2026-04-16 10:44:07.439641
\.


--
-- Data for Name: device_fingerprints; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.device_fingerprints (id, user_id, fingerprint, ip, user_agent, last_seen_at, created_at) FROM stdin;
2	4	TW96aWxsYS81LjAgKExpbnV4OyBBbmRyb2lkIDEwOyBLKSBBcHBsZVdlYktpdC81	112.79.220.58	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36	2026-04-20 17:49:57.384569	2026-04-20 17:49:57.384569
3	142	fp-dup-test-001	::1	curl/8.14.1	2026-04-21 08:09:51.922892	2026-04-21 08:09:51.922892
4	143	fp-agent-1	::1	curl/8.14.1	2026-04-21 08:14:59.753794	2026-04-21 08:14:59.753794
1	1	TW96aWxsYS81LjAgKFgxMTsgTGludXggeDg2XzY0KSBBcHBsZVdlYktpdC81Mzcu	34.66.204.134	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2026-04-23 04:26:40.27	2026-04-20 15:54:31.147048
\.


--
-- Data for Name: disputes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.disputes (id, order_id, buyer_id, seller_id, reason, status, buyer_bank_statement_url, seller_bank_statement_url, seller_recording_url, seller_last_txn_screenshot_url, buyer_proof_deadline, seller_proof_deadline, buyer_proof_at, seller_proof_at, resolved_at, resolved_by, admin_notes, created_at, trigger_reason, buyer_tx_history_url) FROM stdin;
1	11	7	6	No money received in my bank	buyer_won	\N	\N	\N	\N	2026-04-19 17:55:43.484	2026-04-19 17:55:43.484	\N	\N	2026-04-18 17:55:43.506	1	Test resolution	2026-04-18 17:55:43.486959	\N	\N
2	12	7	6	Not received	buyer_won	\N	\N	\N	\N	2026-04-19 17:59:57.511	2026-04-19 17:59:57.511	\N	\N	2026-04-18 17:59:57.566	1	Verified	2026-04-18 17:59:57.514895	\N	\N
3	27	25	24	no payment	open	data:application/pdf;base64,JVBERi0xLjQKJUVPRgo=	\N	\N	\N	2026-04-19 21:03:08.223	2026-04-19 21:03:08.223	2026-04-18 21:03:08.273	\N	\N	\N	\N	2026-04-18 21:03:08.227026	\N	\N
4	28	27	26	no payment	open	\N	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	2026-04-19 21:03:08.534	2026-04-19 21:03:08.534	\N	2026-04-18 21:03:08.569	\N	\N	\N	2026-04-18 21:03:08.537616	\N	\N
5	29	29	28	no payment	open	\N	\N	\N	\N	2026-04-19 21:03:08.827	2026-04-19 21:03:08.827	\N	\N	\N	\N	\N	2026-04-18 21:03:08.830046	\N	\N
6	39	47	46	no payment	open	data:application/pdf;base64,JVBERi0xLjQKJUVPRgo=	\N	\N	\N	2026-04-19 21:08:22.029	2026-04-19 21:08:22.029	2026-04-18 21:08:22.082	\N	\N	\N	\N	2026-04-18 21:08:22.032722	\N	\N
7	40	49	48	no payment	open	\N	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	2026-04-19 21:08:22.366	2026-04-19 21:08:22.366	\N	2026-04-18 21:08:22.406	\N	\N	\N	2026-04-18 21:08:22.3707	\N	\N
8	41	51	50	no payment	open	\N	\N	\N	\N	2026-04-19 21:08:22.675	2026-04-19 21:08:22.675	\N	\N	\N	\N	\N	2026-04-18 21:08:22.678942	\N	\N
9	54	75	74	no payment	open	data:application/pdf;base64,JVBERi0xLjQKJUVPRgo=	\N	\N	\N	2026-04-19 21:09:08.887	2026-04-19 21:09:08.887	2026-04-18 21:09:08.936	\N	\N	\N	\N	2026-04-18 21:09:08.89115	\N	\N
10	55	77	76	no payment	open	\N	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	2026-04-19 21:09:09.198	2026-04-19 21:09:09.198	\N	2026-04-18 21:09:09.239	\N	\N	\N	2026-04-18 21:09:09.201954	\N	\N
11	56	79	78	no payment	open	\N	\N	\N	\N	2026-04-19 21:09:09.513	2026-04-19 21:09:09.513	\N	\N	\N	\N	\N	2026-04-18 21:09:09.516293	\N	\N
12	69	103	102	no payment	open	data:application/pdf;base64,JVBERi0xLjQKJUVPRgo=	\N	\N	\N	2026-04-19 21:10:08.122	2026-04-19 21:10:08.122	2026-04-18 21:10:08.17	\N	\N	\N	\N	2026-04-18 21:10:08.124959	\N	\N
13	70	105	104	no payment	open	\N	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	2026-04-19 21:10:08.438	2026-04-19 21:10:08.438	\N	2026-04-18 21:10:08.473	\N	\N	\N	2026-04-18 21:10:08.441388	\N	\N
14	71	107	106	no payment	open	\N	\N	\N	\N	2026-04-19 21:10:08.739	2026-04-19 21:10:08.739	\N	\N	\N	\N	\N	2026-04-18 21:10:08.742879	\N	\N
15	84	131	130	no payment	open	data:application/pdf;base64,JVBERi0xLjQKJUVPRgo=	\N	\N	\N	2026-04-19 21:10:52.769	2026-04-19 21:10:52.769	2026-04-18 21:10:52.856	\N	\N	\N	\N	2026-04-18 21:10:52.774428	\N	\N
16	85	133	132	no payment	open	\N	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=	2026-04-19 21:10:53.128	2026-04-19 21:10:53.128	\N	2026-04-18 21:10:53.166	\N	\N	\N	2026-04-18 21:10:53.132622	\N	\N
17	86	135	134	no payment	open	\N	\N	\N	\N	2026-04-19 21:10:53.421	2026-04-19 21:10:53.421	\N	\N	\N	\N	\N	2026-04-18 21:10:53.424235	\N	\N
\.


--
-- Data for Name: fraud_alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fraud_alerts (id, user_id, order_id, rule, severity, evidence, resolved, created_at, notified_at, notified_by) FROM stdin;
1	7	10	fake_utr_sequential	warn	UTR 987654321099 starts with sequential digits	f	2026-04-18 17:53:41.667048	\N	\N
2	19	\N	new_account_high_value	critical	Account <24h old attempting ₹6000	f	2026-04-18 21:03:07.259332	2026-04-18 21:03:07.259	\N
3	21	\N	new_account_high_value	critical	Account <24h old attempting ₹11000	f	2026-04-18 21:03:07.564129	2026-04-18 21:03:07.563	\N
4	23	\N	new_account_high_value	critical	Account <24h old attempting ₹8000	f	2026-04-18 21:03:07.94965	2026-04-18 21:03:07.949	\N
5	41	\N	new_account_high_value	critical	Account <24h old attempting ₹6000	f	2026-04-18 21:08:21.000889	2026-04-18 21:08:21	\N
6	43	\N	new_account_high_value	critical	Account <24h old attempting ₹11000	f	2026-04-18 21:08:21.320492	2026-04-18 21:08:21.32	\N
7	45	\N	new_account_high_value	critical	Account <24h old attempting ₹8000	f	2026-04-18 21:08:21.721141	2026-04-18 21:08:21.72	\N
8	57	45	duplicate_utr	critical	UTR FRDUP2299326431 previously used by user #55 on order #43	f	2026-04-18 21:08:52.740845	2026-04-18 21:08:52.74	\N
9	69	\N	new_account_high_value	critical	Account <24h old attempting ₹6000	f	2026-04-18 21:09:07.84714	2026-04-18 21:09:07.846	\N
10	71	\N	new_account_high_value	critical	Account <24h old attempting ₹11000	f	2026-04-18 21:09:08.173681	2026-04-18 21:09:08.173	\N
11	73	\N	new_account_high_value	critical	Account <24h old attempting ₹8000	f	2026-04-18 21:09:08.601742	2026-04-18 21:09:08.601	\N
12	85	60	duplicate_utr	critical	UTR FRDUP6433751739 previously used by user #83 on order #58	f	2026-04-18 21:09:39.555847	2026-04-18 21:09:39.555	\N
13	97	\N	new_account_high_value	critical	Account <24h old attempting ₹6000	f	2026-04-18 21:10:07.095375	2026-04-18 21:10:07.093	\N
14	99	\N	new_account_high_value	critical	Account <24h old attempting ₹11000	f	2026-04-18 21:10:07.425712	2026-04-18 21:10:07.425	\N
15	101	\N	new_account_high_value	critical	Account <24h old attempting ₹8000	f	2026-04-18 21:10:07.82899	2026-04-18 21:10:07.828	\N
16	113	75	duplicate_utr	critical	UTR FRDUP86008813 previously used by user #111 on order #73	f	2026-04-18 21:10:38.778287	2026-04-18 21:10:38.778	\N
17	125	\N	new_account_high_value	critical	Account <24h old attempting ₹6000	f	2026-04-18 21:10:51.771412	2026-04-18 21:10:51.771	\N
18	127	\N	new_account_high_value	critical	Account <24h old attempting ₹11000	f	2026-04-18 21:10:52.058472	2026-04-18 21:10:52.058	\N
19	129	\N	new_account_high_value	critical	Account <24h old attempting ₹8000	f	2026-04-18 21:10:52.441812	2026-04-18 21:10:52.441	\N
20	141	90	duplicate_utr	critical	UTR FRDUP624566387 previously used by user #139 on order #88	f	2026-04-18 21:11:23.502035	2026-04-18 21:11:23.501	\N
\.


--
-- Data for Name: high_value_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.high_value_events (id, user_id, order_id, amount, tier, reviewed_by, reviewed_at, notes, created_at) FROM stdin;
1	19	24	6000	warn	\N	\N	\N	2026-04-18 21:03:07.251544
2	21	25	11000	critical	\N	\N	\N	2026-04-18 21:03:07.560273
3	23	26	8000	warn	\N	\N	\N	2026-04-18 21:03:07.946924
4	41	36	6000	warn	\N	\N	\N	2026-04-18 21:08:20.995902
5	43	37	11000	critical	\N	\N	\N	2026-04-18 21:08:21.316738
6	45	38	8000	warn	\N	\N	\N	2026-04-18 21:08:21.717455
7	69	51	6000	warn	\N	\N	\N	2026-04-18 21:09:07.843426
8	71	52	11000	critical	\N	\N	\N	2026-04-18 21:09:08.170186
9	73	53	8000	warn	\N	\N	\N	2026-04-18 21:09:08.598009
10	97	66	6000	warn	\N	\N	\N	2026-04-18 21:10:07.090178
11	99	67	11000	critical	\N	\N	\N	2026-04-18 21:10:07.421783
12	101	68	8000	warn	\N	\N	\N	2026-04-18 21:10:07.826033
13	125	81	6000	warn	\N	\N	\N	2026-04-18 21:10:51.767828
14	127	82	11000	critical	\N	\N	\N	2026-04-18 21:10:52.055864
15	129	83	8000	warn	\N	\N	\N	2026-04-18 21:10:52.438717
\.


--
-- Data for Name: image_hashes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.image_hashes (id, hash, user_id, order_id, kind, created_at) FROM stdin;
1	739030080	7	10	screenshot	2026-04-18 17:53:41.674222
2	-862726592	7	10	recording	2026-04-18 17:53:41.677842
3	1338735744	7	11	screenshot	2026-04-18 17:55:43.469117
4	138103872	7	11	recording	2026-04-18 17:55:43.472363
5	951222229	7	12	screenshot	2026-04-18 17:59:57.497095
6	-1568309661	7	12	recording	2026-04-18 17:59:57.500922
7	-1201746068	15	21	screenshot	2026-04-18 21:03:06.681941
8	344691519	15	21	recording	2026-04-18 21:03:06.685633
9	1021319399	19	24	screenshot	2026-04-18 21:03:07.210904
10	388865390	19	24	recording	2026-04-18 21:03:07.213813
11	1577944707	21	25	screenshot	2026-04-18 21:03:07.512227
12	1863970219	21	25	recording	2026-04-18 21:03:07.51555
13	-57445336	23	26	screenshot	2026-04-18 21:03:07.903626
14	1668368979	23	26	recording	2026-04-18 21:03:07.906992
15	-71331053	25	27	screenshot	2026-04-18 21:03:08.204669
16	-309692679	25	27	recording	2026-04-18 21:03:08.208155
17	-321549215	27	28	screenshot	2026-04-18 21:03:08.514088
18	88643509	27	28	recording	2026-04-18 21:03:08.517532
19	261888592	29	29	screenshot	2026-04-18 21:03:08.808948
20	1341950399	29	29	recording	2026-04-18 21:03:08.812196
21	1443299125	37	33	screenshot	2026-04-18 21:08:20.339014
22	1891955467	37	33	recording	2026-04-18 21:08:20.342088
23	1206711137	41	36	screenshot	2026-04-18 21:08:20.954982
24	1957086135	41	36	recording	2026-04-18 21:08:20.957821
25	-942659609	43	37	screenshot	2026-04-18 21:08:21.269562
26	113575766	43	37	recording	2026-04-18 21:08:21.273742
27	-531988643	45	38	screenshot	2026-04-18 21:08:21.672065
28	612049423	45	38	recording	2026-04-18 21:08:21.674634
29	-1885005536	47	39	screenshot	2026-04-18 21:08:22.008309
30	804028561	47	39	recording	2026-04-18 21:08:22.012344
31	-1609021387	49	40	screenshot	2026-04-18 21:08:22.346582
32	-1541816597	49	40	recording	2026-04-18 21:08:22.349718
33	-1704756346	51	41	screenshot	2026-04-18 21:08:22.652162
34	2130917105	51	41	recording	2026-04-18 21:08:22.655972
35	-1448313029	55	43	screenshot	2026-04-18 21:08:46.969272
36	1580090903	55	43	recording	2026-04-18 21:08:46.973265
37	585522486	56	44	screenshot	2026-04-18 21:08:47.025681
38	1423253994	56	44	recording	2026-04-18 21:08:47.028602
39	47531800	57	45	screenshot	2026-04-18 21:08:52.759194
40	877673249	57	45	recording	2026-04-18 21:08:52.763125
41	218097888	65	48	screenshot	2026-04-18 21:09:07.23084
42	567986442	65	48	recording	2026-04-18 21:09:07.233987
43	-568338939	69	51	screenshot	2026-04-18 21:09:07.795579
44	-2097844376	69	51	recording	2026-04-18 21:09:07.799027
45	961743765	71	52	screenshot	2026-04-18 21:09:08.116912
46	-306811318	71	52	recording	2026-04-18 21:09:08.119829
47	28765166	73	53	screenshot	2026-04-18 21:09:08.556203
48	-16735578	73	53	recording	2026-04-18 21:09:08.559613
49	1916261911	75	54	screenshot	2026-04-18 21:09:08.868552
50	-2073439331	75	54	recording	2026-04-18 21:09:08.872128
51	-2100395574	77	55	screenshot	2026-04-18 21:09:09.177528
52	1004641624	77	55	recording	2026-04-18 21:09:09.180498
53	2028794256	79	56	screenshot	2026-04-18 21:09:09.494376
54	-977914620	79	56	recording	2026-04-18 21:09:09.498411
55	-711741498	83	58	screenshot	2026-04-18 21:09:33.799738
56	373461145	83	58	recording	2026-04-18 21:09:33.803388
57	1997639881	84	59	screenshot	2026-04-18 21:09:33.856702
58	-2126309093	84	59	recording	2026-04-18 21:09:33.860465
59	-1276728990	85	60	screenshot	2026-04-18 21:09:39.567474
60	-1455757298	85	60	recording	2026-04-18 21:09:39.570542
61	1434028155	93	63	screenshot	2026-04-18 21:10:06.513889
62	-1187577678	93	63	recording	2026-04-18 21:10:06.516938
63	847982767	97	66	screenshot	2026-04-18 21:10:07.045796
64	2051372033	97	66	recording	2026-04-18 21:10:07.048414
65	1842301935	99	67	screenshot	2026-04-18 21:10:07.35874
66	905943154	99	67	recording	2026-04-18 21:10:07.362424
67	-93550788	101	68	screenshot	2026-04-18 21:10:07.78151
68	829745133	101	68	recording	2026-04-18 21:10:07.784234
69	1225045697	103	69	screenshot	2026-04-18 21:10:08.100213
70	-210095917	103	69	recording	2026-04-18 21:10:08.103874
71	2082581248	105	70	screenshot	2026-04-18 21:10:08.41656
72	326802753	105	70	recording	2026-04-18 21:10:08.420362
73	-70654180	107	71	screenshot	2026-04-18 21:10:08.716313
74	-1760651993	107	71	recording	2026-04-18 21:10:08.719917
75	-723974135	111	73	screenshot	2026-04-18 21:10:33.036393
76	1769141432	111	73	recording	2026-04-18 21:10:33.039922
77	60439060	112	74	screenshot	2026-04-18 21:10:33.08585
78	1273698148	112	74	recording	2026-04-18 21:10:33.088808
79	-1658916591	113	75	screenshot	2026-04-18 21:10:38.791154
80	-968356823	113	75	recording	2026-04-18 21:10:38.795116
81	1452911403	121	78	screenshot	2026-04-18 21:10:51.197324
82	-333215996	121	78	recording	2026-04-18 21:10:51.200753
83	428251781	125	81	screenshot	2026-04-18 21:10:51.726082
84	-788230850	125	81	recording	2026-04-18 21:10:51.729411
85	-1026224953	127	82	screenshot	2026-04-18 21:10:52.014957
86	1149571722	127	82	recording	2026-04-18 21:10:52.017774
87	1383432086	129	83	screenshot	2026-04-18 21:10:52.394593
88	1379584555	129	83	recording	2026-04-18 21:10:52.397755
89	1542389969	131	84	screenshot	2026-04-18 21:10:52.745331
90	-2105052403	131	84	recording	2026-04-18 21:10:52.749574
91	-1699374158	133	85	screenshot	2026-04-18 21:10:53.107167
92	1197920768	133	85	recording	2026-04-18 21:10:53.110129
93	-1853756630	135	86	screenshot	2026-04-18 21:10:53.402156
94	-1695295488	135	86	recording	2026-04-18 21:10:53.405126
95	655162482	139	88	screenshot	2026-04-18 21:11:17.680421
96	-450339405	139	88	recording	2026-04-18 21:11:17.683015
97	1116883591	140	89	screenshot	2026-04-18 21:11:17.732365
98	967739360	140	89	recording	2026-04-18 21:11:17.735659
99	-732817170	141	90	screenshot	2026-04-18 21:11:23.513539
100	1565236936	141	90	recording	2026-04-18 21:11:23.518142
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, user_id, type, amount, reward_percent, reward_amount, total_amount, status, upi_id, upi_name, user_upi_id, user_upi_name, user_name, notes, created_at, updated_at, utr_number, screenshot_url, recording_url, parent_sell_id, locked_at, locked_by_user_id, submitted_at, confirm_deadline, confirmed_at, held_amount, fee_amount, sell_reward_percent, sell_reward_amount, ocr_utr, ocr_amount, ocr_timestamp, ocr_bank, ocr_raw_text, ocr_status, ocr_amount_match, ocr_utr_match) FROM stdin;
1	3	deposit	101.00	4.00	4.04	105.04	approved	trustpay@upi	TrustPay	\N	\N	\N	\N	2026-04-16 11:20:28.176451	2026-04-16 11:25:41.177	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
2	3	withdrawal	100.00	5.00	5.00	105.00	approved	trustpay@upi	TrustPay	usfatul3@gmail.com	1000	Atul	\N	2026-04-16 11:22:26.941355	2026-04-16 11:25:43.117	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
3	3	withdrawal	500.00	5.00	25.00	525.00	approved	trustpay@upi	TrustPay	2828e8e	Uejeie	Atul	\N	2026-04-16 11:23:38.359718	2026-04-16 11:25:43.683	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
4	3	withdrawal	400.00	5.00	20.00	420.00	approved	trustpay@upi	TrustPay	Hsjsjs	Jejeje	Atul	\N	2026-04-16 11:23:56.719018	2026-04-16 11:25:44.097	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
5	4	deposit	150.00	4.00	6.00	156.00	pending	trustpay@upi	TrustPay	\N	\N	\N	\N	2026-04-16 12:27:17.301802	2026-04-16 12:27:17.301802	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
6	5	deposit	500.00	4.00	20.00	520.00	rejected	trustpay@upi	TrustPay	\N	\N	7379587444	gateway_error:<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Internal Server Error</pre>\n<script src="https://replit-cdn.com/replit-pill/replit-pill.global.j	2026-04-18 10:50:21.585577	2026-04-18 10:50:22.611	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
7	5	deposit	117.00	4.00	4.68	121.68	rejected	trustpay@upi	TrustPay	\N	\N	7379587444	gateway_error:<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Internal Server Error</pre>\n<script src="https://replit-cdn.com/replit-pill/replit-pill.global.j	2026-04-18 10:50:39.670061	2026-04-18 10:50:40.004	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
8	1	deposit	100.00	4.00	4.00	104.00	rejected	trustpay@upi	TrustPay	\N	\N	admin	gateway_error:{"error":"internal_error","message":"Failed to create payment"}	2026-04-18 12:54:20.818396	2026-04-18 12:54:22.284	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
9	1	deposit	150.00	4.00	6.00	156.00	pending	trustpay@upi	TrustPay	\N	\N	admin	gateway:created	2026-04-18 13:41:39.550973	2026-04-18 13:41:40.214	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
13	6	withdrawal	307.00	0.00	0.00	307.00	available	\N	\N	test1@okhdfc	Test User 1	Test User 1	\N	2026-04-18 17:53:21.457467	2026-04-18 17:53:21.457467	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
14	6	withdrawal	288.00	0.00	0.00	288.00	available	\N	\N	test1@okhdfc	Test User 1	Test User 1	\N	2026-04-18 17:53:21.459691	2026-04-18 17:53:21.459691	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
15	6	withdrawal	384.00	0.00	0.00	384.00	available	\N	\N	test1@okhdfc	Test User 1	Test User 1	\N	2026-04-18 17:53:21.463042	2026-04-18 17:53:21.463042	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
16	6	withdrawal	247.00	0.00	0.00	247.00	available	\N	\N	test1@okhdfc	Test User 1	Test User 1	\N	2026-04-18 17:53:21.465299	2026-04-18 17:53:21.465299	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
17	6	withdrawal	485.00	0.00	0.00	485.00	available	\N	\N	test1@okhdfc	Test User 1	Test User 1	\N	2026-04-18 17:53:21.468226	2026-04-18 17:53:21.468226	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
18	6	withdrawal	109.00	0.00	0.00	109.00	available	\N	\N	test1@okhdfc	Test User 1	Test User 1	\N	2026-04-18 17:53:21.4706	2026-04-18 17:53:21.4706	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
10	6	withdrawal	102.00	5.00	5.10	107.10	confirmed	\N	\N	test1@okhdfc	Test User 1	Test User 1	\N	2026-04-18 17:53:21.448238	2026-04-18 17:53:41.78	987654321099	data:image/png;base64,iVBORw0KGgoTESTSCREENSHOTdata:image/png;base64,iVBORw0KGgoTESTSCREENSHOTdata:image/png;base64,iVBORw0KGgoTESTSCREENSHOTdata:image/png;base64,iVBORw0KGgoTESTSCREENSHOTdata:image/png;base64,iVBORw0KGgoTESTSCREENSHOTdata:image/png;base64,iVBORw0KGgoTESTSCREENSHOTdata:image/png;base64,iVBORw0KGgoTESTSCREENSHOTdata:image/png;base64,iVBORw0KGgoTESTSCREENSHOTdata:image/png;base64,iVBORw0KGgoTESTSCREENSHOTdata:image/png;base64,iVBORw0KGgoTESTSCREENSHOT	data:video/mp4;base64,AAAAFGZ0eXBpc29tTESTRECORDINGdata:video/mp4;base64,AAAAFGZ0eXBpc29tTESTRECORDINGdata:video/mp4;base64,AAAAFGZ0eXBpc29tTESTRECORDINGdata:video/mp4;base64,AAAAFGZ0eXBpc29tTESTRECORDINGdata:video/mp4;base64,AAAAFGZ0eXBpc29tTESTRECORDINGdata:video/mp4;base64,AAAAFGZ0eXBpc29tTESTRECORDINGdata:video/mp4;base64,AAAAFGZ0eXBpc29tTESTRECORDINGdata:video/mp4;base64,AAAAFGZ0eXBpc29tTESTRECORDINGdata:video/mp4;base64,AAAAFGZ0eXBpc29tTESTRECORDINGdata:video/mp4;base64,AAAAFGZ0eXBpc29tTESTRECORDING	\N	2026-04-18 17:53:41.653	7	2026-04-18 17:53:41.681	2026-04-18 18:08:41.681	2026-04-18 17:53:41.78	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
126	216	withdrawal	250.00	0.00	0.00	250.00	cancelled	\N	\N	seed216@upi	Seed 216	Seed 216	\N	2026-04-22 20:57:13.82653	2026-04-22 20:57:13.837	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
12	6	withdrawal	100.00	5.00	5.00	105.00	confirmed	\N	\N	test1@okhdfc	Test User 1	Test User 1	\N	2026-04-18 17:53:21.45439	2026-04-18 17:59:57.528	U1776535197487	data:img;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA	data:vid;base64,BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB	\N	2026-04-18 17:59:57.473	7	2026-04-18 17:59:57.504	2026-04-18 18:14:57.504	2026-04-18 17:59:57.528	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
11	6	withdrawal	414.00	0.00	0.00	414.00	cancelled	\N	\N	test1@okhdfc	Test User 1	Test User 1	\N	2026-04-18 17:53:21.451925	2026-04-18 17:55:43.484	BADUTR123456	data:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZdata:image/png;base64,XYZ	data:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,RECdata:video/mp4;base64,REC	\N	2026-04-18 17:55:43.406	7	2026-04-18 17:55:43.475	2026-04-18 18:10:43.475	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
23	16	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed16@upi	Seed 16	Seed 16	\N	2026-04-18 21:03:06.948163	2026-04-18 21:03:06.948163	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
24	18	withdrawal	6000.00	3.00	180.00	6180.00	confirmed	\N	\N	seed18@upi	Seed 18	Seed 18	\N	2026-04-18 21:03:07.181844	2026-04-18 21:03:07.229	UTRHV6334423703	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODcyMDItb3h3YjZqNWR0Ni14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODcyMDItd3luZmNzeTR3NnAteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:03:07.191	19	2026-04-18 21:03:07.216	2026-04-18 21:18:07.216	2026-04-18 21:03:07.229	6000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
20	12	withdrawal	150.00	0.00	0.00	150.00	available	\N	\N	seed12@upi	Seed 12	Seed 12	\N	2026-04-18 21:03:06.404764	2026-04-18 21:03:06.434	\N	\N	\N	\N	\N	\N	\N	\N	\N	150.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
129	221	withdrawal	100.00	0.00	0.00	100.00	cancelled	\N	\N	seed221@upi	Seed 221	Seed 221	\N	2026-04-22 20:57:38.320702	2026-04-22 20:57:38.339	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
21	14	withdrawal	300.00	5.00	15.00	315.00	confirmed	\N	\N	seed14@upi	Seed 14	Seed 14	\N	2026-04-18 21:03:06.648048	2026-04-18 21:03:06.703	UTR4888726176	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODY2NjctM3lrcW4wbmtrd3EteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODY2NjgtZGx6ZnRwd25xNWQteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:03:06.657	15	2026-04-18 21:03:06.689	2026-04-18 21:18:06.689	2026-04-18 21:03:06.703	300.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
30	28	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed28@upi	Seed 28	Seed 28	\N	2026-04-18 21:03:08.836996	2026-04-18 21:03:08.836996	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
19	10	withdrawal	200.00	0.00	0.00	200.00	available	\N	\N	seed10@upi	Seed 10	Seed 10	\N	2026-04-18 21:03:06.149023	2026-04-20 17:14:36.309	\N	\N	\N	\N	\N	\N	\N	\N	\N	200.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
22	16	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed16@upi	Seed 16	Seed 16	\N	2026-04-18 21:03:06.942308	2026-04-20 17:14:36.309	\N	\N	\N	\N	\N	\N	\N	\N	\N	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
25	20	withdrawal	11000.00	3.00	330.00	11330.00	confirmed	\N	\N	seed20@upi	Seed 20	Seed 20	\N	2026-04-18 21:03:07.481669	2026-04-18 21:03:07.532	UTRC9151493657	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODc1MDMtaDJzbm01ZXV5YWsteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODc1MDMtZXhqcHFyOWh4ODYteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:03:07.492	21	2026-04-18 21:03:07.518	2026-04-18 21:18:07.518	2026-04-18 21:03:07.532	11000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
26	22	withdrawal	8000.00	3.00	240.00	8240.00	confirmed	\N	\N	seed22@upi	Seed 22	Seed 22	\N	2026-04-18 21:03:07.872138	2026-04-18 21:03:07.923	UTRA7654691173	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODc4OTMtamtwMmo4Ym5lc2steHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODc4OTMtcGx2NmltMmhlei14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	\N	2026-04-18 21:03:07.883	23	2026-04-18 21:03:07.91	2026-04-18 21:18:07.91	2026-04-18 21:03:07.923	8000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
27	24	withdrawal	250.00	0.00	0.00	250.00	disputed	\N	\N	seed24@upi	Seed 24	Seed 24	\N	2026-04-18 21:03:08.170828	2026-04-18 21:03:08.223	UTRDP1457100899	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODgxOTUta2d2MjljdmlncS14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODgxOTUtMWllY2dxN2VqOXkteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:03:08.184	25	2026-04-18 21:03:08.211	2026-04-18 21:18:08.211	\N	250.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
28	26	withdrawal	250.00	0.00	0.00	250.00	disputed	\N	\N	seed26@upi	Seed 26	Seed 26	\N	2026-04-18 21:03:08.480866	2026-04-18 21:03:08.534	UTRSL4220858787	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODg1MDQtbTZvcWcxbWRxcmoteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODg1MDQtemk3ZmxuZmcwNmEteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:03:08.492	27	2026-04-18 21:03:08.52	2026-04-18 21:18:08.52	\N	250.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
29	28	withdrawal	150.00	0.00	0.00	150.00	disputed	\N	\N	seed28@upi	Seed 28	Seed 28	\N	2026-04-18 21:03:08.780096	2026-04-18 21:03:08.827	UTRBL3187166390	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODg4MDAtOWNoem83dmExdHcteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDYxODg4MDAtcDN1anduemdpZC14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	\N	2026-04-18 21:03:08.788	29	2026-04-18 21:03:08.814	2026-04-18 21:18:08.814	\N	150.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
36	40	withdrawal	6000.00	3.00	180.00	6180.00	confirmed	\N	\N	seed40@upi	Seed 40	Seed 40	\N	2026-04-18 21:08:20.917613	2026-04-18 21:08:20.973	UTRHV5735597584	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDA5NDMtZXVueXppMWxkZGUteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDA5NDMtamtiZzdqaGgwMmIteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:08:20.929	41	2026-04-18 21:08:20.961	2026-04-18 21:23:20.961	2026-04-18 21:08:20.973	6000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
32	34	withdrawal	150.00	0.00	0.00	150.00	available	\N	\N	seed34@upi	Seed 34	Seed 34	\N	2026-04-18 21:08:20.041008	2026-04-18 21:08:20.073	\N	\N	\N	\N	\N	\N	\N	\N	\N	150.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
38	44	withdrawal	8000.00	3.00	240.00	8240.00	confirmed	\N	\N	seed44@upi	Seed 44	Seed 44	\N	2026-04-18 21:08:21.641576	2026-04-18 21:08:21.693	UTRA1267842065	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDE2NjItcG85NGVsNmJhbS14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDE2NjItcmFuaDFib2F0MGcteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:08:21.65	45	2026-04-18 21:08:21.677	2026-04-18 21:23:21.677	2026-04-18 21:08:21.693	8000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
37	42	withdrawal	11000.00	3.00	330.00	11330.00	confirmed	\N	\N	seed42@upi	Seed 42	Seed 42	\N	2026-04-18 21:08:21.23631	2026-04-18 21:08:21.291	UTRC8857227987	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDEyNTktaXByZ2dmYmlwaS14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDEyNTktNW5kOTRweHp4cHMteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:08:21.247	43	2026-04-18 21:08:21.276	2026-04-18 21:23:21.276	2026-04-18 21:08:21.291	11000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
33	36	withdrawal	300.00	5.00	15.00	315.00	confirmed	\N	\N	seed36@upi	Seed 36	Seed 36	\N	2026-04-18 21:08:20.303019	2026-04-18 21:08:20.362	UTR1029858449	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDAzMjctandiZmEzdm92eS14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDAzMjcteW14MjRyM2dnay14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	\N	2026-04-18 21:08:20.316	37	2026-04-18 21:08:20.345	2026-04-18 21:23:20.345	2026-04-18 21:08:20.362	300.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
35	38	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed38@upi	Seed 38	Seed 38	\N	2026-04-18 21:08:20.65062	2026-04-18 21:08:20.65062	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
127	218	withdrawal	150.00	0.00	0.00	150.00	cancelled	\N	\N	seed218@upi	Seed 218	Seed 218	\N	2026-04-22 20:57:14.072153	2026-04-22 20:57:14.083	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
39	46	withdrawal	250.00	0.00	0.00	250.00	disputed	\N	\N	seed46@upi	Seed 46	Seed 46	\N	2026-04-18 21:08:21.97429	2026-04-18 21:08:22.029	UTRDP6289059602	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDE5OTgtdmVjNmg2djZlNi14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDE5OTgtaDV3NnNxMHZrMmYteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:08:21.986	47	2026-04-18 21:08:22.015	2026-04-18 21:23:22.015	\N	250.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
42	50	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed50@upi	Seed 50	Seed 50	\N	2026-04-18 21:08:22.690122	2026-04-18 21:08:22.690122	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
31	32	withdrawal	200.00	0.00	0.00	200.00	available	\N	\N	seed32@upi	Seed 32	Seed 32	\N	2026-04-18 21:08:19.78069	2026-04-20 17:14:36.309	\N	\N	\N	\N	\N	\N	\N	\N	\N	200.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
34	38	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed38@upi	Seed 38	Seed 38	\N	2026-04-18 21:08:20.641888	2026-04-20 17:14:36.309	\N	\N	\N	\N	\N	\N	\N	\N	\N	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
128	218	withdrawal	100.00	0.00	0.00	100.00	cancelled	\N	\N	seed218@upi	Seed 218	Seed 218	\N	2026-04-22 20:57:14.11352	2026-04-22 20:57:14.125	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
40	48	withdrawal	250.00	0.00	0.00	250.00	disputed	\N	\N	seed48@upi	Seed 48	Seed 48	\N	2026-04-18 21:08:22.315881	2026-04-18 21:08:22.366	UTRSL611084435	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDIzMzYtYmZmb3BraDdpYzgteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDIzMzYtYzdvcHBpZzRxdW8teHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:08:22.325	49	2026-04-18 21:08:22.352	2026-04-18 21:23:22.352	\N	250.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
41	50	withdrawal	150.00	0.00	0.00	150.00	disputed	\N	\N	seed50@upi	Seed 50	Seed 50	\N	2026-04-18 21:08:22.620236	2026-04-18 21:08:22.675	UTRBL3573326708	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDI2NDEtZXJmM2x3dnVpMXcteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MDI2NDEtcXF6MmltamNxcmUteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:08:22.63	51	2026-04-18 21:08:22.659	2026-04-18 21:23:22.659	\N	150.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
52	70	withdrawal	11000.00	3.00	330.00	11330.00	confirmed	\N	\N	seed70@upi	Seed 70	Seed 70	\N	2026-04-18 21:09:08.089162	2026-04-18 21:09:08.136	UTRC5355967350	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDgxMDgtZ245czdobnN2ZzUteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDgxMDgtMm9uZnYxa3dqMWMteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:09:08.098	71	2026-04-18 21:09:08.122	2026-04-18 21:24:08.122	2026-04-18 21:09:08.136	11000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
44	54	withdrawal	100.00	5.00	5.00	105.00	confirmed	\N	\N	seed54@upi	Seed 54	Seed 54	\N	2026-04-18 21:08:46.990246	2026-04-20 17:14:36.447	FRDUP2299326431	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MjcwMTQtbnR5bmhmamZhNGkteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MjcwMTQtb2M5c2R4eDgyai14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	\N	2026-04-18 21:08:47.001	56	2026-04-18 21:08:47.031	2026-04-18 21:23:47.031	2026-04-20 17:14:36.447	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
45	54	withdrawal	100.00	5.00	5.00	105.00	confirmed	\N	\N	seed54@upi	Seed 54	Seed 54	\N	2026-04-18 21:08:52.695163	2026-04-20 17:14:36.478	FRDUP2299326431	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MzI3MjQtczBpN2VjeXEyYi14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MzI3MjQtdHptb3FqdG1uNm4teHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:08:52.708	57	2026-04-18 21:08:52.768	2026-04-18 21:23:52.768	2026-04-20 17:14:36.478	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
53	72	withdrawal	8000.00	3.00	240.00	8240.00	confirmed	\N	\N	seed72@upi	Seed 72	Seed 72	\N	2026-04-18 21:09:08.514602	2026-04-18 21:09:08.578	UTRA5930645924	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDg1NDItdGpuNG5kcDIyN2steHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDg1NDItanVwZjloOW9mZ3EteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:09:08.529	73	2026-04-18 21:09:08.562	2026-04-18 21:24:08.562	2026-04-18 21:09:08.578	8000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
130	227	withdrawal	200.00	0.00	0.00	200.00	cancelled	\N	\N	seed227@upi	Seed 227	Seed 227	\N	2026-04-22 20:57:57.383377	2026-04-22 20:57:57.399	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
51	68	withdrawal	6000.00	3.00	180.00	6180.00	confirmed	\N	\N	seed68@upi	Seed 68	Seed 68	\N	2026-04-18 21:09:07.760572	2026-04-18 21:09:07.816	UTRHV494454177	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDc3ODMtMjEyY3U1NGdnNG4teHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDc3ODMtN2NvczU4M3pobnAteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:09:07.771	69	2026-04-18 21:09:07.802	2026-04-18 21:24:07.802	2026-04-18 21:09:07.816	6000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
47	62	withdrawal	150.00	0.00	0.00	150.00	available	\N	\N	seed62@upi	Seed 62	Seed 62	\N	2026-04-18 21:09:06.939755	2026-04-18 21:09:06.966	\N	\N	\N	\N	\N	\N	\N	\N	\N	150.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
54	74	withdrawal	250.00	0.00	0.00	250.00	disputed	\N	\N	seed74@upi	Seed 74	Seed 74	\N	2026-04-18 21:09:08.837142	2026-04-18 21:09:08.887	UTRDP4064720020	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDg4NTktOG1kNjZ5YXJnMy14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDg4NTktdW9yaXo3ZXBzaWcteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:09:08.846	75	2026-04-18 21:09:08.875	2026-04-18 21:24:08.875	\N	250.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
49	66	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed66@upi	Seed 66	Seed 66	\N	2026-04-18 21:09:07.496361	2026-04-20 17:14:36.309	\N	\N	\N	\N	\N	\N	\N	\N	\N	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
46	60	withdrawal	200.00	0.00	0.00	200.00	available	\N	\N	seed60@upi	Seed 60	Seed 60	\N	2026-04-18 21:09:06.672783	2026-04-20 17:14:36.309	\N	\N	\N	\N	\N	\N	\N	\N	\N	200.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
48	64	withdrawal	300.00	5.00	15.00	315.00	confirmed	\N	\N	seed64@upi	Seed 64	Seed 64	\N	2026-04-18 21:09:07.200306	2026-04-18 21:09:07.254	UTR7041359633	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDcyMjAtcXFxdTJ3MW43Nm8teHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDcyMjAtdHN6Y3Mwc2JmZGUteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:09:07.21	65	2026-04-18 21:09:07.236	2026-04-18 21:24:07.236	2026-04-18 21:09:07.254	300.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
50	66	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed66@upi	Seed 66	Seed 66	\N	2026-04-18 21:09:07.502739	2026-04-18 21:09:07.502739	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
43	53	withdrawal	100.00	5.00	5.00	105.00	confirmed	\N	\N	seed53@upi	Seed 53	Seed 53	\N	2026-04-18 21:08:46.918947	2026-04-20 17:14:36.4	FRDUP2299326431	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MjY5NTEtdWRuaHAyc3hpa2EteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1MjY5NTEta2FieXU0enRqaS14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	\N	2026-04-18 21:08:46.939	55	2026-04-18 21:08:46.975	2026-04-18 21:23:46.975	2026-04-20 17:14:36.4	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
131	229	withdrawal	150.00	0.00	0.00	150.00	cancelled	\N	\N	seed229@upi	Seed 229	Seed 229	\N	2026-04-22 20:57:57.64176	2026-04-22 20:57:57.652	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
132	231	withdrawal	300.00	0.00	0.00	300.00	cancelled	\N	\N	seed231@upi	Seed 231	Seed 231	\N	2026-04-22 20:57:57.884576	2026-04-22 20:57:57.894	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
134	233	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed233@upi	Seed 233	Seed 233	\N	2026-04-22 20:57:58.122312	2026-04-22 20:57:58.122312	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
133	233	withdrawal	100.00	0.00	0.00	100.00	cancelled	\N	\N	seed233@upi	Seed 233	Seed 233	\N	2026-04-22 20:57:58.115416	2026-04-22 20:57:58.133	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
135	235	withdrawal	6000.00	0.00	0.00	6000.00	cancelled	\N	\N	seed235@upi	Seed 235	Seed 235	\N	2026-04-22 20:57:58.355822	2026-04-22 20:57:58.365	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
136	237	withdrawal	11000.00	0.00	0.00	11000.00	cancelled	\N	\N	seed237@upi	Seed 237	Seed 237	\N	2026-04-22 20:57:58.602462	2026-04-22 20:57:58.614	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
55	76	withdrawal	250.00	0.00	0.00	250.00	disputed	\N	\N	seed76@upi	Seed 76	Seed 76	\N	2026-04-18 21:09:09.149369	2026-04-18 21:09:09.198	UTRSL9383037366	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDkxNjgtZ3FicTZxMHJodTQteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDkxNjgtZ2gxZjF3c2drcmUteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:09:09.158	77	2026-04-18 21:09:09.183	2026-04-18 21:24:09.183	\N	250.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
63	92	withdrawal	300.00	5.00	15.00	315.00	confirmed	\N	\N	seed92@upi	Seed 92	Seed 92	\N	2026-04-18 21:10:06.478718	2026-04-18 21:10:06.532	UTR188692075	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDY1MDItbjJob3JncGR0emwteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDY1MDMtNzlyMHExaXd2ZGIteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:06.49	93	2026-04-18 21:10:06.52	2026-04-18 21:25:06.52	2026-04-18 21:10:06.532	300.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
65	94	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed94@upi	Seed 94	Seed 94	\N	2026-04-18 21:10:06.776938	2026-04-18 21:10:06.776938	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
56	78	withdrawal	150.00	0.00	0.00	150.00	disputed	\N	\N	seed78@upi	Seed 78	Seed 78	\N	2026-04-18 21:09:09.463667	2026-04-18 21:09:09.513	UTRBL2414660627	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDk0ODUtNmdlaGNoZHM4NGoteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NDk0ODUtbXJuc2drcXh6dGcteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:09:09.473	79	2026-04-18 21:09:09.501	2026-04-18 21:24:09.501	\N	150.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
57	78	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed78@upi	Seed 78	Seed 78	\N	2026-04-18 21:09:09.523826	2026-04-18 21:09:09.523826	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
68	100	withdrawal	8000.00	3.00	240.00	8240.00	confirmed	\N	\N	seed100@upi	Seed 100	Seed 100	\N	2026-04-18 21:10:07.747965	2026-04-18 21:10:07.801	UTRA2624839512	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDc3NzEtajlqa3I4aWZpdy14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDc3NzEtbXNobzBtaDl4bS14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	\N	2026-04-18 21:10:07.758	101	2026-04-18 21:10:07.788	2026-04-18 21:25:07.788	2026-04-18 21:10:07.801	8000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
61	88	withdrawal	200.00	0.00	0.00	200.00	available	\N	\N	seed88@upi	Seed 88	Seed 88	\N	2026-04-18 21:10:05.986936	2026-04-20 17:14:36.309	\N	\N	\N	\N	\N	\N	\N	\N	\N	200.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
59	82	withdrawal	100.00	5.00	5.00	105.00	confirmed	\N	\N	seed82@upi	Seed 82	Seed 82	\N	2026-04-18 21:09:33.821152	2026-04-20 17:14:36.544	FRDUP6433751739	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NzM4NDctcnI4NDYyNGdrdS14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NzM4NDctbWE4YzRrYTZmYXEteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:09:33.83	84	2026-04-18 21:09:33.863	2026-04-18 21:24:33.863	2026-04-20 17:14:36.544	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
60	82	withdrawal	100.00	5.00	5.00	105.00	confirmed	\N	\N	seed82@upi	Seed 82	Seed 82	\N	2026-04-18 21:09:39.5204	2026-04-20 17:14:36.576	FRDUP6433751739	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1Nzk1NDQtNGlpM3ZvdDU4My14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1Nzk1NDQtNnMyNHF3eHltaWEteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:09:39.53	85	2026-04-18 21:09:39.573	2026-04-18 21:24:39.573	2026-04-20 17:14:36.576	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
67	98	withdrawal	11000.00	3.00	330.00	11330.00	confirmed	\N	\N	seed98@upi	Seed 98	Seed 98	\N	2026-04-18 21:10:07.327222	2026-04-18 21:10:07.397	UTRC947768700	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDczNDktYW9xaG9oeHlnZnEteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDczNDktZGJwbTBuc3ZjNW8teHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:07.337	99	2026-04-18 21:10:07.365	2026-04-18 21:25:07.365	2026-04-18 21:10:07.397	11000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
138	241	withdrawal	250.00	0.00	0.00	250.00	cancelled	\N	\N	seed241@upi	Seed 241	Seed 241	\N	2026-04-22 20:57:59.346184	2026-04-22 20:57:59.356	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
66	96	withdrawal	6000.00	3.00	180.00	6180.00	confirmed	\N	\N	seed96@upi	Seed 96	Seed 96	\N	2026-04-18 21:10:07.016626	2026-04-18 21:10:07.067	UTRHV8551794386	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDcwMzYtNGR1eDJqNDJsaDYteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDcwMzYtemRyaXkydGh6OHEteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:07.026	97	2026-04-18 21:10:07.051	2026-04-18 21:25:07.051	2026-04-18 21:10:07.067	6000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
58	81	withdrawal	100.00	5.00	5.00	105.00	confirmed	\N	\N	seed81@upi	Seed 81	Seed 81	\N	2026-04-18 21:09:33.722593	2026-04-20 17:14:36.511	FRDUP6433751739	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NzM3NTItNjJqamJseWl2cmkteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY1NzM3NTItNzE5a3I1aTJ5dy14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	\N	2026-04-18 21:09:33.74	83	2026-04-18 21:09:33.806	2026-04-18 21:24:33.806	2026-04-20 17:14:36.511	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
69	102	withdrawal	250.00	0.00	0.00	250.00	disputed	\N	\N	seed102@upi	Seed 102	Seed 102	\N	2026-04-18 21:10:08.068028	2026-04-18 21:10:08.122	UTRDP7792127220	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDgwODktMGQ2eWhrM3A0cHM2LXh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA==	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDgwODktMzBvMjdmcjM0OG0teHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:08.077	103	2026-04-18 21:10:08.106	2026-04-18 21:25:08.106	\N	250.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
62	90	withdrawal	150.00	0.00	0.00	150.00	available	\N	\N	seed90@upi	Seed 90	Seed 90	\N	2026-04-18 21:10:06.237718	2026-04-18 21:10:06.265	\N	\N	\N	\N	\N	\N	\N	\N	\N	150.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
72	106	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed106@upi	Seed 106	Seed 106	\N	2026-04-18 21:10:08.752152	2026-04-18 21:10:08.752152	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
64	94	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed94@upi	Seed 94	Seed 94	\N	2026-04-18 21:10:06.771172	2026-04-20 17:14:36.309	\N	\N	\N	\N	\N	\N	\N	\N	\N	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
139	243	withdrawal	250.00	0.00	0.00	250.00	cancelled	\N	\N	seed243@upi	Seed 243	Seed 243	\N	2026-04-22 20:57:59.590027	2026-04-22 20:57:59.6	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
140	245	withdrawal	150.00	0.00	0.00	150.00	cancelled	\N	\N	seed245@upi	Seed 245	Seed 245	\N	2026-04-22 20:57:59.83435	2026-04-22 20:57:59.845	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
141	245	withdrawal	100.00	0.00	0.00	100.00	cancelled	\N	\N	seed245@upi	Seed 245	Seed 245	\N	2026-04-22 20:57:59.873194	2026-04-22 20:57:59.886	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
70	104	withdrawal	250.00	0.00	0.00	250.00	disputed	\N	\N	seed104@upi	Seed 104	Seed 104	\N	2026-04-18 21:10:08.386603	2026-04-18 21:10:08.438	UTRSL4467423040	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDg0MDYtOG4yZDB6amhtMzgteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDg0MDYtbTVxODB5dzNqNXEteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:08.396	105	2026-04-18 21:10:08.423	2026-04-18 21:25:08.423	\N	250.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
71	106	withdrawal	150.00	0.00	0.00	150.00	disputed	\N	\N	seed106@upi	Seed 106	Seed 106	\N	2026-04-18 21:10:08.683326	2026-04-18 21:10:08.739	UTRBL3552908262	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDg3MDQtam5icHkxamd2di14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MDg3MDQtYjNwdzdlcXJ3bzYteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:08.692	107	2026-04-18 21:10:08.722	2026-04-18 21:25:08.722	\N	150.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
82	126	withdrawal	11000.00	3.00	330.00	11330.00	confirmed	\N	\N	seed126@upi	Seed 126	Seed 126	\N	2026-04-18 21:10:51.986226	2026-04-18 21:10:52.034	UTRC3166383917	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTIwMDYtMDBwam4wemhla25xLXh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA==	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTIwMDYtcHhzNmJoY2tvYy14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	\N	2026-04-18 21:10:51.996	127	2026-04-18 21:10:52.019	2026-04-18 21:25:52.019	2026-04-18 21:10:52.034	11000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
73	109	withdrawal	100.00	5.00	5.00	105.00	confirmed	\N	\N	seed109@upi	Seed 109	Seed 109	\N	2026-04-18 21:10:32.991107	2026-04-20 17:14:36.61	FRDUP86008813	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MzMwMjEtaGQ5dDFyeDM2dGsteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MzMwMjEtMW9zYmNma2dxYzdoLXh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA==	\N	2026-04-18 21:10:33.009	111	2026-04-18 21:10:33.042	2026-04-18 21:25:33.042	2026-04-20 17:14:36.61	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
74	110	withdrawal	100.00	5.00	5.00	105.00	confirmed	\N	\N	seed110@upi	Seed 110	Seed 110	\N	2026-04-18 21:10:33.056729	2026-04-20 17:14:36.65	FRDUP86008813	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MzMwNzctb242bGw5NTUwZS14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2MzMwNzctdHUwZXQwbXJ1N20teHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:33.065	112	2026-04-18 21:10:33.092	2026-04-18 21:25:33.092	2026-04-20 17:14:36.65	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
75	110	withdrawal	100.00	5.00	5.00	105.00	confirmed	\N	\N	seed110@upi	Seed 110	Seed 110	\N	2026-04-18 21:10:38.742256	2026-04-20 17:14:36.68	FRDUP86008813	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2Mzg3NjYtNnBsMmIxYTI1ZnkteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2Mzg3NjYtbWw3MzhoM21qbmQteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:38.752	113	2026-04-18 21:10:38.798	2026-04-18 21:25:38.798	2026-04-20 17:14:36.68	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
83	128	withdrawal	8000.00	3.00	240.00	8240.00	confirmed	\N	\N	seed128@upi	Seed 128	Seed 128	\N	2026-04-18 21:10:52.364441	2026-04-18 21:10:52.415	UTRA4677203077	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTIzODQtZm13czFlNWFwMHUteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTIzODQtazl0OTNlaG1iYWUteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:52.373	129	2026-04-18 21:10:52.4	2026-04-18 21:25:52.4	2026-04-18 21:10:52.415	8000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
81	124	withdrawal	6000.00	3.00	180.00	6180.00	confirmed	\N	\N	seed124@upi	Seed 124	Seed 124	\N	2026-04-18 21:10:51.694282	2026-04-18 21:10:51.745	UTRHV434456915	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTE3MTctbTJsd293eWVuby14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTE3MTctNDhiMnh1djRxcXEteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:51.704	125	2026-04-18 21:10:51.732	2026-04-18 21:25:51.732	2026-04-18 21:10:51.745	6000.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
142	248	withdrawal	100.00	0.00	0.00	100.00	cancelled	\N	\N	seed248@upi	Seed 248	Seed 248	\N	2026-04-22 20:58:24.170764	2026-04-22 20:58:24.187	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
77	118	withdrawal	150.00	0.00	0.00	150.00	available	\N	\N	seed118@upi	Seed 118	Seed 118	\N	2026-04-18 21:10:50.914325	2026-04-18 21:10:50.944	\N	\N	\N	\N	\N	\N	\N	\N	\N	150.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
84	130	withdrawal	250.00	0.00	0.00	250.00	disputed	\N	\N	seed130@upi	Seed 130	Seed 130	\N	2026-04-18 21:10:52.683818	2026-04-18 21:10:52.769	UTRDP437292890	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTI3MjYtN3ltcnc2b3hzZGcteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTI3MjYtNDc1ODYzb3RqangteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:52.696	131	2026-04-18 21:10:52.752	2026-04-18 21:25:52.752	\N	250.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
87	134	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed134@upi	Seed 134	Seed 134	\N	2026-04-18 21:10:53.43583	2026-04-18 21:10:53.43583	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
78	120	withdrawal	300.00	5.00	15.00	315.00	confirmed	\N	\N	seed120@upi	Seed 120	Seed 120	\N	2026-04-18 21:10:51.165882	2026-04-18 21:10:51.219	UTR2520929999	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTExODctOTh2cmhjbG1pdC14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTExODctOXcxcDNsYjd5YW4teHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:51.176	121	2026-04-18 21:10:51.203	2026-04-18 21:25:51.203	2026-04-18 21:10:51.219	300.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
80	122	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed122@upi	Seed 122	Seed 122	\N	2026-04-18 21:10:51.461805	2026-04-18 21:10:51.461805	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
79	122	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed122@upi	Seed 122	Seed 122	\N	2026-04-18 21:10:51.455266	2026-04-20 17:14:36.309	\N	\N	\N	\N	\N	\N	\N	\N	\N	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
76	116	withdrawal	200.00	0.00	0.00	200.00	available	\N	\N	seed116@upi	Seed 116	Seed 116	\N	2026-04-18 21:10:50.668226	2026-04-20 17:14:36.309	\N	\N	\N	\N	\N	\N	\N	\N	\N	200.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
85	132	withdrawal	250.00	0.00	0.00	250.00	disputed	\N	\N	seed132@upi	Seed 132	Seed 132	\N	2026-04-18 21:10:53.074614	2026-04-18 21:10:53.128	UTRSL5114555106	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTMwOTYtZjNnNnNkcjIwcWIteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTMwOTYtNjNpam1nZnd2NGgteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:53.084	133	2026-04-18 21:10:53.112	2026-04-18 21:25:53.112	\N	250.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
86	134	withdrawal	150.00	0.00	0.00	150.00	disputed	\N	\N	seed134@upi	Seed 134	Seed 134	\N	2026-04-18 21:10:53.372256	2026-04-18 21:10:53.421	UTRBL3184949231	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTMzOTItOHpucHFsc3lobTcteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2NTMzOTItaGNneHRtaHY2bXYteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:10:53.381	135	2026-04-18 21:10:53.408	2026-04-18 21:25:53.408	\N	150.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
94	152	withdrawal	100.00	0.00	0.00	100.00	cancelled	\N	\N	seed152@upi	Seed 152	Seed 152	\N	2026-04-22 20:55:32.160446	2026-04-22 20:55:32.182	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
96	154	withdrawal	6000.00	0.00	0.00	6000.00	cancelled	\N	\N	seed154@upi	Seed 154	Seed 154	\N	2026-04-22 20:55:32.418507	2026-04-22 20:55:32.43	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
97	156	withdrawal	11000.00	0.00	0.00	11000.00	cancelled	\N	\N	seed156@upi	Seed 156	Seed 156	\N	2026-04-22 20:55:32.67633	2026-04-22 20:55:32.686	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
98	158	withdrawal	8000.00	0.00	0.00	8000.00	cancelled	\N	\N	seed158@upi	Seed 158	Seed 158	\N	2026-04-22 20:55:33.028111	2026-04-22 20:55:33.04	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
99	160	withdrawal	250.00	0.00	0.00	250.00	cancelled	\N	\N	seed160@upi	Seed 160	Seed 160	\N	2026-04-22 20:55:33.300402	2026-04-22 20:55:33.311	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
88	137	withdrawal	100.00	5.00	5.00	105.00	confirmed	\N	\N	seed137@upi	Seed 137	Seed 137	\N	2026-04-18 21:11:17.630919	2026-04-20 17:14:36.708	FRDUP624566387	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2Nzc2NjMtaWg0MWIxZ2lzamkteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2Nzc2NjMtOHNpOGwzOXc1YS14eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=	\N	2026-04-18 21:11:17.648	139	2026-04-18 21:11:17.685	2026-04-18 21:26:17.685	2026-04-20 17:14:36.708	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
89	138	withdrawal	100.00	5.00	5.00	105.00	confirmed	\N	\N	seed138@upi	Seed 138	Seed 138	\N	2026-04-18 21:11:17.69988	2026-04-20 17:14:36.739	FRDUP624566387	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2Nzc3MjEtNmozemRzbTQ4MWoteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2Nzc3MjEtMmtyczdqNGNwc2wteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:11:17.709	140	2026-04-18 21:11:17.739	2026-04-18 21:26:17.739	2026-04-20 17:14:36.739	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
90	138	withdrawal	100.00	5.00	5.00	105.00	confirmed	\N	\N	seed138@upi	Seed 138	Seed 138	\N	2026-04-18 21:11:23.468614	2026-04-20 17:14:36.766	FRDUP624566387	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2ODM0OTAtYWJudzNnc2pxNDcteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	data:image/png;base64,dW5pcXVlLTE3NzY1NDY2ODM0OTAtMnA5ejJ4YmwzenAteHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4	\N	2026-04-18 21:11:23.479	141	2026-04-18 21:11:23.521	2026-04-18 21:26:23.521	2026-04-20 17:14:36.766	100.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
91	146	withdrawal	200.00	0.00	0.00	200.00	cancelled	\N	\N	seed146@upi	Seed 146	Seed 146	\N	2026-04-22 20:55:31.319174	2026-04-22 20:55:31.345	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
92	148	withdrawal	150.00	0.00	0.00	150.00	cancelled	\N	\N	seed148@upi	Seed 148	Seed 148	\N	2026-04-22 20:55:31.583851	2026-04-22 20:55:31.599	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
93	150	withdrawal	300.00	0.00	0.00	300.00	cancelled	\N	\N	seed150@upi	Seed 150	Seed 150	\N	2026-04-22 20:55:31.868517	2026-04-22 20:55:31.882	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
95	152	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed152@upi	Seed 152	Seed 152	\N	2026-04-22 20:55:32.169601	2026-04-22 20:55:32.169601	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
100	162	withdrawal	250.00	0.00	0.00	250.00	cancelled	\N	\N	seed162@upi	Seed 162	Seed 162	\N	2026-04-22 20:55:33.568247	2026-04-22 20:55:33.58	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
101	164	withdrawal	150.00	0.00	0.00	150.00	cancelled	\N	\N	seed164@upi	Seed 164	Seed 164	\N	2026-04-22 20:55:33.819396	2026-04-22 20:55:33.831	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
102	164	withdrawal	100.00	0.00	0.00	100.00	cancelled	\N	\N	seed164@upi	Seed 164	Seed 164	\N	2026-04-22 20:55:33.860966	2026-04-22 20:55:33.874	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
103	167	withdrawal	100.00	0.00	0.00	100.00	cancelled	\N	\N	seed167@upi	Seed 167	Seed 167	\N	2026-04-22 20:55:58.040361	2026-04-22 20:55:58.06	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
104	173	withdrawal	200.00	0.00	0.00	200.00	cancelled	\N	\N	seed173@upi	Seed 173	Seed 173	\N	2026-04-22 20:56:18.790628	2026-04-22 20:56:18.806	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
105	175	withdrawal	150.00	0.00	0.00	150.00	cancelled	\N	\N	seed175@upi	Seed 175	Seed 175	\N	2026-04-22 20:56:19.064143	2026-04-22 20:56:19.078	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
106	177	withdrawal	300.00	0.00	0.00	300.00	cancelled	\N	\N	seed177@upi	Seed 177	Seed 177	\N	2026-04-22 20:56:19.354539	2026-04-22 20:56:19.369	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
108	179	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed179@upi	Seed 179	Seed 179	\N	2026-04-22 20:56:19.637055	2026-04-22 20:56:19.637055	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
107	179	withdrawal	100.00	0.00	0.00	100.00	cancelled	\N	\N	seed179@upi	Seed 179	Seed 179	\N	2026-04-22 20:56:19.628594	2026-04-22 20:56:19.65	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
109	181	withdrawal	6000.00	0.00	0.00	6000.00	cancelled	\N	\N	seed181@upi	Seed 181	Seed 181	\N	2026-04-22 20:56:19.899371	2026-04-22 20:56:19.912	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
110	183	withdrawal	11000.00	0.00	0.00	11000.00	cancelled	\N	\N	seed183@upi	Seed 183	Seed 183	\N	2026-04-22 20:56:20.175492	2026-04-22 20:56:20.186	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
111	185	withdrawal	8000.00	0.00	0.00	8000.00	cancelled	\N	\N	seed185@upi	Seed 185	Seed 185	\N	2026-04-22 20:56:20.519823	2026-04-22 20:56:20.53	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
112	187	withdrawal	250.00	0.00	0.00	250.00	cancelled	\N	\N	seed187@upi	Seed 187	Seed 187	\N	2026-04-22 20:56:20.770505	2026-04-22 20:56:20.781	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
113	189	withdrawal	250.00	0.00	0.00	250.00	cancelled	\N	\N	seed189@upi	Seed 189	Seed 189	\N	2026-04-22 20:56:21.013152	2026-04-22 20:56:21.026	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
114	191	withdrawal	150.00	0.00	0.00	150.00	cancelled	\N	\N	seed191@upi	Seed 191	Seed 191	\N	2026-04-22 20:56:21.265709	2026-04-22 20:56:21.277	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
115	191	withdrawal	100.00	0.00	0.00	100.00	cancelled	\N	\N	seed191@upi	Seed 191	Seed 191	\N	2026-04-22 20:56:21.307196	2026-04-22 20:56:21.318	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
116	194	withdrawal	100.00	0.00	0.00	100.00	cancelled	\N	\N	seed194@upi	Seed 194	Seed 194	\N	2026-04-22 20:56:45.453282	2026-04-22 20:56:45.47	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
117	200	withdrawal	200.00	0.00	0.00	200.00	cancelled	\N	\N	seed200@upi	Seed 200	Seed 200	\N	2026-04-22 20:57:11.656848	2026-04-22 20:57:11.673	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
118	202	withdrawal	150.00	0.00	0.00	150.00	cancelled	\N	\N	seed202@upi	Seed 202	Seed 202	\N	2026-04-22 20:57:11.916414	2026-04-22 20:57:11.927	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
119	204	withdrawal	300.00	0.00	0.00	300.00	cancelled	\N	\N	seed204@upi	Seed 204	Seed 204	\N	2026-04-22 20:57:12.162853	2026-04-22 20:57:12.174	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
121	206	withdrawal	100.00	0.00	0.00	100.00	available	\N	\N	seed206@upi	Seed 206	Seed 206	\N	2026-04-22 20:57:12.419054	2026-04-22 20:57:12.419054	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
120	206	withdrawal	100.00	0.00	0.00	100.00	cancelled	\N	\N	seed206@upi	Seed 206	Seed 206	\N	2026-04-22 20:57:12.408684	2026-04-22 20:57:12.434	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
122	208	withdrawal	6000.00	0.00	0.00	6000.00	cancelled	\N	\N	seed208@upi	Seed 208	Seed 208	\N	2026-04-22 20:57:12.662857	2026-04-22 20:57:12.674	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
123	210	withdrawal	11000.00	0.00	0.00	11000.00	cancelled	\N	\N	seed210@upi	Seed 210	Seed 210	\N	2026-04-22 20:57:12.9383	2026-04-22 20:57:12.948	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
124	212	withdrawal	8000.00	0.00	0.00	8000.00	cancelled	\N	\N	seed212@upi	Seed 212	Seed 212	\N	2026-04-22 20:57:13.288552	2026-04-22 20:57:13.301	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
125	214	withdrawal	250.00	0.00	0.00	250.00	cancelled	\N	\N	seed214@upi	Seed 214	Seed 214	\N	2026-04-22 20:57:13.575867	2026-04-22 20:57:13.587	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
137	239	withdrawal	8000.00	0.00	0.00	8000.00	cancelled	\N	\N	seed239@upi	Seed 239	Seed 239	\N	2026-04-22 20:57:59.075466	2026-04-22 20:57:59.085	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: referrals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.referrals (id, referrer_id, referred_user_id, order_id, level, commission_amount, created_at) FROM stdin;
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.settings (id, key, value, updated_at) FROM stdin;
7	gatewayBaseUrl	https://payment-gateway-hub--atulusf3.replit.app	2026-04-18 12:53:48.696508
8	gatewayMerchantId	0cb5695cfa01460dc19477a9	2026-04-18 12:53:48.696508
9	gatewayApiKey	pgk_930dd0184344858e81f092212cdf6cd1dd12badd1a7fb527	2026-04-18 12:53:48.696508
10	gatewayApiSecret	pgs_d62ef4708d20beb03c3fbc7daeaceffa7e7cc8f8ac5f3b8f	2026-04-18 12:53:48.696508
11	gatewayWebhookSecret	273afd48d760a653c9340104be092f349fe2f4b483ec6b04d2a50d6522b98d44	2026-04-18 12:53:48.696508
12	gatewayAuthMethod	bearer	2026-04-18 12:53:48.696508
13	gatewayCreatePaymentPath	/payments	2026-04-18 12:53:48.696508
14	gatewayVerifyPaymentPath	/payments/{id}/verify	2026-04-18 12:53:48.696508
15	gatewayRefundPath	/refunds	2026-04-18 12:53:48.696508
16	gatewayStatusPath	/payments/{id}/status	2026-04-18 12:53:48.696508
27	disabled_fraud_rules	[]	2026-04-18 21:03:14.509
28	fraud_rule_state	{"fake_utr_pattern":{"enabled":true,"updatedAt":"2026-04-22T20:58:12.465Z"},"velocity_high":{"enabled":true,"updatedAt":"2026-04-22T20:58:12.483Z"},"duplicate_utr":{"enabled":false,"updatedAt":"2026-04-22T20:58:18.606Z"}}	2026-04-22 20:58:18.607
1	upiId	trustpay@upi	2026-04-16 11:37:32.101
2	upiName	TrustPay	2026-04-16 11:37:32.105
3	popupMessage	Welcome to TrustPay! Start earning rewards today.	2026-04-16 11:37:32.109
4	popupImageUrl	https://img.sanishtech.com/u/3e73a4627bc1eaca4d11875e068cc88d.png	2026-04-16 11:37:32.111
5	telegramLink	https://t.me/trustpay	2026-04-16 11:37:32.115
6	bannerImages	["https://img.sanishtech.com/u/632f7d0021ce2b6163c1f1b1cb9e49c8.png"]	2026-04-16 11:37:32.119
\.


--
-- Data for Name: sms_active_patterns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sms_active_patterns (id, sender_key, template_label, utr_regex, amount_regex, credit_only, reversal_blocked, source_candidate_id, created_by, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: sms_candidate_patterns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sms_candidate_patterns (id, sender_key, template_hash, template_body, utr_sample, amount_sample, sample_count, sample_ids, status, reviewed_by, reviewed_at, notes, created_at) FROM stdin;
\.


--
-- Data for Name: sms_learning_queue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sms_learning_queue (id, sender, sender_key, body, bucket, parsed_utr, parsed_amount, is_debit, has_reversal, template_body, template_hash, user_id, status, created_at, reason) FROM stdin;
1	NEWCOOP	NEWCOOP	Credited Rs.100	suspicious	\N	\N	f	f	credited {amount}	dc96c230	1	pending	2026-04-23 05:02:54.599936	server_override:matched_missing_utr_or_amount
2	UNKNOWNBK	UNKNOWNBK	Some SMS	unparsed	\N	\N	f	f	some sms	248db341	1	pending	2026-04-23 05:02:54.652576	server_override:untrusted_sender;parse_failed
\.


--
-- Data for Name: sms_safe_senders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sms_safe_senders (id, sender_key, label, added_by, created_at) FROM stdin;
2	NEWCOOP	New Cooperative Bank	1	2026-04-23 04:27:26.143523
\.


--
-- Data for Name: trade_pair_blocks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trade_pair_blocks (id, user_id_1, user_id_2, reason, created_at) FROM stdin;
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, user_id, order_id, type, amount, description, created_at) FROM stdin;
1	2	\N	credit	1000.00	Admin adjustment	2026-04-16 10:54:11.097795
2	2	\N	credit	0.00	Admin adjustment	2026-04-16 11:14:15.534466
3	3	\N	credit	1000.00	Admin adjustment	2026-04-16 11:14:20.115177
4	3	1	credit	105.04	Deposit approved for order #1 (+4% reward)	2026-04-16 11:25:41.214765
5	3	\N	credit	10000.00	Admin adjustment	2026-04-16 11:30:09.667627
6	7	10	credit	107.10	Buy confirmed +5% reward (chunk #10)	2026-04-18 17:53:41.788326
7	6	10	debit	102.00	Chunk sold to buyer #7 (chunk #10)	2026-04-18 17:53:41.792079
8	7	12	credit	105.00	Buy confirmed +5% reward (chunk #12)	2026-04-18 17:59:57.537795
9	6	12	debit	100.00	Chunk sold to buyer #7 (chunk #12)	2026-04-18 17:59:57.541085
10	15	21	credit	315.00	Buy confirmed +5% reward (chunk #21)	2026-04-18 21:03:06.703138
11	14	21	debit	300.00	Chunk sold to buyer #15 (chunk #21)	2026-04-18 21:03:06.703138
12	19	24	credit	6180.00	Buy confirmed +3% reward (chunk #24)	2026-04-18 21:03:07.229031
13	18	24	debit	6000.00	Chunk sold to buyer #19 (chunk #24)	2026-04-18 21:03:07.229031
14	21	25	credit	11330.00	Buy confirmed +3% reward (chunk #25)	2026-04-18 21:03:07.53263
15	20	25	debit	11000.00	Chunk sold to buyer #21 (chunk #25)	2026-04-18 21:03:07.53263
16	23	26	credit	8240.00	Buy confirmed +3% reward (chunk #26)	2026-04-18 21:03:07.923598
17	22	26	debit	8000.00	Chunk sold to buyer #23 (chunk #26)	2026-04-18 21:03:07.923598
18	37	33	credit	315.00	Buy confirmed +5% reward (chunk #33)	2026-04-18 21:08:20.36268
19	36	33	debit	300.00	Chunk sold to buyer #37 (chunk #33)	2026-04-18 21:08:20.36268
20	41	36	credit	6180.00	Buy confirmed +3% reward (chunk #36)	2026-04-18 21:08:20.973278
21	40	36	debit	6000.00	Chunk sold to buyer #41 (chunk #36)	2026-04-18 21:08:20.973278
22	43	37	credit	11330.00	Buy confirmed +3% reward (chunk #37)	2026-04-18 21:08:21.291081
23	42	37	debit	11000.00	Chunk sold to buyer #43 (chunk #37)	2026-04-18 21:08:21.291081
24	45	38	credit	8240.00	Buy confirmed +3% reward (chunk #38)	2026-04-18 21:08:21.693754
25	44	38	debit	8000.00	Chunk sold to buyer #45 (chunk #38)	2026-04-18 21:08:21.693754
26	65	48	credit	315.00	Buy confirmed +5% reward (chunk #48)	2026-04-18 21:09:07.254653
27	64	48	debit	300.00	Chunk sold to buyer #65 (chunk #48)	2026-04-18 21:09:07.254653
28	69	51	credit	6180.00	Buy confirmed +3% reward (chunk #51)	2026-04-18 21:09:07.815918
29	68	51	debit	6000.00	Chunk sold to buyer #69 (chunk #51)	2026-04-18 21:09:07.815918
30	71	52	credit	11330.00	Buy confirmed +3% reward (chunk #52)	2026-04-18 21:09:08.136238
31	70	52	debit	11000.00	Chunk sold to buyer #71 (chunk #52)	2026-04-18 21:09:08.136238
32	73	53	credit	8240.00	Buy confirmed +3% reward (chunk #53)	2026-04-18 21:09:08.578242
33	72	53	debit	8000.00	Chunk sold to buyer #73 (chunk #53)	2026-04-18 21:09:08.578242
34	93	63	credit	315.00	Buy confirmed +5% reward (chunk #63)	2026-04-18 21:10:06.532786
35	92	63	debit	300.00	Chunk sold to buyer #93 (chunk #63)	2026-04-18 21:10:06.532786
36	97	66	credit	6180.00	Buy confirmed +3% reward (chunk #66)	2026-04-18 21:10:07.067859
37	96	66	debit	6000.00	Chunk sold to buyer #97 (chunk #66)	2026-04-18 21:10:07.067859
38	99	67	credit	11330.00	Buy confirmed +3% reward (chunk #67)	2026-04-18 21:10:07.397173
39	98	67	debit	11000.00	Chunk sold to buyer #99 (chunk #67)	2026-04-18 21:10:07.397173
40	101	68	credit	8240.00	Buy confirmed +3% reward (chunk #68)	2026-04-18 21:10:07.80163
41	100	68	debit	8000.00	Chunk sold to buyer #101 (chunk #68)	2026-04-18 21:10:07.80163
42	121	78	credit	315.00	Buy confirmed +5% reward (chunk #78)	2026-04-18 21:10:51.219219
43	120	78	debit	300.00	Chunk sold to buyer #121 (chunk #78)	2026-04-18 21:10:51.219219
44	125	81	credit	6180.00	Buy confirmed +3% reward (chunk #81)	2026-04-18 21:10:51.745561
45	124	81	debit	6000.00	Chunk sold to buyer #125 (chunk #81)	2026-04-18 21:10:51.745561
46	127	82	credit	11330.00	Buy confirmed +3% reward (chunk #82)	2026-04-18 21:10:52.033914
47	126	82	debit	11000.00	Chunk sold to buyer #127 (chunk #82)	2026-04-18 21:10:52.033914
48	129	83	credit	8240.00	Buy confirmed +3% reward (chunk #83)	2026-04-18 21:10:52.414918
49	128	83	debit	8000.00	Chunk sold to buyer #129 (chunk #83)	2026-04-18 21:10:52.414918
50	55	43	credit	105.00	Buy confirmed +5% reward (chunk #43)	2026-04-20 17:14:36.399884
51	53	43	debit	100.00	Chunk sold to buyer #55 (chunk #43)	2026-04-20 17:14:36.399884
52	1	43	credit	1.00	Admin 1% override from buyer #55 (chunk #43)	2026-04-20 17:14:36.443089
53	56	44	credit	105.00	Buy confirmed +5% reward (chunk #44)	2026-04-20 17:14:36.446859
54	54	44	debit	100.00	Chunk sold to buyer #56 (chunk #44)	2026-04-20 17:14:36.446859
55	1	44	credit	1.00	Admin 1% override from buyer #56 (chunk #44)	2026-04-20 17:14:36.473819
56	57	45	credit	105.00	Buy confirmed +5% reward (chunk #45)	2026-04-20 17:14:36.477873
57	54	45	debit	100.00	Chunk sold to buyer #57 (chunk #45)	2026-04-20 17:14:36.477873
58	1	45	credit	1.00	Admin 1% override from buyer #57 (chunk #45)	2026-04-20 17:14:36.50657
59	83	58	credit	105.00	Buy confirmed +5% reward (chunk #58)	2026-04-20 17:14:36.510807
60	81	58	debit	100.00	Chunk sold to buyer #83 (chunk #58)	2026-04-20 17:14:36.510807
61	1	58	credit	1.00	Admin 1% override from buyer #83 (chunk #58)	2026-04-20 17:14:36.540736
62	84	59	credit	105.00	Buy confirmed +5% reward (chunk #59)	2026-04-20 17:14:36.544345
63	82	59	debit	100.00	Chunk sold to buyer #84 (chunk #59)	2026-04-20 17:14:36.544345
64	1	59	credit	1.00	Admin 1% override from buyer #84 (chunk #59)	2026-04-20 17:14:36.572418
65	85	60	credit	105.00	Buy confirmed +5% reward (chunk #60)	2026-04-20 17:14:36.576629
66	82	60	debit	100.00	Chunk sold to buyer #85 (chunk #60)	2026-04-20 17:14:36.576629
67	1	60	credit	1.00	Admin 1% override from buyer #85 (chunk #60)	2026-04-20 17:14:36.606728
68	111	73	credit	105.00	Buy confirmed +5% reward (chunk #73)	2026-04-20 17:14:36.610368
69	109	73	debit	100.00	Chunk sold to buyer #111 (chunk #73)	2026-04-20 17:14:36.610368
70	1	73	credit	1.00	Admin 1% override from buyer #111 (chunk #73)	2026-04-20 17:14:36.64565
71	112	74	credit	105.00	Buy confirmed +5% reward (chunk #74)	2026-04-20 17:14:36.650156
72	110	74	debit	100.00	Chunk sold to buyer #112 (chunk #74)	2026-04-20 17:14:36.650156
73	1	74	credit	1.00	Admin 1% override from buyer #112 (chunk #74)	2026-04-20 17:14:36.676791
74	113	75	credit	105.00	Buy confirmed +5% reward (chunk #75)	2026-04-20 17:14:36.680494
75	110	75	debit	100.00	Chunk sold to buyer #113 (chunk #75)	2026-04-20 17:14:36.680494
76	1	75	credit	1.00	Admin 1% override from buyer #113 (chunk #75)	2026-04-20 17:14:36.705197
77	139	88	credit	105.00	Buy confirmed +5% reward (chunk #88)	2026-04-20 17:14:36.708738
78	137	88	debit	100.00	Chunk sold to buyer #139 (chunk #88)	2026-04-20 17:14:36.708738
79	1	88	credit	1.00	Admin 1% override from buyer #139 (chunk #88)	2026-04-20 17:14:36.734847
80	140	89	credit	105.00	Buy confirmed +5% reward (chunk #89)	2026-04-20 17:14:36.739375
81	138	89	debit	100.00	Chunk sold to buyer #140 (chunk #89)	2026-04-20 17:14:36.739375
82	1	89	credit	1.00	Admin 1% override from buyer #140 (chunk #89)	2026-04-20 17:14:36.763044
83	141	90	credit	105.00	Buy confirmed +5% reward (chunk #90)	2026-04-20 17:14:36.766876
84	138	90	debit	100.00	Chunk sold to buyer #141 (chunk #90)	2026-04-20 17:14:36.766876
85	1	90	credit	1.00	Admin 1% override from buyer #141 (chunk #90)	2026-04-20 17:14:36.789838
\.


--
-- Data for Name: trust_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trust_events (id, user_id, delta, reason, order_id, created_at) FROM stdin;
1	7	1	trade_success	10	2026-04-18 17:53:41.794451
2	6	1	trade_success	10	2026-04-18 17:53:41.801074
3	6	-10	dispute_loss	11	2026-04-18 17:55:43.499618
4	7	1	auto_confirm_win	12	2026-04-18 17:59:57.543762
5	6	-2	late_confirm	12	2026-04-18 17:59:57.549547
6	6	-10	dispute_loss	12	2026-04-18 17:59:57.56153
7	15	1	trade_success	21	2026-04-18 21:03:06.711633
8	14	1	trade_success	21	2026-04-18 21:03:06.71828
9	19	1	trade_success	24	2026-04-18 21:03:07.233957
10	18	1	trade_success	24	2026-04-18 21:03:07.240899
11	21	1	trade_success	25	2026-04-18 21:03:07.53778
12	20	1	trade_success	25	2026-04-18 21:03:07.543134
13	23	1	trade_success	26	2026-04-18 21:03:07.928748
14	22	1	trade_success	26	2026-04-18 21:03:07.934208
15	37	1	trade_success	33	2026-04-18 21:08:20.36967
16	36	1	trade_success	33	2026-04-18 21:08:20.375521
17	41	1	trade_success	36	2026-04-18 21:08:20.978699
18	40	1	trade_success	36	2026-04-18 21:08:20.98433
19	43	1	trade_success	37	2026-04-18 21:08:21.296786
20	42	1	trade_success	37	2026-04-18 21:08:21.303582
21	45	1	trade_success	38	2026-04-18 21:08:21.699424
22	44	1	trade_success	38	2026-04-18 21:08:21.706303
23	65	1	trade_success	48	2026-04-18 21:09:07.259801
24	64	1	trade_success	48	2026-04-18 21:09:07.265536
25	69	1	trade_success	51	2026-04-18 21:09:07.822024
26	68	1	trade_success	51	2026-04-18 21:09:07.8289
27	71	1	trade_success	52	2026-04-18 21:09:08.141469
28	70	1	trade_success	52	2026-04-18 21:09:08.152859
29	73	1	trade_success	53	2026-04-18 21:09:08.582781
30	72	1	trade_success	53	2026-04-18 21:09:08.588226
31	93	1	trade_success	63	2026-04-18 21:10:06.538864
32	92	1	trade_success	63	2026-04-18 21:10:06.545622
33	97	1	trade_success	66	2026-04-18 21:10:07.072847
34	96	1	trade_success	66	2026-04-18 21:10:07.078738
35	99	1	trade_success	67	2026-04-18 21:10:07.402181
36	98	1	trade_success	67	2026-04-18 21:10:07.408608
37	101	1	trade_success	68	2026-04-18 21:10:07.807082
38	100	1	trade_success	68	2026-04-18 21:10:07.81357
39	121	1	trade_success	78	2026-04-18 21:10:51.224307
40	120	1	trade_success	78	2026-04-18 21:10:51.231148
41	125	1	trade_success	81	2026-04-18 21:10:51.750697
42	124	1	trade_success	81	2026-04-18 21:10:51.757029
43	127	1	trade_success	82	2026-04-18 21:10:52.039132
44	126	1	trade_success	82	2026-04-18 21:10:52.04525
45	129	1	trade_success	83	2026-04-18 21:10:52.419947
46	128	1	trade_success	83	2026-04-18 21:10:52.426196
47	55	1	auto_confirm_win	43	2026-04-20 17:14:36.41374
48	53	-2	late_confirm	43	2026-04-20 17:14:36.424247
49	56	1	auto_confirm_win	44	2026-04-20 17:14:36.45136
50	54	-2	late_confirm	44	2026-04-20 17:14:36.456801
51	57	1	auto_confirm_win	45	2026-04-20 17:14:36.483952
52	54	-2	late_confirm	45	2026-04-20 17:14:36.488434
53	83	1	auto_confirm_win	58	2026-04-20 17:14:36.51556
54	81	-2	late_confirm	58	2026-04-20 17:14:36.523183
55	84	1	auto_confirm_win	59	2026-04-20 17:14:36.549528
56	82	-2	late_confirm	59	2026-04-20 17:14:36.554972
57	85	1	auto_confirm_win	60	2026-04-20 17:14:36.58213
58	82	-2	late_confirm	60	2026-04-20 17:14:36.587603
59	111	1	auto_confirm_win	73	2026-04-20 17:14:36.615249
60	109	-2	late_confirm	73	2026-04-20 17:14:36.620676
61	112	1	auto_confirm_win	74	2026-04-20 17:14:36.655864
62	110	-2	late_confirm	74	2026-04-20 17:14:36.661453
63	113	1	auto_confirm_win	75	2026-04-20 17:14:36.685613
64	110	-2	late_confirm	75	2026-04-20 17:14:36.690226
65	139	1	auto_confirm_win	88	2026-04-20 17:14:36.713288
66	137	-2	late_confirm	88	2026-04-20 17:14:36.717965
67	140	1	auto_confirm_win	89	2026-04-20 17:14:36.743536
68	138	-2	late_confirm	89	2026-04-20 17:14:36.748559
69	141	1	auto_confirm_win	90	2026-04-20 17:14:36.770704
70	138	-2	late_confirm	90	2026-04-20 17:14:36.775315
\.


--
-- Data for Name: user_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_notifications (id, user_id, kind, title, body, severity, fraud_alert_id, read_at, created_at) FROM stdin;
1	19	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹6000	critical	2	\N	2026-04-18 21:03:07.264393
2	21	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹11000	critical	3	\N	2026-04-18 21:03:07.566335
3	23	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹8000	critical	4	\N	2026-04-18 21:03:07.951954
4	41	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹6000	critical	5	\N	2026-04-18 21:08:21.004277
5	43	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹11000	critical	6	\N	2026-04-18 21:08:21.322961
6	45	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹8000	critical	7	\N	2026-04-18 21:08:21.724015
7	57	fraud_alert	Critical: Duplicate payment reference flagged	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: UTR FRDUP2299326431 previously used by user #55 on order #43	critical	8	\N	2026-04-18 21:08:52.747202
8	69	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹6000	critical	9	\N	2026-04-18 21:09:07.850845
9	71	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹11000	critical	10	\N	2026-04-18 21:09:08.176156
10	73	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹8000	critical	11	\N	2026-04-18 21:09:08.604
11	85	fraud_alert	Critical: Duplicate payment reference flagged	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: UTR FRDUP6433751739 previously used by user #83 on order #58	critical	12	\N	2026-04-18 21:09:39.55865
12	97	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹6000	critical	13	\N	2026-04-18 21:10:07.100119
13	99	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹11000	critical	14	\N	2026-04-18 21:10:07.428923
14	101	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹8000	critical	15	\N	2026-04-18 21:10:07.832336
15	113	fraud_alert	Critical: Duplicate payment reference flagged	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: UTR FRDUP86008813 previously used by user #111 on order #73	critical	16	\N	2026-04-18 21:10:38.781405
16	125	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹6000	critical	17	\N	2026-04-18 21:10:51.773638
17	127	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹11000	critical	18	\N	2026-04-18 21:10:52.061328
18	129	fraud_alert	Critical: High-value action on new account	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: Account <24h old attempting ₹8000	critical	19	\N	2026-04-18 21:10:52.444566
19	141	fraud_alert	Critical: Duplicate payment reference flagged	Our fraud system flagged your account. Your account has been frozen for review — please contact support to resolve.\n\nDetails: UTR FRDUP624566387 previously used by user #139 on order #88	critical	20	\N	2026-04-18 21:11:23.504266
20	142	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-21 08:09:51.912562
21	143	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-21 08:14:59.749613
22	144	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:30.465626
23	145	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:30.926126
24	146	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:31.053522
25	147	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:31.275381
26	148	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:31.460422
27	149	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:31.565503
28	150	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:31.721481
29	151	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:31.836639
30	152	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:31.999931
31	153	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:32.111843
32	154	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:32.289479
33	155	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:32.397597
34	156	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:32.558501
35	157	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:32.660761
36	158	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:32.901049
37	159	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:33.009199
38	160	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:33.177182
39	161	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:33.283869
40	162	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:33.435449
41	163	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:33.546395
42	164	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:33.701864
43	165	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:33.800462
44	166	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:34.077654
45	167	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:52.195304
46	168	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:52.294507
47	169	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:52.394371
48	170	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:55:52.49234
49	171	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:18.070048
50	172	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:18.49466
51	173	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:18.632913
52	174	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:18.748164
53	175	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:18.923192
54	176	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:19.038454
55	177	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:19.207329
56	178	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:19.325924
57	179	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:19.491639
58	180	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:19.606225
59	181	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:19.776622
60	182	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:19.877455
61	183	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:20.041003
62	184	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:20.157089
63	185	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:20.398289
64	186	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:20.500066
65	187	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:20.656929
66	188	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:20.755385
67	189	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:20.897022
68	190	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:20.994603
69	191	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:21.150303
70	192	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:21.25074
71	193	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:21.513041
72	194	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:39.604096
73	195	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:39.703209
74	196	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:39.802682
75	197	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:56:39.901641
76	198	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:10.978064
77	199	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:11.38159
78	200	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:11.508264
79	201	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:11.613542
80	202	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:11.781942
81	203	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:11.897489
82	204	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:12.044589
83	205	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:12.14263
84	206	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:12.286388
85	207	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:12.391142
86	208	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:12.539341
87	209	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:12.643735
88	210	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:12.816082
89	211	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:12.92375
90	212	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:13.163452
91	213	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:13.27086
92	214	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:13.43972
93	215	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:13.557961
94	216	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:13.703317
95	217	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:13.805267
96	218	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:13.957374
97	219	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:14.054717
98	220	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:14.311695
99	221	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:32.467642
100	222	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:32.572581
101	223	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:32.672216
102	224	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:32.774133
103	225	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:56.748122
104	226	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:57.124583
105	227	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:57.24645
106	228	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:57.347289
107	229	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:57.508191
108	230	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:57.620542
109	231	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:57.763828
110	232	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:57.866506
111	233	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:57.999789
112	234	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:58.099766
113	235	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:58.23192
114	236	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:58.335492
115	237	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:58.479583
116	238	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:58.586164
117	239	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:58.817736
118	240	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:58.916931
119	241	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:59.232099
120	242	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:59.331826
121	243	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:59.475533
122	244	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:59.57216
123	245	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:59.717397
124	246	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:57:59.818704
125	247	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:58:00.075996
126	248	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:58:18.241511
127	249	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:58:18.350521
128	250	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:58:18.457485
129	251	google_verification	Google verification kar lo	Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.	info	\N	\N	2026-04-22 20:58:18.569506
\.


--
-- Data for Name: user_upi_ids; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_upi_ids (id, user_id, upi_id, platform, bank_name, holder_name, is_active, created_at) FROM stdin;
1	6	test1@okhdfc	PhonePe	HDFC	Test User 1	t	2026-04-18 17:53:21.436903
2	10	seed10@upi	PhonePe	HDFC	Seed 10	t	2026-04-18 21:03:06.143971
3	12	seed12@upi	PhonePe	HDFC	Seed 12	t	2026-04-18 21:03:06.401094
4	14	seed14@upi	PhonePe	HDFC	Seed 14	t	2026-04-18 21:03:06.644117
5	16	seed16@upi	PhonePe	HDFC	Seed 16	t	2026-04-18 21:03:06.938775
6	18	seed18@upi	PhonePe	HDFC	Seed 18	t	2026-04-18 21:03:07.178607
7	20	seed20@upi	PhonePe	HDFC	Seed 20	t	2026-04-18 21:03:07.477727
8	22	seed22@upi	PhonePe	HDFC	Seed 22	t	2026-04-18 21:03:07.869127
9	24	seed24@upi	PhonePe	HDFC	Seed 24	t	2026-04-18 21:03:08.167554
10	26	seed26@upi	PhonePe	HDFC	Seed 26	t	2026-04-18 21:03:08.475402
11	28	seed28@upi	PhonePe	HDFC	Seed 28	t	2026-04-18 21:03:08.776701
12	32	seed32@upi	PhonePe	HDFC	Seed 32	t	2026-04-18 21:08:19.775964
13	34	seed34@upi	PhonePe	HDFC	Seed 34	t	2026-04-18 21:08:20.037429
14	36	seed36@upi	PhonePe	HDFC	Seed 36	t	2026-04-18 21:08:20.299376
15	38	seed38@upi	PhonePe	HDFC	Seed 38	t	2026-04-18 21:08:20.636342
16	40	seed40@upi	PhonePe	HDFC	Seed 40	t	2026-04-18 21:08:20.913746
17	42	seed42@upi	PhonePe	HDFC	Seed 42	t	2026-04-18 21:08:21.232819
18	44	seed44@upi	PhonePe	HDFC	Seed 44	t	2026-04-18 21:08:21.638097
19	46	seed46@upi	PhonePe	HDFC	Seed 46	t	2026-04-18 21:08:21.971115
20	48	seed48@upi	PhonePe	HDFC	Seed 48	t	2026-04-18 21:08:22.312425
21	50	seed50@upi	PhonePe	HDFC	Seed 50	t	2026-04-18 21:08:22.615905
22	53	seed53@upi	PhonePe	HDFC	Seed 53	t	2026-04-18 21:08:46.914237
23	54	seed54@upi	PhonePe	HDFC	Seed 54	t	2026-04-18 21:08:46.986061
24	60	seed60@upi	PhonePe	HDFC	Seed 60	t	2026-04-18 21:09:06.667862
25	62	seed62@upi	PhonePe	HDFC	Seed 62	t	2026-04-18 21:09:06.936264
26	64	seed64@upi	PhonePe	HDFC	Seed 64	t	2026-04-18 21:09:07.196566
27	66	seed66@upi	PhonePe	HDFC	Seed 66	t	2026-04-18 21:09:07.493223
28	68	seed68@upi	PhonePe	HDFC	Seed 68	t	2026-04-18 21:09:07.756438
29	70	seed70@upi	PhonePe	HDFC	Seed 70	t	2026-04-18 21:09:08.085629
30	72	seed72@upi	PhonePe	HDFC	Seed 72	t	2026-04-18 21:09:08.509791
31	74	seed74@upi	PhonePe	HDFC	Seed 74	t	2026-04-18 21:09:08.834127
32	76	seed76@upi	PhonePe	HDFC	Seed 76	t	2026-04-18 21:09:09.145947
33	78	seed78@upi	PhonePe	HDFC	Seed 78	t	2026-04-18 21:09:09.460187
34	81	seed81@upi	PhonePe	HDFC	Seed 81	t	2026-04-18 21:09:33.718581
35	82	seed82@upi	PhonePe	HDFC	Seed 82	t	2026-04-18 21:09:33.817405
36	88	seed88@upi	PhonePe	HDFC	Seed 88	t	2026-04-18 21:10:05.981012
37	90	seed90@upi	PhonePe	HDFC	Seed 90	t	2026-04-18 21:10:06.233233
38	92	seed92@upi	PhonePe	HDFC	Seed 92	t	2026-04-18 21:10:06.475033
39	94	seed94@upi	PhonePe	HDFC	Seed 94	t	2026-04-18 21:10:06.767257
40	96	seed96@upi	PhonePe	HDFC	Seed 96	t	2026-04-18 21:10:07.013108
41	98	seed98@upi	PhonePe	HDFC	Seed 98	t	2026-04-18 21:10:07.32348
42	100	seed100@upi	PhonePe	HDFC	Seed 100	t	2026-04-18 21:10:07.744384
43	102	seed102@upi	PhonePe	HDFC	Seed 102	t	2026-04-18 21:10:08.064452
44	104	seed104@upi	PhonePe	HDFC	Seed 104	t	2026-04-18 21:10:08.381791
45	106	seed106@upi	PhonePe	HDFC	Seed 106	t	2026-04-18 21:10:08.679983
46	109	seed109@upi	PhonePe	HDFC	Seed 109	t	2026-04-18 21:10:32.986892
47	110	seed110@upi	PhonePe	HDFC	Seed 110	t	2026-04-18 21:10:33.053097
48	116	seed116@upi	PhonePe	HDFC	Seed 116	t	2026-04-18 21:10:50.663432
49	118	seed118@upi	PhonePe	HDFC	Seed 118	t	2026-04-18 21:10:50.910516
50	120	seed120@upi	PhonePe	HDFC	Seed 120	t	2026-04-18 21:10:51.162077
51	122	seed122@upi	PhonePe	HDFC	Seed 122	t	2026-04-18 21:10:51.452109
52	124	seed124@upi	PhonePe	HDFC	Seed 124	t	2026-04-18 21:10:51.691438
53	126	seed126@upi	PhonePe	HDFC	Seed 126	t	2026-04-18 21:10:51.983212
54	128	seed128@upi	PhonePe	HDFC	Seed 128	t	2026-04-18 21:10:52.361119
55	130	seed130@upi	PhonePe	HDFC	Seed 130	t	2026-04-18 21:10:52.680278
56	132	seed132@upi	PhonePe	HDFC	Seed 132	t	2026-04-18 21:10:53.071295
57	134	seed134@upi	PhonePe	HDFC	Seed 134	t	2026-04-18 21:10:53.369109
58	137	seed137@upi	PhonePe	HDFC	Seed 137	t	2026-04-18 21:11:17.626618
59	138	seed138@upi	PhonePe	HDFC	Seed 138	t	2026-04-18 21:11:17.695172
60	146	seed146@upi	PhonePe	HDFC	Seed 146	t	2026-04-22 20:55:31.314274
61	148	seed148@upi	PhonePe	HDFC	Seed 148	t	2026-04-22 20:55:31.579784
62	150	seed150@upi	PhonePe	HDFC	Seed 150	t	2026-04-22 20:55:31.862285
63	152	seed152@upi	PhonePe	HDFC	Seed 152	t	2026-04-22 20:55:32.156175
64	154	seed154@upi	PhonePe	HDFC	Seed 154	t	2026-04-22 20:55:32.414287
65	156	seed156@upi	PhonePe	HDFC	Seed 156	t	2026-04-22 20:55:32.673495
66	158	seed158@upi	PhonePe	HDFC	Seed 158	t	2026-04-22 20:55:33.024803
67	160	seed160@upi	PhonePe	HDFC	Seed 160	t	2026-04-22 20:55:33.297162
68	162	seed162@upi	PhonePe	HDFC	Seed 162	t	2026-04-22 20:55:33.56415
69	164	seed164@upi	PhonePe	HDFC	Seed 164	t	2026-04-22 20:55:33.815917
70	167	seed167@upi	PhonePe	HDFC	Seed 167	t	2026-04-22 20:55:58.035005
71	173	seed173@upi	PhonePe	HDFC	Seed 173	t	2026-04-22 20:56:18.785801
72	175	seed175@upi	PhonePe	HDFC	Seed 175	t	2026-04-22 20:56:19.057933
73	177	seed177@upi	PhonePe	HDFC	Seed 177	t	2026-04-22 20:56:19.349276
74	179	seed179@upi	PhonePe	HDFC	Seed 179	t	2026-04-22 20:56:19.624894
75	181	seed181@upi	PhonePe	HDFC	Seed 181	t	2026-04-22 20:56:19.892884
76	183	seed183@upi	PhonePe	HDFC	Seed 183	t	2026-04-22 20:56:20.170935
77	185	seed185@upi	PhonePe	HDFC	Seed 185	t	2026-04-22 20:56:20.516718
78	187	seed187@upi	PhonePe	HDFC	Seed 187	t	2026-04-22 20:56:20.767473
79	189	seed189@upi	PhonePe	HDFC	Seed 189	t	2026-04-22 20:56:21.009513
80	191	seed191@upi	PhonePe	HDFC	Seed 191	t	2026-04-22 20:56:21.26289
81	194	seed194@upi	PhonePe	HDFC	Seed 194	t	2026-04-22 20:56:45.449431
82	200	seed200@upi	PhonePe	HDFC	Seed 200	t	2026-04-22 20:57:11.65203
83	202	seed202@upi	PhonePe	HDFC	Seed 202	t	2026-04-22 20:57:11.912608
84	204	seed204@upi	PhonePe	HDFC	Seed 204	t	2026-04-22 20:57:12.158811
85	206	seed206@upi	PhonePe	HDFC	Seed 206	t	2026-04-22 20:57:12.405345
86	208	seed208@upi	PhonePe	HDFC	Seed 208	t	2026-04-22 20:57:12.65843
87	210	seed210@upi	PhonePe	HDFC	Seed 210	t	2026-04-22 20:57:12.934946
88	212	seed212@upi	PhonePe	HDFC	Seed 212	t	2026-04-22 20:57:13.284426
89	214	seed214@upi	PhonePe	HDFC	Seed 214	t	2026-04-22 20:57:13.572346
90	216	seed216@upi	PhonePe	HDFC	Seed 216	t	2026-04-22 20:57:13.822905
91	218	seed218@upi	PhonePe	HDFC	Seed 218	t	2026-04-22 20:57:14.068341
92	221	seed221@upi	PhonePe	HDFC	Seed 221	t	2026-04-22 20:57:38.316185
93	227	seed227@upi	PhonePe	HDFC	Seed 227	t	2026-04-22 20:57:57.379115
94	229	seed229@upi	PhonePe	HDFC	Seed 229	t	2026-04-22 20:57:57.636631
95	231	seed231@upi	PhonePe	HDFC	Seed 231	t	2026-04-22 20:57:57.881157
96	233	seed233@upi	PhonePe	HDFC	Seed 233	t	2026-04-22 20:57:58.112627
97	235	seed235@upi	PhonePe	HDFC	Seed 235	t	2026-04-22 20:57:58.351962
98	237	seed237@upi	PhonePe	HDFC	Seed 237	t	2026-04-22 20:57:58.599031
99	239	seed239@upi	PhonePe	HDFC	Seed 239	t	2026-04-22 20:57:59.071917
100	241	seed241@upi	PhonePe	HDFC	Seed 241	t	2026-04-22 20:57:59.343642
101	243	seed243@upi	PhonePe	HDFC	Seed 243	t	2026-04-22 20:57:59.586415
102	245	seed245@upi	PhonePe	HDFC	Seed 245	t	2026-04-22 20:57:59.830597
103	248	seed248@upi	PhonePe	HDFC	Seed 248	t	2026-04-22 20:58:24.119538
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, phone, balance, total_deposits, total_withdrawals, role, created_at, invite_earnings, invite_earnings_l2, referral_code, referred_by, held_balance, trust_score, successful_trades, is_blocked, blocked_reason, blocked_at, is_frozen, auto_sell_enabled, last_seen_at, fraud_warning_count, matching_expires_at, display_name, must_install_app, email, google_sub, is_verified_agent, agent_tier_awarded_date, agent_tier_awarded_level, is_trusted, freeze_reason) FROM stdin;
11	buy_oov5hn	$2b$10$l8/puCRjLQkgyRNp4F.OougPYN1DzXVRJyp6dbRG5XLaaOqDN7gTm	6185938595	0.00	0.00	0.00	user	2026-04-18 21:03:06.092203	0.00	0.00	TP000011	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
21	hvcb_n76zte	$2b$10$zFEuB53b0Ul9YGB9sRSaneS6kRAGwdYs0F.Hkd28y5oOW7YYKyxty	8506199093	11330.00	11000.00	0.00	user	2026-04-18 21:03:07.460588	0.00	0.00	TP000021	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
16	selx_vov2r7	$2b$10$BBrm.QCgKccxNa.74TZ2fOhfmzIpPz.YwnXze.WG/USlWch5fEBUK	8160719479	1000.00	0.00	0.00	user	2026-04-18 21:03:06.827242	0.00	0.00	TP000016	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
13	buyc_s13ypb	$2b$10$Nl5H67Ov6hsQcfpmZ.caeu03NKe59Wr1kw/tPIffDRW02NSze45PG	9509597324	0.00	0.00	0.00	user	2026-04-18 21:03:06.381686	0.00	0.00	TP000013	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
10	sel_s925ee	$2b$10$D/ZbquSDfDI3kEiYKno9dec.7YEWBBc9zcqNwS5G9Df7MOtBcchrm	7818981651	600.00	0.00	0.00	user	2026-04-18 21:03:05.990976	0.00	0.00	TP000010	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
2	Atul Yadav 	$2b$10$NdjxrAh67WVgVrnBvL1/XO/Q.fX.48pm8yAcGNrogvwxFMZHf2Que	73795 87448	0.00	0.00	0.00	user	2026-04-16 10:52:16.647333	0.00	0.00	TP000002	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
3	Atul	$2b$10$GGACdwS7AT7NY/28XjJlUOO7KW9nkvarVAbHmunBPpSgxsjJBk.Uy		10000.00	101.00	1000.00	user	2026-04-16 11:12:44.272843	0.00	0.00	TP000003	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
4	7379587448	$2b$10$mm3kJDhxr6boH.Qe.g/XCe2trmVNSWQiVmnWLXSh5azlxMB/gm5Km	7379587448	0.00	0.00	0.00	user	2026-04-16 12:25:13.535069	0.00	0.00	TP000004	\N	0.00	0	0	f	\N	\N	f	f	2026-04-20 17:50:11.554	0	\N	\N	f	\N	\N	f	\N	0	f	\N
5	7379587444	$2b$10$Y0Jl9OcEOWWdEy11kd6KM.jNW6pEoM3F3SGxdOgaEkYBO5tOxr9kG	7379587444	0.00	0.00	0.00	user	2026-04-18 10:50:14.87982	0.00	0.00	TP000005	\N	0.00	0	0	f	\N	\N	f	f	2026-04-20 17:49:39.117	0	\N	\N	f	\N	\N	f	\N	0	f	\N
12	selc_0ga1h4	$2b$10$l2AZHNvQyXPrXAG9J8L0A..1HWqA.1WNSxlCFrwYIyjNyQWTVvcEO	9943497672	500.00	0.00	0.00	user	2026-04-18 21:03:06.284974	0.00	0.00	TP000012	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
31	dup_ctf4y8	$2b$10$/i6vZvDAbi3kkoxOzHnBpOHIYXMCY0i9IeAPy3eNxHoDbyJFKbqoC	9354622058	0.00	0.00	0.00	user	2026-04-18 21:08:19.517809	0.00	0.00	TP000031	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
27	dpb2_e5d0fl	$2b$10$.JcFjl5aq.KYNxD8s4QeAONW7b0EoLZVdb1edMVndZnYZmPm0ujHW	6276681650	0.00	0.00	0.00	user	2026-04-18 21:03:08.459123	0.00	0.00	TP000027	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
18	hvw_sylsnz	$2b$10$poeuJ1e6i7jfBTU31iJroOxxaaKgIJubMJZXZcf7LPMkehJZrig3u	7896671149	1000.00	0.00	6000.00	user	2026-04-18 21:03:07.061404	0.00	0.00	TP000018	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
19	hvwb_ee8rb7	$2b$10$FNmSNnN2hWxjpQmdP0Jwo.zSPcr8tZJqUJ6PDxO6aSbW3Pe8Yhn0i	6392879644	6180.00	6000.00	0.00	user	2026-04-18 21:03:07.162292	0.00	0.00	TP000019	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
26	dps2_1hkh0l	$2b$10$OWaX3N.iLlDVWwMqGe43LuS0GYdVmSMprz.wDP31d5xX//wqfCi7G	6586441134	550.00	0.00	0.00	user	2026-04-18 21:03:08.362944	0.00	0.00	TP000026	\N	250.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
15	buys_fb5oju	$2b$10$QrN1pTU6u5fxRBIwo1rmBOFr3XNnm1wiGdbiQjOfADprA12rmetRO	8687335792	315.00	300.00	0.00	user	2026-04-18 21:03:06.628666	0.00	0.00	TP000015	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
14	sels_wzevmi	$2b$10$o.QLqx6Q8/6uXQzMFcKNZuYeixzEF1RWnLJTzYw4NfUi9h6ewoVyq	7567671462	700.00	0.00	300.00	user	2026-04-18 21:03:06.531517	0.00	0.00	TP000014	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
7	9999999992	$2b$10$Y7EGXFc3eM9CxjaeW7Zy4OuNeL8dzN5gm.csZJ/haPgPOVFpFgsp.	9999999992	212.10	202.00	0.00	user	2026-04-18 17:53:41.622709	0.00	0.00	TP000007	\N	0.00	2	2	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
6	9999999991	$2b$10$n3eg4ZQIeofoHF3EqNjEL.RisICfAoS7TGz6rj0rLrizvtyT6FPeG	9999999991	2298.00	0.00	202.00	user	2026-04-18 17:53:17.599794	0.00	0.00	TP000006	\N	0.00	-21	2	f	\N	\N	f	t	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
8	auth_e2d9zy	$2b$10$u3PDlRAxpS1hOWTMpL5w..YsujHk0To2Q141pnSkxfFoZT53QmX0K	7460823652	0.00	0.00	0.00	user	2026-04-18 21:03:05.433009	0.00	0.00	TP000008	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
9	dup_mr5ko5	$2b$10$9PvY8WzAeHapbXlRkhP86uA4HKM6XcgtIAE1mtZZcKsdQ23GCaGCO	8843523802	0.00	0.00	0.00	user	2026-04-18 21:03:05.858799	0.00	0.00	TP000009	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
17	buyx_0boepi	$2b$10$gd6JuJlMSkJYKFUdKEJiaOpWaG6W4DPPna.ABbV3JOhLCULMRx.T6	9729987861	0.00	0.00	0.00	user	2026-04-18 21:03:06.92344	0.00	0.00	TP000017	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
35	buyc_fe1d2i	$2b$10$SFgYnVK8C9tWkfG5ekAVyuBg.xSlprQ6boekvWAu/mc4FTN1MuT.S	8726474953	0.00	0.00	0.00	user	2026-04-18 21:08:20.01899	0.00	0.00	TP000035	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
32	sel_qsiifg	$2b$10$et4AdyBNGAWHL6DWyXgWHeam1mYLzsxHT32DSkk106Xf2MC7airkG	8918780084	600.00	0.00	0.00	user	2026-04-18 21:08:19.639176	0.00	0.00	TP000032	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
22	hva_n8ehja	$2b$10$XaWLR//eu2xpItBKzS6/B.Q23hDBox2.cBNHHBTTPUrlpOiQyaPSS	6377662729	1000.00	0.00	8000.00	user	2026-04-18 21:03:07.751753	0.00	0.00	TP000022	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
23	hvab_urssq3	$2b$10$u0O6I9Rkq0mzvnDmsmahIu3Sx69.RoLJ6OSkVBcKQtxwsls99Zx22	8042374260	8240.00	8000.00	0.00	user	2026-04-18 21:03:07.8526	0.00	0.00	TP000023	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
29	db1_xa967r	$2b$10$zqO8fAKJqUTHBoFewQWTYOfYmNJWgdfkNQDMY94sSpMiWfTX7cS/K	6121208560	0.00	0.00	0.00	user	2026-04-18 21:03:08.758651	0.00	0.00	TP000029	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
20	hvc_j4j0lt	$2b$10$Riunca7lyrxYsxhK.tWlZer4cOU480bhz7YnQ2QX/tQ1xflwuDfKe	9993766467	1000.00	0.00	11000.00	user	2026-04-18 21:03:07.365637	0.00	0.00	TP000020	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
25	dpbu_ac60yd	$2b$10$/RdlCovltjS6bzmyuJx44eBB27ZRWxGDYrr1ADhkjEGghzVOG/Jma	9658860853	0.00	0.00	0.00	user	2026-04-18 21:03:08.153295	0.00	0.00	TP000025	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
33	buy_15ujar	$2b$10$E8sLnzGQYtSOgVgvjdcNAe6Q1rI.3oXl5DC9EFP./4W6BtOH6IVMq	6755130408	0.00	0.00	0.00	user	2026-04-18 21:08:19.736942	0.00	0.00	TP000033	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
24	dpsl_lsj4wi	$2b$10$CRlLRFQBBaWrlwYUox5Wp.1WlV1XgOqc7iPQODod5KSlP1guq3Rm2	8307130518	550.00	0.00	0.00	user	2026-04-18 21:03:08.059821	0.00	0.00	TP000024	\N	250.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
28	ds1_6hxi06	$2b$10$Wj9yDrYQ3xQD5jJLiWMv0OPpQ.SMfoMY1/SvI0kM13Xz5p19VhC0i	9352184238	450.00	0.00	0.00	user	2026-04-18 21:03:08.662169	0.00	0.00	TP000028	\N	150.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
30	auth_6ow7pd	$2b$10$Cl.zRd.PjvunJnk5Jjv5w.DxNo9J2pNafHc0NELG9BQ50GWHXC/Ca	7660295666	0.00	0.00	0.00	user	2026-04-18 21:08:19.149779	0.00	0.00	TP000030	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
38	selx_g4whbu	$2b$10$dvVQVab.Hu5l5NxQTdcGd.n.uhZgErgHYRvHzV3aoiKMudgqsXOzm	8365586906	1000.00	0.00	0.00	user	2026-04-18 21:08:20.487973	0.00	0.00	TP000038	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
37	buys_bulijh	$2b$10$kmT4UMgQggXc9MN2A97gCOFIEpSHUk1d5hceWiHQgVX/Z.32roxgi	6733899945	315.00	300.00	0.00	user	2026-04-18 21:08:20.281513	0.00	0.00	TP000037	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
36	sels_hlo3du	$2b$10$BPdpeKDrC7L6vhZ3aHs/i.INxIrlNkT.1VwSxdNJf3Lw4BlQotaxa	6112141927	700.00	0.00	300.00	user	2026-04-18 21:08:20.174999	0.00	0.00	TP000036	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
34	selc_yanurh	$2b$10$pKAHl8sD5.FUZb7EaHzCE.NpnJvRLU9MJph96j8C5BOam3nvk5CRS	7371953531	500.00	0.00	0.00	user	2026-04-18 21:08:19.915474	0.00	0.00	TP000034	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
39	buyx_slv0g8	$2b$10$x8bl8FWDp5leF6nfelyyQe4POfR6UE4XaQN5KI1JPaS6Dkqp5UWqO	7298836291	0.00	0.00	0.00	user	2026-04-18 21:08:20.609029	0.00	0.00	TP000039	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
40	hvw_ptvmis	$2b$10$mXL2bj9dDAKKb8P0qtcWLueFm9/mWxj7YLx.RWYNIOO/.ZzXMwdvK	9119093928	1000.00	0.00	6000.00	user	2026-04-18 21:08:20.790751	0.00	0.00	TP000040	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
41	hvwb_nhmlxb	$2b$10$pyYbhpW0x1rUtlTzR107XOoFFR64fhTgAtizVlpMg7fpjg4H5ikhq	7905541167	6180.00	6000.00	0.00	user	2026-04-18 21:08:20.894106	0.00	0.00	TP000041	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
1	admin	$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi	\N	12.00	0.00	0.00	admin	2026-04-16 10:49:27.21425	0.00	0.00	TP000001	\N	0.00	0	0	f	\N	\N	f	f	2026-04-23 04:26:40.323	0	\N	\N	f	\N	\N	f	\N	0	f	\N
43	hvcb_qolomp	$2b$10$4cal9tJhgN3v50mtN1NOSePiY4KfdTZ8t5fUAl8ojzN13YY7z54O2	8659138316	11330.00	11000.00	0.00	user	2026-04-18 21:08:21.214989	0.00	0.00	TP000043	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
42	hvc_u0fixv	$2b$10$QBu7yz7q6VZNzd9vUHxwFOA4PyAbM5te75fjnavXZLH0tScSQKV2e	7667511736	1000.00	0.00	11000.00	user	2026-04-18 21:08:21.112467	0.00	0.00	TP000042	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
54	frfsb_niafzj	$2b$10$CP48.JYfY1zDvsPCt9JaQu.sGniFbLRBG5T/HzEeZC6aLKoomok9W	7149954651	400.00	0.00	200.00	user	2026-04-18 21:08:41.137267	0.00	0.00	TP000054	\N	0.00	-4	2	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
225	auth_e8f7jk	$2b$10$sQHkjhGkBx75kptVar6X7eOUSV.1SMzn4eIJdLEyn1wl3lAvSA6RO	7118537139	0.00	0.00	0.00	user	2026-04-22 20:57:56.741571	0.00	0.00	TP000225	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
73	hvab_3rmnn0	$2b$10$t1DTdBBPj/09HnsmnFv3Te7HICOYSStPOihzl93hu0QqWp/6QYWp6	8206569171	8240.00	8000.00	0.00	user	2026-04-18 21:09:08.486686	0.00	0.00	TP000073	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
56	frfbb_devtgy	$2b$10$/7XwJOPivie6T5KfUbqy8Ol4iokFv3cK2N3aKxacTrCndHShZgxIa	7210033527	105.00	100.00	0.00	user	2026-04-18 21:08:41.362914	0.00	0.00	TP000056	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
57	frfbc_l1dg6s	$2b$10$dzdwkmjcqPyKHVE3HvO8duY05G0fMhiHezfNnbL7S8V5cBQ39I02u	6489219491	105.00	100.00	0.00	user	2026-04-18 21:08:52.677322	0.00	0.00	TP000057	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
44	hva_ht3ao0	$2b$10$aU1HZvaXw9rwZQsmCi7A4uVFQzmhRrKa70jFKwSBDrolpKb89KfEu	7414851301	1000.00	0.00	8000.00	user	2026-04-18 21:08:21.519432	0.00	0.00	TP000044	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
45	hvab_9pu921	$2b$10$1dCaVu9JklbYgcW.0akZOOVe3dbzeIJ0nqyxRjvD8y/T7GjT7li.G	7685893324	8240.00	8000.00	0.00	user	2026-04-18 21:08:21.618728	0.00	0.00	TP000045	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
47	dpbu_nfhfsz	$2b$10$kLxz/0uwFfMTl6qf67iK5OgLJKYVz/VayoM1nHvCUjMrDWqhemiiG	7031080943	0.00	0.00	0.00	user	2026-04-18 21:08:21.953856	0.00	0.00	TP000047	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
58	auth_dzynff	$2b$10$cLAKh6T5VvPrqdvIWjaWw.P.BsQoDZ.OSjofsUnRBtRifCyd1wctK	6963470483	0.00	0.00	0.00	user	2026-04-18 21:09:05.884676	0.00	0.00	TP000058	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
46	dpsl_736th0	$2b$10$MR7G6pmQRMzt/vam8nGC8OCbKpLavePORAbNXTVO2fRbfK6DYG3E2	7598436771	550.00	0.00	0.00	user	2026-04-18 21:08:21.854691	0.00	0.00	TP000046	\N	250.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
49	dpb2_yg6k92	$2b$10$Psiz4R5ewT.8TJC/tArUzuzgzv3Qj7OzFwbXNRJRkGXOkD5X/1oXS	6704808508	0.00	0.00	0.00	user	2026-04-18 21:08:22.272706	0.00	0.00	TP000049	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
59	dup_k45tja	$2b$10$BFpjBFpdsRidzguzT9sVEOWXdiuirJIpg6uictmdhOH2JY2.2M5US	7515534065	0.00	0.00	0.00	user	2026-04-18 21:09:06.28729	0.00	0.00	TP000059	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
48	dps2_w065te	$2b$10$dRXUztjOLSZFwGkrrYKIbu6d/usbw4j0xY5EUTfxbVNeUy951U/l6	8722310307	550.00	0.00	0.00	user	2026-04-18 21:08:22.175116	0.00	0.00	TP000048	\N	250.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
51	db1_aga01j	$2b$10$UtzkGkm/SpBSQtCutKKg3uZE0XFw8A2BThZbnNhAr1mXtdO5qu4t.	6546859181	0.00	0.00	0.00	user	2026-04-18 21:08:22.596377	0.00	0.00	TP000051	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
50	ds1_zm2ofu	$2b$10$XgP6CmKsKgRpSIzCH.m0PujMQcZEmEe.m/fFFGUSTpMqz.nLV2fGS	6105025313	450.00	0.00	0.00	user	2026-04-18 21:08:22.49931	0.00	0.00	TP000050	\N	150.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
52	frrules_97c81o	$2b$10$gsGQWqTjqCN/inQkPAhQ5uPON.vSNIbYY6fUcztz4bjjqB.49ts9i	9747855764	0.00	0.00	0.00	user	2026-04-18 21:08:22.890748	0.00	0.00	TP000052	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
55	frfba_1xcu4b	$2b$10$x8qECqyHkiCD84PRrMkYRO4rEqnLkZQxjwXSY3XfPwMRSHx8bzXXC	6517501513	105.00	100.00	0.00	user	2026-04-18 21:08:41.250652	0.00	0.00	TP000055	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
61	buy_t07vb0	$2b$10$GATDi3Voqoqz1kCq8MVIlu2Dr5C1z6bXPmya9D2LGLcn.lymdNcla	6942748058	0.00	0.00	0.00	user	2026-04-18 21:09:06.603077	0.00	0.00	TP000061	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
75	dpbu_1b3l3d	$2b$10$aJve.Mn6Jeebxzj8jZHs2Os9OoEOeLAFVIAmSKbhphIYtL/TvbMjq	7032244497	0.00	0.00	0.00	user	2026-04-18 21:09:08.815122	0.00	0.00	TP000075	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
83	frfba_61u5kg	$2b$10$KVzF6vF6yLMukcYMAVYPuefEY0XvRKiTY5hgGvh7U59buXtBsIj8e	6301128529	105.00	100.00	0.00	user	2026-04-18 21:09:28.063164	0.00	0.00	TP000083	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
77	dpb2_ena922	$2b$10$FSaiBBPAwdiimq3nIAW4/OGKxo.4HEVTubDGFJRVRwUTr9xuhBHs6	9424385152	0.00	0.00	0.00	user	2026-04-18 21:09:09.129801	0.00	0.00	TP000077	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
63	buyc_b7ay00	$2b$10$zuWHfytRzvFdRILpvr0fHeS.Ht4h8ARNIEgimZrW6VSdqOkYpz6/W	8813630508	0.00	0.00	0.00	user	2026-04-18 21:09:06.919592	0.00	0.00	TP000063	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
65	buys_gbjwqh	$2b$10$KJ4.OCyaZKYPK07DzpGFrup10vwHMUuWJHlVhJ0HajB9CBXry0wbS	6635419810	315.00	300.00	0.00	user	2026-04-18 21:09:07.176751	0.00	0.00	TP000065	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
64	sels_lpa8vm	$2b$10$t9jYDsFuFs7ekE8HxMs27uAfboyUiBDdHnxGdYvKw0RtsdH0XmDuu	7156973688	700.00	0.00	300.00	user	2026-04-18 21:09:07.077735	0.00	0.00	TP000064	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
62	selc_gjlxgp	$2b$10$pRcCifR0BW3XOlF8TvEDWuiNW//ZohJd4w5bNtFCRgsoOS1sw7Tw2	8316952510	500.00	0.00	0.00	user	2026-04-18 21:09:06.823791	0.00	0.00	TP000062	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
70	hvc_n7o891	$2b$10$.kpwX/Pwv0PHkXb4gy7f8uDX6TU7Pl9Qe4P0cTUVNqimAW3ZhClpG	8187451938	1000.00	0.00	11000.00	user	2026-04-18 21:09:07.966128	0.00	0.00	TP000070	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
67	buyx_om7qms	$2b$10$V11f8Ts/uKnmteQIF3qil..Y1VcwEveF8vjloZIgajhkl6wniSmU2	7789121328	0.00	0.00	0.00	user	2026-04-18 21:09:07.477227	0.00	0.00	TP000067	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
68	hvw_dxqpt1	$2b$10$lmizmHCZ4o6n7q30Erdu3.YKwX.XUH0y14.sqdOHGVIL0zSTqz/j2	8481930817	1000.00	0.00	6000.00	user	2026-04-18 21:09:07.62683	0.00	0.00	TP000068	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
81	frfsa_y89398	$2b$10$DsryOcHc1d93T6pqt1wa/OhEGfTcZLmlVBYASValci4OV3BnkA9Xi	8387338150	500.00	0.00	100.00	user	2026-04-18 21:09:27.857743	0.00	0.00	TP000081	\N	0.00	-2	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
71	hvcb_wm1mzv	$2b$10$OYsiMd1OtsX13DIizq04Be5qAyf3f8z1E5cUn9IAMyTwG6TfUTkrm	6858074938	11330.00	11000.00	0.00	user	2026-04-18 21:09:08.069981	0.00	0.00	TP000071	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
69	hvwb_nguz77	$2b$10$N542LvH9PWWNETVK6cWofuy.Q2DHly/ecV0Yr2QF.omqG2CR05VCi	7426158501	6180.00	6000.00	0.00	user	2026-04-18 21:09:07.737036	0.00	0.00	TP000069	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
74	dpsl_w4uijk	$2b$10$uA64Y8h.WkS7wViqZyySWOJGCHq5X7OKBMMeO6R40mQtAUnG7S42S	8601499124	550.00	0.00	0.00	user	2026-04-18 21:09:08.718464	0.00	0.00	TP000074	\N	250.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
72	hva_58s8ln	$2b$10$0iyndeYrK5vcRUSQ33oxve8cvv1V7wjOQ4AvRrCG0nvkloIWFmWJy	9334778753	1000.00	0.00	8000.00	user	2026-04-18 21:09:08.377572	0.00	0.00	TP000072	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
79	db1_q9yy7s	$2b$10$gUlj41ediGtgU541nnGeZup4XmlziEGMrVtBZho87Vo6Q9P9D3fOe	8171065321	0.00	0.00	0.00	user	2026-04-18 21:09:09.441804	0.00	0.00	TP000079	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
76	dps2_lbsw08	$2b$10$Hy/igGcqfyD/54o17vzmkeRD.inFSGXnKP8lFqubTK3WV2orOZgQy	8137066471	550.00	0.00	0.00	user	2026-04-18 21:09:09.036132	0.00	0.00	TP000076	\N	250.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
78	ds1_bvxl6u	$2b$10$2ubQwyeFouj/eZiCZnWa/.3L9Ff1GQYso01tANMRTP02vZ63bgUSm	8693786808	450.00	0.00	0.00	user	2026-04-18 21:09:09.336868	0.00	0.00	TP000078	\N	150.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
80	frrules_m5dpyu	$2b$10$ATYX.vXH1Nf33XBNW/XlxOP/p3AF35rK9myoF.0g0quQX1eooKf9y	8018233335	0.00	0.00	0.00	user	2026-04-18 21:09:09.716238	0.00	0.00	TP000080	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
84	frfbb_ofvomh	$2b$10$btKnCQPX1WZw1aW1MTp2eew4GNKmY3VLyGYFS9DKvYnLoJkLFHucC	8255098338	105.00	100.00	0.00	user	2026-04-18 21:09:28.16784	0.00	0.00	TP000084	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
82	frfsb_ttfjbl	$2b$10$8MQwi1VEe2W1IJTK1P06ZuUDvdXVKfygUEVOVH0q5lnmhov7Y92Ju	7070307928	400.00	0.00	200.00	user	2026-04-18 21:09:27.959826	0.00	0.00	TP000082	\N	0.00	-4	2	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
85	frfbc_y9bspz	$2b$10$u6LQVO3Z9hM/5TgUDzzJBudVr5As8YX.Fqv85IY0ysNtaUCmAD5ly	6301667049	105.00	100.00	0.00	user	2026-04-18 21:09:39.507016	0.00	0.00	TP000085	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
66	selx_s8j986	$2b$10$x6bsWZ5IFKablIv/Gp6Yo.YuHXuuTFlAVi3nR7bHX9xAj6QEMrrL.	7897267260	1000.00	0.00	0.00	user	2026-04-18 21:09:07.379012	0.00	0.00	TP000066	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
86	auth_wewacd	$2b$10$ykROIRTjs6uhPD//v81g5OZdjA2e.bcGzVSb09On5.xxlabHwgcjW	7717690276	0.00	0.00	0.00	user	2026-04-18 21:10:05.308809	0.00	0.00	TP000086	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
87	dup_k2tg2r	$2b$10$F4XhBQGQZaQvbgD3WCZO..P4OpcrJodVR6AAYtwN0OpKmVzh/K7sa	8601345114	0.00	0.00	0.00	user	2026-04-18 21:10:05.722034	0.00	0.00	TP000087	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
89	buy_yl3vh4	$2b$10$xWgqjYF5XJiQBY8SzrRQB.xJ0xOOTCYy4SNWw8mAlL4LEYB/0cUjy	9529963391	0.00	0.00	0.00	user	2026-04-18 21:10:05.945493	0.00	0.00	TP000089	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
122	selx_pr50yp	$2b$10$uIUFM.DYIJxZ/z7ZAXJKd.mg1fpSt0x/UmsmCm9RVV4VJFUNx75Vy	6582017371	1000.00	0.00	0.00	user	2026-04-18 21:10:51.34009	0.00	0.00	TP000122	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
100	hva_drjf19	$2b$10$qarmqhU.GAm7uibC/BdaheXP7yJRf5dZzwHUmcAlVxAHboBHcVQl2	6165788182	1000.00	0.00	8000.00	user	2026-04-18 21:10:07.630687	0.00	0.00	TP000100	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
91	buyc_9sqqaq	$2b$10$XxxjDr1GTVPhLm.bxTZSJ.Pisgyv1caznZ7mLI.uabQvTxM71yuay	8366416218	0.00	0.00	0.00	user	2026-04-18 21:10:06.214688	0.00	0.00	TP000091	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
101	hvab_3jvqmu	$2b$10$Uwd.dbnH0GkjHyGyaTjBUe6jq8kZD/Ss0a7kcbmfGrLE7avUFy3NW	6874030261	8240.00	8000.00	0.00	user	2026-04-18 21:10:07.727504	0.00	0.00	TP000101	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
96	hvw_fzfr51	$2b$10$13uG.eCqgFPmkzifNx5qhe7/bV3SM4VHwOZLaIdzF369B7VDh5ife	7071465422	1000.00	0.00	6000.00	user	2026-04-18 21:10:06.898738	0.00	0.00	TP000096	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
90	selc_qgwlkp	$2b$10$Y3PM12X0KLZaGa.zxE59keocu2JYlVMX.2nLjhkDS6slRAxcJJqoy	6556876698	500.00	0.00	0.00	user	2026-04-18 21:10:06.120235	0.00	0.00	TP000090	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
97	hvwb_18vd72	$2b$10$7U1hns1iSvWkmCiU2icVj.0LpUTcN6ScPgYsMwxXL6Hhl4xZnKwSG	8168435553	6180.00	6000.00	0.00	user	2026-04-18 21:10:06.99541	0.00	0.00	TP000097	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
115	dup_tk1u61	$2b$10$gwp7KovZSFpb9CEGtDode.PrDNQtiNbGfjtnjQ09fyX02hf1p3vau	8358833175	0.00	0.00	0.00	user	2026-04-18 21:10:50.390713	0.00	0.00	TP000115	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
103	dpbu_ublljw	$2b$10$UomTJrKRdMeGyfMmw3m9Au/BqDxs9CpYnyKjwsAo6TzJ87hT5WEAu	7076439607	0.00	0.00	0.00	user	2026-04-18 21:10:08.047817	0.00	0.00	TP000103	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
93	buys_r347tx	$2b$10$Q8bx4XQR.9xKTkKcs/Proubiy.a1VdMgy.QpawHjNELPfuKtVponC	9714834776	315.00	300.00	0.00	user	2026-04-18 21:10:06.456598	0.00	0.00	TP000093	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
92	sels_5lytlw	$2b$10$4y7VXPYHh2Awer0.2etQVO8CUhwAYul9SRMWMiX9AhL759SAXEaey	8506820684	700.00	0.00	300.00	user	2026-04-18 21:10:06.358554	0.00	0.00	TP000092	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
102	dpsl_4173oj	$2b$10$OiENRo42g3GBJqu8X9v/YuqYEl2RCveoo4F35ki4RIqtoE8ETQnjK	6737107195	550.00	0.00	0.00	user	2026-04-18 21:10:07.950521	0.00	0.00	TP000102	\N	250.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
95	buyx_mkch4c	$2b$10$73KXkCZ/tBstfho22yR/rOq9DKWl8NNPOMk7HeIygbXTNpJbQPIta	9056348632	0.00	0.00	0.00	user	2026-04-18 21:10:06.749662	0.00	0.00	TP000095	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
88	sel_e8pmuk	$2b$10$JSq1F0/hIdYbp083eJpbAup19eu77GaUct5ATwbnq3x0ZrGuYDZK6	9705002460	600.00	0.00	0.00	user	2026-04-18 21:10:05.848551	0.00	0.00	TP000088	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
109	frfsa_hwevw9	$2b$10$AKyXo57Iyg9DW230cl9swu7N2m/IBxwoFZTWxSkSWokGqz2jDZdW6	9691907929	500.00	0.00	100.00	user	2026-04-18 21:10:27.143246	0.00	0.00	TP000109	\N	0.00	-2	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
105	dpb2_ny79ff	$2b$10$TJrQTvgwsnrZZ5oVIliWJeuPL3UPZ1uSWNrhH4WImyjgW8q2/uVby	6026832758	0.00	0.00	0.00	user	2026-04-18 21:10:08.366022	0.00	0.00	TP000105	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
104	dps2_0trix6	$2b$10$OEurGb3BM0z4Lf.p6wqTLOj/FrkGi3724mDWQcqTesrb27xuYASrO	8755681575	550.00	0.00	0.00	user	2026-04-18 21:10:08.268639	0.00	0.00	TP000104	\N	250.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
98	hvc_14op99	$2b$10$lOGqEJ.0LrfMFVQRhQvFm.tuGpCbrcI6edNv7QgWWvuOC/hfmhlNS	6363498661	1000.00	0.00	11000.00	user	2026-04-18 21:10:07.207448	0.00	0.00	TP000098	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
99	hvcb_k51i0s	$2b$10$NzxmaGAooFSV.amWeJdITursPXOVYfT7QFPnncDV83RMncMFVFvRy	6182940878	11330.00	11000.00	0.00	user	2026-04-18 21:10:07.304731	0.00	0.00	TP000099	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
110	frfsb_n7ygyr	$2b$10$k75reyznnw1uZ.wte9KbeONh3tEXo5GwEnEZArvlceyZujgKxE5d2	6624737971	400.00	0.00	200.00	user	2026-04-18 21:10:27.2423	0.00	0.00	TP000110	\N	0.00	-4	2	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
107	db1_sr405i	$2b$10$Fn3XPaN1uWZttjOoMlzsvuFQXDrQ4utGWJ.JD.kXbKYUW9ADuPJ7W	7962848089	0.00	0.00	0.00	user	2026-04-18 21:10:08.662144	0.00	0.00	TP000107	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
121	buys_76ijow	$2b$10$muuEfOHD3fPLQK8vt26yK.gdDaxgT4boN4kPdwtJAWFFXATzh1FK2	9616451344	315.00	300.00	0.00	user	2026-04-18 21:10:51.143273	0.00	0.00	TP000121	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
106	ds1_ajeq6b	$2b$10$N4LRdWJ9COxZKo2xpaESN.BPeaYNhlMRcem2y7lIw2nn1oShNxipK	9263204542	450.00	0.00	0.00	user	2026-04-18 21:10:08.566541	0.00	0.00	TP000106	\N	150.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
108	frrules_w4jiz5	$2b$10$PmZe9yIXht0FKIwtqXnmBOr4E8edLQmYwXZI1M5nHVS2z3TAOPxUi	9624230718	0.00	0.00	0.00	user	2026-04-18 21:10:08.941047	0.00	0.00	TP000108	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
117	buy_h0xnqo	$2b$10$MMxs7L7ElbVlHWmBGGfw7eRL6BL7thCS95Ax5/XdI7ZiAdvY7OqyK	9821547392	0.00	0.00	0.00	user	2026-04-18 21:10:50.61984	0.00	0.00	TP000117	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
112	frfbb_8vl5g6	$2b$10$Ly55jdOSB/EEK9zkVXA3Menpp1119dWhgNoPfdK1HmBFUwa4ixF9C	7894697231	105.00	100.00	0.00	user	2026-04-18 21:10:27.442421	0.00	0.00	TP000112	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
113	frfbc_uxy3f2	$2b$10$Q9lyqyN.pFbzIOJ2R0s1FeUrzEHa1uNO9ggSDqvlBvB8BaiSfOiP6	7293695262	105.00	100.00	0.00	user	2026-04-18 21:10:38.727831	0.00	0.00	TP000113	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
114	auth_f94ztl	$2b$10$jfc6ZM6T7ebdLMMNBf/5E.fVa6i3fz5MUgIWz8SOEoIzfWTUmFl/u	9442409118	0.00	0.00	0.00	user	2026-04-18 21:10:50.010431	0.00	0.00	TP000114	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
120	sels_4u7hwk	$2b$10$hHXrtOVHh/egPLQCtE38wuOUsFSGezAXOCRDGydjd8lCI3RmOk3nm	7439982334	700.00	0.00	300.00	user	2026-04-18 21:10:51.045203	0.00	0.00	TP000120	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
111	frfba_1bvbw5	$2b$10$Iv1slpuXHap5bSAHWFwwi.P.WL5p6B42qkXl76MmKgDnABBRBZ2xa	7069859742	105.00	100.00	0.00	user	2026-04-18 21:10:27.345236	0.00	0.00	TP000111	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
119	buyc_si9apm	$2b$10$gH/DqTeEjZXpghypM4z2FulCXEzkeooeIHE9HikFllxZYqwxxTPiu	8263461187	0.00	0.00	0.00	user	2026-04-18 21:10:50.894111	0.00	0.00	TP000119	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
118	selc_ykice7	$2b$10$A/ayhcW8q7WDGyUMRu74DudISBQBrwMrG/Hih5s.YBK7L2h5OkZBO	6734896218	500.00	0.00	0.00	user	2026-04-18 21:10:50.797928	0.00	0.00	TP000118	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
116	sel_2g7n45	$2b$10$xw3kDROGY4pnXtIuMqvt7ug4IatLL2/L1552L2MCZWnAeGm.WnU2y	8996989627	600.00	0.00	0.00	user	2026-04-18 21:10:50.517162	0.00	0.00	TP000116	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
123	buyx_jvqtht	$2b$10$DU9W2BtR0iCXWiEKCxdBDuppUtA85AAcW6fIu4jfjMKn6/LYUqVyO	8733757110	0.00	0.00	0.00	user	2026-04-18 21:10:51.436236	0.00	0.00	TP000123	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
124	hvw_vyvhtg	$2b$10$yIK3gIxuSNytJ0i/jQTC/uCPDueK68Pv4ZfgcO3bUBjIXbFueYf1y	9931298852	1000.00	0.00	6000.00	user	2026-04-18 21:10:51.579918	0.00	0.00	TP000124	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
125	hvwb_1n6yao	$2b$10$VgeRlbeTcpYyriiU1KmrqeY7ChzyQ3yvWQI981XWJVIu2IdGycDuG	6776785753	6180.00	6000.00	0.00	user	2026-04-18 21:10:51.674807	0.00	0.00	TP000125	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
226	dup_qi3fgi	$2b$10$XSTnE1dOmT9/umAVgIwxouEktgqIsuWOhGElSkPZ4.IwqUaQH9a0K	7173745490	0.00	0.00	0.00	user	2026-04-22 20:57:57.11814	0.00	0.00	TP000226	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
127	hvcb_7s1ao4	$2b$10$HoQg.EdllM9FCw.8./r3ju9IiL2oDWjfGkneBEJD22aObbGPx.xsS	7950016633	11330.00	11000.00	0.00	user	2026-04-18 21:10:51.963976	0.00	0.00	TP000127	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
94	selx_lrv8t8	$2b$10$fRV3IPydglZzTKAiJme8U.aIymyplxip8zFOnwSxOk5/b6O9d4Eim	7582896253	1000.00	0.00	0.00	user	2026-04-18 21:10:06.654062	0.00	0.00	TP000094	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
126	hvc_ii9ehs	$2b$10$zszpjx5m1tmsuSU/7GVyMuHjaz08f6dEMMzX0sS4ZIW0JBZvdLUlq	9409192361	1000.00	0.00	11000.00	user	2026-04-18 21:10:51.869077	0.00	0.00	TP000126	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
149	buyc_e63sam	$2b$10$5zhQiRGDneQcKuRX6.wE9uJQgPYSwwoGin3oHw000x0iFxTO.MVtm	7647299919	0.00	0.00	0.00	user	2026-04-22 20:55:31.55889	0.00	0.00	TP000149	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
148	selc_jqfw5p	$2b$10$/KH.RRqmdf0SXJNk6/FhyuOzfOqQa8.feSu2cobsT99SEZNUR1I0G	7897163998	500.00	0.00	0.00	user	2026-04-22 20:55:31.454115	0.00	0.00	TP000148	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
141	frfbc_28jxzl	$2b$10$MPVtAlXzizgRBJoRmKdgx.33vqbUVGZl5QY//hIWfJe4h1t7cf9N6	7380036841	105.00	100.00	0.00	user	2026-04-18 21:11:23.405228	0.00	0.00	TP000141	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
138	frfsb_hl3fr2	$2b$10$gol040qC6MyNwoQnRVvkKOzphYQtE8oma4w9FSnW0OxCh5/rBceFG	8968545847	400.00	0.00	200.00	user	2026-04-18 21:11:11.84297	0.00	0.00	TP000138	\N	0.00	-4	2	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
142	testdup1	$2b$10$z3SZZbVy6wSnYqPtbFDd7enDlgU536XmjiNvaVs4SBlmCIdBXFXFG	9991110001	0.00	0.00	0.00	user	2026-04-21 08:09:51.78867	0.00	0.00	TP000142	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
128	hva_2ss8nj	$2b$10$xokq.pzusIOhCCqk8iuD0u1kQzbKLmH8ZbGJXnARutPdV4v5HLNLq	7582111517	1000.00	0.00	8000.00	user	2026-04-18 21:10:52.249146	0.00	0.00	TP000128	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
129	hvab_gsovm5	$2b$10$yWo.S8fmPGK.HePeYP90xuHjIkGLmkWgCeASg6FXpygyibZGQa.7C	9016977810	8240.00	8000.00	0.00	user	2026-04-18 21:10:52.345313	0.00	0.00	TP000129	\N	0.00	1	1	f	\N	\N	t	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
60	sel_v2q2bf	$2b$10$mhRW2xk14xPfa2Z0QlhCDevTurKrxcWDFv9F5CRxCuicwgxNpWk06	6021551459	600.00	0.00	0.00	user	2026-04-18 21:09:06.467281	0.00	0.00	TP000060	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
131	dpbu_irn59u	$2b$10$6PhVIg8LTqmH7aFMFnkIHObXrcH/vlK/k68dHH.EYJnJFnc2Hnh5S	8496750246	0.00	0.00	0.00	user	2026-04-18 21:10:52.657494	0.00	0.00	TP000131	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
130	dpsl_gkoj3e	$2b$10$UDIiaDoKsJHEy5yjqGhZ2uRJe4W1PV7l26uJwSFZ9BoptVy3ZsavW	6923065647	550.00	0.00	0.00	user	2026-04-18 21:10:52.55327	0.00	0.00	TP000130	\N	250.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
133	dpb2_excvz9	$2b$10$Q7WT3QMEXMyrdqXbkMrtMOK/bjmeDqi1F4ONvxW2SBdrG4QmQkTse	6757388569	0.00	0.00	0.00	user	2026-04-18 21:10:53.05614	0.00	0.00	TP000133	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
53	frfsa_bsy8pm	$2b$10$dpjJAa69in57e2YorrA4Oel6.fOK0Rp/4cJptNwzGKTbgLRuhcFxq	9957483044	500.00	0.00	100.00	user	2026-04-18 21:08:41.034282	0.00	0.00	TP000053	\N	0.00	-2	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
132	dps2_e9t5i0	$2b$10$kQeYJZNJd0bKg4i.vf/DmO3yohe.BVJin.oQVlDtSP2ciXb06WHtq	7982411435	550.00	0.00	0.00	user	2026-04-18 21:10:52.959947	0.00	0.00	TP000132	\N	250.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
143	agentchk	$2b$10$j7vLbcoYEdorRbvdtR3MiOE1Ni2SsasYxDb/U2cjYKvRs04xE8CRm	9991112222	0.00	0.00	0.00	user	2026-04-21 08:14:59.74303	0.00	0.00	TP000143	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
135	db1_j4hj83	$2b$10$EIZV2rK7j8bmiPF9Jh6Bk.FvYBCH70gAbT5wDcm4usfharzpJ9A12	9780942303	0.00	0.00	0.00	user	2026-04-18 21:10:53.354725	0.00	0.00	TP000135	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
134	ds1_5c9mis	$2b$10$iP16AF/RpxkalbmvciKGdOwa5hD7z5mhwTTmx2P7CfZSfnV6J.UFW	8246071151	450.00	0.00	0.00	user	2026-04-18 21:10:53.258914	0.00	0.00	TP000134	\N	150.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
136	frrules_9mib3o	$2b$10$.Ji.RzVqiQW1TaP7xOCCrOf6.D72UUC8jYdjuOssn82WylCVcm906	9592164902	0.00	0.00	0.00	user	2026-04-18 21:10:53.627982	0.00	0.00	TP000136	\N	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
144	auth_mwjsir	$2b$10$SzYIzY5J4j5hy3yfSRdZ/.nDjO.MzC2Bwu95AWZB7DjDJZkbPROIa	8443526890	0.00	0.00	0.00	user	2026-04-22 20:55:30.452338	0.00	0.00	TP000144	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
145	dup_gabk5n	$2b$10$wWUWJDGG/P1iDdMPQy0RJ.mYxtKqSmg6gVH2D7w1sN0mHmT/yN7Wq	6519985124	0.00	0.00	0.00	user	2026-04-22 20:55:30.919727	0.00	0.00	TP000145	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
139	frfba_v93gvr	$2b$10$E4AWCsqf6GYmTPSXKR5Ob.2zf.2CNVzO7rLc/cd6EKFDkFMXrZQXK	9089712905	105.00	100.00	0.00	user	2026-04-18 21:11:11.949388	0.00	0.00	TP000139	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
137	frfsa_f76k27	$2b$10$z.yw.cnw/sxU2fRryXnjGOCW5kuW7pg5LYwQ9E48T6Pe5rSj54pi2	6431442170	500.00	0.00	100.00	user	2026-04-18 21:11:11.734811	0.00	0.00	TP000137	\N	0.00	-2	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
147	buy_f0mw1x	$2b$10$DFfkmKYiJZcnATYGJPOLfOcCDRcXM1qva3CkasvdNrYf4aygLIPEW	9193600628	0.00	0.00	0.00	user	2026-04-22 20:55:31.152634	0.00	0.00	TP000147	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
146	sel_62hmum	$2b$10$F0eGhhoR3.MMiBFQi4rZbeS1K0TqYnv0WYUrnSm37y.3dNWVpMoDm	9638809894	600.00	0.00	0.00	user	2026-04-22 20:55:31.046644	0.00	0.00	TP000146	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
140	frfbb_e24nt4	$2b$10$QmsSo5ToBlRBOhHpCp.Mj.2MCjvCeYH4EW9TRlWpgeSoZrey9gfgO	8060735279	105.00	100.00	0.00	user	2026-04-18 21:11:12.060037	0.00	0.00	TP000140	\N	0.00	1	1	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
151	buys_11e7w9	$2b$10$5YC13xuxe4/xa0jCIDzb4.Oj/iH0Kxx2WHd8thsGAhiw7jz160W6i	8859779318	0.00	0.00	0.00	user	2026-04-22 20:55:31.82211	0.00	0.00	TP000151	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
150	sels_xhej0f	$2b$10$rutCuhCumG21BwBXpBvNTuP5MMvfFzg4/7Q6IqCD1JkhDTf5M521C	9903504843	1000.00	0.00	0.00	user	2026-04-22 20:55:31.715021	0.00	0.00	TP000150	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
153	buyx_eoudqf	$2b$10$m.Zr08bJVU3v5C2LMBDNUOQkAJckywL04O2M23wkGaih3FkQa8th2	7465893089	0.00	0.00	0.00	user	2026-04-22 20:55:32.098399	0.00	0.00	TP000153	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
152	selx_q6046q	$2b$10$6U8sMyq7LTOL6U1gZPSYJOIexxj2V88cxuU2G5mfY1BBdUlS4uBnu	6729822962	1000.00	0.00	0.00	user	2026-04-22 20:55:31.992538	0.00	0.00	TP000152	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
155	hvwb_vqjkzu	$2b$10$sMw1UPlZQlLEE4r2b7mhXuGZy8vz6N5C1FvIAMm7UcMwVyHcQ9sG2	9278991673	0.00	0.00	0.00	user	2026-04-22 20:55:32.391108	0.00	0.00	TP000155	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
154	hvw_0b9vpl	$2b$10$gCUQYc/AQKF.cos./KrUG.WZG0C2QDK3qAes5cjPLhICjWxm3tdGW	9365735795	7000.00	0.00	0.00	user	2026-04-22 20:55:32.281292	0.00	0.00	TP000154	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
157	hvcb_3pcz4v	$2b$10$8tO5eGLaE98owzzfd/ZsoeG1DocbVjADNyj/FFXoVJT9V/lHaKDtq	9415938122	0.00	0.00	0.00	user	2026-04-22 20:55:32.655264	0.00	0.00	TP000157	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
156	hvc_d0uh54	$2b$10$pIcso.2Sa/9pQD/s//ekS.2Eb4.gETxIkzzkofo8IXZk7gfdJGYHG	9484313845	12000.00	0.00	0.00	user	2026-04-22 20:55:32.551309	0.00	0.00	TP000156	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
159	hvab_biwg3w	$2b$10$tPwI2sIrOVCEA/.bsQ0mHun4WQvpm0vWiiFeYTTqDqfYyRDKE8Zue	7228874699	0.00	0.00	0.00	user	2026-04-22 20:55:33.001285	0.00	0.00	TP000159	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
158	hva_7rardb	$2b$10$JAi8IHhEnawvAektgLFvg.943dAgGryCex7d6GzwK0cah6Ja2PqUO	6857247122	9000.00	0.00	0.00	user	2026-04-22 20:55:32.894319	0.00	0.00	TP000158	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
161	dpbu_kb197x	$2b$10$NCsXbXeSdA7txchgyW5FuejdJeA9k18tqcVVr5n7OpQOgRBHyxUG.	9336269744	0.00	0.00	0.00	user	2026-04-22 20:55:33.278713	0.00	0.00	TP000161	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
160	dpsl_suvrmo	$2b$10$6kvb/yhc8DwzX7F4IGe4JOLDF4b3uzb0vtaf7PyjJz3Dz65Fd2wz2	8398458184	800.00	0.00	0.00	user	2026-04-22 20:55:33.171258	0.00	0.00	TP000160	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
163	dpb2_g41341	$2b$10$vAYVnXDQ6Z4uwvCjAK9Qm.v5BhJJxhKXemevKV/1oss7G7uR34eaa	8016107492	0.00	0.00	0.00	user	2026-04-22 20:55:33.533924	0.00	0.00	TP000163	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
162	dps2_7e6j0h	$2b$10$xLfxGIJ4Ggvd1hxOCpoqzeARfqEJSS/POC5gRLt59qd26YbkJ1fwK	6047056243	800.00	0.00	0.00	user	2026-04-22 20:55:33.428748	0.00	0.00	TP000162	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
165	db1_357mji	$2b$10$JACkyPJe6jLyD62YyDETtus/gZUYJWhA3KOywH2KIL1Wcqrt4ITVG	8318490816	0.00	0.00	0.00	user	2026-04-22 20:55:33.795154	0.00	0.00	TP000165	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
164	ds1_g6nkqi	$2b$10$qmrenoStBnZP8A4aGhmJnuFHNmDDHp4E/ImhYgH9zTmdluM4IcK7e	9127088287	600.00	0.00	0.00	user	2026-04-22 20:55:33.694838	0.00	0.00	TP000164	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
166	frrules_cwmpi5	$2b$10$52tsE.xsr09v7LT8qIinSu.RQHevM1ZCio29QhVUkI46dCTMtWGoO	9138521073	0.00	0.00	0.00	user	2026-04-22 20:55:34.070146	0.00	0.00	TP000166	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
169	frfba_9bfsbx	$2b$10$J9MPYCVT5fIjxpsl4B/CE.shzVnLKujyn2QXSs0RfTDoHwvet9A4i	6638478086	0.00	0.00	0.00	user	2026-04-22 20:55:52.388417	0.00	0.00	TP000169	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
170	frfbb_0xwq24	$2b$10$uP7mSw9R2UuDHryO.rECBuUmqT3x4UPXNAETRf/DY6WcF90B41GOy	9177971518	0.00	0.00	0.00	user	2026-04-22 20:55:52.486396	0.00	0.00	TP000170	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
167	frfsa_jvbnu1	$2b$10$/5geHTKolDpcXpzfiTxZBODOAAdFtkTtMHO3ds7fHJEAsOBndKLoa	7944122090	600.00	0.00	0.00	user	2026-04-22 20:55:52.188676	0.00	0.00	TP000167	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
168	frfsb_niahbj	$2b$10$0BLb1sRNP3005dHYRBk2uuzvuzIPsEiW/a0KIFfSvlUygFXAfTHL2	6541343979	600.00	0.00	0.00	user	2026-04-22 20:55:52.28868	0.00	0.00	TP000168	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
171	auth_x2amt9	$2b$10$BlUAC1SeAy3RRa5JSBtweOd6.rRENODONkveiG18azVHJ51yzdpki	9821493809	0.00	0.00	0.00	user	2026-04-22 20:56:18.01961	0.00	0.00	TP000171	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
172	dup_kzhkm5	$2b$10$ISP5BE9stPcE8WiJmLiUJuiQ/XCQtizXDckhBBUPmFWB/rho50OlK	9908782218	0.00	0.00	0.00	user	2026-04-22 20:56:18.46673	0.00	0.00	TP000172	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
174	buy_w3wu27	$2b$10$bGiZGrCgXIM4Lf9eIT4MCONysIMwe2Yg8KwINqwTnX53JgYuZ0ZbG	6848262523	0.00	0.00	0.00	user	2026-04-22 20:56:18.739681	0.00	0.00	TP000174	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
173	sel_a89tvx	$2b$10$R0J11/nlI0wHfNYY813m0uZRGnSBvrdRSw20QAijz.ViVnyNsR8zu	7421820974	600.00	0.00	0.00	user	2026-04-22 20:56:18.624917	0.00	0.00	TP000173	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
176	buyc_l85dmg	$2b$10$Yc3JqvdOpLhfFkAr7y43Aeshx4cu.BkCFz79zFo92DMfRGChtzKAi	6060420310	0.00	0.00	0.00	user	2026-04-22 20:56:19.030506	0.00	0.00	TP000176	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
175	selc_1k5pyd	$2b$10$ELXCcNKqgUah6vIIE9abW.lfqUCzC5ur3Xr5BfLDsPviGJI4BB8IG	6003520852	500.00	0.00	0.00	user	2026-04-22 20:56:18.915488	0.00	0.00	TP000175	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
178	buys_k8tkuo	$2b$10$HmQUQ6rDzY0PFvduxmrC5urd7ZvtBakrFiG6U9f/FCwy5Cht3ykY2	8632707790	0.00	0.00	0.00	user	2026-04-22 20:56:19.318229	0.00	0.00	TP000178	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
177	sels_v7z2jl	$2b$10$tmKeoD3VA2v5/SzY7pWxDeRLKkg.KfzNLJqtrxb2A9x1DwYWQc3da	9357235955	1000.00	0.00	0.00	user	2026-04-22 20:56:19.199793	0.00	0.00	TP000177	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
180	buyx_e31ifu	$2b$10$AE0FW.txXUYMfJphf2K4wOGum3gwguC/wx5fFVH8SXX3BW.d2VENS	7229536274	0.00	0.00	0.00	user	2026-04-22 20:56:19.599485	0.00	0.00	TP000180	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
179	selx_vd9unk	$2b$10$ZFMOCxRyXvKijOMOCSHrGeyXdWP5sxGU8XO0FIA4B3327e2oJ1ity	7044691211	1000.00	0.00	0.00	user	2026-04-22 20:56:19.481392	0.00	0.00	TP000179	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
182	hvwb_ok3g9r	$2b$10$39bZhtq4d9s2n/ZVMnHyPuoy2p2GlLCatp9nc8mqLHlflXFzUnU6K	9573706814	0.00	0.00	0.00	user	2026-04-22 20:56:19.871381	0.00	0.00	TP000182	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
181	hvw_waskci	$2b$10$ezZam9TrVcC1F1G.sGkblusvXpENoV6lKL0cOd/tkW/IKVUGZYEvG	8232131822	7000.00	0.00	0.00	user	2026-04-22 20:56:19.770031	0.00	0.00	TP000181	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
184	hvcb_4w8kbo	$2b$10$YBGwIVLhSPxQhljTJD7CLu1LsJyP4.49DC71H234u24GKpT87bf7O	7188633413	0.00	0.00	0.00	user	2026-04-22 20:56:20.149721	0.00	0.00	TP000184	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
183	hvc_s9a2ez	$2b$10$h2PKQTN5abMirqxzJ4mV2.KMRumWgL4uoWSEeVEjgaJrYJzH.uzwm	9070848148	12000.00	0.00	0.00	user	2026-04-22 20:56:20.033105	0.00	0.00	TP000183	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
186	hvab_8s2kax	$2b$10$FNGAsTlTgA1.H7Gi0UUS1O1t2xxWHTKpuTHCksZsPZEtMgY58DXF6	8782424959	0.00	0.00	0.00	user	2026-04-22 20:56:20.492515	0.00	0.00	TP000186	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
185	hva_kjf56g	$2b$10$TB.O4CqlQlwHa.WnrJZ/k.0Sf7VGEfX.4zWwJ/KE5ojw7/Jm2T60a	7689222242	9000.00	0.00	0.00	user	2026-04-22 20:56:20.392137	0.00	0.00	TP000185	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
188	dpbu_yaf67l	$2b$10$74ikgsnagzxZjy.Uz9DinelhVwLrAzs0KEq4apOKtVc/96vJ/XeYm	6021308021	0.00	0.00	0.00	user	2026-04-22 20:56:20.749249	0.00	0.00	TP000188	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
187	dpsl_c6s0s7	$2b$10$DcA/Bxn5s5oFmsHZ0U/VjuGz0mNU86yjE4uUYPvDWsM7V/aa4bB7.	7773186953	800.00	0.00	0.00	user	2026-04-22 20:56:20.650602	0.00	0.00	TP000187	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
190	dpb2_rqarwd	$2b$10$VmyebGbidWPPO68HDSg9AeulSALA2ZjsDxyror3KWl8wBN/Wn5xdS	7613966640	0.00	0.00	0.00	user	2026-04-22 20:56:20.988749	0.00	0.00	TP000190	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
189	dps2_8cnt2q	$2b$10$RYLmh68IVU6siW9uES53guSiyivse6qczQE4qLplOLsyVhbGF1eju	7097149472	800.00	0.00	0.00	user	2026-04-22 20:56:20.890667	0.00	0.00	TP000189	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
192	db1_4e06b9	$2b$10$2PFoW1XcKfH3NzqYKSFRJuv/7M8V6w3e61XkHUPhd9l7C01Az9eyq	7519113795	0.00	0.00	0.00	user	2026-04-22 20:56:21.244716	0.00	0.00	TP000192	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
191	ds1_rflfbf	$2b$10$wU1PdGoW/N74chapfXPFU.fQ9yvUqy380WV5vhsa1eky5RiMFtVCa	7864451035	600.00	0.00	0.00	user	2026-04-22 20:56:21.143221	0.00	0.00	TP000191	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
193	frrules_mt9zfh	$2b$10$gNwMrvlG3MVGKLpff6E2bufSXRPAIsxMfSOKUV/5fkhCEPnj9pqIK	9918205706	0.00	0.00	0.00	user	2026-04-22 20:56:21.506867	0.00	0.00	TP000193	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
196	frfba_fo8zuw	$2b$10$8CH40N/YnlfZMHFZpzZStOf38gRj/Tb7vJc8O9WwiE8FVNsL9IpVy	6402773579	0.00	0.00	0.00	user	2026-04-22 20:56:39.796699	0.00	0.00	TP000196	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
197	frfbb_tceivv	$2b$10$z5/pBgMm5YKA59M0qcg3o.BUHz3hkZ3BNuYS1ZbU9uHVHKUM91/ZC	6914844305	0.00	0.00	0.00	user	2026-04-22 20:56:39.895562	0.00	0.00	TP000197	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
194	frfsa_wybfxi	$2b$10$PsCBANb9Sm4QdZRiz98ijOEMbYahOM1J0233pMZp2DKjNSoGtNXoS	9936296902	600.00	0.00	0.00	user	2026-04-22 20:56:39.597839	0.00	0.00	TP000194	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
195	frfsb_7422aj	$2b$10$861/zRkQzI2RJkDP7r9TX.xmwuRbbEF0WeoSNuaib0FMEoGa5bFvy	9543760399	600.00	0.00	0.00	user	2026-04-22 20:56:39.697107	0.00	0.00	TP000195	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
198	auth_1m1401	$2b$10$Wh/oHJacQpBPIGJiaOUYIu9KlQIUNdB2caFSS5INyA3vhdjpmbDA2	8090294404	0.00	0.00	0.00	user	2026-04-22 20:57:10.97144	0.00	0.00	TP000198	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
199	dup_k4c1d6	$2b$10$M0hjeZgaEQ2SkLwg1r/vfeWO32D.VHdiAg.UgX/DgjxkVT8wv2xey	6520276430	0.00	0.00	0.00	user	2026-04-22 20:57:11.375762	0.00	0.00	TP000199	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
201	buy_bwsen6	$2b$10$YKyVLdY5AkIfXZ6HAOnPIO6HVFYWrUW7Nkk5FgLr30w56ndSqlUDG	8973001946	0.00	0.00	0.00	user	2026-04-22 20:57:11.605994	0.00	0.00	TP000201	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
200	sel_z9tvft	$2b$10$5Vgz3I5TsoH/H7V6/ryaRelMDLvFxH/UAFHZdnrsEpAmDDWApyjk6	8593209311	600.00	0.00	0.00	user	2026-04-22 20:57:11.502268	0.00	0.00	TP000200	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
228	buy_muckgr	$2b$10$MZLHWMb8VPt8Q2PqdsUvseFFTjex3Eng7LwVTJ9tyHP2mGTXFmbiG	7848622784	0.00	0.00	0.00	user	2026-04-22 20:57:57.340931	0.00	0.00	TP000228	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
203	buyc_u9s6vo	$2b$10$LliWeXT278lxWr9S/io4euNKhtEadnp8IR.kCvGXR664GacsIA2O2	7514628535	0.00	0.00	0.00	user	2026-04-22 20:57:11.892366	0.00	0.00	TP000203	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
202	selc_na3l5q	$2b$10$u8UL53sWDpBrRK6zlKCN3e1Lsb2cl4oiMUPRF1/UJ0A.Yzk679Npm	8217260102	500.00	0.00	0.00	user	2026-04-22 20:57:11.7756	0.00	0.00	TP000202	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
227	sel_1pmqlg	$2b$10$0T9nN9qjD4ot3W28.JS.iuuGnHu3RM9wynzspV7h642ceRAMq.V8K	7702885306	600.00	0.00	0.00	user	2026-04-22 20:57:57.239886	0.00	0.00	TP000227	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
205	buys_bgcg94	$2b$10$f7sAf2xg1FWuauHU4II.l.hZwENqZgBzmffntgnMzgOvMulU6OydW	8559583843	0.00	0.00	0.00	user	2026-04-22 20:57:12.136679	0.00	0.00	TP000205	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
204	sels_y4r7xu	$2b$10$VBCrBxWPSOkXh/EIC6Ge5exOT98/xYjAaRI6rzSdM45CGx5ks7AOq	7859934625	1000.00	0.00	0.00	user	2026-04-22 20:57:12.037564	0.00	0.00	TP000204	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
207	buyx_b5n2o5	$2b$10$A0hX3//4Yogxo8SGtM0t3u5nlLBqFI2oWpX6VhS4RoLZnrZX9HhEq	9315428399	0.00	0.00	0.00	user	2026-04-22 20:57:12.383932	0.00	0.00	TP000207	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
206	selx_m75i4c	$2b$10$KYEk/OTfTneDsDvSw2nxwuPxd4Xj3G9SDCWpxAYmHRrsz3L3D3h5S	7339601307	1000.00	0.00	0.00	user	2026-04-22 20:57:12.280158	0.00	0.00	TP000206	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
230	buyc_gjb60b	$2b$10$.rTkvEDe9hZAZ78mdsiS5eU85vQ8y8ARFLTldmwl8k.M.IiPEJVuW	6448403729	0.00	0.00	0.00	user	2026-04-22 20:57:57.610249	0.00	0.00	TP000230	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
229	selc_m6dm7o	$2b$10$A8EoubowlgGsZwkWD7hdKe.QenkbfvjkHcIZ.OYpWTxrL0yMqu05m	7705054169	500.00	0.00	0.00	user	2026-04-22 20:57:57.501459	0.00	0.00	TP000229	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
209	hvwb_8hmi0q	$2b$10$epMqFDj14BOswp62iFh.Fewf5tT/9YFxq06Jn4AYL5j0FYLu9BJoq	6320190727	0.00	0.00	0.00	user	2026-04-22 20:57:12.637997	0.00	0.00	TP000209	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
208	hvw_smkx05	$2b$10$ZFamRO3gTk2QCYHhcdnBn.2pcxdlYqKwHy2.une9.Ubm312R3b7Qa	8077719669	7000.00	0.00	0.00	user	2026-04-22 20:57:12.533176	0.00	0.00	TP000208	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
211	hvcb_5gdzu6	$2b$10$56LrKtT56ZaMI4O7AQxa7.5kNecFMocI1CKl04pFRht2oY.PwCZqq	8358231921	0.00	0.00	0.00	user	2026-04-22 20:57:12.917365	0.00	0.00	TP000211	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
210	hvc_hr7hu5	$2b$10$9Qzmy0wiCtFrd8IlRbr7NeqIPnMlE1k8VGEioND3V9b9qrbhzmiTi	9569847227	12000.00	0.00	0.00	user	2026-04-22 20:57:12.809506	0.00	0.00	TP000210	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
232	buys_2y863z	$2b$10$xrQUQYsY5xynmDp71HBKE.jICOxC718Kt1guARpq6cq5c1UO//DYm	6624915392	0.00	0.00	0.00	user	2026-04-22 20:57:57.861278	0.00	0.00	TP000232	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
213	hvab_glexsy	$2b$10$68cPfo.hyynvWa3wJ0To1..T5OGEXXDBeRYviRvi4cY9.WUrCpMqO	7854358926	0.00	0.00	0.00	user	2026-04-22 20:57:13.264476	0.00	0.00	TP000213	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
212	hva_com5qy	$2b$10$0JkRjJ3eUSW78KDnwifb1eiYTbgQxIgIePGjiWRAWfKpt/15QkumO	6269943218	9000.00	0.00	0.00	user	2026-04-22 20:57:13.157109	0.00	0.00	TP000212	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
231	sels_7a5tis	$2b$10$4eROIhYoh9NawUQSN.g6Su1tPen1MpVRAkbY8YIXSXYqlzzimODhe	8911655465	1000.00	0.00	0.00	user	2026-04-22 20:57:57.757493	0.00	0.00	TP000231	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
215	dpbu_avzhpw	$2b$10$MW7ISdaVqiX9SNfoVPS/dOHEdSAseNJY5UMGGw3WH3oReUn./BwiK	8896342421	0.00	0.00	0.00	user	2026-04-22 20:57:13.551644	0.00	0.00	TP000215	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
214	dpsl_9j38ah	$2b$10$0YmqwxcALPnYPQFnRHeTb.PjQqaOp0qhCZxuFGDr0iANwo4gW1DEC	7371691954	800.00	0.00	0.00	user	2026-04-22 20:57:13.43352	0.00	0.00	TP000214	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
217	dpb2_lggn20	$2b$10$dheiF6Yqos7N35AzFKpUCujYlyDACG3B9XT3XETPmHHZs5jgEHgVG	9899957387	0.00	0.00	0.00	user	2026-04-22 20:57:13.799546	0.00	0.00	TP000217	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
216	dps2_dokmev	$2b$10$kkp93/ubbBLOattyyH9gT.tcUSQEDCgZTz3i51DowWslT2sIzJCoS	9757956256	800.00	0.00	0.00	user	2026-04-22 20:57:13.69745	0.00	0.00	TP000216	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
234	buyx_k5rupg	$2b$10$nk3JRYeUYM0dT.Bt1cBmGOyFDbouU1XxeZGOxonPF9BUMjeWmuwKe	9904579351	0.00	0.00	0.00	user	2026-04-22 20:57:58.090453	0.00	0.00	TP000234	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
233	selx_xz9j2y	$2b$10$4qrOj032M6lXyGRFqHG3/OHGgnp8Abz297TV2gLfj0Gz./mxsJE8W	7735791493	1000.00	0.00	0.00	user	2026-04-22 20:57:57.993613	0.00	0.00	TP000233	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
219	db1_dx2x7v	$2b$10$e20pdtFE36UT3sblB519ouf8Jijaewqm84GsDO7k9MJHm8VxOQ./y	9192267210	0.00	0.00	0.00	user	2026-04-22 20:57:14.049097	0.00	0.00	TP000219	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
218	ds1_ie9j5p	$2b$10$lRo1vx2ZaoSuEfvrXJkbYuSPZm0ekHZvarzKTRyf4dgZe1cdi5A6K	6977858325	600.00	0.00	0.00	user	2026-04-22 20:57:13.95241	0.00	0.00	TP000218	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
220	frrules_x88fgv	$2b$10$lXggB.9hPDYuq6hRUImmZu7mE7N6M.k2TMngp1Yr34SnFK1KZp2JO	7582546766	0.00	0.00	0.00	user	2026-04-22 20:57:14.304732	0.00	0.00	TP000220	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
236	hvwb_dtiuw9	$2b$10$ja0hgg8r/CLgvAs8tQTevOBIynA7uh4aTgYTsZJNhzub.CCsvaJYC	7593524711	0.00	0.00	0.00	user	2026-04-22 20:57:58.330047	0.00	0.00	TP000236	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
223	frfba_oop3b5	$2b$10$mGW/BQGQzgW0XVw/PfXAWOQVTU402R3AZoRNTQZXMkDk5oqaQvzGC	7003966607	0.00	0.00	0.00	user	2026-04-22 20:57:32.665395	0.00	0.00	TP000223	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
235	hvw_443b7k	$2b$10$p2UB.WyJbXUmQgpkA7FzQuaC9DfPpacXtM8.x4Neoc2V10BqD6dV2	8868778134	7000.00	0.00	0.00	user	2026-04-22 20:57:58.226008	0.00	0.00	TP000235	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
224	frfbb_h44vcr	$2b$10$1M0srYU7w8wICrBjRQ5vhe79lacHc9m8OVJFspqf6HrHgBHD5X.O2	7569052251	0.00	0.00	0.00	user	2026-04-22 20:57:32.767755	0.00	0.00	TP000224	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
221	frfsa_s3e44s	$2b$10$wdmnIkySJ92.uwSSgQXf9uSMc/VvAgYN8dnVT1H2twQYZL62jAEr2	7528623697	600.00	0.00	0.00	user	2026-04-22 20:57:32.460191	0.00	0.00	TP000221	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
222	frfsb_moedjb	$2b$10$dVUsJREeZx8Ypyl1YMC8POR4OAyvW8X3NJfUvO5ukNMxNnFMmSXAq	8783035370	600.00	0.00	0.00	user	2026-04-22 20:57:32.564907	0.00	0.00	TP000222	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
238	hvcb_27y9da	$2b$10$Z1gCX2kmUfjCd8H0t94DauulDe0mBKGk5urpzK9Auo5DFIg9Ji5BK	9634313169	0.00	0.00	0.00	user	2026-04-22 20:57:58.580919	0.00	0.00	TP000238	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
237	hvc_vkeklz	$2b$10$/KiyrFUVvMbKCGTnkyX/4OT3igibHN.5FYXDzAwPh2lWaYA/vWmzG	6092556972	12000.00	0.00	0.00	user	2026-04-22 20:57:58.474022	0.00	0.00	TP000237	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
240	hvab_vgnbcl	$2b$10$kgA6Q2PsFcKg0PFICZcOF.2YsaWEbjNsSYQy5hY2iOu/IC/PCxJ1G	9655342973	0.00	0.00	0.00	user	2026-04-22 20:57:58.910975	0.00	0.00	TP000240	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
239	hva_f1u0p8	$2b$10$Z9ndWc7G42NHZ8em7GixVeHxubj3F8Qk2Rof69WPOn7pOvJkniVVS	8831839713	9000.00	0.00	0.00	user	2026-04-22 20:57:58.811725	0.00	0.00	TP000239	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
241	dpsl_tkjbyx	$2b$10$3VXgraMOqMeffDPDcdZiMOuXs22QJI7ZvAqBlIPwTZ8epDTBF4qBu	8687975306	800.00	0.00	0.00	user	2026-04-22 20:57:59.225578	0.00	0.00	TP000241	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
242	dpbu_nvcv5p	$2b$10$ydP0kqjiGxg7tH/orA99tOaFI2sJLH4tqipUFk6u2LEMKQhA0BJcW	6143881171	0.00	0.00	0.00	user	2026-04-22 20:57:59.325211	0.00	0.00	TP000242	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
244	dpb2_pzi2jb	$2b$10$t069tFgrDGXlgXWd5rfKjOJ27C/U3MaNpMZcLRQgjiYSHqf77JTqS	7290500887	0.00	0.00	0.00	user	2026-04-22 20:57:59.565965	0.00	0.00	TP000244	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
243	dps2_564kbz	$2b$10$KHR5KbSoEFz7q7gvo8w0hOfVWXZFeL./GpvJICkNHc/VE8u9nMZ0K	8081270353	800.00	0.00	0.00	user	2026-04-22 20:57:59.469556	0.00	0.00	TP000243	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
246	db1_ojxxix	$2b$10$BDEP1GlhbY1tjHjf3jtKY.sNDNwrg.5hDMY8qlvOXYl/bEZCydrNe	8460929481	0.00	0.00	0.00	user	2026-04-22 20:57:59.812431	0.00	0.00	TP000246	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
245	ds1_fk3pto	$2b$10$R3KdqBs5iMmfM7DuS1iWIO8HpC6TUUCfoy0xF0pKk4lg61mzfBGUS	7977620228	600.00	0.00	0.00	user	2026-04-22 20:57:59.712068	0.00	0.00	TP000245	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
247	frrules_6vgqp8	$2b$10$Tx5lgmkFQWijsohYaf.oi.hiy8rzwkXjVlhl2KznmSdv2Y5OXhsAO	9246450196	0.00	0.00	0.00	user	2026-04-22 20:58:00.068182	0.00	0.00	TP000247	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
250	frfba_o6a59h	$2b$10$6UOtkjlxmatiEouUj.jZZ.tPP/So9SagQjD0Hwos/8dp3q3Rd78we	6097554543	0.00	0.00	0.00	user	2026-04-22 20:58:18.451437	0.00	0.00	TP000250	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
251	frfbb_29ttnp	$2b$10$JE4.MBQntNg.M1egngmQkenqMUrMNm0zH7VLIEkIZ2yzGLCGP75Fe	6904412622	0.00	0.00	0.00	user	2026-04-22 20:58:18.562579	0.00	0.00	TP000251	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
248	frfsa_nfpigf	$2b$10$1VLdEJZaM.406pDAR9RwLOThUO.VWDL/Fwpw03..ZWk7fNrwIOFwu	6125353442	600.00	0.00	0.00	user	2026-04-22 20:58:18.234708	0.00	0.00	TP000248	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
249	frfsb_xr48pg	$2b$10$MP8zhL9TFw4DyqgEogcGf.Eq5gw/.aPXDNrNPuQ./6BuMwYGILziS	7081243289	600.00	0.00	0.00	user	2026-04-22 20:58:18.343662	0.00	0.00	TP000249	1	0.00	0	0	f	\N	\N	f	f	\N	0	\N	\N	f	\N	\N	f	\N	0	f	\N
\.


--
-- Data for Name: utr_index; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.utr_index (id, utr, user_id, order_id, created_at) FROM stdin;
1	987654321099	7	10	2026-04-18 17:53:41.670913
2	BADUTR123456	7	11	2026-04-18 17:55:43.464582
3	U1776535197487	7	12	2026-04-18 17:59:57.493073
4	UTR4888726176	15	21	2026-04-18 21:03:06.675805
5	UTRHV6334423703	19	24	2026-04-18 21:03:07.207606
6	UTRC9151493657	21	25	2026-04-18 21:03:07.508861
7	UTRA7654691173	23	26	2026-04-18 21:03:07.899972
8	UTRDP1457100899	25	27	2026-04-18 21:03:08.201195
9	UTRSL4220858787	27	28	2026-04-18 21:03:08.510982
10	UTRBL3187166390	29	29	2026-04-18 21:03:08.805769
11	UTR1029858449	37	33	2026-04-18 21:08:20.33528
12	UTRHV5735597584	41	36	2026-04-18 21:08:20.950785
13	UTRC8857227987	43	37	2026-04-18 21:08:21.265984
14	UTRA1267842065	45	38	2026-04-18 21:08:21.668846
15	UTRDP6289059602	47	39	2026-04-18 21:08:22.004612
16	UTRSL611084435	49	40	2026-04-18 21:08:22.343067
17	UTRBL3573326708	51	41	2026-04-18 21:08:22.647829
18	FRDUP2299326431	55	43	2026-04-18 21:08:46.965791
19	FRDUP2299326431	56	44	2026-04-18 21:08:47.022236
20	FRDUP2299326431	57	45	2026-04-18 21:08:52.754737
21	UTR7041359633	65	48	2026-04-18 21:09:07.22695
22	UTRHV494454177	69	51	2026-04-18 21:09:07.791465
23	UTRC5355967350	71	52	2026-04-18 21:09:08.113773
24	UTRA5930645924	73	53	2026-04-18 21:09:08.550821
25	UTRDP4064720020	75	54	2026-04-18 21:09:08.865241
26	UTRSL9383037366	77	55	2026-04-18 21:09:09.174496
27	UTRBL2414660627	79	56	2026-04-18 21:09:09.491314
28	FRDUP6433751739	83	58	2026-04-18 21:09:33.766857
29	FRDUP6433751739	84	59	2026-04-18 21:09:33.853584
30	FRDUP6433751739	85	60	2026-04-18 21:09:39.564221
31	UTR188692075	93	63	2026-04-18 21:10:06.509853
32	UTRHV8551794386	97	66	2026-04-18 21:10:07.042316
33	UTRC947768700	99	67	2026-04-18 21:10:07.355771
34	UTRA2624839512	101	68	2026-04-18 21:10:07.777968
35	UTRDP7792127220	103	69	2026-04-18 21:10:08.096317
36	UTRSL4467423040	105	70	2026-04-18 21:10:08.412828
37	UTRBL3552908262	107	71	2026-04-18 21:10:08.713215
38	FRDUP86008813	111	73	2026-04-18 21:10:33.033294
39	FRDUP86008813	112	74	2026-04-18 21:10:33.082922
40	FRDUP86008813	113	75	2026-04-18 21:10:38.787262
41	UTR2520929999	121	78	2026-04-18 21:10:51.193615
42	UTRHV434456915	125	81	2026-04-18 21:10:51.723586
43	UTRC3166383917	127	82	2026-04-18 21:10:52.011985
44	UTRA4677203077	129	83	2026-04-18 21:10:52.391628
45	UTRDP437292890	131	84	2026-04-18 21:10:52.735494
46	UTRSL5114555106	133	85	2026-04-18 21:10:53.103054
47	UTRBL3184949231	135	86	2026-04-18 21:10:53.399265
48	FRDUP624566387	139	88	2026-04-18 21:11:17.677032
49	FRDUP624566387	140	89	2026-04-18 21:11:17.728863
50	FRDUP624566387	141	90	2026-04-18 21:11:23.510006
\.


--
-- Name: admin_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_logs_id_seq', 17, true);


--
-- Name: deposit_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.deposit_tasks_id_seq', 10, true);


--
-- Name: device_fingerprints_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.device_fingerprints_id_seq', 4, true);


--
-- Name: disputes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.disputes_id_seq', 17, true);


--
-- Name: fraud_alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.fraud_alerts_id_seq', 20, true);


--
-- Name: high_value_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.high_value_events_id_seq', 15, true);


--
-- Name: image_hashes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.image_hashes_id_seq', 100, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 142, true);


--
-- Name: referrals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.referrals_id_seq', 1, false);


--
-- Name: settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.settings_id_seq', 28, true);


--
-- Name: sms_active_patterns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sms_active_patterns_id_seq', 1, false);


--
-- Name: sms_candidate_patterns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sms_candidate_patterns_id_seq', 1, false);


--
-- Name: sms_learning_queue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sms_learning_queue_id_seq', 2, true);


--
-- Name: sms_safe_senders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sms_safe_senders_id_seq', 8, true);


--
-- Name: trade_pair_blocks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trade_pair_blocks_id_seq', 1, false);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transactions_id_seq', 85, true);


--
-- Name: trust_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trust_events_id_seq', 70, true);


--
-- Name: user_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_notifications_id_seq', 129, true);


--
-- Name: user_upi_ids_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_upi_ids_id_seq', 103, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 251, true);


--
-- Name: utr_index_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.utr_index_id_seq', 50, true);


--
-- Name: admin_logs admin_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_pkey PRIMARY KEY (id);


--
-- Name: deposit_tasks deposit_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposit_tasks
    ADD CONSTRAINT deposit_tasks_pkey PRIMARY KEY (id);


--
-- Name: device_fingerprints device_fingerprints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_fingerprints
    ADD CONSTRAINT device_fingerprints_pkey PRIMARY KEY (id);


--
-- Name: disputes disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_pkey PRIMARY KEY (id);


--
-- Name: fraud_alerts fraud_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fraud_alerts
    ADD CONSTRAINT fraud_alerts_pkey PRIMARY KEY (id);


--
-- Name: high_value_events high_value_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.high_value_events
    ADD CONSTRAINT high_value_events_pkey PRIMARY KEY (id);


--
-- Name: image_hashes image_hashes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.image_hashes
    ADD CONSTRAINT image_hashes_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_unique UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: sms_active_patterns sms_active_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_active_patterns
    ADD CONSTRAINT sms_active_patterns_pkey PRIMARY KEY (id);


--
-- Name: sms_candidate_patterns sms_candidate_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_candidate_patterns
    ADD CONSTRAINT sms_candidate_patterns_pkey PRIMARY KEY (id);


--
-- Name: sms_learning_queue sms_learning_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_learning_queue
    ADD CONSTRAINT sms_learning_queue_pkey PRIMARY KEY (id);


--
-- Name: sms_safe_senders sms_safe_senders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_safe_senders
    ADD CONSTRAINT sms_safe_senders_pkey PRIMARY KEY (id);


--
-- Name: trade_pair_blocks trade_pair_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trade_pair_blocks
    ADD CONSTRAINT trade_pair_blocks_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: trust_events trust_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trust_events
    ADD CONSTRAINT trust_events_pkey PRIMARY KEY (id);


--
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);


--
-- Name: user_upi_ids user_upi_ids_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_upi_ids
    ADD CONSTRAINT user_upi_ids_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referral_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_unique UNIQUE (referral_code);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: utr_index utr_index_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.utr_index
    ADD CONSTRAINT utr_index_pkey PRIMARY KEY (id);


--
-- Name: device_fingerprints_fp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX device_fingerprints_fp_idx ON public.device_fingerprints USING btree (fingerprint);


--
-- Name: device_fingerprints_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX device_fingerprints_user_idx ON public.device_fingerprints USING btree (user_id);


--
-- Name: high_value_events_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX high_value_events_created_idx ON public.high_value_events USING btree (created_at);


--
-- Name: high_value_events_tier_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX high_value_events_tier_idx ON public.high_value_events USING btree (tier);


--
-- Name: high_value_events_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX high_value_events_user_idx ON public.high_value_events USING btree (user_id);


--
-- Name: image_hashes_hash_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX image_hashes_hash_idx ON public.image_hashes USING btree (hash);


--
-- Name: sms_active_patterns_dedup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX sms_active_patterns_dedup ON public.sms_active_patterns USING btree (sender_key, utr_regex);


--
-- Name: sms_candidates_hash_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX sms_candidates_hash_unique ON public.sms_candidate_patterns USING btree (sender_key, template_hash);


--
-- Name: sms_queue_sender_key_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sms_queue_sender_key_idx ON public.sms_learning_queue USING btree (sender_key);


--
-- Name: sms_queue_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sms_queue_status_idx ON public.sms_learning_queue USING btree (status);


--
-- Name: sms_queue_template_hash_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sms_queue_template_hash_idx ON public.sms_learning_queue USING btree (template_hash);


--
-- Name: sms_safe_senders_key_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX sms_safe_senders_key_unique ON public.sms_safe_senders USING btree (sender_key);


--
-- Name: user_notifications_read_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_notifications_read_idx ON public.user_notifications USING btree (user_id, read_at);


--
-- Name: user_notifications_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_notifications_user_idx ON public.user_notifications USING btree (user_id);


--
-- Name: users_google_sub_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_google_sub_unique ON public.users USING btree (google_sub) WHERE (google_sub IS NOT NULL);


--
-- Name: utr_index_utr_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX utr_index_utr_idx ON public.utr_index USING btree (utr);


--
-- Name: admin_logs admin_logs_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id);


--
-- Name: device_fingerprints device_fingerprints_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_fingerprints
    ADD CONSTRAINT device_fingerprints_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: disputes disputes_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id);


--
-- Name: disputes disputes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: disputes disputes_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id);


--
-- Name: fraud_alerts fraud_alerts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fraud_alerts
    ADD CONSTRAINT fraud_alerts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: fraud_alerts fraud_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fraud_alerts
    ADD CONSTRAINT fraud_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: high_value_events high_value_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.high_value_events
    ADD CONSTRAINT high_value_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: image_hashes image_hashes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.image_hashes
    ADD CONSTRAINT image_hashes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: image_hashes image_hashes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.image_hashes
    ADD CONSTRAINT image_hashes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: orders orders_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: referrals referrals_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: referrals referrals_referred_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES public.users(id);


--
-- Name: referrals referrals_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id);


--
-- Name: sms_learning_queue sms_learning_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_learning_queue
    ADD CONSTRAINT sms_learning_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sms_safe_senders sms_safe_senders_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_safe_senders
    ADD CONSTRAINT sms_safe_senders_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);


--
-- Name: trade_pair_blocks trade_pair_blocks_user_id_1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trade_pair_blocks
    ADD CONSTRAINT trade_pair_blocks_user_id_1_fkey FOREIGN KEY (user_id_1) REFERENCES public.users(id);


--
-- Name: trade_pair_blocks trade_pair_blocks_user_id_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trade_pair_blocks
    ADD CONSTRAINT trade_pair_blocks_user_id_2_fkey FOREIGN KEY (user_id_2) REFERENCES public.users(id);


--
-- Name: transactions transactions_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: transactions transactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: trust_events trust_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trust_events
    ADD CONSTRAINT trust_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: trust_events trust_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trust_events
    ADD CONSTRAINT trust_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_notifications user_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_upi_ids user_upi_ids_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_upi_ids
    ADD CONSTRAINT user_upi_ids_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: utr_index utr_index_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.utr_index
    ADD CONSTRAINT utr_index_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: utr_index utr_index_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.utr_index
    ADD CONSTRAINT utr_index_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict t0wtavBzP3Ccuza2aWGNOwiwWnOz6G3rELkRPGdrEGWuHbgqyeZob1yKFjjP6EA

