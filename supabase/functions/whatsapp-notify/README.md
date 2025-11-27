# WhatsApp Notification Service

Servicio de notificaciones por WhatsApp usando WhatsApp Cloud API integrado con Supabase Edge Functions.

## 📋 Contenido

- `index.ts` - Edge Function principal que maneja el envío de mensajes
- `helpers.ts` - Funciones utilitarias para notificaciones comunes
- `examples.ts` - Ejemplos de uso desde backend y frontend

## 🚀 Configuración

### 1. Variables de Entorno

Configura las siguientes variables en tu proyecto de Supabase:

```bash
# Token de acceso de WhatsApp Business API
WHATSAPP_TOKEN=tu_token_aqui

# ID del número de teléfono de WhatsApp Business
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id_aqui

# URLs de Supabase (ya deberían estar configuradas)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
```

### 2. Obtener Credenciales de WhatsApp

1. Ve a [Meta for Developers](https://developers.facebook.com/)
2. Crea una app de WhatsApp Business
3. Obtén tu `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`
4. Configura el número de WhatsApp Business

### 3. Desplegar la Función

```bash
# Desplegar la función a Supabase
supabase functions deploy whatsapp-notify

# Configurar las variables de entorno
supabase secrets set WHATSAPP_TOKEN=tu_token
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=tu_id
```

## 📡 API de la Edge Function

### Endpoint

```
POST https://tu-proyecto.supabase.co/functions/v1/whatsapp-notify
```

### Request Body

```json
{
  "phone": "+573001234567",
  "message": "Tu mensaje aquí"
}
```

### Respuesta Exitosa (200)

```json
{
  "success": true,
  "message": "Mensaje enviado exitosamente",
  "messageId": "wamid.xxxxx",
  "whatsappId": "573001234567"
}
```

### Respuesta de Error (400/500)

```json
{
  "error": "Descripción del error",
  "details": "Detalles adicionales"
}
```

## 🛠️ Funciones Helpers

### `sendPaymentConfirmation(phone, orderId)`

Envía una confirmación de pago al cliente.

```typescript
import { sendPaymentConfirmation } from "./helpers.ts";

const result = await sendPaymentConfirmation("+573001234567", "ORD-12345");

if (result.success) {
  console.log("Notificación enviada:", result.messageId);
}
```

**Mensaje enviado:**
```
🎉 ¡Pago confirmado!

Tu pedido #ORD-12345 fue recibido exitosamente.

Te mantendremos informado sobre el estado de tu pedido.

¡Gracias por tu compra! 🛍️
```

### `sendOrderStatusUpdate(phone, status, orderId?)`

Envía una actualización del estado del pedido.

```typescript
import { sendOrderStatusUpdate } from "./helpers.ts";

const result = await sendOrderStatusUpdate(
  "+573001234567",
  "SHIPPED",
  "ORD-12345"
);
```

**Estados disponibles:**

- `PREPARING` - "Tu pedido está siendo preparado."
- `SHIPPED` - "¡Tu pedido fue enviado!"
- `DELIVERED` - "¡Tu pedido fue entregado!"
- `CANCELED` - "Tu pedido fue cancelado."

### `sendCustomMessage(phone, message)`

Envía un mensaje personalizado.

```typescript
import { sendCustomMessage } from "./helpers.ts";

const result = await sendCustomMessage(
  "+573001234567",
  "¡Tenemos una oferta especial para ti!"
);
```

## 📝 Ejemplos de Uso

### Desde Backend (Edge Function)

```typescript
import { sendPaymentConfirmation } from "./helpers.ts";

// En tu función de procesamiento de pagos
async function handlePayment(paymentData: any) {
  // Procesar el pago...
  
  // Enviar confirmación
  await sendPaymentConfirmation(
    paymentData.customerPhone,
    paymentData.orderId
  );
}
```

### Desde Frontend (React/Vite)

```typescript
// src/utils/whatsapp.ts
export async function sendWhatsAppNotification(phone: string, message: string) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-notify`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ phone, message }),
    }
  );
  
  return await response.json();
}

// En tu componente
const result = await sendWhatsAppNotification(
  "+573001234567",
  "¡Tu pedido fue confirmado!"
);
```

### Con Supabase Client

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const { data, error } = await supabase.functions.invoke("whatsapp-notify", {
  body: {
    phone: "+573001234567",
    message: "Tu mensaje aquí",
  },
});
```

## 🔒 Seguridad

- La función valida el formato de números de teléfono (internacional)
- Verifica que los mensajes no estén vacíos
- Maneja errores de forma segura sin exponer información sensible
- Las credenciales de WhatsApp se mantienen en variables de entorno

## ⚠️ Consideraciones

- Los números de teléfono deben estar en formato internacional: `+[código_país][número]`
- Ejemplo para Colombia: `+573001234567`
- WhatsApp tiene límites de rate limiting - ten cuidado con el volumen de mensajes
- Solo se pueden enviar mensajes a números que hayan iniciado conversación con tu número de WhatsApp Business (excepto con templates aprobados)

## 🧪 Testing

Prueba la función localmente:

```bash
# Ejecutar función localmente
supabase functions serve whatsapp-notify

# Probar con curl
curl -X POST http://localhost:54321/functions/v1/whatsapp-notify \
  -H "Content-Type: application/json" \
  -d '{"phone":"+573001234567","message":"Test message"}'
```

## 📚 Recursos

- [WhatsApp Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)

## 🤝 Soporte

Si tienes problemas:

1. Verifica que las variables de entorno estén configuradas correctamente
2. Asegúrate de que tu número de WhatsApp Business esté activado
3. Revisa los logs de la función: `supabase functions logs whatsapp-notify`
4. Consulta los ejemplos en `examples.ts` para casos de uso comunes
