## A. Decisiones Técnicas

### 1. Motor de Estados Determinista en el Backend
- **Problema**: Garantizar la integridad de la ruta de aprendizaje y evitar que el estudiante altere el flujo mediante peticiones manipuladas en el cliente.
- **Alternativas**: Controlar el flujo en el Frontend o delegar lógica en procedimientos almacenados.
- **Solución elegida**: Implementar una Máquina de Estados Finitos (FSM) pura en TypeScript dentro del backend de Node.js.
- **Razonamiento**: Descoupla la interfaz de la lógica de negocio, facilita las pruebas unitarias aisladas y asegura que las respuestas correctas nunca se expongan al cliente antes de tiempo.

### 2. Persistencia con SQLite
- **Problema**: Requerimiento de persistencia ligera, confiable y que funcione sin necesidad de configurar servicios externos complejos.
- **Alternativas**: PostgreSQL, MongoDB o memoria en RAM.
- **Solución elegida**: SQLite utilizando `better-sqlite3`.
- **Razonamiento**: Ofrece una persistencia completamente funcional en un único archivo (`database.sqlite`), sobrevivir a reinicios de la aplicación y simplifica la ejecución vía Docker Compose sin dependencias adicionales.

## B. Reflexión de Producto

- **Limitación identificada**: Reutilización de la misma pregunta de refuerzo en múltiples intentos fallidos. Si un estudiante falla la actividad de refuerzo varias veces, responderá exactamente la misma pregunta tras revisar la teoría.
- **Propuesta de mejora**: Implementar un banco de preguntas dinámicas o una variación de parámetros numéricos en la pregunta de refuerzo.
- **Validación**: Analizar la tasa de acierto en el segundo intento de refuerzo para determinar si los estudiantes están comprendiendo el tema o simplemente memorizando la opción correcta.