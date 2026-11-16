# Actividad 6 — Correlacionar un cambio de configuración con su autor

**Laboratorio:** LAB-02 — Trazabilidad en MongoDB Community  
**Materia:** Gestión de Seguridad y Desempeño de Bases de Datos  
**Unidad:** III — Auditoría, trazabilidad y gobierno práctico de datos  
**Fecha:** 16 de noviembre de 2026  
**Motor:** MongoDB Community Edition 7.0.45  
**Base de datos:** `comercial`  
**Entorno:** Docker Desktop en Windows

## 1. Objetivo

Identificar qué usuario realizó los cambios de configuración del perfilador de MongoDB, correlacionando los eventos registrados en la bitácora de `mongod` mediante el identificador de conexión `ctx`.

## 2. Identificación de cambios de configuración

Desde la sesión del administrador, en la base de datos `comercial`, se ejecutó:

```javascript
bitacora()
  .filter(e => e.msg === "Profiler settings changed")
  .map(e => ({
    t: e.t,
    ctx: e.ctx,
    msg: e.msg,
    attr: e.attr
  }))
```

Se encontraron tres eventos de modificación de la configuración del perfilador:

| Fecha y hora UTC | Conexión | Configuración anterior | Configuración nueva |
|---|---|---|---|
| 16/11/2026 12:46:57.522 | conn13 | Nivel 0 | Nivel 2 |
| 16/11/2026 13:03:21.160 | conn13 | Nivel 2 | Nivel 0 |
| 16/11/2026 13:05:07.376 | conn13 | Nivel 0 | Nivel 1 con filtro |

El último cambio incorporó el filtro:

```javascript
{
  op: {
    $in: ["insert", "remove", "update"]
  }
}
```

Los tres eventos correspondieron a la base de datos `comercial`.

La bitácora identificó la conexión utilizada para modificar la configuración, pero estos mensajes no incluyeron directamente el nombre del usuario.

## 3. Identificación del usuario autenticado

Para determinar qué usuario estaba autenticado en la conexión `conn13`, se ejecutó:

```javascript
bitacora()
  .filter(e =>
    e.ctx === "conn13" &&
    e.msg === "Successfully authenticated"
  )
  .map(e => ({
    t: e.t,
    ctx: e.ctx,
    user: e.attr?.user,
    db: e.attr?.db,
    client: e.attr?.client
  }))
```

**Resultado obtenido:**

```javascript
[
  {
    t: {
      '$date': '2026-11-16T12:23:27.258+00:00'
    },
    ctx: 'conn13',
    user: 'admin',
    db: 'admin',
    client: '172.17.0.1:58488'
  }
]
```

El registro confirma que el usuario `admin` se autenticó exitosamente mediante la conexión `conn13`.

La dirección `172.17.0.1` pertenece a la red interna utilizada por Docker para comunicar el equipo anfitrión con el contenedor.

## 4. Correlación de los acontecimientos

Se relacionaron los eventos de autenticación y modificación utilizando el campo `ctx`.

La secuencia identificada fue:

1. A las 12:23:27.258 UTC, la conexión `conn13` autenticó al usuario `admin`.
2. A las 12:46:57.522 UTC, la misma conexión modificó el perfilador del nivel 0 al 2.
3. A las 13:03:21.160 UTC, la conexión `conn13` desactivó el perfilador.
4. A las 13:05:07.376 UTC, la conexión `conn13` configuró el nivel 1 con un filtro para operaciones de modificación.

Estos acontecimientos corresponden al 16 de noviembre de 2026.

La coincidencia del identificador de conexión permite atribuir las modificaciones a la sesión autenticada como `admin`, siempre que los eventos pertenezcan a la misma ejecución del servidor.

Esta atribución identifica una cuenta de MongoDB, pero no demuestra por sí sola la identidad física de la persona que utilizó sus credenciales.

## 5. Preguntas de la actividad

### 1. ¿Qué usuario cambió la configuración del perfilador? ¿Qué dos eventos lo demuestran?

El usuario identificado fue `admin`, autenticado en la base de datos `admin`.

La atribución se fundamenta en dos tipos de acontecimientos:

**Evento de autenticación:** el mensaje `Successfully authenticated` indicó que la conexión `conn13` correspondía al usuario `admin`.

**Evento de modificación:** el mensaje `Profiler settings changed` mostró que esa misma conexión modificó la configuración del perfilador.

Al relacionar ambos mensajes mediante `ctx: conn13`, fue posible identificar la cuenta responsable de los cambios registrados.

### 2. ¿Qué condición debe cumplirse para que esta correlación sea válida? (Piensa en qué pasa si el servidor se reinicia y los números de conexión vuelven a empezar.)

La correlación solamente es válida cuando los eventos pertenecen a la misma ejecución del servidor y corresponden efectivamente a la misma conexión.

Los identificadores `conn` pueden reutilizarse después de reiniciar MongoDB.

Por lo tanto, no sería correcto relacionar automáticamente una autenticación registrada antes de un reinicio con una modificación posterior que tuviera el mismo número de conexión.

Para evitar atribuciones incorrectas, deben revisarse las marcas de tiempo, los eventos de inicio del servidor y la continuidad de la sesión.

En esta práctica, los eventos analizados pertenecen a la misma ejecución del servidor y comparten `ctx: conn13`.

### 3. ¿Por qué es relevante que quede registrado un cambio de configuración del propio mecanismo de registro?

Porque modificar o desactivar un mecanismo de registro puede reducir la cantidad de evidencia disponible para investigar acontecimientos posteriores.

Si una persona con privilegios suficientes desactiva el perfilador, algunas operaciones podrían dejar de registrarse sin que necesariamente se pierdan los registros anteriores.

Conservar información sobre estos cambios permite identificar períodos en los que la trazabilidad estuvo limitada, revisar las acciones administrativas y detectar posibles intentos de ocultar operaciones.

Sin embargo, la bitácora local tampoco constituye una protección absoluta frente a un administrador con control total del servidor. Para mejorar su confiabilidad, se recomienda enviar los registros a un sistema de conservación independiente.

## 6. Conclusión

La Actividad 6 permitió demostrar que la bitácora de MongoDB Community ofrece información útil para correlacionar acontecimientos administrativos con las conexiones autenticadas.

Mediante el campo `ctx` fue posible relacionar tres cambios de configuración del perfilador con la cuenta `admin`.

También se identificó una limitación importante: los identificadores de conexión no son globalmente únicos y pueden repetirse después de un reinicio.

Se concluye que la correlación de registros puede aportar trazabilidad sobre las actividades administrativas, siempre que se consideren la continuidad del servidor, las marcas de tiempo y las limitaciones de los mecanismos de registro.
