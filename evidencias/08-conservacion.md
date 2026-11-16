# Actividad 8 — Conservación: exportar antes de perder

**Laboratorio:** LAB-02 — Trazabilidad en MongoDB Community  
**Materia:** Gestión de Seguridad y Desempeño de Bases de Datos  
**Unidad:** III — Auditoría, trazabilidad y gobierno práctico de datos  
**Fecha:** 16 de noviembre de 2026  
**Motor:** MongoDB Community Edition 7.0.45  
**Base de datos:** `comercial`  
**Entorno:** Docker Desktop en Windows

## 1. Objetivo

Comprobar los riesgos de pérdida de evidencias del perfilador y de la bitácora de MongoDB Community, verificar su comportamiento después de reiniciar el servidor y conservar los registros mediante exportaciones y hashes SHA-256.

## 2. Procedimiento y resultados

### 2.1 Exportación de la bitácora

Antes de reiniciar el contenedor `dba-u3-mongo`, se exportó la información disponible mediante el comando `getLog` al archivo:

`evidencias/bitacora-mongod.log`

El archivo se generó correctamente desde PowerShell, con un tamaño de **185,981 bytes**.

Posteriormente, mediante `Measure-Object -Line`, se comprobó que contenía **464 líneas**.

Esta copia permitió conservar los eventos disponibles antes del reinicio.

### 2.2 Conservación de `system.profile`

La colección `system.profile` ya había sido exportada durante una actividad anterior, antes de modificar su configuración y eliminar sus registros.

El archivo:

`evidencias/system-profile.json`

conserva evidencia de las operaciones `query`, `update` y `remove` realizadas por `app_ventas`.

Se decidió conservar esta copia sin sobrescribirla para evitar perder los eventos registrados anteriormente.

### 2.3 Generación de hashes SHA-256

Se calcularon los hashes de ambos archivos mediante `Get-FileHash` de PowerShell.

Los resultados se almacenaron en:

`evidencias/hashes.sha256`

**Hashes obtenidos:**

| Archivo | SHA-256 |
|---|---|
| `bitacora-mongod.log` | `a4053cb034cc0f3119c9c54f2d7363d6bdabf480bfe2b9b81fb33b4cafbb8895` |
| `system-profile.json` | `cd82cd319d3a932333b05ce9b6809e704fb42147ba5431ccda16b5dd118b5b16` |

Estos valores permiten comprobar posteriormente la integridad de las copias mediante una nueva comparación de hashes.

### 2.4 Reinicio de MongoDB

Se reinició el servidor mediante Docker:

`docker restart dba-u3-mongo`

El comando finalizó correctamente y devolvió el nombre del contenedor.

Posteriormente, se estableció una nueva conexión a MongoDB como usuario `admin`.

### 2.5 Comportamiento del perfilador

Se ejecutó:

`db.getProfilingStatus()`

Resultado:

`{ was: 0, slowms: 100, sampleRate: 1, ok: 1 }`

Antes del reinicio, el perfilador estaba configurado en nivel `1` con un filtro para las operaciones `insert`, `update` y `remove`.

Después del reinicio, volvió al nivel `0`, demostrando que la configuración aplicada mediante `db.setProfilingLevel()` no persistió.

También se ejecutó:

`db.system.profile.countDocuments()`

Resultado: **2 documentos**.

Esto confirma que los documentos almacenados en la colección permanecieron después del reinicio, aunque el perfilador dejó de registrar operaciones.

### 2.6 Comportamiento de la bitácora

Después del reinicio se consultó:

`db.adminCommand({ getLog: "global" }).log.length`

Resultado: **91 mensajes**.

La copia exportada antes del reinicio contenía 464 líneas, mientras que la nueva sesión ofrecía 91 mensajes.

La comparación es consistente con el reinicio de la memoria temporal de `getLog` y la acumulación de nuevos eventos después de arrancar el servidor.

Los valores corresponden a dos observaciones diferentes y no representan una resta exacta de eventos perdidos.

## 3. Preguntas de reflexión

### 1. Menciona tres formas en que la evidencia del perfilador o de la bitácora puede perderse sin que nadie la borre deliberadamente.

**Primera:** al reiniciar MongoDB, el historial temporal de `getLog` se vacía y comienza a recopilar nuevos mensajes. Si no se exportó previamente, los registros anteriores dejan de estar disponibles mediante este mecanismo.

**Segunda:** `getLog` tiene una capacidad limitada para conservar eventos recientes. Cuando se generan nuevos mensajes y se alcanza el límite, los más antiguos dejan de estar disponibles en memoria.

**Tercera:** `system.profile` utiliza una colección de tamaño limitado. Cuando se alcanza su capacidad, los nuevos registros pueden reemplazar a los más antiguos. Esto puede provocar la pérdida de operaciones relevantes sin que un administrador las elimine manualmente.

### 2. ¿Por qué el tamaño de 1 MB de `system.profile` es un problema de conservación y no solo de espacio?

Porque una colección de tamaño limitado no garantiza que los registros históricos permanezcan disponibles.

Cuando se alcanza el límite, los eventos nuevos pueden desplazar los anteriores. Esto significa que una operación importante para investigar un incidente podría desaparecer antes de que el DBA la consulte.

El riesgo aumenta cuando existe una cantidad elevada de operaciones o cuando el perfilador se configura en nivel `2`.

Por ello, el problema no consiste solamente en el espacio utilizado, sino en la posibilidad de perder evidencia necesaria para reconstruir un incidente. Se requieren exportaciones periódicas o un mecanismo de almacenamiento independiente.

### 3. ¿Por qué `getLog` sirve para interpretar pero no para conservar?

Porque permite consultar rápidamente mensajes recientes del servidor, como conexiones, autenticaciones y cambios de configuración, pero no mantiene un historial completo y permanente.

Su capacidad es limitada y su contenido se reinicia cuando se reinicia `mongod`.

En nuestra práctica, antes del reinicio exportamos una bitácora de 464 líneas. Después del reinicio, `getLog` mostró 91 mensajes correspondientes a la nueva ejecución.

Por esta razón, `getLog` resulta útil para interpretar eventos recientes, pero debe complementarse con archivos de bitácora persistentes, exportaciones y controles de integridad cuando se necesita conservar evidencia.

## 4. Conclusión

La Actividad 8 permitió comprobar que la configuración temporal del perfilador no permanece activa después de reiniciar MongoDB, aunque los documentos previamente registrados en `system.profile` pueden conservarse.

También se observó que `getLog` mantiene un historial temporal que se reinicia con el servidor, lo que representa un riesgo para la conservación de evidencias.

Para reducir ese riesgo, se exportaron los archivos `system-profile.json` y `bitacora-mongod.log` y se generaron sus hashes SHA-256.

La práctica demuestra que la trazabilidad no depende únicamente de generar registros, sino también de conservarlos, proteger su integridad y garantizar su disponibilidad cuando sea necesario investigar un incidente.