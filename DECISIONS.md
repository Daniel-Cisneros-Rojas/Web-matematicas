# Decisiones Técnicas, Criterio y Reflexión

## A. Decisiones Técnicas

### 1. Arquitectura del Motor de Estados Determinista (Backend-First)
- **Problema**: Garantizar la integridad del recorrido pedagógico y evitar que los estudiantes manipulen el flujo o accedan a las respuestas correctas evaluadas en el cliente.
- **Alternativas consideradas**:
  - *Lógica compartida o en el Frontend*: Simplifica la interacción pero expone respuestas y permite saltarse reglas modificando el estado local.
  - *Procedimientos almacenados / Triggers en Base de Datos*: Acopla las reglas de negocio al motor de persistencia.
- **Solución elegida**: Implementar una Máquina de Estados Finitos (FSM) pura en TypeScript dentro del servidor de Node.js (Express).
- **Justificación**: Mantiene una separación clara de responsabilidades (Clean Architecture). La API valida estrictamente los envíos, registra cada intento en SQLite y calcula la siguiente transición ($A_n \rightarrow T_n \rightarrow R_n \rightarrow A_{n+1}$) según las 9 reglas de negocio. Las respuestas correctas nunca se envían al cliente para actividades pendientes.

### 2. Persistencia Ligera con SQLite y Ejecución con `tsx`
- **Problema**: Requerir un motor de persistencia relacional que conserve el historial de intentos y progreso por usuario entre reinicios, con ejecuciones rápidas y reproducibles sin depender de infraestructura pesada.
- **Alternativas consideradas**:
  - *Persistencia en Memoria (RAM)*: Se pierde al reiniciar el servidor.
  - *PostgreSQL / Dockerizado separado*: Requiere orquestación adicional y tiempos de arranque más lentos.
- **Solución elegida**: SQLite mediante `better-sqlite3` persistido en `./backend/data/database.sqlite`, ejecutado en desarrollo mediante `tsx watch`.
- **Justificación**: Proporciona soporte completo para transacciones relacionales (FK, timestamps) en un solo archivo local, ideal para Docker Compose (`docker compose up --build`). El uso de `tsx` resuelve las incompatibilidades recientes de `ts-node` con versiones modernas de TypeScript.

### 3. Modelo Multiusuario Simple y Dashboard de Administración
- **Problema**: Validar que la base de datos mantenga estados e historiales independientes para diferentes estudiantes ("Daniel" y "Brandon"), además de permitir el seguimiento detallado de su desempeño por un "Administrador".
- **Alternativas consideradas**:
  - *Sistema completo de Autenticación (JWT, contraseñas, sesiones)*: Agrega complejidad innecesaria fuera del alcance de la prueba.
- **Solución elegida**: Esquema de roles simple (`STUDENT` vs `ADMIN`) almacenado en la tabla `users` de SQLite. Un selector en la interfaz permite alternar el contexto sin contraseñas.
- **Justificación**: Demuestra la persistencia individualizada y permite al Administrador visualizar en un Dashboard el porcentaje de progreso, lección actual y la trazabilidad con fecha/hora exacta (`completed_at`) de cada intento.

---

## B. Reflexión de Producto

### 1. Reutilización del Mismo Refuerzo tras Intentos Fallidos
- **Limitación identificada**: Cuando un estudiante responde incorrectamente una actividad de refuerzo ($R_n$), el sistema lo regresa a la teoría ($T_n$) y luego le vuelve a presentar la **misma** pregunta de refuerzo.
- **Riesgo**: El estudiante puede memorizar la opción correcta por ensayo y error en lugar de comprender verdaderamente el concepto matemático tras repasar la teoría.
- **Propuesta de Mejora**:
  1. Implementar una lista o banco de preguntas equivalentes por tema ($R_{n,1}, R_{n,2}, \dots$).
  2. Aplicar variación paramétrica en los ejercicios (ej. cambiar los coeficientes numéricos $3x=12$ a $4x=16$).
- **Validación de Conveniencia**: Comparar la tasa de acierto entre el primer reintento y los posteriores. Si la tasa de éxito en el segundo intento es cercana al 100% en muy poco tiempo de revisión de teoría, indica memorización de la opción visual.

---

## C. Uso de Inteligencia Artificial

- **Herramientas utilizadas**: GitHub Copilot / OpenCode (Claude 3.5 Sonnet).
- **Proceso y Casos de Uso**:
  - Configuración inicial de la estructura monorepo (`frontend` y `backend`).
  - Generación de los esquemas de tablas en SQLite y datos semilla (Seed) de los 3 temas y los 3 usuarios por defecto.
  - Asistencia en la redacción de pruebas unitarias en Vitest para evaluar los ciclos de reintento ($T_n \rightarrow R_n$).
- **Decisiones Personales y Correcciones**:
  - **Corrección de Tooling**: Se descartó `ts-node-dev` tras un error de compatibilidad con TypeScript 7/5.5+ (`TypeError: Cannot read properties of undefined (reading 'fileExists')`) y se reemplazó personalmente por `tsx`.
  - **Control de Seguridad**: Se auditó manualmente que los DTOs devueltos por la API Express filtraran la columna `is_correct` / `correct_option` en el payload enviada al cliente.

---

## D. Autoevaluación

- **Aspectos bien resueltos**:
  - Cumplimiento estricto de las 9 reglas de transición en la máquina de estados.
  - Separación clara entre Frontend (React Presentacional con KaTeX) y Backend (FSM + SQLite).
  - Persistencia e independencia total entre estudiantes (`Daniel` y `Brandon`) y vista analítica completa para el `Administrador`.
  - Ejecución reproducible mediante Docker y scripts unificados.
- **Limitaciones o Riesgos**:
  - Ausencia de autenticación real (adecuado para la prueba, pero no listo para producción).
  - La base de datos SQLite puede presentar contención en entornos de altísima concurrencia de escritura simultánea (resuelto fácilmente migrando a PostgreSQL en el futuro gracias a la capa de abstracción).

