# Docker

## Requisitos

- Docker Engine o Docker Desktop con Docker Compose.

## Iniciar la API y MongoDB local

Desde la raíz del proyecto:

```bash
docker compose up --build
```

Compose levanta la API en `http://localhost:3003` y MongoDB en una red interna.
La base de datos y los archivos cargados persisten en volúmenes de Docker.
Este Compose es para desarrollo local: la autenticación y las rutas internas
están habilitadas según los valores de desarrollo de la aplicación.
Si el puerto `3003` ya está ocupado, cambia el puerto publicado con
`API_HOST_PORT` (por ejemplo, `API_HOST_PORT=3004 docker compose up --build`).
En PowerShell puedes ejecutar `$env:API_HOST_PORT=3004` antes del comando.

Para detener los servicios:

```bash
docker compose down
```

## Construir solo la imagen

```bash
docker build -t shipnow-api:local .
```

La imagen usa un build multi-stage, copia solo las dependencias de producción y
el código de `src/` al runner, ejecuta Node.js como usuario no-root y tiene un
health check en `/api/health`.

## Ejecutar la imagen con una base externa

En un archivo `.env.production` local configura `NODE_ENV=production`,
`PORT=3003`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` (el origen del frontend,
sin ruta) y `LOG_LEVEL=info`. No subas ese archivo al repositorio; también
puedes configurar estos valores con un gestor de secretos.

`AUTH_REQUIRED` no puede deshabilitarse y requiere `JWT_SECRET`. La URI de
MongoDB debe ser accesible desde el contenedor (no uses `localhost` para una
base que corre en el host) y apuntar a un replica set o mongos para soportar
transacciones en producción.

```bash
docker run --rm -p 3003:3003 --env-file .env.production -v shipnow-uploads:/shipnow-uploads shipnow-api:local
```

`PORT` debe permanecer en `3003` para usar el mapeo anterior. Para comprobar la
API, abre `http://localhost:3003/api/health`. Swagger y las rutas internas
(`/api/mocks`, `/api/logger`) quedan deshabilitados por defecto en producción;
habilítalos solo de forma explícita y con controles de acceso adecuados.

En desarrollo, la consola muestra los logs; Winston también escribe
`logs/error.log` y `logs/combined.log`. En producción la consola queda
deshabilitada y los archivos del contenedor no persisten por defecto. Monta
`logs/` como volumen o utiliza un agente para conservarlos. Los uploads se
guardan en el volumen montado, por lo que producción debe definir su respaldo y
retención o usar un servicio de almacenamiento de objetos.

La suite se ejecuta localmente con `npm test` y requiere una URI de MongoDB local
con `test` en el nombre de la base, configurada en `.env.test`. En desarrollo, Swagger está
disponible en `http://localhost:3003/api/docs`.
