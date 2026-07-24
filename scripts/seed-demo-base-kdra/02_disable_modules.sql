UPDATE bases
SET enabled_modules = array_remove(array_remove(array_remove(enabled_modules, 'waivers'), 'acsi'), 'amtr'),
    updated_at = now()
WHERE id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';

SELECT enabled_modules AS remaining
FROM bases
WHERE id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
