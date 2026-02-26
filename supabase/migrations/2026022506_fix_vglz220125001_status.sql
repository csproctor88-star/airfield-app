-- Fix VGLZ220125001: permanent exclusion zone should be 'active', not 'completed'
UPDATE waivers SET status = 'active' WHERE waiver_number = 'VGLZ220125001';
