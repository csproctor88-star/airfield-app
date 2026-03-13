-- Delete features with no layer (Unknown) or C-AFLD-SIGN layer
DELETE FROM infrastructure_features WHERE layer IS NULL;
DELETE FROM infrastructure_features WHERE layer = 'C-AFLD-SIGN';
