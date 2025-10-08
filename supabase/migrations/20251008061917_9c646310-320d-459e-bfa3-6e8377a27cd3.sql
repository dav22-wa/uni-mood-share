-- Add foreign key constraint for contacts table to properly join with profiles
ALTER TABLE public.contacts 
DROP CONSTRAINT IF EXISTS contacts_contact_id_fkey;

ALTER TABLE public.contacts
ADD CONSTRAINT contacts_contact_id_fkey 
FOREIGN KEY (contact_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;