# ShipNow API (Backend III)

ShipNow es una API para gestionar usuarios, pedidos y entregas, y asociarles documentos y comprobantes. Esta versión consolida el flujo de negocio, las pruebas, el logging, Swagger y Docker.

## Estado de entrega

Esta es la versión final que preparé para la entrega. Acá están reunidas las
funcionalidades trabajadas durante el curso y las instrucciones para ejecutar
y probar la API.

## Objetivo del proyecto

La API permite trabajar con:

- usuarios con documentos personales
- comprobantes asociados a órdenes y entregas
- validación de tipo y tamaño de archivo
- archivos guardados en una carpeta configurable fuera del repositorio
- registro de metadatos únicamente en base de datos

## Stack técnico

- Node.js + Express
- MongoDB + Mongoose
- Multer para carga de archivos multipart/form-data
- Swagger (`swagger-jsdoc`, `swagger-ui-express`)
- Winston para logs estructurados
- Faker para generación de datos mock

## Arquitectura

Flujo principal:

`routes -> controllers -> services -> repositories -> models`

Estructura relevante:

- `src/routes/` endpoints HTTP
- `src/controllers/` capa HTTP
- `src/services/` reglas de negocio
- `src/repositories/` acceso a datos
- `src/models/` esquemas Mongoose
- `src/middlewares/` middlewares de upload, errores, logging y 404
- `src/utils/` logger y utilidades de errores
- `src/config/` configuración de entorno y Swagger
- `UPLOAD_BASE_DIR/` directorio de almacenamiento documental configurable (fuera del repo por default)

## Requisitos

- Node.js 20+
- MongoDB local o remoto

## Instalación y ejecución

1. Instalar dependencias:

```bash
npm install
```

2. Crear variables de entorno:

```bash
# Linux/macOS/Git Bash
cp .env.example .env

# PowerShell (Windows)
Copy-Item .env.example .env
```

3. Levantar en desarrollo:

```bash
npm run dev
```

4. Swagger UI:

- `http://localhost:3003/api/docs`
- `http://localhost:3003/api-docs`

Si `AUTH_REQUIRED=true`, los endpoints protegidos deben usarse con:

`Authorization: Bearer <token>`

## Variables de entorno

| Variable | Requerida | Descripción | Valor por defecto |
| --- | --- | --- | --- |
| `PORT` | No | Puerto HTTP de la API | `3003` |
| `CLIENT_URL` | Sí en producción | Origen HTTP/HTTPS autorizado para solicitudes CORS del navegador, sin ruta | `http://localhost:3000` en desarrollo y tests |
| `MONGODB_URI` | Sí (desarrollo/producción) | URI de conexión a MongoDB | Sin valor por defecto; completar en `.env` |
| `MONGO_URI_TEST` | Sí (test, o usar `MONGODB_URI_TEST`) | URI local de MongoDB para tests; la base debe incluir `test` en el nombre | Sin default; completar en `.env.test` |
| `NODE_ENV` | No | Entorno (`development`, `test`, `production`) | `development` |
| `LOG_LEVEL` | No | Nivel mínimo de logging (`fatal,error,warning,info,http,debug`) | `info` |
| `REQUEST_BODY_LIMIT` | No | Límite de payload JSON/urlencoded para evitar cuerpos excesivos | `1mb` |
| `JWT_SECRET` | Condicional | Clave para verificar JWT cuando `AUTH_REQUIRED=true` | `""` |
| `AUTH_REQUIRED` | No | Exige `Authorization: Bearer <token>` en endpoints protegidos (en producción no se puede deshabilitar) | `false` (`true` por defecto en `production`) |
| `REQUIRE_REPLICASET_TRANSACTIONS` | No | Obliga soporte de transacciones MongoDB al iniciar | `false` en desarrollo y tests; `true` en `production` |
| `INTERNAL_ROUTES_ENABLED` | No | Habilita rutas internas `/api/mocks` y `/api/logger` | `true` fuera de `production` |
| `SWAGGER_ENABLED` | No | Habilita `/api/docs` y `/api-docs` | `true` fuera de `production` |
| `UPLOAD_BASE_DIR` | No | Directorio base para los archivos (recomendado fuera del repo) | `../shipnow-uploads` |
| `EXTERNAL_SERVICE_BASE_URL` | No | URL base de servicios externos integrados | Sin valor por defecto |

`.env.example` sirve como base para desarrollo y `.env.test.example` para tests.
En producción, configura estas variables en el entorno de despliegue o en un
gestor de secretos. `CLIENT_URL` debe ser el origen exacto del frontend; CORS
solo permite ese origen. En desarrollo y tests, si no se define, se usa
`http://localhost:3000`. La API valida `MONGODB_URI` (o `MONGO_URI_TEST` en
tests), `CLIENT_URL`, el puerto y los booleanos. Si la autenticación está
activa, también requiere `JWT_SECRET`. Si falta una variable obligatoria o su
valor no es válido, la aplicación no inicia. En producción, usa un secreto
distinto al de pruebas.

## Scripts

| Comando | Uso |
| --- | --- |
| `npm run dev` | Levanta servidor con nodemon |
| `npm start` | Levanta servidor con node |
| `npm test` | Ejecuta pruebas unitarias y funcionales |
| `npm run test:unit` | Ejecuta pruebas unitarias con Node.js |
| `npm run test:functional` | Ejecuta pruebas funcionales con Mocha, Chai y Supertest |

## Política de autorización

- Endpoints de escritura (`POST`, `PUT`, `DELETE`) usan middleware de roles y JWT cuando `AUTH_REQUIRED=true`.
- Endpoints de lectura (`GET`) se mantienen públicos por diseño en esta entrega.
- En producción, la app no inicia si `AUTH_REQUIRED=false`.
- En producción `AUTH_REQUIRED` queda activo por defecto y exige `JWT_SECRET`.

## Performance y escalabilidad

- Endpoints de listados (`/api/users`, `/api/orders`, `/api/deliveries` y `/api/products`) aplican paginación con:
  - `page` (default `1`)
  - `limit` (default `20`, máximo `100`)
- Filtros soportados:
  - Users: `role`, `email`
  - Orders: `status`, `priority`, `customer`
  - Deliveries: `status`, `driver`, `order`
- Products: productos disponibles con stock; `includeInactive=true` amplía el listado.
- Los uploads aceptan PDF, PNG y JPEG, con un máximo de 5 MB por archivo y errores normalizados en [uploadFileMiddleware.js](./src/middlewares/uploadFileMiddleware.js).
- Uploads fuera del repo vía `UPLOAD_BASE_DIR`.

## Criterio de rutas internas en producción

- `INTERNAL_ROUTES_ENABLED=false` deshabilita `/api/mocks` y `/api/logger`.
- `SWAGGER_ENABLED=false` deshabilita `/api/docs` y `/api-docs`.
- En producción, ambas opciones quedan en `false` por defecto.

## Producción y Docker

### Archivos

- [Dockerfile](./Dockerfile)
- [.dockerignore](./.dockerignore)

### Build de imagen

```bash
docker build -t shipnow-api:local .
```

La imagen usa un build multi-stage: instala dependencias de producción en una
etapa y copia solo `node_modules`, `package.json` y `src/` a la imagen final.
El runner usa Node.js 22, ejecuta como usuario no-root y expone el puerto `3003`.

### Ejecutar con una base MongoDB externa

```bash
docker run --rm -p 3003:3003 --env-file .env.production -v shipnow-uploads:/shipnow-uploads shipnow-api:local
```

`.env.production` debe mantenerse fuera del repositorio y contener como mínimo
`NODE_ENV=production`, `PORT=3003`, `MONGODB_URI`, `CLIENT_URL`, `JWT_SECRET` y
`LOG_LEVEL=info`. `CLIENT_URL` es el origen del frontend, sin ruta.
`AUTH_REQUIRED` no puede ser `false` en producción. La URI de MongoDB debe ser
accesible desde el contenedor (no uses `localhost` para una base que corre en
el host) y soportar transacciones (replica set o mongos), como requiere
`REQUIRE_REPLICASET_TRANSACTIONS=true` por defecto. También puedes inyectar las
variables desde la plataforma de despliegue en lugar de usar un archivo.

Para desarrollo local con MongoDB incluido:

```bash
docker compose up --build
```

Compose publica la API en `http://localhost:3003` y conserva la base y los
uploads en volúmenes. Puedes cambiar el puerto expuesto en el host con
`API_HOST_PORT` sin modificar el puerto interno de la API.

### Verificaciones

- Health check: `GET http://localhost:3003/api/health`
- Swagger: `GET http://localhost:3003/api/docs` (habilitado en desarrollo y tests;
  deshabilitado por defecto en producción)
- Endpoint principal: `GET http://localhost:3003/api/users?page=1&limit=20`

### Rutas internas, logs y archivos

- En producción, `/api/mocks` y `/api/logger` quedan deshabilitados por defecto
  (`INTERNAL_ROUTES_ENABLED=false`); Swagger también queda deshabilitado
  (`SWAGGER_ENABLED=false`). Se pueden habilitar explícitamente si el despliegue
  lo requiere y está protegido por controles de red/autorización apropiados.
- Winston escribe `logs/error.log` y `logs/combined.log`; la consola se habilita
  únicamente en desarrollo. En producción, los archivos del contenedor son
  efímeros por defecto: monta `logs/` como volumen o usa un agente para
  conservar y centralizar los logs. En Compose de desarrollo puedes consultar
  la salida de consola con `docker logs`.
- Los uploads se guardan fuera del código en `UPLOAD_BASE_DIR` (en la imagen,
  `/shipnow-uploads`). El volumen de Compose persiste estos archivos; en
  producción define respaldo y retención, o usa almacenamiento de objetos. No
  son almacenamiento ilimitado ni deben conservarse sin una política.
- No subas `.env`, `.env.production`, `node_modules`, `logs/`, `uploads/`,
  `coverage/` ni archivos temporales. `.dockerignore` evita incluirlos en la
  imagen; `.gitignore` excluye los archivos locales del repositorio.

### Hardening de contenedor aplicado

- Ejecución con usuario no-root (`node`)
- Build multi-stage con dependencias de producción aisladas
- `HEALTHCHECK` contra `/api/health`
- Instalación de dependencias solo de producción (`npm ci --omit=dev`)

### Archivos que no deben versionarse ni copiarse a la imagen

- **Repositorio Git**: no subas `.env` ni archivos `.env.*` con secretos. Los ejemplos (`.env.example`, `.env.test.example`) sí se pueden versionar.
- **Contexto Docker**: `.dockerignore` excluye todos los `.env*`, también los ejemplos, porque no son necesarios para construir la imagen. Inyecta la configuración al ejecutar el contenedor.
- No subas dependencias locales (`node_modules`), logs, uploads generados, coverage ni archivos temporales.

Estas reglas se aplican mediante [.gitignore](./.gitignore) y [.dockerignore](./.dockerignore).

## Testing

La suite completa incluye pruebas unitarias con Node.js y pruebas funcionales
con Mocha, Chai y Supertest:

```bash
npm test
```

### Cobertura de tests

La suite funcional tiene **61 pruebas** y la unitaria, **21**:

| Suite | Tests | Cobertura |
|-------|-------|-----------|
| API de usuarios | 11 | CRUD, permisos, carga de documentos, hash de contraseña, filtros y paginación |
| API de pedidos | 8 | CRUD, estados, comprobantes, filtros y paginación |
| API de productos | 1 | Paginación y límite máximo |
| Cargas de archivos | 10 | Documentos, comprobantes, tipo MIME/extensión, tamaño, duplicados y limpieza ante errores |
| API de entregas | 9 | Estados, tracking, sincronización con pedidos, conflictos y paginación |
| API de mocks | 7 | Generación de usuarios/pedidos/entregas, snapshots y validación de seed |
| Logger / Swagger / health / 404 / CORS | 8 | Rutas técnicas, documentación, health check, errores y origen permitido |
| Middleware de autenticación | 7 | JWT, roles permitidos y denegados |
| **Total funcional** | **61** | **Todas aprobadas** |

Las 21 pruebas unitarias cubren errores, logger, validación segura de la base de
test, controlador de pedidos, repositorio y endpoint de usuarios. `npm test` ejecuta
ambos grupos.

### Requisitos para testing

- Node.js 20+
- MongoDB local configurado en `MONGO_URI_TEST` (o `MONGODB_URI_TEST`) y con
  `test` en el nombre de la base
- Copiar `.env.test.example` a `.env.test` antes de correr las pruebas:

```powershell
Copy-Item .env.test.example .env.test
```

- El setup rechaza hosts remotos y bases cuyo nombre no identifica testing
- La suite funcional crea una carpeta temporal aislada para los uploads y la elimina al finalizar. Para ejecutar la aplicación manualmente, `UPLOAD_BASE_DIR` debe tener permisos de escritura.

### Ejecución de tests

```bash
# Ejecutar todos los tests
npm test

# Resultado esperado
# 21 pruebas unitarias aprobadas
# 61 pruebas funcionales aprobadas
```

### Tests de carga de archivos (Módulo 7)

Las 10 pruebas de carga de archivos validan:

1. **Carga exitosa**: documento válido con metadatos
2. **Archivo faltante**: error MISSING_FILE (400)
3. **Tipo de documento inválido**: error INVALID_DOCUMENT_TYPE (400)
4. **MIME y extensión incompatibles**: error INVALID_FILE_TYPE (400)
5. **Archivo mayor al límite**: error FILE_TOO_LARGE (400)
6. **Duplicado permitido por tipo** cuando el binario es distinto
7. **Duplicado binario bloqueado** con RESOURCE_CONFLICT_ERROR (409), sin dejar un archivo huérfano
8. **Comprobante de pedido** asociado y persistido correctamente
9. **Comprobante de entrega** asociado y persistido correctamente
10. **Entidad inexistente**: error DELIVERY_NOT_FOUND_ERROR (404), sin dejar un archivo huérfano

## Rutas principales

Base: `/api`

- `GET /api/health`
- Usuarios:
  - `GET /api/users`
  - `GET /api/users/:id`
  - `POST /api/users`
  - `PUT /api/users/:id`
  - `DELETE /api/users/:id`
  - `POST /api/users/:id/documents`
- Pedidos / envíos (`Order` / `Shipment`):
  - En este contrato, el recurso de envío se representa como pedido y usa `/api/orders`; la entrega y su tracking usan `/api/deliveries`.
  - `GET /api/orders`
  - `GET /api/orders/:id`
  - `POST /api/orders`
  - `PUT /api/orders/:id`
  - `DELETE /api/orders/:id`
  - `POST /api/orders/:id/proof`
- Productos:
  - `GET /api/products`
  - `GET /api/products/:id`
  - `POST /api/products`
  - `PUT /api/products/:id`
  - `DELETE /api/products/:id`
- Entregas:
  - `GET /api/deliveries`
  - `GET /api/deliveries/:id`
  - `GET /api/deliveries/:id/tracking`
  - `POST /api/deliveries`
  - `PUT /api/deliveries/:id`
  - `DELETE /api/deliveries/:id`
  - `POST /api/deliveries/:id/proof`
- Mocks:
  - `GET /api/mocks/user`
  - `GET /api/mocks/users`
  - `GET /api/mocks/orders`
  - `GET /api/mocks/deliveries`
  - `GET /api/mocks/snapshot`
  - `POST /api/mocks/seed`
  - `POST /api/mocks/seed/users`
  - `POST /api/mocks/seed/orders`
  - `POST /api/mocks/seed/deliveries`
  - `POST /api/mocks/seed/all`
- Logger técnico:
  - `GET /api/logger`
  - `GET /api/logger/test`
  - `GET /api/logger/error`

## Carga de archivos y documentos (Módulo 7)

### Decisiones de diseño para el Módulo 7

#### 1. Por qué Multer y almacenamiento en disco

**Decisión**: Usar Multer con diskStorage para guardar archivos en carpetas del servidor.

**Razonamiento**:
- Consideré guardar todo en MongoDB (binarios), pero los archivos pueden ser grandes (fotos, PDFs) y ralentizar las consultas
- Consideré usar S3/cloud, pero para un proyecto educativo local era innecesario
- **Elegí diskStorage** porque es simple, no requiere dependencias adicionales y permite recuperar archivos rápidamente sin pasar por la base de datos
- Los metadatos (nombre original, tamaño, tipo, fecha) se guardan en MongoDB para consultas rápidas

#### 2. Carpetas separadas por tipo de documento

**Decisión**: Crear tres carpetas distintas dentro de `UPLOAD_BASE_DIR`: `documents`, `receipts`, `proofs`.

**Razonamiento**:
- Una carpeta única sería más simple, pero dificulta la auditoría y gestión
- **Elegí separar por tipo** para:
  - Facilitar backups selectivos (ej: respaldar solo documentos de usuarios)
  - Permitir políticas de retención diferentes por tipo
  - Hacer más legible la estructura del servidor
  - Simplificar limpieza de archivos obsoletos

#### 3. Nombres de archivo únicos con timestamp + aleatorio

**Decisión**: Generar nombres como `1704150000000-a7f3b2.pdf` en lugar de usar el nombre original.

**Razonamiento**:
- Los nombres originales pueden tener caracteres especiales, espacios o colisiones
- Uso un timestamp y un valor aleatorio para reducir las colisiones y no depender
  del nombre original.
- El nombre original se guarda en los metadatos para identificar el archivo que
  se subió.

#### 4. Validaciones en dos capas: Multer + Service

**Decisión**: Validar en `uploadFileMiddleware` + nuevamente en el servicio.

**Razonamiento**:
- Multer guarda el archivo en disco antes de que el servicio compruebe que la entidad existe.
- **Elegí dos capas** para:
  - Multer rechaza archivos inválidos (tipo, extensión, tamaño) rápidamente
  - Service valida si el usuario/pedido/entrega existe antes de asociar el archivo
  - Respuesta de error consistente con el ErrorDictionary del proyecto

**Límite actual**: si la asociación falla después de que Multer escribió el archivo, la aplicación no lo elimina automáticamente. Por eso los uploads se guardan fuera del repositorio y deben tener una política de retención y limpieza. Para producción se recomienda almacenamiento externo o una tarea de mantenimiento controlada.

#### 5. Metadatos en MongoDB en lugar de solo archivos

**Decisión**: Guardar objeto con `{ originalName, fileName, path, mimetype, size, type, uploadedAt }`.

- Permite consultas rápidas, por ejemplo, buscar los documentos de un usuario por tipo.
- Facilita auditoría: quién subió, cuándo, qué tipo
- Permite marcar un archivo como inactivo sin borrarlo
- La aplicación puede recuperar el archivo sin listar el directorio

### Configuración de Multer

La configuración está en `src/middlewares/uploadFileMiddleware.js`:

- **diskStorage** con nombres controlados y seguros
- **Carpetas organizadas**: `UPLOAD_BASE_DIR/{documents, receipts, proofs}`
- **Límites de tamaño**: 5MB por archivo
- **File filter** con validaciones de tipo MIME y extensión

### Tipos de documento permitidos

Para documentos de usuario:

- `dni` - Documento Nacional de Identidad
- `cuit` - Código Único de Identificación Tributaria
- `pasaporte` - Pasaporte
- `licencia` - Licencia de conducir
- `driver_license` - Driver license (equivalente)
- `cedula` - Cédula de identidad
- `comprobante` - Comprobante de domicilio
- `factura` - Factura
- `recibo` - Recibo de pago

### Tipos MIME y extensiones permitidas

- `application/pdf` → `.pdf`
- `image/png` → `.png`
- `image/jpeg` → `.jpg`, `.jpeg`

### Endpoints de carga

#### 1. Documento de usuario

```bash
POST /api/users/:id/documents
Content-Type: multipart/form-data

Fields:
  - document (binary, required) - Archivo a cargar
  - type (string, required) - Tipo de documento (dni, cuit, pasaporte, etc.)
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3003/api/users/507f1f77bcf86cd799439011/documents \
  -F "document=@./documento.pdf" \
  -F "type=dni"
```

**Respuestas:**
- `200 OK` - Documento cargado exitosamente
- `400 Bad Request` - Archivo faltante, tipo inválido, tamaño excedido, tipo de documento inválido
- `404 Not Found` - Usuario no encontrado

#### 2. Comprobante de orden

```bash
POST /api/orders/:id/proof
Content-Type: multipart/form-data

Fields:
  - proof (binary, required) - Archivo de comprobante
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3003/api/orders/507f1f77bcf86cd799439011/proof \
  -F "proof=@./comprobante.pdf"
```

**Respuestas:**
- `200 OK` - Comprobante asociado exitosamente
- `400 Bad Request` - Archivo faltante, tipo inválido, tamaño excedido
- `404 Not Found` - Orden no encontrada

#### 3. Comprobante de entrega

```bash
POST /api/deliveries/:id/proof
Content-Type: multipart/form-data

Fields:
  - proof (binary, required) - Archivo de comprobante de entrega
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3003/api/deliveries/507f1f77bcf86cd799439011/proof \
  -F "proof=@./comprobante_entrega.pdf"
```

**Respuestas:**
- `200 OK` - Comprobante asociado exitosamente
- `400 Bad Request` - Archivo faltante, tipo inválido, tamaño excedido
- `404 Not Found` - Entrega no encontrada

### Almacenamiento y metadatos

- **Archivos**: se guardan en `UPLOAD_BASE_DIR` con nombres seguros y únicos
- **Metadatos en MongoDB**: solo se persisten referencias y metadatos
  - `originalName` - Nombre original del archivo
  - `fileName` - Nombre seguro generado
  - `path` - Ruta de almacenamiento
  - `mimetype` - Tipo MIME
  - `size` - Tamaño en bytes
  - `type` - Tipo de documento
  - `uploadedAt` - Timestamp de carga

### Validaciones implementadas

- Archivo requerido (MISSING_FILE)
- Tipo MIME permitido (INVALID_FILE_TYPE)
- Extensión permitida (INVALID_FILE_TYPE)
- Tamaño máximo 5MB (FILE_TOO_LARGE)
- Tipo de documento válido (INVALID_DOCUMENT_TYPE)
- Entidad existente antes de asociar el archivo
- Campo correcto en el request (UNEXPECTED_FILE_FIELD)

### Recuperación de documentos

Los documentos se pueden recuperar junto con la entidad:

```bash
GET /api/users/:id
```

La respuesta incluye el array `documents` con los archivos asociados y sus metadatos. Esta entrega no implementa una ruta de descarga del contenido binario.



## Formato de errores

La API normaliza los errores desde un diccionario central (`src/utils/errors.js`) y responde con un formato consistente:

```json
{
  "success": false,
  "status": "fail",
  "error": {
    "id": 12,
    "code": "INVALID_ID_ERROR",
    "message": "Id inválido"
  },
  "timestamp": "2026-10-19T22:00:00.000Z"
}
```

Errores contemplados para archivos incluidos:

- `MISSING_FILE`
- `INVALID_FILE_TYPE`
- `FILE_TOO_LARGE`
- `INVALID_DOCUMENT_TYPE`
- `USER_NOT_FOUND_ERROR`
- `ORDER_NOT_FOUND_ERROR`
- `DELIVERY_NOT_FOUND_ERROR`

## Logging y trazabilidad

- registro de requests por middleware HTTP
- logs de negocio y errores con Winston
- archivos `logs/error.log` y `logs/combined.log`
- salida a consola solo en desarrollo
- eventos de carga de archivos y asociación a entidades registrados con contexto útil

## Criterios que tuve en cuenta

Al implementar la API, prioricé:

- corrección técnica
- mantener respuestas HTTP consistentes
- separar las responsabilidades del código
- guardar solo los metadatos necesarios
- dejar instrucciones para ejecutar y probar el proyecto

## Bitácora del proyecto

El historial técnico y decisiones del proyecto está en:

- `BITACORA_PROYECTO.md`
