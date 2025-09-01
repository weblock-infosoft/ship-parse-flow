-- Create profiles table for user authentication
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text DEFAULT 'staff',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create shipment_orders table
CREATE TABLE public.shipment_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name text NOT NULL,
  address text NOT NULL,
  tracking_id text,
  delivery_date date,
  package_weight decimal(10,2),
  notes text,
  status text DEFAULT 'pending',
  original_file_url text,
  original_file_name text,
  parsed_by_ai boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.shipment_orders ENABLE ROW LEVEL SECURITY;

-- Create policies for shipment_orders (authenticated users can access all)
CREATE POLICY "Authenticated users can view all shipment orders" 
ON public.shipment_orders 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert shipment orders" 
ON public.shipment_orders 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update shipment orders" 
ON public.shipment_orders 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete shipment orders" 
ON public.shipment_orders 
FOR DELETE 
TO authenticated
USING (true);

-- Create parsing_logs table for monitoring
CREATE TABLE public.parsing_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name text NOT NULL,
  file_url text,
  status text NOT NULL, -- 'success', 'failed', 'processing'
  error_message text,
  extracted_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.parsing_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for parsing_logs
CREATE POLICY "Authenticated users can view all parsing logs" 
ON public.parsing_logs 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert parsing logs" 
ON public.parsing_logs 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create storage bucket for uploaded files
INSERT INTO storage.buckets (id, name, public) VALUES ('shipment-files', 'shipment-files', false);

-- Create storage policies
CREATE POLICY "Authenticated users can upload files" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'shipment-files');

CREATE POLICY "Authenticated users can view files" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'shipment-files');

CREATE POLICY "Authenticated users can delete files" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'shipment-files');

-- Create function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'staff');
  RETURN new;
END;
$$;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create function to update updated_at columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipment_orders_updated_at
  BEFORE UPDATE ON public.shipment_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();