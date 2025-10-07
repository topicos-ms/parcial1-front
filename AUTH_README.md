# Sistema de Autenticación - Angular 20 + Material 3

Sistema moderno de autenticación con Login y Register implementado con Angular 20 y Angular Material 3.

## 🚀 Características

- ✅ **Login moderno y responsive** con validaciones
- ✅ **Registro de estudiantes** con generación automática de código
- ✅ **Angular Material 3** - UI moderna y atractiva
- ✅ **Formularios reactivos** con validaciones robustas
- ✅ **Signals** - Estado reactivo de Angular
- ✅ **Guards** - Protección de rutas
- ✅ **HTTP Interceptor** - Gestión automática de tokens
- ✅ **Diseño responsive** - Compatible con móviles y tablets
- ✅ **Animaciones fluidas** - Experiencia de usuario mejorada

## 📋 Estructura del Proyecto

```
src/app/auth/
├── guards/
│   └── auth.guard.ts           # Guards para protección de rutas
├── interceptors/
│   └── auth.interceptor.ts     # Interceptor HTTP para tokens
├── models/
│   └── user.model.ts           # Modelos e interfaces TypeScript
├── services/
│   └── auth.service.ts         # Servicio de autenticación
├── pages/
│   ├── login/                  # Componente de Login
│   │   ├── login.ts
│   │   ├── login.html
│   │   └── login.scss
│   └── register/               # Componente de Register
│       ├── register.ts
│       ├── register.html
│       └── register.scss
├── launcher/                   # Componente contenedor con tabs
│   ├── launcher.ts
│   ├── launcher.html
│   └── launcher.scss
└── auth.ts                     # Rutas de autenticación
```

## 🔧 Configuración

### 1. Variables de Entorno

Configura la URL de tu API en `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api'  // Cambia esto por tu API
};
```

### 2. Endpoints Requeridos

Tu backend debe implementar estos endpoints:

#### POST `/api/auth/register`
```json
{
  "email": "student@university.edu",
  "password": "Student123!",
  "firstName": "Juan",
  "lastName": "Pérez",
  "role": "STUDENT",
  "phone": "78901234",
  "studentCode": "EST20251234",
  "nationalId": "12345678",
  "birthDate": "2000-05-15T00:00:00.000Z"
}
```

**Respuesta:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "student@university.edu",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "STUDENT",
    ...
  }
}
```

#### POST `/api/auth/login`
```json
{
  "email": "student@university.edu",
  "password": "Student123!"
}
```

**Respuesta:** Misma estructura que register

## 🎨 Características del Registro

### Generación Automática de Código de Estudiante

El código de estudiante se genera automáticamente con el formato:
- **EST** + **Año actual** + **4 primeros dígitos del CI**

Ejemplo: Para CI `12345678` en 2025 → `EST20251234`

### Validaciones del Formulario

**Campos requeridos:**
- Email (formato válido)
- Contraseña (mínimo 8 caracteres, debe incluir mayúsculas, minúsculas, números y caracteres especiales)
- Confirmación de contraseña (debe coincidir)
- Nombre (mínimo 2 caracteres)
- Apellido (mínimo 2 caracteres)
- Teléfono (exactamente 8 dígitos)
- Cédula de Identidad (exactamente 8 dígitos)
- Fecha de nacimiento

### Roles de Usuario

```typescript
export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN'
}
```

Por defecto, todos los registros son con rol `STUDENT`.

## 🛡️ Seguridad

### Auth Guard

Protege rutas que requieren autenticación:

```typescript
{
  path: 'dashboard',
  canActivate: [authGuard],
  loadComponent: () => import('./dashboard/dashboard')
}
```

### Public Guard

Evita que usuarios autenticados accedan al login/register:

```typescript
{
  path: 'auth',
  canActivate: [publicGuard],
  loadChildren: () => import('./auth/auth')
}
```

### HTTP Interceptor

Agrega automáticamente el token JWT a todas las peticiones HTTP:
```typescript
Authorization: Bearer <token>
```

## 📱 Diseño Responsive

El sistema es completamente responsive con breakpoints para:
- **Desktop:** > 768px
- **Tablet:** 481px - 768px
- **Mobile:** < 480px

## 🎭 Experiencia de Usuario

- **Animaciones suaves** en transiciones
- **Feedback visual** en todos los estados (loading, error, success)
- **Indicadores de contraseña** (mostrar/ocultar)
- **Mensajes de error claros** y contextuales
- **Tabs intuitivos** para alternar entre Login y Register
- **Diseño atractivo** con gradientes y efectos visuales

## 🚀 Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm start

# Compilar para producción
npm run build
```

## 📦 Dependencias Principales

- **@angular/core**: ^20.3.0
- **@angular/material**: ^20.2.7
- **@angular/forms**: ^20.3.0
- **@angular/router**: ^20.3.0
- **rxjs**: ~7.8.0

## 🔄 Estado de la Aplicación

El estado de autenticación se maneja con **Signals**:

```typescript
// En AuthService
currentUser = signal<User | null>(null);
isAuthenticated = signal<boolean>(false);

// Uso en componentes
authService.currentUser();      // Usuario actual
authService.isAuthenticated();  // Estado de autenticación
```

## 📝 Notas Importantes

1. **studentCode** se genera automáticamente, no es necesario que el usuario lo ingrese
2. El **role** por defecto es `STUDENT`
3. Los tokens se almacenan en `localStorage`
4. La fecha de nacimiento se convierte automáticamente a formato ISO
5. El sistema redirige a `/dashboard` después de login/register exitoso

## 🎯 Próximos Pasos

Para completar el sistema, necesitarás:

1. Crear la vista de Dashboard
2. Implementar el endpoint de logout en el backend
3. Agregar funcionalidad de "Olvidé mi contraseña"
4. Implementar refresh token para sesiones largas
5. Agregar tests unitarios y e2e

## 🤝 Buenas Prácticas Implementadas

- ✅ Standalone Components (Angular 20)
- ✅ Signals para estado reactivo
- ✅ Lazy Loading de módulos
- ✅ FormBuilder y FormGroup para formularios
- ✅ Validadores personalizados
- ✅ Manejo de errores HTTP
- ✅ Separación de responsabilidades
- ✅ Código limpio y documentado
- ✅ TypeScript strict mode
- ✅ SCSS con variables y mixins

---

**Desarrollado con ❤️ usando Angular 20 + Material 3**
