# Bitácora técnica del proyecto ShipNow

## Actualización Entrega Final: Rendimiento, producción y Docker

En esta última parte revisé lo que faltaba para entregar: paginación,
configuración por entorno, Docker, pruebas y documentación. Anoto acá los cambios
y las decisiones que fui tomando.

### Resumen técnico de lo incorporado

1. **Rendimiento y paginación**
   - Agregué paginación y un máximo de 100 resultados en usuarios, órdenes, entregas y productos (`page`, `limit`).
   - Agregué filtros para los campos que se usan en esos listados (`role`, `email`, `status`, `priority`, `customer`, `driver`, `order`).
   - Los productos con stock aparecen por defecto; `includeInactive=true` también incluye los inactivos.

2. **Preparación para producción**
   - Validé al inicio las variables necesarias, como el puerto, la URI de MongoDB y los booleanos.
   - En `production`, la autenticación queda activa y requiere `JWT_SECRET`.
   - `CLIENT_URL` configura el único origen permitido por CORS; es obligatorio en `production`.
   - Dejé configurable `REQUEST_BODY_LIMIT` para limitar el tamaño de los requests.
   - El health check en `/api/health` devuelve `status`, `environment`, `uptimeSeconds` y `timestamp`, sin incluir datos sensibles.
   - En producción, mocks, la ruta de prueba del logger y Swagger quedan deshabilitados por defecto.

3. **Seguridad y consistencia de dominio**
   - Los endpoints de escritura usan JWT y roles cuando `AUTH_REQUIRED=true`.
   - Agregué la regla para evitar que una orden tenga más de una entrega; si ya existe, la API responde 409.
   - El manejo de transacciones depende de las capacidades de MongoDB.

4. **Dockerización**
   - Dejé un `Dockerfile` multi-stage que:
     - `npm ci --omit=dev`
     - ejecución con usuario no-root (`node`)
     - `HEALTHCHECK` sobre `/api/health`
   - `compose.yaml` permite levantar la API y MongoDB localmente; los datos se guardan en volúmenes.
   - Se completó `.dockerignore` para no copiar secretos ni artefactos locales:
     - `.env*`, `node_modules`, logs, uploads generados, coverage y temporales.

5. **Documentación y pruebas**
   - Actualicé el README con las instrucciones para configurar el entorno, correr los tests y usar Docker.
   - Actualicé OpenAPI con `BearerAuth` y los parámetros de paginación y filtros.
   - En la última ejecución pasaron **57 pruebas funcionales y 21 unitarias**.
   - Ya había levantado la imagen y comprobado health, Swagger y un listado. Después de agregar CORS volví a construir la imagen y validé la configuración de Compose.

## 1) Cómo organicé el proyecto

Fui trabajando la API por partes. La idea fue mantener las rutas, la lógica de
negocio y el acceso a MongoDB en capas separadas. Además, agregué:

- manejo centralizado de errores y logs
- documentación para consultar y probar las rutas
- validaciones para los datos y archivos que recibe la API

## 2) Línea de evolución del proyecto

### Etapa A - Base y estructura

Empecé con Express y MongoDB, y organicé el código en estas capas:

- `app.js` para middlewares y rutas
- `server.js` para bootstrap y conexión a MongoDB
- `routes/controllers/services/repositories/models`

Con esa separación, las rutas no acceden directamente a MongoDB.

### Etapa B - Entidades y reglas del negocio

Modelé las entidades principales: usuarios, productos, pedidos y entregas.

Después agregué los CRUDs y algunas validaciones en los servicios:

- existencia de recursos relacionados
- datos requeridos antes de persistir
- estados y prioridades con constantes
- reglas de negocio para asignación y actualización de entregas

Las validaciones y reglas del negocio quedaron en los servicios.

### Etapa C - Manejo de errores

Unifiqué el formato de los errores usando:

- diccionario central en `src/utils/errors.js`
- `createError` + `CustomError`
- middleware global de errores
- middleware 404 para rutas inexistentes

Ahora los errores pasan por el mismo middleware y mantienen un formato común.

### Etapa D - Logs

Agregué Winston y un middleware HTTP para registrar:

- logger central con niveles
- middleware HTTP para trazas por request
- consola en desarrollo y archivos `error.log` y `combined.log`
- registros de eventos relevantes para negocio y carga documental

Así puedo consultar las requests y los errores durante el desarrollo.

### Etapa E - Documentación con Swagger

Documenté las rutas de la API con Swagger:

- configuración en `src/config/swagger.js`
- UI en `/api/docs` y `/api-docs`
- documentación por módulos (`Users`, `Products`, `Orders`, `Deliveries`, `Mocks`, `Logger`)
- schemas y respuestas reutilizables

La documentación se puede abrir desde `/api/docs` y sirve para probar las rutas.

### Etapa F - Módulo 7: carga de archivos, documentos y comprobantes

Para el Módulo 7 agregué la carga de documentos y comprobantes, con validaciones y asociación a usuarios, órdenes o entregas.

**Decisiones tomadas**:

1. **Almacenamiento**
   - Para esta entrega elegí `diskStorage`. Así los archivos quedan fuera de MongoDB y los metadatos se guardan en la base.
   - No incorporé almacenamiento cloud porque no era necesario para probar el proyecto localmente.

2. **Organización de carpetas**
   - Separé los archivos en `documents`, `receipts` y `proofs` para encontrarlos y limpiarlos por tipo.

3. **Nombres de archivo**
   - La aplicación genera un nombre con timestamp y un valor aleatorio. Esto reduce las colisiones y evita guardar el archivo con el nombre original.
   - El nombre original se conserva en los metadatos.

4. **Validaciones**
   - Multer comprueba tipo, extensión y tamaño. Después, el servicio comprueba que exista la entidad antes de asociar el archivo.
   - Como Multer escribe en disco antes de esa segunda comprobación, puede quedar un archivo huérfano si falla la asociación. La limpieza automática queda pendiente.

5. **Metadatos**
   - Guardo `originalName`, `fileName`, `path`, `mimetype`, `size`, `type` y `uploadedAt` en MongoDB para poder identificar y consultar los archivos asociados.

Los archivos se guardan fuera de la base y tienen límites de tamaño y tipos permitidos. La aplicación todavía no limpia automáticamente los archivos huérfanos.

## 3) Cambios de la revisión final

Al cerrar la entrega revisé estos puntos para que la documentación y el código coincidieran:

1. Dejé la validación de cargas en `src/middlewares/uploadFileMiddleware.js`.
2. Conecté los errores de Multer al formato general de `src/middlewares/errorHandler.js`.
3. Agregué errores para archivos y tipos de documento en `src/utils/errors.js`.
4. Asocié los metadatos de documentos y comprobantes a sus modelos.
5. Ignoré `uploads/` en Git para no subir archivos creados durante las pruebas.
6. Actualicé los ejemplos de carga de archivos en el README.
7. Configuré producción para desactivar por defecto las rutas internas y Swagger, y exigir autenticación.
8. Agregué el health check y probé los endpoints principales.

## 4) Validación realizada

Probé la API con requests para comprobar estos casos:

- carga correcta de documento de usuario
- archivo faltante
- tipo de archivo no permitido
- tipo de documento inválido
- entidad no encontrada
- comprobante asociado a orden/entrega

También revisé el formato de errores, que el health check no exponga secretos y que el contenedor respondiera en health, Swagger y un listado principal.

## 5) Testing y validación

La suite tiene **57 pruebas funcionales** con Mocha, Chai y Supertest, y **21 pruebas unitarias** con Node.js. Para las pruebas que usan MongoDB configuro una URI local con `test` en el nombre de la base.

| Módulo | Pruebas | Casos principales |
|---|---:|---|
| Usuarios | 11 | CRUD, permisos, hash de contraseña, filtros y paginación |
| Pedidos | 8 | CRUD, estados, comprobantes, filtros y paginación |
| Productos | 1 | Paginación y límite máximo |
| Cargas de archivos | 6 | Carga válida, límites, tipos, duplicados y entidad inexistente |
| Entregas | 9 | Estados, tracking, sincronización con pedidos, conflictos y paginación |
| Mocks | 7 | Generación, seed, snapshots y consistencia de estados |
| Logger / Swagger / health / 404 / CORS | 8 | Rutas técnicas, documentación, health check, errores y origen permitido |
| Middleware de autenticación | 7 | JWT, roles y respuestas de autorización |
| **Total** | **57** | **Suite funcional** |

Al comenzar el Módulo 7, los tests de uploads cubrían los casos principales de carga correcta, archivo faltante, tipo inválido y entidad inexistente. En la Entrega 8 la cobertura se amplió para incluir restricciones adicionales y duplicados.

### Ejecución

```bash
npm test
```

Requisitos:
- Node.js 20+
- MongoDB local y URI de prueba (`MONGO_URI_TEST` o `MONGODB_URI_TEST`) con `test` en el nombre de la base
- Variables definidas en `.env.test` o en el entorno

En la última ejecución pasaron **57 pruebas funcionales y 21 unitarias**. También volví a construir la imagen Docker después de configurar `CLIENT_URL`.

## 6) Pendientes y cosas a tener en cuenta

Luego de la Entrega 8, identifico las siguientes limitaciones y mejoras:

**Riesgos que tengo presentes**:

1. **Archivos locales y archivos huérfanos**
   - Riesgo: el almacenamiento local puede perderse si el volumen no tiene respaldo. Si falla la asociación después de la carga, puede quedar un archivo sin referencia.
   - Mitigación actual: `UPLOAD_BASE_DIR` queda fuera del repositorio y Compose usa un volumen.
   - Mejora pendiente: definir retención, limpieza automática y respaldo; para producción real, evaluar almacenamiento de objetos.

2. **Lecturas públicas**
   - Riesgo: los endpoints GET no requieren autenticación en esta entrega.
   - Decisión: se conserva el comportamiento existente para el alcance educativo; en producción real debe revisarse la autorización por recurso.

3. **Validación del contenido de archivos**
   - Riesgo: MIME type y extensión no garantizan por sí solos que el contenido sea seguro.
   - Mejora futura: inspección del contenido y análisis antivirus antes de asociar el archivo.

4. **Retención y observabilidad**
   - Los logs locales no reemplazan un sistema centralizado.
   - Mejora futura: centralizar logs y configurar alertas en el entorno de despliegue.

5. **MongoDB con transacciones**
   - En producción se requiere replica set o mongos por defecto.
   - Una instancia standalone no iniciará con la configuración productiva.
   - Compose usa MongoDB standalone solo para desarrollo local y desactiva el requisito de transacciones.

## 7) Cierre del Módulo 7

En ese módulo dejé separadas las validaciones del archivo, la asociación con la entidad y la respuesta HTTP.


### Cómo quedó el flujo de archivos

- `uploadFileMiddleware.js` valida el archivo.
- El servicio comprueba la entidad y asocia los metadatos.
- `errorHandler.js` prepara la respuesta de error.

### Lo que prioricé

- que las validaciones y los errores fueran consistentes
- guardar los archivos fuera del repositorio
- explicar en el README cómo instalar, probar y ejecutar la API

## 8) Cierre de la Entrega 8

La API conserva sus endpoints principales y suma límites para listados y cargas, configuración validada al inicio, un health check y una imagen Docker que corre con un usuario no-root. En producción, `JWT_SECRET` y `CLIENT_URL` son obligatorios; mocks, logger de prueba y Swagger quedan desactivados por defecto. El puerto interno del contenedor es `3003`.


### Aprendizaje

Me quedó claro que preparar la API para Docker no es solo crear la imagen: también tuve que revisar los límites, las variables de entorno y qué archivos se guardan. Me queda pendiente automatizar la limpieza de uploads huérfanos y definir cuánto tiempo conservarlos.