-- ==============================================================================
-- SISTEMA ARJ · 13 — TASA BCV AUTOMÁTICA (nov-2026)
--
-- Pedido de JJ: que la tasa BCV se actualice sola cuando es un día nuevo y cada
-- vez que el BCV la cambia. Decisión: SOLO la BCV es automática. El paralelo lo
-- sigue confirmando el gerente cada día y, sin esa confirmación, no se factura
-- (la regla de `tasas_actualizadas` no cambia).
--
-- La tasa la consulta el SERVIDOR (no el navegador), así nadie puede mandar una
-- tasa inventada. Fuente: https://ve.dolarapi.com/v1/dolares/oficial (publica la
-- tasa oficial del BCV y su fecha de vigencia).
--
--   · arj_traer_bcv(): consulta la fuente y actualiza `configuracion.tasa_bcv` si
--     cambió. Como mucho una consulta cada 10 minutos. Un salto de más de 25 %
--     no se aplica: se deja como ALERTA en la bitácora para que el gerente revise.
--   · refrescar_tasa_bcv(): la llama la app al abrir y cada 10 minutos.
--   · pg_cron (si está disponible): la ejecuta cada 30 minutos aunque nadie
--     tenga la app abierta.
--
-- Requiere la extensión `http` (Database → Extensions en Supabase). Este script
-- intenta activarla. Aplicar en desarrollo y en producción después del 12.
-- Idempotente.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS bcv_actualizada TIMESTAMPTZ;   -- cuándo cambió por última vez
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS bcv_consultada TIMESTAMPTZ;    -- última consulta a la fuente
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS bcv_fecha_valor DATE;          -- fecha de vigencia que publica el BCV

-- La consulta a internet (hasta 8 s) se hace SIN bloquear la configuración: el
-- bloqueo solo se toma al final, un instante, para comparar y guardar. Siempre
-- devuelve la tasa vigente para que la app no tenga que volver a leerla.
CREATE OR REPLACE FUNCTION arj_traer_bcv()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_cfg configuracion;
  v_resp extensions.http_response;
  v_json JSONB;
  v_nueva NUMERIC;
  v_fecha DATE;
  v_res JSONB;
BEGIN
  SELECT * INTO v_cfg FROM configuracion ORDER BY id LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'No existe la configuración'); END IF;
  IF v_cfg.bcv_consultada IS NOT NULL AND v_cfg.bcv_consultada > NOW() - INTERVAL '10 minutes' THEN
    v_res := jsonb_build_object('ok', TRUE, 'cambio', FALSE, 'consultada', FALSE);
  ELSE
    PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT', '8');
    v_resp := extensions.http_get('https://ve.dolarapi.com/v1/dolares/oficial');
    IF v_resp.status = 200 THEN
      v_json := v_resp.content::JSONB;
      v_nueva := ROUND(NULLIF(v_json->>'promedio', '')::NUMERIC, 8);
      v_fecha := ((v_json->>'fechaActualizacion')::TIMESTAMPTZ AT TIME ZONE 'America/Caracas')::DATE;
    END IF;

    -- Desde aquí, con la fila bloqueada y releída (el gerente pudo cambiarla mientras tanto)
    SELECT * INTO v_cfg FROM configuracion WHERE id = v_cfg.id FOR UPDATE;
    UPDATE configuracion SET bcv_consultada = NOW() WHERE id = v_cfg.id;

    IF v_resp.status <> 200 THEN
      v_res := jsonb_build_object('ok', FALSE, 'error', 'La fuente de la tasa BCV respondió ' || v_resp.status);
    ELSIF COALESCE(v_nueva, 0) <= 0 THEN
      v_res := jsonb_build_object('ok', FALSE, 'error', 'La fuente no trajo una tasa BCV válida');
    ELSIF COALESCE(v_cfg.tasa_bcv, 0) > 0 AND ABS(v_nueva / v_cfg.tasa_bcv - 1) > 0.25 THEN
      -- Un salto tan grande suele ser un error de la fuente: no se aplica, se avisa
      INSERT INTO bitacora (fecha, usuario, empresa, accion, descripcion, critico)
      VALUES (NOW(), 'Sistema', 'directa', 'tasas',
        'Tasa BCV automática NO aplicada: la fuente dio ' || v_nueva || ' y la actual es ' || v_cfg.tasa_bcv || '. Revísala en Configuración.', TRUE);
      v_res := jsonb_build_object('ok', FALSE, 'error', 'La tasa nueva varía más de 25 %; quedó pendiente de revisión');
    ELSIF ABS(v_nueva - COALESCE(v_cfg.tasa_bcv, 0)) < 0.00005 THEN
      UPDATE configuracion SET bcv_fecha_valor = v_fecha WHERE id = v_cfg.id;
      v_cfg.bcv_fecha_valor := v_fecha;
      v_res := jsonb_build_object('ok', TRUE, 'cambio', FALSE, 'consultada', TRUE);
    ELSE
      UPDATE configuracion SET tasa_bcv = v_nueva, bcv_actualizada = NOW(), bcv_fecha_valor = v_fecha, updated_at = NOW()
      WHERE id = v_cfg.id;
      INSERT INTO bitacora (fecha, usuario, empresa, accion, descripcion, critico)
      VALUES (NOW(), 'Sistema', 'directa', 'tasas',
        'Tasa BCV actualizada automáticamente: ' || COALESCE(v_cfg.tasa_bcv, 0) || ' → ' || v_nueva ||
        ' (vigente desde ' || TO_CHAR(v_fecha, 'DD/MM/YYYY') || ')' ||
        CASE WHEN v_nueva > COALESCE(v_cfg.tasa_par, 0) THEN '. ATENCIÓN: quedó por encima del paralelo; confirma el paralelo.' ELSE '' END,
        v_nueva > COALESCE(v_cfg.tasa_par, 0));
      v_res := jsonb_build_object('ok', TRUE, 'cambio', TRUE, 'consultada', TRUE, 'anterior', v_cfg.tasa_bcv);
      v_cfg.tasa_bcv := v_nueva;
      v_cfg.bcv_actualizada := NOW();
      v_cfg.bcv_fecha_valor := v_fecha;
    END IF;
  END IF;
  RETURN v_res || jsonb_build_object('tasa_bcv', v_cfg.tasa_bcv, 'bcv_actualizada', v_cfg.bcv_actualizada,
    'bcv_fecha_valor', v_cfg.bcv_fecha_valor);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

REVOKE ALL ON FUNCTION arj_traer_bcv() FROM PUBLIC, anon, authenticated;

-- La app no manda ninguna tasa: solo pide que el servidor la consulte
CREATE OR REPLACE FUNCTION refrescar_tasa_bcv()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM arj_exigir_usuario(FALSE);
  RETURN arj_traer_bcv();
EXCEPTION WHEN OTHERS THEN
  RETURN arj_respuesta_error(SQLERRM);
END $$;

REVOKE ALL ON FUNCTION refrescar_tasa_bcv() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION refrescar_tasa_bcv() TO authenticated;

-- Cada 30 minutos desde el servidor, aunque nadie tenga la app abierta
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule('arj-tasa-bcv', '*/30 * * * *', 'SELECT arj_traer_bcv()');
  RAISE NOTICE 'Tarea programada arj-tasa-bcv activa (cada 30 min)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron no disponible (%): la tasa se actualizará cuando alguien abra la app', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verificación (debe traer la tasa del día; la segunda vez en 10 min dice consultada=false):
-- SELECT arj_traer_bcv();
-- SELECT tasa_bcv, bcv_actualizada, bcv_consultada, bcv_fecha_valor FROM configuracion;
-- SELECT * FROM cron.job WHERE jobname = 'arj-tasa-bcv';
