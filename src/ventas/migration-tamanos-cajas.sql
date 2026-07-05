-- ══ MIGRACIÓN — Tamaños y cajas de 180 en ventas/pedidos/bodega ══════════
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (proyecto xewujmpycclqjhlmiica),
-- DESPUÉS de ventas-schema.sql y pedidos-bodega-schema.sql.
-- Es incremental y seguro: usa "if not exists", no borra ni toca datos.

-- Tamaño del huevo por movimiento. 'mixto' = sin especificar (afecta el total
-- pero no un tamaño concreto). Los 6 tamaños calzan con las columnas de la
-- tabla registros (chico, mediano, grande, xl, super_xl, jumbo).
alter table ventas        add column if not exists tamano text default 'mixto';
alter table pedidos       add column if not exists tamano text default 'mixto';
alter table ajustes_stock add column if not exists tamano text default 'mixto';

-- Cajas de 180 huevos (= 6 bandejas). Se guarda como referencia de cómo se
-- ingresó; el total real sigue en huevos_total.
alter table ventas  add column if not exists cajas numeric(10,2) default 0;
alter table pedidos add column if not exists cajas numeric(10,2) default 0;
