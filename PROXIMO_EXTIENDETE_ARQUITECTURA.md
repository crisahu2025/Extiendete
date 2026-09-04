# 📌 ARQUITECTURA OFICIAL — PRÓXIMO EVENTO EXTIÉNDETE
**Directiva de Cristian — Code Ahumada & Iglesia Gran Rey**

Este documento establece la arquitectura técnica obligatoria para el **próximo evento Extiéndete**. Cuando se reactive la venta de entradas de Extiéndete, el sistema **no volverá al modelo anterior**, sino que adoptará al 100% el flujo probado y validado de **LUMINATE**.

---

## 🚀 1. PILARES FUNDAMENTALES DEL NUEVO SISTEMA

1. **Captura Obligatoria de Datos de Contacto**:
   - **Correo Electrónico (`buyerEmail`)**: Obligatorio para recibir las entradas y comprobante digital.
   - **Teléfono / WhatsApp (`buyerPhone`)**: Obligatorio para validaciones, avisos y soporte el día del evento.
   - **Iglesia / Ciudad (`city`)**: Congregación de procedencia.
   - **Pastor (`pastor`)**: Nombre del pastor de la congregación.
   - **Lista de Asistentes (`names`)**: Nombres completos para cada entrada adquirida.

2. **Envío Automático de Comprobante Oficial**:
   - Tras la aprobación del pago por Mercado Pago (Webhook IPN), el servidor dispara automáticamente un correo HTML con diseño premium.
   - **Destinatario Principal**: El email ingresado por el comprador (`buyerEmail`).
   - **Copia Oficial de Control**: Se envía copia automática u oculta a **`facturacion@iglesiagranrey.com`** para registro administrativo, prueba contable y conciliación de caja.

3. **Checkout Atómico (1 sola llamada servidor)**:
   - Reemplaza el doble paso de registro + preferencia por un guardado atómico en lote (`checkout_atomico`) protegido con `LockService` y sanitización contra inyecciones de fórmulas.

4. **Depuración Total de Telegram**:
   - Todo el soporte de Telegram queda oficialmente dado de baja. La consulta, validación y entrega de pulseras y libros se gestiona de forma exclusiva a través de la web de **Acreditación** (`/acreditacion/`).

---

## 📊 2. ESTRUCTURA DE LA PLANILLA (GOOGLE SHEETS)

La hoja de cálculo para el próximo Extiéndete registrará los datos organizados de la siguiente forma:

| Columna | Campo | Descripción |
| :---: | :--- | :--- |
| **A (1)** | `Entrada` | Tipo de entrada (*Individual, General, etc.*) |
| **B (2)** | `Fecha de pago` | Fecha y hora exacta |
| **C (3)** | `Nombre de la persona` | Nombre y apellido del asistente |
| **D (4)** | `Ciudad / Iglesia` | Ciudad y congregación |
| **E (5)** | `Monto que pagó` | Importe en pesos |
| **F (6)** | `ID Mercado Pago` | Código de pago de MP (*o 'EFECTIVO PUERTA'*) |
| **G (7)** | `Se entregó pulsera` | Estado: `"SI"` o `"NO"` |
| **H (8)** | `Usuario que entrega` | Nombre del colaborador en mesa |
| **I (9)** | `Fecha y hora entrega` | Timestamp de entrega |
| **J (10)** | `Pastor` | Nombre del pastor |
| **K (11)** | `Contacto Comprador` | Formato: `email@dominio.com \| +549...` |
| **L (12)** | `External Reference` | Identificador único de transacción (*ej: EXT-...*) |
| **M (13)** | `Pago Exitoso` | `"PAGO APROBADO ✅"` o `"PAGO EN EFECTIVO ✅"` |

---

## 📧 3. INTEGRACIÓN CON CORREO DE FACTURACIÓN

En el backend de Google Apps Script (`SCRIPT_PROXIMO_EXTIENDETE.gs`), la función de despacho de correos se configura de la siguiente manera:

```javascript
const EMAIL_FACTURACION = "facturacion@iglesiagranrey.com";

function enviarComprobantePorEmail(destinatario, ref, paymentId, asistentes, totalMonto, ciudad, pastor) {
  const asunto = "🎟️ Tu Comprobante y Entradas - EXTIÉNDETE";
  // Generación de HTML con resumen de compra y asistentes...
  
  GmailApp.sendEmail(destinatario, asunto, "Tu pago para EXTIÉNDETE fue confirmado con éxito. Ref: " + ref, {
    htmlBody: htmlBody,
    bcc: EMAIL_FACTURACION // Copia automática a facturación de la Iglesia
  });
}
```

---

## 📂 4. ARCHIVOS PREPARADOS EN ESTE REPOSITORIO

- **[`proximo-extiendete/index.html`](file:///c:/Users/Code%20Ahumada/Desktop/Proyectos%20de%20Mi%20Empresa%20CodeAhumada/PAGINA%20ONLINE%20EXTIENDETE/proximo-extiendete/index.html)**: Plantilla web completa con inputs de Email, Teléfono, Pastor, Ciudad, selección de entradas y checkout atómico.
- **[`proximo-extiendete/SCRIPT_PROXIMO_EXTIENDETE.gs`](file:///c:/Users/Code%20Ahumada/Desktop/Proyectos%20de%20Mi%20Empresa%20CodeAhumada/PAGINA%20ONLINE%20EXTIENDETE/proximo-extiendete/SCRIPT_PROXIMO_EXTIENDETE.gs)**: Backend unificado de Google Apps Script con comprobante HTML, envío a comprador y copia a `facturacion@iglesiagranrey.com`.
