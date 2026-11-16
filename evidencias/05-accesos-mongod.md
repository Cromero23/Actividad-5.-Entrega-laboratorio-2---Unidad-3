# Actividad 5 — Accesos en la bitácora de mongod

**Laboratorio:** LAB-02 — Trazabilidad en MongoDB Community  
**Materia:** Gestión de Seguridad y Desempeño de Bases de Datos  
**Unidad:** III — Auditoría, trazabilidad y gobierno práctico de datos  
**Fecha:** 16 de noviembre de 2026  
**Motor:** MongoDB Community Edition 7.0.45  
**Base de datos:** `comercial`  
**Entorno:** Docker Desktop en Windows

## 1. Objetivo

Analizar los eventos de autenticación registrados por `mongod`, identificando accesos exitosos y fallidos, las causas de los rechazos y la información de conexión proporcionada por la bitácora del servidor.

## 2. Pruebas realizadas

Se efectuaron dos intentos de autenticación fallidos utilizando MongoDB Shell (`mongosh`):

1. Acceso con el usuario existente `app_ventas`, introduciendo deliberadamente una contraseña incorrecta.
2. Acceso con `usuario_inexistente`, una cuenta que no está registrada en la base de datos `comercial`.

En ambos casos, MongoDB Shell devolvió:

```text
MongoServerError: Authentication failed.
```

Las contraseñas se introdujeron de manera interactiva para evitar escribirlas en el historial de PowerShell.

## 3. Investigación de la bitácora

Desde la sesión del administrador se utilizó la función `bitacora()` para recuperar los mensajes recientes del servidor.

### Autenticaciones fallidas

```javascript
bitacora()
  .filter(e => e.c === "ACCESS" && e.msg === "Failed to authenticate")
  .map(e => ({
    t: e.t,
    id: e.id,
    ctx: e.ctx,
    user: e.attr?.user,
    client: e.attr?.client,
    error: e.attr?.error,
    result: e.attr?.result,
    app: e.attr?.doc?.application?.name
  }))
```

Los eventos correspondientes a las pruebas fueron:

| Campo | Contraseña incorrecta | Usuario inexistente |
|---|---|---|
| Momento UTC | 13:12:20.368 | 13:13:27.187 |
| Usuario | `app_ventas` | `usuario_inexistente` |
| Conexión | `conn44` | `conn46` |
| Cliente | `172.17.0.1:46368` | `172.17.0.1:32888` |
| Aplicación | `mongosh 2.4.2` | `mongosh 2.4.2` |
| ID del evento | `5286307` | `5286307` |
| Resultado | `18` | `11` |
| Error | `storedKey mismatch` | `UserNotFound` |

Todos los eventos corresponden al 16 de noviembre de 2026.

En el caso de `usuario_inexistente`, MongoDB produjo dos mensajes con el mismo identificador de conexión `conn46`. Es importante distinguir entre la cantidad de mensajes y la cantidad de intentos de acceso.

También se encontraron errores anteriores asociados con `app_ventas` y `admin`, algunos generados durante otras pruebas y exportaciones. No deben confundirse con los dos intentos realizados específicamente para esta actividad.

### Última autenticación exitosa de app_ventas

Se ejecutó:

```javascript
bitacora()
  .filter(e =>
    e.msg === "Successfully authenticated" &&
    e.attr?.user === "app_ventas"
  )
  .slice(-1)
  .map(e => ({
    t: e.t,
    id: e.id,
    ctx: e.ctx,
    user: e.attr?.user,
    client: e.attr?.client,
    result: e.attr?.result,
    app: e.attr?.doc?.application?.name
  }))
```

El resultado fue:

```javascript
[
  {
    t: { '$date': '2026-11-16T12:49:41.959+00:00' },
    id: 5286306,
    ctx: 'conn29',
    user: 'app_ventas',
    client: '172.17.0.1:42506',
    result: 0,
    app: 'app-ventas-web'
  }
]
```

El evento confirma que se autenticó correctamente el usuario `app_ventas` mediante la aplicación identificada como `app-ventas-web`.

Las direcciones `172.17.0.1` corresponden a la conectividad interna entre el equipo anfitrión y el contenedor Docker.

## 4. Preguntas de la actividad

### 1. ¿Qué campo distingue un acceso fallido de uno exitoso?

El campo `result` permite diferenciar el resultado de la autenticación.

En los registros analizados, el acceso exitoso presentó `result: 0`, mientras que los accesos fallidos presentaron valores distintos de cero: `18` y `11`.

El campo `msg` también permite distinguirlos mediante los mensajes `Successfully authenticated` y `Failed to authenticate`.

### 2. ¿Qué diferencia hay entre el error de contraseña incorrecta y el de usuario inexistente? ¿Por qué el cliente recibe el mismo mensaje en ambos casos?

Cuando se utilizó una contraseña incorrecta para `app_ventas`, el servidor registró:

`AuthenticationFailed: SCRAM authentication failed, storedKey mismatch`

Esto indica que la verificación de las credenciales no coincidió con la información almacenada.

En cambio, para `usuario_inexistente` se registró:

`UserNotFound: Could not find user "usuario_inexistente" for db "comercial"`

Este mensaje indica que la cuenta no existe en la base de autenticación indicada.

MongoDB Shell mostró `Authentication failed` en ambos casos para no revelar al cliente detalles internos sobre la existencia de usuarios y la validación de sus credenciales. Esto reduce la información que podría aprovechar un atacante para enumerar cuentas válidas.

### 3. ¿Por qué el nombre de la aplicación del intento fallido es `mongosh 2.10.0` y no `app-ventas-web`?

La versión `mongosh 2.10.0` es la que aparece en el ejemplo de la guía. En esta práctica, el cliente instalado en Windows fue `mongosh 2.4.2`, y ese es el nombre registrado en los intentos fallidos.

Esto sucede porque los comandos de prueba no especificaron el parámetro `appName`, por lo que MongoDB Shell anunció su nombre predeterminado.

En cambio, las sesiones de la aplicación utilizaron explícitamente `appName=app-ventas-web` en la cadena de conexión. Por esa razón, el evento de autenticación exitosa muestra `app-ventas-web`.

El nombre de aplicación es un dato proporcionado por el cliente y sirve como contexto para la investigación, pero no debe considerarse una identidad independiente y verificable.

## 5. Conclusión

La Actividad 5 permitió comprobar que la bitácora de `mongod` registra acontecimientos de autenticación con información útil para investigar accesos.

Se identificaron las diferencias entre una contraseña incorrecta y un usuario inexistente, así como los datos de conexión y aplicación correspondientes.

También se confirmó que una autenticación exitosa puede relacionarse con una cuenta, una aplicación y una conexión, aunque esto no demuestra por sí solo qué operaciones sobre los datos se ejecutaron después.

La bitácora de accesos y `system.profile` proporcionan información complementaria, pero no sustituyen la auditoría nativa de seguridad.