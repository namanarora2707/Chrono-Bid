-- Fix function security issues by adding proper search_path settings

-- Update the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update the handle_new_user function  
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

-- Update the update_auction_status function
CREATE OR REPLACE FUNCTION public.update_auction_status()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path = ''
AS $$
BEGIN
  -- Update status based on current time
  IF NEW.start_time <= now() AND NEW.end_time > now() AND NEW.status = 'pending' THEN
    NEW.status = 'active';
  ELSIF NEW.end_time <= now() AND NEW.status = 'active' THEN
    NEW.status = 'ended';
  END IF;
  RETURN NEW;
END;
$$;