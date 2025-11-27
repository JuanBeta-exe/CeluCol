/**
 * WhatsApp Notification Helpers
 * 
 * Funciones de utilidad para enviar notificaciones específicas
 * a través de la Edge Function whatsapp-notify
 */

/**
 * Estados de pedido soportados
 */
export type OrderStatus = "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED";

/**
 * Configuración base para las llamadas a la función
 */
interface WhatsAppConfig {
  functionUrl: string;
  supabaseKey?: string;
}

/**
 * Obtiene la URL de la función según el entorno
 * @returns URL base de las Supabase Functions
 */
export function getWhatsAppFunctionUrl(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL no está configurada");
  }
  return `${supabaseUrl}/functions/v1/whatsapp-notify`;
}

/**
 * Envía un mensaje de WhatsApp usando la Edge Function
 * @param phone Número de teléfono destino
 * @param message Mensaje a enviar
 * @param config Configuración opcional
 * @returns Respuesta de la función
 */
async function sendWhatsAppMessage(
  phone: string,
  message: string,
  config?: WhatsAppConfig
): Promise<Response> {
  const functionUrl = config?.functionUrl || getWhatsAppFunctionUrl();
  const supabaseKey = config?.supabaseKey || Deno.env.get("SUPABASE_ANON_KEY");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Agregar autenticación si está disponible
  if (supabaseKey) {
    headers["Authorization"] = `Bearer ${supabaseKey}`;
    headers["apikey"] = supabaseKey;
  }

  return await fetch(functionUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone, message }),
  });
}

/**
 * Envía una confirmación de pago al cliente
 * 
 * @param phone Número de teléfono del cliente en formato internacional (+57XXXXXXXXX)
 * @param orderId ID del pedido
 * @param config Configuración opcional de la función
 * @returns Promesa con la respuesta de la API
 * 
 * @example
 * ```typescript
 * await sendPaymentConfirmation("+573001234567", "ORD-12345");
 * ```
 */
export async function sendPaymentConfirmation(
  phone: string,
  orderId: string,
  config?: WhatsAppConfig
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const message = `🎉 ¡Pago confirmado!\n\nTu pedido #${orderId} fue recibido exitosamente.\n\nTe mantendremos informado sobre el estado de tu pedido.\n\n¡Gracias por tu compra! 🛍️`;

    const response = await sendWhatsAppMessage(phone, message, config);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error al enviar confirmación de pago:", errorData);
      return {
        success: false,
        error: errorData.error || "Error desconocido",
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (error) {
    console.error("Error en sendPaymentConfirmation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Obtiene el mensaje apropiado según el estado del pedido
 * @param status Estado del pedido
 * @returns Mensaje formateado
 */
function getStatusMessage(status: OrderStatus): string {
  const messages: Record<OrderStatus, string> = {
    PREPARING: "📦 Tu pedido está siendo preparado.\n\nNuestro equipo está trabajando para tener tu pedido listo lo antes posible.\n\nTe notificaremos cuando esté listo para enviar.",
    SHIPPED: "🚚 ¡Tu pedido fue enviado!\n\nYa está en camino a tu dirección.\n\nPodrás recibirlo pronto. Mantente atento a las actualizaciones de entrega.",
    DELIVERED: "✅ ¡Tu pedido fue entregado!\n\nEsperamos que disfrutes tu compra.\n\nGracias por confiar en nosotros. 😊",
    CANCELED: "❌ Tu pedido fue cancelado.\n\nSi tienes alguna pregunta o necesitas asistencia, no dudes en contactarnos.\n\nEstamos aquí para ayudarte.",
  };

  return messages[status];
}

/**
 * Envía una actualización del estado del pedido al cliente
 * 
 * @param phone Número de teléfono del cliente en formato internacional (+57XXXXXXXXX)
 * @param status Estado actual del pedido (PREPARING | SHIPPED | DELIVERED | CANCELED)
 * @param orderId ID del pedido (opcional, se incluirá en el mensaje si se proporciona)
 * @param config Configuración opcional de la función
 * @returns Promesa con la respuesta de la API
 * 
 * @example
 * ```typescript
 * await sendOrderStatusUpdate("+573001234567", "SHIPPED", "ORD-12345");
 * ```
 */
export async function sendOrderStatusUpdate(
  phone: string,
  status: OrderStatus,
  orderId?: string,
  config?: WhatsAppConfig
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    // Validar que el estado sea válido
    const validStatuses: OrderStatus[] = ["PREPARING", "SHIPPED", "DELIVERED", "CANCELED"];
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        error: `Estado inválido: ${status}. Debe ser uno de: ${validStatuses.join(", ")}`,
      };
    }

    let message = getStatusMessage(status);

    // Agregar ID del pedido si se proporciona
    if (orderId) {
      message = `Pedido #${orderId}\n\n${message}`;
    }

    const response = await sendWhatsAppMessage(phone, message, config);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error al enviar actualización de estado:", errorData);
      return {
        success: false,
        error: errorData.error || "Error desconocido",
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (error) {
    console.error("Error en sendOrderStatusUpdate:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Envía un mensaje personalizado de WhatsApp
 * 
 * @param phone Número de teléfono del cliente en formato internacional (+57XXXXXXXXX)
 * @param message Mensaje personalizado a enviar
 * @param config Configuración opcional de la función
 * @returns Promesa con la respuesta de la API
 * 
 * @example
 * ```typescript
 * await sendCustomMessage("+573001234567", "¡Tenemos una oferta especial para ti!");
 * ```
 */
export async function sendCustomMessage(
  phone: string,
  message: string,
  config?: WhatsAppConfig
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const response = await sendWhatsAppMessage(phone, message, config);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error al enviar mensaje personalizado:", errorData);
      return {
        success: false,
        error: errorData.error || "Error desconocido",
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (error) {
    console.error("Error en sendCustomMessage:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
