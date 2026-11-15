-- ==============================================================================
-- SISTEMA ARJ · 15 — RECUPERAR LOS PRECIOS MANUALES DE LAS FACTURAS VIEJAS (nov-2026)
--
-- El 14 guarda el precio manual al emitir, pero solo de ahí en adelante. Las
-- facturas anteriores no lo tienen. Este script lo recupera de dos rastros que
-- sí quedaron en la base, y marca esos renglones como "recuperados" para que la
-- app los distinga de los registrados al emitir:
--
--   1. BITÁCORA. Cada cambio de precio dejó una entrada (app Vue y monolito):
--        "Precio de 'X' fijado en $40.00 efectivo ($50.00 → $44.94 BCV)"
--        "Precio BCV de 'X' fijado en $45.00 ($50.00 → $45.00)"
--      con quién y cuándo. Se asocia al renglón de la primera factura que esa
--      persona emitió después (hasta 12 horas), con ese producto y ese precio.
--      El precio de lista es el "antes" de la entrada. Si un precio se cambió
--      dos veces, el "antes" es el del último cambio (puede no ser el de lista).
--
--   2. DESCUENTO MANUAL %. La factura guardó su motivo ("Descuento manual 10%: …"):
--      se marcan sus renglones y el precio antes del descuento se calcula.
--
-- Solo rellena renglones sin marca (no pisa lo registrado por el 14). Se puede
-- correr más de una vez. Requiere el 14. Al final muestra cuántos recuperó.
--
-- Para ver ANTES qué marcaría sin cambiar nada, correr solo la consulta de la
-- sección "VISTA PREVIA" del final.
-- ==============================================================================

ALTER TABLE factura_items ADD COLUMN IF NOT EXISTS ajuste_recuperado BOOLEAN NOT NULL DEFAULT FALSE;

-- Cambios de precio leídos de la bitácora ($1,234.50 → 1234.50)
CREATE OR REPLACE VIEW arj_bitacora_precios AS
SELECT b.fecha, b.usuario, 'dolar'::TEXT AS tipo, m[1] AS producto,
       REPLACE(m[2], ',', '')::NUMERIC AS monto, REPLACE(m[3], ',', '')::NUMERIC AS antes, REPLACE(m[4], ',', '')::NUMERIC AS nuevo
FROM bitacora b,
     regexp_match(b.descripcion, '^Precio de ''(.*)'' fijado en \$([0-9.,]+) efectivo \(\$([0-9.,]+) → \$([0-9.,]+) BCV\)$') m
WHERE b.accion = 'precio'
UNION ALL
SELECT b.fecha, b.usuario, 'bcv', m[1],
       REPLACE(m[2], ',', '')::NUMERIC, REPLACE(m[3], ',', '')::NUMERIC, REPLACE(m[4], ',', '')::NUMERIC
FROM bitacora b,
     regexp_match(b.descripcion, '^Precio BCV de ''(.*)'' fijado en \$([0-9.,]+) \(\$([0-9.,]+) → \$([0-9.,]+)\)$') m
WHERE b.accion = 'precio';

REVOKE ALL ON arj_bitacora_precios FROM PUBLIC, anon, authenticated;

-- 1. Bitácora: el último cambio de ese producto, por quien emitió, antes de emitir
WITH cand AS (
  SELECT DISTINCT ON (fi.id) fi.id AS item_id, bp.tipo, bp.monto, bp.antes, bp.usuario
  FROM factura_items fi
  JOIN facturas f ON f.id = fi.factura_id
  JOIN arj_bitacora_precios bp
    ON bp.usuario = f.vendedor AND bp.producto = fi.descripcion
   AND ABS(bp.nuevo - fi.precio_unitario) < 0.011
   AND bp.fecha <= f.fecha AND bp.fecha >= f.fecha - INTERVAL '12 hours'
  WHERE fi.ajuste_tipo IS NULL
  ORDER BY fi.id, bp.fecha DESC
)
UPDATE factura_items fi
SET ajuste_tipo = cand.tipo, ajuste_monto = cand.monto, precio_lista = cand.antes,
    ajustado_por = cand.usuario, ajuste_recuperado = TRUE
FROM cand WHERE fi.id = cand.item_id;

-- 2. Descuento manual %: todos los renglones de la factura llevan el descuento
WITH d AS (
  SELECT f.id, f.vendedor,
         SUBSTRING(f.motivo_descuento FROM '^Descuento manual ([0-9]+(?:\.[0-9]+)?)%')::NUMERIC AS pct
  FROM facturas f
  WHERE f.motivo_descuento ~ '^Descuento manual [0-9]'
)
UPDATE factura_items fi
SET ajuste_tipo = 'descuento', ajuste_monto = d.pct,
    precio_lista = ROUND(fi.precio_unitario / (1 - d.pct / 100), 2),
    ajustado_por = d.vendedor, ajuste_recuperado = TRUE
FROM d
WHERE fi.factura_id = d.id AND fi.ajuste_tipo IS NULL AND d.pct > 0 AND d.pct < 100;

NOTIFY pgrst, 'reload schema';

-- Resultado
SELECT ajuste_tipo AS tipo, COUNT(*) AS renglones, COUNT(DISTINCT factura_id) AS facturas
FROM factura_items WHERE ajuste_recuperado GROUP BY ajuste_tipo ORDER BY 1;

-- ─── VISTA PREVIA (no cambia nada) ───────────────────────────────────────────
-- Cambios de precio que hay en la bitácora y a qué factura se asociarían:
-- SELECT bp.fecha, bp.usuario, bp.producto, bp.tipo, bp.monto, bp.antes, bp.nuevo, f.numero
-- FROM arj_bitacora_precios bp
-- LEFT JOIN facturas f ON f.vendedor = bp.usuario AND f.fecha >= bp.fecha AND f.fecha <= bp.fecha + INTERVAL '12 hours'
--   AND EXISTS (SELECT 1 FROM factura_items fi WHERE fi.factura_id = f.id AND fi.descripcion = bp.producto
--               AND ABS(bp.nuevo - fi.precio_unitario) < 0.011)
-- ORDER BY bp.fecha DESC;
