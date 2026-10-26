# Ruta de Aprendizaje Adaptativa de Matemáticas

Plataforma web de aprendizaje adaptativo basada en una máquina de estados determinista. El backend valida las respuestas y conserva el progreso en SQLite; el frontend solo presenta el paso actual y envía el identificador de la opción elegida.

## Ejecutar con Docker

Con Docker y Docker Compose instalados:

```sh
docker compose up --build
```

La interfaz estará disponible en http://localhost:5173 y la API en http://localhost:3000/api. SQLite se inicializa automáticamente con los tres temas y persiste en `backend/data/database.sqlite`.

## Ejecutar localmente

Se requiere Node.js 22 o superior. En dos terminales:

```sh
cd backend
npm ci
npm run dev
```

```sh
cd frontend
npm ci
npm run dev
```

El servidor de desarrollo de Vite proxifica `/api` al backend en `http://localhost:3000`. El selector permite alternar entre los usuarios de ejemplo Daniel y Brandon; cada estudiante conserva progreso e historial independientes.

La API ofrece `GET /api/users`, `GET /api/progress/:userId`, `POST /api/attempts` con `{ "userId": 1, "activityId": "a1", "optionId": "a1-b" }` y `POST /api/theory/consult` con `{ "userId": 1 }`.

## Pruebas y compilación

Desde la raíz, `npm run test` ejecuta las pruebas del backend. También se pueden ejecutar directamente:

```sh
cd backend
npm test
npm run build
```

Para comprobar el frontend: `cd frontend && npm run build`.
