# Control de Capital Humano

Sistema de gestión de capital humano para QIS Servicio. Permite administrar usuarios, unidades de negocio, perfiles de acceso y módulos operativos (análisis de defectos y checklist de operación).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (puerto 5000)
- `pnpm --filter @workspace/capital-humano run dev` — Frontend (puerto variable)
- `pnpm run typecheck` — typecheck completo
- `pnpm run build` — typecheck + build todos los paquetes
- `pnpm --filter @workspace/api-spec run codegen` — regenerar hooks y schemas desde OpenAPI
- `pnpm --filter @workspace/db run push` — aplicar cambios de schema a la DB (solo dev)
- Env requeridas: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + wouter
- API: Express 5 + express-session + bcryptjs
- DB: PostgreSQL + Drizzle ORM
- Validación: Zod (zod/v4), drizzle-zod
- API codegen: Orval (desde OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — contrato único de la API (fuente de verdad)
- `lib/db/src/schema/` — esquemas Drizzle (users, udns, profiles, zones, panels, defects, sides, visualZones, alphanumeric)
- `artifacts/api-server/src/routes/` — rutas Express (auth, users, udns, profiles, zones, panels, defects, sides, visualZones, alphanumeric, dashboard)
- `artifacts/capital-humano/src/` — frontend React (páginas, contexto auth, layout con sidebar)
- `lib/api-client-react/src/custom-fetch.ts` — cliente HTTP con `credentials: 'include'` para sesiones

## Architecture decisions

- Sesiones del servidor con express-session (cookies HTTP-only). El cliente usa `credentials: 'include'` en cada fetch.
- Passwords hasheadas con bcryptjs (10 rounds).
- OpenAPI-first: spec en `lib/api-spec/openapi.yaml` genera hooks React Query y schemas Zod via Orval.
- Frontend protegido con AuthContext (wouter): rutas privadas redirigen a /login si no hay sesión.
- Paneles tienen grid cuadriculado: columnas numeradas (1, 2, 3...) y filas en letras (A, B, C...).

## Product

- Login por correo y contraseña con sesión persistente
- Panel de Control: Perfiles (CRUD con permisos por checkbox), Usuarios (CRUD), UDNs (CRUD)
- Control Módulo: Zonas Auditadas, Vista, Paneles (con visualizador de cuadrícula), Defectos, Lados, Zona Visual, Alfanumérico
- Módulo Análisis de Defectos: Dashboard con KPIs, Zonas Auditadas
- Módulo Checklist de Operación
- Superadministrador precargado: sistemas@qis-servicio.com

## User preferences

- Idioma español en toda la interfaz
- Sin emojis en la UI
- Superadmin: José Alberto Osornio Morales (sistemas@qis-servicio.com) es el único que puede crear/editar/borrar todo

## Gotchas

- Al cambiar el schema de DB, ejecutar `pnpm --filter @workspace/db run push` antes de reiniciar el servidor
- Después de cambiar `lib/api-spec/openapi.yaml`, ejecutar codegen y rebuilds libs: `pnpm run typecheck:libs`
- El cliente API necesita `credentials: 'include'` en custom-fetch.ts para que las cookies de sesión funcionen

## Pointers

- Ver skill `pnpm-workspace` para estructura del workspace, TypeScript y detalles de paquetes
