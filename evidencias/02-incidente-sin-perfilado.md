# Actividad 2 — El incidente sin perfilado

**Laboratorio:** LAB-02 — Trazabilidad en MongoDB Community  
**Materia:** Gestión de Seguridad y Desempeño de Bases de Datos  
**Unidad:** III — Auditoría, trazabilidad y gobierno práctico de datos  
**Fecha:** 16 de noviembre de 2026  
**Motor:** MongoDB Community Edition 7.0.45  
**Base de datos:** `comercial`  
**Entorno:** Docker Desktop en Windows

## Objetivo

Investigar una modificación realizada sobre el RFC de un cliente mientras el perfilador de MongoDB se encuentra desactivado, con el propósito de identificar qué evidencia puede obtenerse mediante `system.profile` y la bitácora del servidor.

## 1. Comprobación del perfilador

Desde la sesión del administrador se ejecutó:

```javascript
db.getProfilingStatus()
```

**Resultado:**

```javascript
{ was: 0, slowms: 100, sampleRate: 1, ok: 1 }
```

El valor `was: 0` confirmó que el perfilador estaba desactivado antes de realizar la modificación.

## 2. Simulación del incidente

Se inició una sesión con el usuario `app_ventas` y la aplicación `app-ventas-web`.

Desde esa sesión se ejecutó:

```javascript
db.clientes.updateOne(
  { _id: 3 },
  { $set: { rfc: "GAMA780912XXX" } }
)
```

**Resultado:**

```javascript
{
  acknowledged: true,
  insertedId: null,
  matchedCount: 1,
  modifiedCount: 1,
  upsertedCount: 0
}
```

La ejecución confirmó que se modificó un documento de la colección `comercial.clientes`, correspondiente a María García.

El RFC inicial utilizado durante la preparación de la práctica era `GAMA780912GHI`, mientras que el nuevo valor establecido fue `GAMA780912XXX`.

Sin embargo, conocer estos valores por haber preparado y ejecutado personalmente la práctica no equivale a disponer de una evidencia histórica independiente del cambio.

## 3. Investigación de los registros

### Consulta de system.profile

```javascript
db.system.profile.countDocuments()
```

**Resultado:**

```text
0
```

No se encontraron operaciones almacenadas en `system.profile`.

### Búsqueda del RFC en la bitácora

```javascript
bitacora().filter(
  e => JSON.stringify(e).includes("GAMA780912XXX")
).length
```

**Resultado:**

```text
0
```

No se encontraron referencias al RFC modificado entre los mensajes recientes consultados.

### Búsqueda de conexiones de la aplicación

```javascript
bitacora()
  .filter(e => JSON.stringify(e).includes("app-ventas-web"))
  .map(e => ({
    t: e.t,
    c: e.c,
    ctx: e.ctx,
    msg: e.msg
  }))
```

La consulta devolvió 27 eventos relacionados con la aplicación.

Entre los acontecimientos identificados se encontraron:

| Fecha y hora UTC | Conexión | Categoría | Mensaje |
|---|---|---|---|
| 12:38:11.024 | conn17 | ACCESS | Failed to authenticate |
| 12:38:36.786 | conn19 | ACCESS | Failed to authenticate |
| 12:39:23.326 | conn21 | ACCESS | Successfully authenticated |
| 12:40:30.268 | conn23 | ACCESS | Successfully authenticated |
| 12:40:30.328 | conn25 | ACCESS | Successfully authenticated |
| 12:40:30.329 | conn24 | ACCESS | Successfully authenticated |

Todos estos eventos corresponden al 16 de noviembre de 2026.

La bitácora permitió identificar conexiones y resultados de autenticación asociados con `app-ventas-web`, pero no ofreció una referencia directa a la operación de modificación del RFC.

## 4. Preguntas de la actividad

### 1. ¿Puedes demostrar qué cambió? ¿Y quién se conectó a esa hora?

**No es posible demostrar históricamente qué cambió utilizando únicamente el perfilador y la bitácora disponibles durante este incidente.**

El perfilador estaba desactivado y la colección `system.profile` no contenía registros. Tampoco se encontraron referencias al RFC modificado en los mensajes recientes del servidor.

Durante la práctica se observó directamente que el usuario `app_ventas` ejecutó una actualización sobre el cliente `_id: 3`. Sin embargo, esa observación de la ejecución no constituye una bitácora independiente que permita reconstruir posteriormente el incidente.

Sí se encontraron conexiones asociadas con la aplicación `app-ventas-web`, incluyendo autenticaciones exitosas y fallidas.

Por lo tanto, es posible demostrar que existieron conexiones de la aplicación, pero no atribuir de manera concluyente la modificación del RFC a una conexión específica mediante los registros disponibles.

### 2. ¿Por qué mongosh abre varias conexiones (conn8, conn9, …) para una sola instrucción? ¿Cuál es la que se autentica?

`mongosh` utiliza un controlador de MongoDB que puede establecer varias conexiones durante una sesión.

Estas conexiones pueden utilizarse para inicializar la comunicación, intercambiar metadatos, supervisar el servidor, autenticar al usuario y ejecutar operaciones.

Por ello, una sola ejecución desde la consola puede generar varios identificadores `conn` en la bitácora.

La conexión que se autentica exitosamente se reconoce mediante un evento de categoría `ACCESS` cuyo mensaje es `Successfully authenticated`.

En esta práctica se identificaron autenticaciones exitosas en `conn21`, `conn23`, `conn24` y `conn25`.

También aparecieron eventos `Connection not authenticating`, que no representan por sí mismos una autenticación exitosa, y eventos `Failed to authenticate`, correspondientes a intentos de autenticación rechazados.

Estos mensajes permiten distinguir las conexiones que consiguieron autenticarse, pero no identifican directamente cuál ejecutó la modificación del RFC.

## 5. Conclusión

La Actividad 2 permitió comprobar las limitaciones de trazabilidad cuando el perfilador de MongoDB Community se encuentra desactivado.

Aunque la bitácora del servidor conservó información sobre conexiones, metadatos de clientes y autenticaciones, no proporcionó evidencia suficiente para reconstruir directamente la modificación del RFC.

Esta situación demuestra que registrar accesos no equivale a registrar operaciones sobre los datos.

Para mejorar la trazabilidad de las siguientes pruebas, será necesario habilitar el perfilador y analizar los documentos almacenados en `system.profile`.
