/**
 * Ejemplos de uso de WhatsApp Notification Service
 * 
 * Este archivo contiene ejemplos de cómo usar las funciones de WhatsApp
 * desde diferentes contextos (Backend y Frontend)
 */

// ============================================================================
// EJEMPLO 1: USO DESDE BACKEND (Otra Edge Function)
// ============================================================================

/**
 * Ejemplo: Enviar notificación después de confirmar un pago
 * 
 * Uso desde una Edge Function de procesamiento de pagos
 */

import { sendPaymentConfirmation, sendOrderStatusUpdate } from "./helpers.ts";

// Ejemplo 1.1: Notificación de pago confirmado
async function handlePaymentConfirmation(orderId: string, customerPhone: string) {
  try {
    // Enviar confirmación de pago
    const result = await sendPaymentConfirmation(customerPhone, orderId);
    
    if (result.success) {
      console.log(`Notificación enviada exitosamente. Message ID: ${result.messageId}`);
      return { success: true };
    } else {
      console.error(`Error al enviar notificación: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error("Error en handlePaymentConfirmation:", error);
    return { success: false, error: "Error inesperado" };
  }
}

// Ejemplo 1.2: Actualización de estado de pedido
async function handleOrderStatusChange(
  orderId: string,
  customerPhone: string,
  newStatus: "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED"
) {
  try {
    const result = await sendOrderStatusUpdate(customerPhone, newStatus, orderId);
    
    if (result.success) {
      console.log(`Actualización de estado enviada. Message ID: ${result.messageId}`);
      return { success: true };
    } else {
      console.error(`Error al enviar actualización: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error("Error en handleOrderStatusChange:", error);
    return { success: false, error: "Error inesperado" };
  }
}

// Ejemplo 1.3: Uso completo en una función de pago
async function processPaymentWithNotification(paymentData: any) {
  try {
    // 1. Procesar el pago (lógica de pago aquí)
    const paymentResult = { success: true, orderId: "ORD-12345" };
    
    if (paymentResult.success) {
      // 2. Enviar confirmación de pago
      await sendPaymentConfirmation("+573001234567", paymentResult.orderId);
      
      // 3. Actualizar estado a "preparando"
      await sendOrderStatusUpdate("+573001234567", "PREPARING", paymentResult.orderId);
    }
    
    return paymentResult;
  } catch (error) {
    console.error("Error al procesar pago:", error);
    throw error;
  }
}

// ============================================================================
// EJEMPLO 2: USO DIRECTO DE LA EDGE FUNCTION (Llamada HTTP)
// ============================================================================

/**
 * Ejemplo 2.1: Desde otra Edge Function usando fetch directo
 */
async function sendWhatsAppDirectFromBackend(phone: string, message: string) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // Usar service role en backend
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "apikey": SUPABASE_KEY!,
      },
      body: JSON.stringify({
        phone: phone,
        message: message,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Error al enviar WhatsApp: ${error.error}`);
    }
    
    const data = await response.json();
    console.log("Mensaje enviado:", data);
    return data;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

// Ejemplo 2.2: Integración en un webhook de pagos
async function paymentWebhookHandler(req: Request) {
  try {
    const paymentData = await req.json();
    
    // Procesar lógica de pago...
    
    // Enviar notificación
    if (paymentData.status === "approved") {
      await sendWhatsAppDirectFromBackend(
        paymentData.customer_phone,
        `¡Pago confirmado! Tu pedido #${paymentData.order_id} fue recibido.`
      );
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error en webhook:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ============================================================================
// EJEMPLO 3: USO DESDE FRONTEND (React/Vite)
// ============================================================================

/**
 * Archivo: src/utils/whatsapp.ts
 * 
 * Utilidades para enviar notificaciones de WhatsApp desde el frontend
 */

// Ejemplo 3.1: Función utilitaria para el frontend
export async function sendWhatsAppNotification(
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Obtener configuración de Supabase desde variables de entorno de Vite
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ phone, message }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || "Error al enviar mensaje",
      };
    }
    
    await response.json();
    return { success: true };
  } catch (error) {
    console.error("Error al enviar WhatsApp:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

// Ejemplo 3.2: Hook de React para notificaciones
import { useState } from "react";

export function useWhatsAppNotification() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sendNotification = async (phone: string, message: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await sendWhatsAppNotification(phone, message);
      
      if (!result.success) {
        setError(result.error || "Error al enviar notificación");
        return false;
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  return { sendNotification, loading, error };
}

// Ejemplo 3.3: Uso en un componente de React
function CheckoutComponent() {
  const { sendNotification, loading, error } = useWhatsAppNotification();
  
  const handlePaymentSuccess = async (orderId: string, customerPhone: string) => {
    // Enviar confirmación de pago
    const success = await sendNotification(
      customerPhone,
      `🎉 ¡Pago confirmado! Tu pedido #${orderId} fue recibido.`
    );
    
    if (success) {
      console.log("Notificación enviada exitosamente");
      // Mostrar mensaje de éxito al usuario
    } else {
      console.error("Error al enviar notificación:", error);
      // El pago fue exitoso pero la notificación falló
      // Decidir si mostrar un warning al usuario
    }
  };
  
  return (
    <div>
      {/* UI del componente */}
      {loading && <p>Enviando notificación...</p>}
      {error && <p>Error: {error}</p>}
    </div>
  );
}

// Ejemplo 3.4: Uso directo en un evento de botón
async function handleSendOrderUpdate() {
  const phone = "+573001234567";
  const message = "Tu pedido está siendo preparado.";
  
  const result = await sendWhatsAppNotification(phone, message);
  
  if (result.success) {
    alert("Notificación enviada exitosamente");
  } else {
    alert(`Error: ${result.error}`);
  }
}

// Ejemplo 3.5: Uso con async/await en un formulario
async function handleSubmitOrder(formData: FormData) {
  const phone = formData.get("phone") as string;
  const orderId = formData.get("orderId") as string;
  
  try {
    // Crear el pedido en la base de datos...
    
    // Enviar confirmación
    const result = await sendWhatsAppNotification(
      phone,
      `¡Pedido #${orderId} creado exitosamente! Te mantendremos informado.`
    );
    
    if (result.success) {
      console.log("Cliente notificado");
    }
  } catch (error) {
    console.error("Error al procesar pedido:", error);
  }
}

// ============================================================================
// EJEMPLO 4: USO CON SUPABASE CLIENT
// ============================================================================

import { createClient } from "@supabase/supabase-js";

// Ejemplo 4.1: Desde el frontend con Supabase Client
async function sendNotificationWithSupabaseClient(phone: string, message: string) {
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  
  try {
    const { data, error } = await supabase.functions.invoke("whatsapp-notify", {
      body: { phone, message },
    });
    
    if (error) {
      console.error("Error al enviar notificación:", error);
      return { success: false, error: error.message };
    }
    
    console.log("Notificación enviada:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Error inesperado:", error);
    return { success: false, error: "Error inesperado" };
  }
}

// Ejemplo 4.2: Uso en una acción después de crear un pedido
async function createOrderAndNotify(orderData: any) {
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  
  try {
    // 1. Crear pedido en la base de datos
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([orderData])
      .select()
      .single();
    
    if (orderError) throw orderError;
    
    // 2. Enviar notificación de WhatsApp
    await supabase.functions.invoke("whatsapp-notify", {
      body: {
        phone: orderData.customer_phone,
        message: `¡Gracias por tu pedido #${order.id}! Lo estamos procesando.`,
      },
    });
    
    return { success: true, order };
  } catch (error) {
    console.error("Error:", error);
    return { success: false, error };
  }
}

// ============================================================================
// EJEMPLO 5: TESTING / DEBUGGING
// ============================================================================

// Ejemplo 5.1: Función de prueba simple
async function testWhatsAppNotification() {
  const testPhone = "+573001234567"; // Reemplazar con tu número de prueba
  const testMessage = "Este es un mensaje de prueba desde CeluCol 🚀";
  
  console.log("Enviando mensaje de prueba...");
  const result = await sendWhatsAppNotification(testPhone, testMessage);
  
  if (result.success) {
    console.log("✅ Mensaje enviado exitosamente");
  } else {
    console.error("❌ Error:", result.error);
  }
}

// Ejemplo 5.2: Prueba de todos los estados de pedido
async function testAllOrderStatuses() {
  const testPhone = "+573001234567";
  const testOrderId = "TEST-001";
  
  const statuses: Array<"PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED"> = [
    "PREPARING",
    "SHIPPED",
    "DELIVERED",
  ];
  
  for (const status of statuses) {
    console.log(`Probando estado: ${status}`);
    
    const message = getStatusMessageForTesting(status);
    const result = await sendWhatsAppNotification(
      testPhone,
      `Pedido #${testOrderId}\n\n${message}`
    );
    
    console.log(result.success ? "✅" : "❌", status);
    
    // Esperar 2 segundos entre mensajes para evitar rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

function getStatusMessageForTesting(status: string): string {
  const messages: Record<string, string> = {
    PREPARING: "Tu pedido está siendo preparado.",
    SHIPPED: "¡Tu pedido fue enviado!",
    DELIVERED: "¡Tu pedido fue entregado!",
    CANCELED: "Tu pedido fue cancelado.",
  };
  return messages[status] || "Estado desconocido";
}
