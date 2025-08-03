ALTER TABLE public.users
ADD COLUMN referral TEXT NULL;

COMMENT ON COLUMN public.users.referral IS 'Referral source from the URL when the user first signs up.';
