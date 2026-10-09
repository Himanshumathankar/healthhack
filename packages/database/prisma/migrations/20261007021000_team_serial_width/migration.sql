CREATE OR REPLACE FUNCTION generate_team_id() RETURNS TEXT LANGUAGE SQL VOLATILE AS $$
  SELECT 'HH-VITB-JHU-' || EXTRACT(YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::TEXT || '-' ||
    CASE WHEN serial < 100000 THEN LPAD(serial::TEXT, 5, '0') ELSE serial::TEXT END
  FROM (SELECT nextval('team_id_serial') AS serial) AS allocation;
$$;
