
# CeluCol - Aplicación de E-commerce

Aplicación web de comercio electrónico construida con React, Vite y Supabase. Permite la gestión de productos, carrito de compras, y procesamiento de pedidos con diferentes métodos de pago.

## Características

### Para Clientes
- 🛍️ Catálogo de productos con búsqueda
- 🛒 Carrito de compras
- 💳 Múltiples métodos de pago (tarjeta y transferencia)
- 📦 Seguimiento de pedidos
- 👤 Gestión de cuenta de usuario

### Para Administradores
- ✨ Panel de administración
- 📝 CRUD de productos
- 📊 Gestión de pedidos
- 🔄 Actualización de estados de pedidos

## Stack Tecnológico

### Frontend
- **React** - Framework de UI
- **Vite** - Build tool y dev server
- **TypeScript** - Tipado estático
- **Radix UI** - Componentes base accesibles
- **Lucide Icons** - Iconografía
- **TailwindCSS** - Estilado
- **Sonner** - Notificaciones

### Backend
- **Supabase** - Base de datos y autenticación
- **Hono** - Framework para Edge Functions
- **KV Store** - Almacenamiento key-value

## Requisitos Previos

- Node.js 18.x o superior
- npm 7.x o superior
- Una cuenta en Supabase

## Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/JuanBeta-exe/El-Faro-del-Saber.git
cd "Ecommerce Web Application"
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
   Crear un archivo `.env` con:
```env
VITE_SUPABASE_PROJECT_ID=tu_project_id
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

## Desarrollo

Iniciar el servidor de desarrollo:
```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:5173](http://localhost:5173)

## Construcción

Para crear una build de producción:
```bash
npm run build
```

Los archivos de la build se generarán en la carpeta `dist`.

## Estructura del Proyecto

```
├── src/
│   ├── components/         # Componentes React
│   │   ├── ui/            # Componentes base UI
│   │   └── ...           
│   ├── supabase/          # Configuración y funciones de Supabase
│   │   └── functions/     # Edge Functions
│   ├── utils/             # Utilidades y helpers
│   ├── App.tsx           # Componente principal
│   └── main.tsx          # Punto de entrada
├── public/               # Archivos estáticos
└── package.json         # Dependencias y scripts
```

## Componentes Principales

### AuthModal
Maneja la autenticación de usuarios con:
- Registro de nuevos usuarios
- Inicio de sesión
- Roles (cliente/administrador)

### ProductCard
Muestra productos con:
- Imagen
- Nombre
- Descripción
- Precio
- Acciones según rol

### CartSheet
Gestiona el carrito de compras:
- Lista de productos
- Cantidades
- Subtotal y total
- Proceso de checkout

### CheckoutModal
Procesa pagos con:
- Múltiples métodos de pago
- Formulario de envío
- Resumen de la orden

### OrdersView
Visualización de pedidos:
- Lista de órdenes
- Detalles de productos
- Estados y seguimiento
- Gestión de estados (admin)

## API y Endpoints

### Autenticación
- `POST /signup` - Registro de usuarios
- `POST /signin` - Inicio de sesión

### Productos
- `GET /products` - Listar productos
- `POST /products` - Crear producto (admin)
- `PUT /products/:id` - Actualizar producto (admin)
- `DELETE /products/:id` - Eliminar producto (admin)

### Carrito
- `GET /cart` - Obtener carrito
- `POST /cart` - Agregar al carrito
- `PUT /cart/:productId` - Actualizar cantidad
- `DELETE /cart/:productId` - Eliminar del carrito

### Pedidos
- `POST /orders` - Crear pedido
- `GET /orders` - Listar pedidos
- `PUT /orders/:id/status` - Actualizar estado (admin)

## Contribuir

1. Fork el repositorio
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Contacto

Juan Beta - [@JuanBeta](https://github.com/JuanBeta-exe)

Link del proyecto: [https://github.com/JuanBeta-exe/El-Faro-del-Saber](https://github.com/JuanBeta-exe/El-Faro-del-Saber)
  
