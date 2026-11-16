# Actividad 7 — Cambios de privilegios: el límite más importante

**Laboratorio:** LAB-02 — Trazabilidad en MongoDB Community  
**Materia:** Gestión de Seguridad y Desempeño de Bases de Datos  
**Unidad:** III — Auditoría, trazabilidad y gobierno práctico de datos  
**Fecha:** 16 de noviembre de 2026  
**Motor:** MongoDB Community Edition 7.0.45  
**Base de datos:** `comercial`

## 1. Objetivo

Comprobar las limitaciones del perfilador y de la bitácora de MongoDB Community para detectar cambios de privilegios, e implementar un control compensatorio mediante instantáneas de los roles asignados a los usuarios.

## 2. Procedimiento realizado

### 2.1 Primera instantánea de privilegios

Se almacenó una instantánea inicial en la colección `auditoria.instantaneas_privilegios`, registrando el momento de la consulta, el usuario que la realizó y los permisos existentes.

La operación `insertOne()` devolvió `acknowledged: true`, confirmando que se guardó correctamente.

**Resultado observado:**

- Momento: `2026-11-16T13:20:15.672Z`.
- Usuario consultado: `app_ventas`.
- Base de datos: `comercial`.
- Rol inicial: `readWrite`.
- Usuario que tomó la instantánea: `admin`, autenticado en `admin`.

### 2.2 Asignación temporal de privilegios

Se activó el perfilador en nivel 2 mediante `db.setProfilingLevel(2)` y posteriormente se ejecutó:

`db.grantRolesToUser("app_ventas", [{ role: "dbAdmin", db: "comercial" }])`

MongoDB devolvió `{ ok: 1 }`, confirmando que la operación fue exitosa.

El usuario `app_ventas` pasó a tener dos roles: `readWrite` y `dbAdmin`, ambos sobre `comercial`.

### 2.3 Búsqueda de evidencia

Se realizaron dos comprobaciones.

**Consulta en `system.profile`:**

`db.system.profile.countDocuments({ "command.grantRolesToUser": { $exists: true } })`

Resultado: `0`.

**Búsqueda en la bitácora de `mongod`:**

`bitacora().filter(e => JSON.stringify(e).includes("grantRoles")).length`

Resultado: `0`.

En las fuentes consultadas no se encontraron registros identificables del comando de asignación de privilegios, aunque la operación sí se ejecutó correctamente.

Esta ausencia demuestra que los mecanismos consultados no proporcionaron la evidencia de auditoría necesaria para atribuir ese cambio.

### 2.4 Segunda instantánea y comparación

Después de otorgar el rol adicional, se guardó una segunda instantánea en `auditoria.instantaneas_privilegios`.

**Resultado de la comparación:**

| Momento (UTC) | Usuario | Roles registrados |
|---|---|---|
| 13:20:15.672 | `app_ventas` | `readWrite` |
| 13:24:51.589 | `app_ventas` | `readWrite`, `dbAdmin` |

La comparación permitió determinar que los privilegios del usuario cambiaron y que se agregó el rol `dbAdmin`.

Sin embargo, las instantáneas no permiten identificar por sí solas qué persona ejecutó el cambio ni el momento exacto en que ocurrió. Únicamente permiten establecer que sucedió entre ambas observaciones.

El campo `tomada_por` identifica a quien generó cada instantánea, no necesariamente a quien modificó los privilegios.

### 2.5 Restauración de la configuración

Se revocó el rol adicional mediante:

`db.revokeRolesFromUser("app_ventas", [{ role: "dbAdmin", db: "comercial" }])`

La operación devolvió `{ ok: 1 }`.

Posteriormente, `db.getUser("app_ventas").roles` confirmó que el usuario conservaba únicamente `readWrite`.

También se restauró el perfilador a nivel 1 con el filtro de operaciones `insert`, `update` y `remove`.

La consulta final `db.getProfilingStatus()` confirmó `was: 1`, el filtro configurado y `ok: 1`.

## 3. Preguntas de reflexión

### 1. ¿Por qué un cambio de privilegios es uno de los eventos auditables más importantes?

Porque modifica las acciones que un usuario puede realizar dentro de la base de datos. Un cambio no autorizado podría permitir consultar información restringida, modificar registros, eliminar datos o realizar operaciones administrativas que no corresponden a las funciones del usuario.

Por ello, resulta fundamental conocer quién realizó el cambio, cuándo ocurrió, qué permisos fueron modificados y si existía autorización para hacerlo. Esta información permite investigar incidentes y comprobar el cumplimiento del principio de mínimo privilegio.

### 2. ¿Con qué frecuencia tomarías instantáneas? ¿Qué factores influyen?

Para una organización con información sensible, propondría realizar instantáneas automáticas al menos diariamente y también después de cada modificación autorizada de roles. En sistemas especialmente críticos, utilizaría intervalos más cortos, por ejemplo, cada hora, según los recursos disponibles.

La frecuencia dependería de la sensibilidad de los datos, la cantidad de usuarios, la frecuencia con que cambian los privilegios, los requisitos de seguridad y el riesgo aceptable para la organización.

Sin embargo, incluso con instantáneas frecuentes pueden existir cambios temporales que ocurran entre dos capturas y no sean detectados.

### 3. ¿Quién debería poder escribir en `auditoria.instantaneas_privilegios`?

Únicamente una cuenta de servicio dedicada a la recopilación de evidencias, con permisos mínimos para insertar registros, o un proceso administrativo específicamente autorizado.

Los usuarios de aplicaciones, como `app_ventas`, no deberían tener permisos para modificar, sobrescribir o eliminar las instantáneas.

Además, sería recomendable almacenar una copia protegida fuera del servidor principal para reducir el riesgo de alteración por parte de una cuenta comprometida.

### 4. Redacta en tres líneas cómo comunicarías esta limitación a Dirección.

MongoDB Community no proporciona auditoría nativa para registrar de manera completa y atribuible los cambios de privilegios.  
Las instantáneas periódicas permiten detectar diferencias entre permisos, pero no identificar con certeza al responsable ni el instante exacto.  
Se recomienda implementar este control compensatorio y evaluar MongoDB Enterprise o Atlas con auditoría nativa si la organización requiere trazabilidad formal.

## 4. Conclusión

La actividad demostró que MongoDB Community permite consultar y comparar los permisos de sus usuarios mediante instantáneas almacenadas en una colección independiente.

En la práctica se identificó correctamente la incorporación temporal del rol `dbAdmin` al usuario `app_ventas`, aunque las búsquedas realizadas en `system.profile` y la bitácora del servidor no proporcionaron evidencia directa del comando.

El control compensatorio permitió detectar el cambio, pero no atribuirlo a un responsable ni determinar su instante exacto. Por esta razón, no debe considerarse equivalente a un mecanismo de auditoría nativa.

Finalmente, se revocó el permiso adicional y se restauró el perfilador a su configuración anterior, dejando el entorno preparado para continuar con las actividades del laboratorio.