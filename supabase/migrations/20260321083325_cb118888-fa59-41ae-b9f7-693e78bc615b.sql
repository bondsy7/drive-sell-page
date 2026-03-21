
-- Admin can read all image_generation_jobs
CREATE POLICY "Admins can view all jobs"
ON public.image_generation_jobs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update image_generation_jobs (cancel/restart)
CREATE POLICY "Admins can update all jobs"
ON public.image_generation_jobs
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin can read all spin360_jobs
CREATE POLICY "Admins can view all spin jobs"
ON public.spin360_jobs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update spin360_jobs
CREATE POLICY "Admins can update all spin jobs"
ON public.spin360_jobs
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin can read all sales_email_outbox
CREATE POLICY "Admins can view all emails"
ON public.sales_email_outbox
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update sales_email_outbox (resend)
CREATE POLICY "Admins can update all emails"
ON public.sales_email_outbox
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin can read all test_drive_bookings
CREATE POLICY "Admins can view all bookings"
ON public.test_drive_bookings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can read all projects
CREATE POLICY "Admins can view all projects"
ON public.projects
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can read all leads
CREATE POLICY "Admins can view all leads"
ON public.leads
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
