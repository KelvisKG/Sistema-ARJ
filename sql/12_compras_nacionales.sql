-- ==============================================================================
-- SISTEMA ARJ · 12 — COMPRAS NACIONALES (nov-2026)
--
-- JJ pidió un registro parecido al de Embarques pero para mercancía comprada en
-- el país, con el número de factura del proveedor. Se guardan en la misma tabla `embarques` con tipo = 'nacional': así
-- la Recepción las puede sellar, "Recalcular" funciona igual y las distribuidoras
-- no las ven (sql/11 ya les oculta `embarques`).
--
-- Costo de una compra nacional: no lleva aduana, comisión de banco ni compra de
-- divisas. Su factor es 1 + (flete y gastos / monto de la compra).
--
-- Al sellar un producto con una compra nacional queda como compra LOCAL. Sin esto
-- aplicar_recepcion lo marcaría importado y les aparecería a las distribuidoras.
--
-- Aplicar en desarrollo y en producción después del 11, ANTES de publicar la app.
-- Idempotente. No cambia ningún embarque existente (todos quedan 'importado').
-- ==============================================================================

ALTER TABLE embarques ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'importado';
ALTER TABLE embarques ADD COLUMN IF NOT EXISTS num_factura TEXT;   -- factura del proveedor (compras nacionales)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'embarques_tipo_valido') THEN
    ALTER TABLE embarques ADD CONSTRAINT embarques_tipo_valido CHECK (tipo IN ('importado', 'nacional'));
  END IF;
END $$;

-- El porcentaje lo calcula el servidor; el factor sigue siendo la columna generada
CREATE OR REPLACE FUNCTION guardar_compra_nacional(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID := NULLIF(p->>'id', '')::UUID;
  v_monto NUMERIC := NULLIF(p->>'monto', '')::NUMERIC;
  v_gastos NUMERIC := COALESCE(NULLIF(p->>'gastos', '')::NUMERIC, 0);
  v_pct NUMERIC;
  v_fila embarques;
BEGIN
  PERFORM arj_exigir_usuario(TRUE);
  IF COALESCE(TRIM(p->>'codigo'), '') = '' OR COALESCE(TRIM(p->>'proveedor'), '') = '' THEN
    RAISE EXCEPTION 'ARJ: código y proveedor son obligatorios';
  END IF;
  IF COALESCE(v_monto, 0) <= 0 THEN RAISE EXCEPTION 'ARJ: el monto de la compra debe ser mayor que cero'; END IF;
  IF v_gastos < 0 THEN RAISE EXCEPTION 'ARJ: el flete y los gastos no pueden ser negativos'; END IF;
  v_pct := v_gastos / v_monto * 100;

  IF v_id IS NULL THEN
    INSERT INTO embarques (codigo, proveedor, fecha_llegada, fob_total, monto_flete_aduana, pct_flete_aduana,
      pct_comision, pct_divisas, notas, activo, tipo, num_factura)
    VALUES (UPPER(TRIM(p->>'codigo')), UPPER(TRIM(p->>'proveedor')), NULLIF(p->>'fecha', '')::DATE,
      v_monto, v_gastos, v_pct, 0, 0, NULLIF(TRIM(p->>'notas'), ''), TRUE, 'nacional', NULLIF(UPPER(TRIM(p->>'num_factura')), ''))
    RETURNING * INTO v_fila;
  ELSE
    UPDATE embarques SET codigo = UPPER(TRIM(p->>'codigo')), proveedor = UPPER(TRIM(p->>'proveedor')),
      fecha_llegada = NULLIF(p->>'fecha', '')::DATE, fob_total = v_monto, monto_flete_aduana = v_gastos,
      pct_flete_aduana = v_pct, notas = NULLIF(TRIM(p->>'notas'), ''),
      num_factura = NULLIF(UPPER(TRIM(p->>'num_factura')), ''), updated_at = NOW()
    WHERE id = v_id AND tipo = 'nacional' RETURNING * INTO v_fila;
    IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: compra nacional no encontrada'; END IF;
  END IF;
  RETURN jsonb_build_object('ok', TRUE, 'data', to_jsonb(v_fila));
EXCEPTION WHEN OTHERS THEN
  RETURN arj_respuesta_error(SQLERRM);
END $$;

REVOKE ALL ON FUNCTION guardar_compra_nacional(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION guardar_compra_nacional(JSONB) TO authenticated;

-- Disparador y no un cambio en aplicar_recepcion: sigue valiendo aunque esa función se reemplace
CREATE OR REPLACE FUNCTION arj_origen_por_compra()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.embarque_id IS NOT NULL AND EXISTS (SELECT 1 FROM embarques WHERE id = NEW.embarque_id AND tipo = 'nacional') THEN
    NEW.origen := 'local';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION arj_origen_por_compra() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_productos_origen_compra ON productos;
CREATE TRIGGER trg_productos_origen_compra BEFORE INSERT OR UPDATE OF embarque_id ON productos
  FOR EACH ROW EXECUTE FUNCTION arj_origen_por_compra();

NOTIFY pgrst, 'reload schema';

-- Verificación:
-- SELECT tipo, COUNT(*) FROM embarques GROUP BY 1;                       -- todo 'importado' al inicio
-- SELECT proname FROM pg_proc WHERE proname = 'guardar_compra_nacional'; -- 1 fila
