# Actividad 10 — Responder a Dirección

**Laboratorio:** LAB-02 — Trazabilidad en MongoDB Community  
**Materia:** Gestión de Seguridad y Desempeño de Bases de Datos  
**Unidad:** III — Auditoría, trazabilidad y gobierno práctico de datos  
**Fecha:** 16 de noviembre de 2026  
**Motor:** MongoDB Community Edition 7.0.45  
**Empresa:** Comercializadora Norte S.A. de C.V.

## 1. Objetivo

Responder las preguntas del área directiva sobre la modificación del RFC de María García y los cambios de privilegios del usuario `app_ventas`, utilizando exclusivamente las evidencias obtenidas durante el laboratorio.

Se distingue entre los hechos demostrados mediante registros, los cambios conocidos por la ejecución de la práctica y la información que MongoDB Community no permite recuperar mediante sus mecanismos de trazabilidad.

## 2. Respuestas a Dirección

### 1. ¿Quién cambió el RFC de María García en la Actividad 2? ¿Y en la Actividad 3?

**Actividad 2:**

**No hay evidencia con esta edición** que permita atribuir de forma verificable la modificación del RFC a un usuario.

La operación se realizó durante la práctica utilizando la sesión de `app_ventas`, pero el perfilador estaba desactivado en nivel `0`.

La consulta de `system.profile` devolvió `0` documentos y la búsqueda del RFC modificado en la bitácora tampoco encontró coincidencias.

Por lo tanto, aunque conocemos qué cuenta utilizamos durante el ejercicio, los registros disponibles no permiten demostrar quién efectuó el cambio.

**Actividad 3:**

El perfilador registró la modificación del documento de María García (`_id: 3`) realizada mediante el usuario de MongoDB:

`app_ventas@comercial`

En esta ocasión, el perfilador estaba activado en nivel `2`, por lo que se conservó información sobre la operación.

Sin embargo, esto identifica la cuenta utilizada, no necesariamente a una persona física específica.

### 2. ¿Cuándo y desde qué aplicación?

**Actividad 2:**

**No hay evidencia con esta edición** que permita determinar la fecha y hora exactas de la modificación a partir de los registros del servidor.

Debido a que el perfilador se encontraba desactivado, la operación no generó un documento en `system.profile`.

Tampoco se encontró en la bitácora consultada una entrada que identificara la actualización del RFC.

**Actividad 3:**

El perfilador permitió recuperar los siguientes datos:

| Campo | Valor observado |
|---|---|
| Fecha | 16 de noviembre de 2026 |
| Hora UTC | 12:50:54.350 |
| Usuario | `app_ventas@comercial` |
| Aplicación | `app-ventas-web` |
| Cliente | `172.17.0.1` |
| Operación | `update` |
| Colección | `comercial.clientes` |
| Documento | `_id: 3` |

La dirección `172.17.0.1` corresponde al cliente observado desde el contenedor MongoDB en nuestro entorno Docker. No identifica por sí sola a una persona ni su ubicación física.

Estos datos demuestran que el perfilador registró una operación de actualización sobre el RFC desde la aplicación indicada.

### 3. ¿Qué valor tenía antes?

**No hay evidencia con esta edición** que permita recuperar automáticamente el valor anterior del RFC mediante `system.profile` o la bitácora del servidor.

Durante la preparación y ejecución de la práctica se trabajó con los siguientes valores:

| Etapa | RFC conocido durante la práctica |
|---|---|
| Registro inicial | `GAMA780912GHI` |
| Después de la Actividad 2 | `GAMA780912XXX` |
| Después de la Actividad 3 | `GAMA780912XYZ` |

La secuencia se conoce por los datos iniciales y los comandos realizados durante el ejercicio.

Sin embargo, el perfilador de MongoDB no almacena automáticamente una copia del documento anterior a cada actualización.

Por lo tanto, la secuencia conocida durante la práctica no debe presentarse como si fuera un historial de valores anteriores obtenido mediante auditoría.

Para conservar ese tipo de información sería necesario implementar un mecanismo específico de historial de cambios, con protección e integridad adecuadas.

### 4. ¿Cambió alguien los privilegios de `app_ventas`?

**Sí.** Las instantáneas de privilegios permitieron comprobar que se agregó temporalmente el rol `dbAdmin` al usuario `app_ventas`.

Se obtuvieron los siguientes resultados:

| Momento UTC | Privilegios registrados |
|---|---|
| 13:20:15.672 | `readWrite` |
| 13:24:51.589 | `readWrite`, `dbAdmin` |

La comparación demuestra que los permisos cambiaron entre ambas instantáneas.

También se realizaron búsquedas para identificar el comando `grantRolesToUser`:

- `system.profile`: `0` registros encontrados.
- Bitácora consultada de `mongod`: `0` coincidencias encontradas.

Por lo tanto, **no hay evidencia con esta edición**, en las fuentes consultadas, que permita atribuir el cambio de privilegios a un usuario específico ni determinar su instante exacto.

Las instantáneas permiten identificar qué cambió, pero no quién ejecutó la modificación. El campo `tomada_por` identifica al usuario que generó cada instantánea, no necesariamente al responsable del cambio.

Durante el laboratorio, el rol `dbAdmin` fue otorgado y posteriormente revocado de manera controlada. La verificación final confirmó que `app_ventas` conservó únicamente el rol `readWrite`.

## 3. Conclusión para Dirección

La investigación permitió identificar una operación de modificación del RFC de María García cuando el perfilador de MongoDB estaba activado.

En la Actividad 3 fue posible conocer la cuenta utilizada, la aplicación, la dirección del cliente y el momento registrado de la actualización. En cambio, la operación realizada con el perfilador desactivado no dejó evidencia suficiente para atribuirla.

Tampoco fue posible recuperar automáticamente los valores anteriores del RFC mediante el perfilador.

Respecto a los privilegios, las instantáneas demostraron que se agregó temporalmente el rol `dbAdmin` a `app_ventas`, pero no permitieron identificar de manera independiente al responsable ni el instante exacto del cambio.

**Se recomienda complementar los mecanismos disponibles en MongoDB Community con controles de conservación de evidencias e instantáneas protegidas de privilegios.** Para una organización que necesite auditoría formal de cambios de usuarios y roles, se recomienda evaluar MongoDB Enterprise o Atlas con auditoría nativa debidamente configurada.

Estas medidas permitirían mejorar la trazabilidad, sin confundir el perfilador de desempeño ni las instantáneas periódicas con un sistema completo de auditoría de seguridad.