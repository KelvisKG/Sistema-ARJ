# 🚜 Sistema ARJ — Repuestos Agrícolas

Sistema integral de facturación, punto de venta (POS), inventario multialmacén, costeo landed de importaciones, cuentas por cobrar, arqueo de caja chica y reportería fiscal diseñado a la medida para **Repuestos Agrícolas ARJ** (operando bajo doble empresa: **Venta Directa** y **Distribuidora**).

Plataforma administrativa con respaldo en la nube y arquitectura moderna para alta disponibilidad y escalabilidad.

---

## 🚀 Inicio Rápido y Despliegue Local

Sigue estos pasos para instalar y levantar el sistema en un equipo local o servidor de pruebas.

### 1. Requisitos Previos
* **Node.js**: v18.0 o superior (recomendado Node LTS v20+).
* **Navegador**: Cualquier navegador web moderno (Chrome, Edge, Firefox).
* **Git** (Opcional, para control de versiones).

### 2. Instalación de Dependencias
Abre una terminal en la carpeta raíz del proyecto (`ARJ-SISTEMA-main`) y ejecuta:
```bash
npm install
```
Esto descargará e instalará todas las librerías necesarias.

### 3. Configuración de Base de Datos
El sistema utiliza Supabase como base de datos en la nube.
1. Crea un archivo llamado `.env` en la raíz del proyecto.
2. Añade tus credenciales de conexión (obtenidas desde tu panel de Supabase):
```env
VITE_SUPABASE_URL="https://TU_PROYECTO.supabase.co"
VITE_SUPABASE_KEY="TU_CLAVE_ANONIMA_PUBLICA"
```

### 4. Iniciar Servidor de Desarrollo
Para arrancar el sistema en tiempo real y comenzar a trabajar:
```bash
npm run dev
```
La aplicación estará disponible de inmediato en: 👉 **`http://localhost:5173/`**

### 5. Compilación para Producción
Para empaquetar el sistema y subirlo a un hosting (como Vercel, Netlify, o un servidor propio con Nginx):
```bash
npm run build
```
Los archivos finales y optimizados quedarán dentro de la carpeta `/dist`.

---

## 📋 Módulos y Funcionalidades Principales

El sistema integra con exactitud matemática y funcional cada una de las capacidades requeridas por ARJ:

### 1. 🧾 Facturación y Punto de Venta (POS)
* **5 Métodos de Búsqueda y Captura de Repuestos:** Búsqueda Normal, Por Aplicación, Lector de Códigos de Barras, Favoritos, e Importación Masiva.
* **Modo Caja Express (POS)**: Pantalla optimizada para mostrador rápido con teclado numérico en pantalla.
* **Simulador de Descuento en Divisas**: Cálculo automático de brecha cambiaria (BCV vs Dólar Efectivo).
* **Pagos Múltiples**: Desglose simultáneo de pagos en efectivo ($ Verde), Pago Móvil, Zelle y Transferencias.
* **Generación de PDFs y Tickets**: Emisión de comprobantes formales listos para imprimir.

### 2. 📦 Inventario Multialmacén y Costeo
* **Existencias Multi-Depósito**: Control independiente de existencias para **Venta Directa** y **Distribuidora**.
* **Traspasos**: Transferencia inmediata de stock entre depósitos.
* **Embarques y Costeo Landed**: Registro de importaciones, fletes y cálculo de aranceles para determinar el factor landed real.
* **Descarga de Precios a Excel (.xlsx)**: Generador de listas de precios según el nivel de cliente.

### 3. 💳 Cuentas por Cobrar (CxC)
* **Semáforo de Vencimiento**: Identificación visual por colores según días de atraso.
* **Abonos Multimoneda**: Registro de pagos parciales/totales calculados a la tasa de la fecha de cobro.
* **Estados de Cuenta**: Exportación del historial financiero de cada cliente.

### 4. 📝 Cotizaciones y Presupuestos
* **Emisión de Cotizaciones**: Generación en PDF con 45 días de validez.
* **Conversión Directa**: Transformación de cotización a factura activa deduciendo inventario.

### 5. 🕒 Turnos de Caja y Arqueo
* **Monitoreo**: Visualización de cobros realizados en el turno activo.
* **Cierre Automático**: Cuadre de caja y generación inmediata de **Acta de Cierre en PDF**.

### 6. 📊 Reportes Gerenciales y BI
* Análisis cruzado de rendimiento entre Venta Directa y Distribuidora.
* Ranking de clientes.
* Asistente de reorden basado en stock mínimo.
* Exportación Fiscal para libros del SENIAT (en Excel .xlsx).

### 7. 🔒 Seguridad y Configuración
* Sistema respaldado por base de datos segura y roles de acceso.
* Archivo `.env` oculto para evitar fuga de credenciales.
* Monitor de tasas cambiarias (Tasa BCV y Tasa Libre) con bloqueo de ventas sin tasas actualizadas.

---

## 🗄️ Arquitectura y Datos

* **Frontend**: Framework JavaScript de alto rendimiento (SPA).
* **Lógica Financiera**: Aislada en motores especializados para precisión flotante.
* **Backend**: Base de Datos PostgreSQL gestionada mediante Supabase.
* **Sincronización Inicial**: Si necesitas cargar la base de datos desde cero, ejecuta el script `supabase_setup.sql` en el SQL Editor de tu proyecto de Supabase.

---

© 2026 **Repuestos Agrícolas ARJ** — Uso administrativo exclusivo.
