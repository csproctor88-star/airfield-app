-- Remove all RLS policies and helper functions
-- RLS will be re-added in a later development phase

-- Drop all policies on profiles
DROP POLICY IF EXISTS "Anyone can view active profiles" ON profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON profiles;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop all policies on discrepancies
DROP POLICY IF EXISTS "AM roles full access" ON discrepancies;
DROP POLICY IF EXISTS "CE sees assigned" ON discrepancies;
DROP POLICY IF EXISTS "CE updates assigned" ON discrepancies;
DROP POLICY IF EXISTS "Observers read all" ON discrepancies;
ALTER TABLE discrepancies DISABLE ROW LEVEL SECURITY;

-- Drop all policies on airfield_checks
DROP POLICY IF EXISTS "AM roles full access" ON airfield_checks;
DROP POLICY IF EXISTS "Authenticated users create checks" ON airfield_checks;
DROP POLICY IF EXISTS "Others read checks" ON airfield_checks;
ALTER TABLE airfield_checks DISABLE ROW LEVEL SECURITY;

-- Drop all policies on check_comments
DROP POLICY IF EXISTS "AM roles manage check comments" ON check_comments;
DROP POLICY IF EXISTS "Authenticated users add comments" ON check_comments;
DROP POLICY IF EXISTS "Everyone reads check comments" ON check_comments;
ALTER TABLE check_comments DISABLE ROW LEVEL SECURITY;

-- Drop all policies on inspections
DROP POLICY IF EXISTS "AM roles full access" ON inspections;
DROP POLICY IF EXISTS "Others read inspections" ON inspections;
ALTER TABLE inspections DISABLE ROW LEVEL SECURITY;

-- Drop all policies on notams
DROP POLICY IF EXISTS "AM roles manage notams" ON notams;
DROP POLICY IF EXISTS "Everyone reads notams" ON notams;
ALTER TABLE notams DISABLE ROW LEVEL SECURITY;

-- Drop all policies on photos
DROP POLICY IF EXISTS "AM roles manage photos" ON photos;
DROP POLICY IF EXISTS "Everyone reads photos" ON photos;
ALTER TABLE photos DISABLE ROW LEVEL SECURITY;

-- Drop all policies on status_updates
DROP POLICY IF EXISTS "AM roles manage status" ON status_updates;
DROP POLICY IF EXISTS "Authenticated users add notes" ON status_updates;
DROP POLICY IF EXISTS "Everyone reads status" ON status_updates;
ALTER TABLE status_updates DISABLE ROW LEVEL SECURITY;

-- Drop all policies on obstruction_evaluations
DROP POLICY IF EXISTS "AM roles full access" ON obstruction_evaluations;
DROP POLICY IF EXISTS "Authenticated users create evaluations" ON obstruction_evaluations;
DROP POLICY IF EXISTS "Users update own evaluations" ON obstruction_evaluations;
DROP POLICY IF EXISTS "Users delete own evaluations" ON obstruction_evaluations;
DROP POLICY IF EXISTS "Everyone reads evaluations" ON obstruction_evaluations;
ALTER TABLE obstruction_evaluations DISABLE ROW LEVEL SECURITY;

-- Drop all policies on activity_log
DROP POLICY IF EXISTS "Everyone reads activity" ON activity_log;
DROP POLICY IF EXISTS "System inserts activity" ON activity_log;
ALTER TABLE activity_log DISABLE ROW LEVEL SECURITY;

-- Drop RLS helper functions
DROP FUNCTION IF EXISTS public.user_has_role(text[]);
DROP FUNCTION IF EXISTS public.user_shop();
