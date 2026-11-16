# Actividad 3 — Activar el perfilador y registrar operaciones

**Laboratorio:** LAB-02 — Trazabilidad en MongoDB Community  
**Materia:** Gestión de Seguridad y Desempeño de Bases de Datos  
**Unidad:** III — Auditoría, trazabilidad y gobierno práctico de datos  
**Fecha:** 16 de noviembre de 2026  
**Motor:** MongoDB Community Edition 7.0.45  
**Base de datos:** `comercial`  
**Entorno:** Docker Desktop en Windows

## 1. Objetivo

Activar el perfilador de MongoDB Community, registrar operaciones de consulta, actualización y eliminación, e interpretar los documentos almacenados en `system.profile` para identificar qué operación se ejecutó, quién la realizó, desde qué cliente y aplicación, y en qué momento.

## 2. Activación del perfilador

Desde la sesión del administrador, en la base de datos `comercial`, se ejecutaron:

```javascript
db.setProfilingLevel(2)
db.getProfilingStatus()
```

Los resultados fueron:

```javascript
{ was: 0, slowms: 100, sampleRate: 1, ok: 1 }
{ was: 2, slowms: 100, sampleRate: 1, ok: 1 }
```

El nivel anterior era `0`, por lo que el perfilador se encontraba desactivado. Posteriormente se comprobó que el nivel vigente era `2`, lo que habilita el registro de todas las operaciones de la base de datos.

## 3. Operaciones ejecutadas

Se utilizó el usuario `app_ventas`, autenticado en `comercial` y conectado mediante la aplicación `app-ventas-web`.

### Consulta

```javascript
db.clientes.find(
  { ciudad: "Culiacán" },
  { nombre: 1, ciudad: 1 }
).toArray()
```

La consulta devolvió tres clientes: Ana López, Carlos Pérez y Laura Sánchez.

### Actualización

```javascript
db.clientes.updateOne(
  { _id: 3 },
  { $set: { rfc: "GAMA780912XYZ" } }
)
```

Resultado:

```javascript
{
  acknowledged: true,
  matchedCount: 1,
  modifiedCount: 1,
  upsertedCount: 0
}
```

Se modificó el RFC del documento con `_id: 3`, correspondiente a María García.

### Eliminación

```javascript
db.clientes.deleteOne({ _id: 2 })
```

Resultado:

```javascript
{ acknowledged: true, deletedCount: 1 }
```

Se eliminó el documento con `_id: 2`, correspondiente a Carlos Pérez.

## 4. Consulta del perfilador

Desde la sesión del administrador se ejecutó:

```javascript
db.system.profile.find(
  { ns: "comercial.clientes" },
  {
    op: 1,
    ns: 1,
    command: 1,
    user: 1,
    client: 1,
    appName: 1,
    ts: 1,
    millis: 1,
    nreturned: 1,
    docsExamined: 1,
    nModified: 1,
    ndeleted: 1
  }
).sort({ ts: 1 }).toArray()
```

Se identificaron tres operaciones realizadas por `app_ventas`.

## 5. Tabla de interpretación de los documentos

| # | `op` | Usuario | Cliente | Aplicación | Momento (UTC) | Qué hizo | Documentos afectados |
|---|---|---|---|---|---|---|---|
| 1 | `query` | `app_ventas@comercial` | `172.17.0.1` | `app-ventas-web` | 16/11/2026 12:50:27.257 | Consultó clientes de Culiacán | 3 devueltos; 5 examinados |
| 2 | `update` | `app_ventas@comercial` | `172.17.0.1` | `app-ventas-web` | 16/11/2026 12:50:54.350 | Modificó el RFC del cliente `_id: 3` | 1 modificado |
| 3 | `remove` | `app_ventas@comercial` | `172.17.0.1` | `app-ventas-web` | 16/11/2026 12:51:33.972 | Eliminó al cliente `_id: 2` | 1 eliminado |

Las direcciones de cliente corresponden al entorno de red de Docker y no identifican por sí solas una dirección pública o a una persona física.

Los tiempos de ejecución registrados fueron de 0 ms para la consulta, 1 ms para la actualización y 0 ms para la eliminación.

## 6. Preguntas de la actividad

### 1. ¿Puedes saber cuál era el RFC antes del cambio con la información de `system.profile`?

No. El perfilador registra la instrucción de actualización, el documento al que se dirigió y el nuevo valor establecido, pero no almacena automáticamente el valor anterior del campo.

El registro muestra que se asignó `GAMA780912XYZ` al campo `rfc` del documento `_id: 3`.

Sabemos por la ejecución anterior de la práctica que el RFC previo era `GAMA780912XXX`, pero esa información no se puede recuperar únicamente del documento de `system.profile`.

### 2. ¿Puedes saber qué datos tenía el documento eliminado?

No. El perfilador registra que se ejecutó una eliminación sobre el documento `_id: 2` y que un documento fue eliminado, pero no conserva automáticamente su contenido completo anterior.

En esta práctica conocemos los datos de Carlos Pérez porque fueron insertados durante la preparación inicial. Sin embargo, `system.profile` por sí solo no permite reconstruirlos.

### 3. A diferencia de `log_statement = 'mod'` en PostgreSQL, el nivel 2 sí registró la consulta. ¿Qué ventaja y qué riesgo tiene eso?

La principal ventaja es que permite identificar operaciones de lectura, además de actualizaciones y eliminaciones. Esto facilita investigar qué colecciones fueron consultadas, mediante qué filtros y por qué usuario.

El riesgo es que registrar todas las operaciones incrementa la cantidad de información almacenada, puede afectar al rendimiento del servidor y puede exponer información sensible contenida en las consultas.

Por esta razón, el perfilador debe configurarse de acuerdo con las necesidades reales de diagnóstico y trazabilidad.

### 4. ¿Por qué el campo `user` incluye `@comercial`?

Porque MongoDB identifica a los usuarios mediante su nombre y la base de datos en la que están definidos.

En este caso, `app_ventas@comercial` indica que el usuario se llama `app_ventas` y que su base de autenticación es `comercial`.

Este identificador permite distinguir cuentas que podrían tener el mismo nombre, pero estar definidas en bases de datos diferentes.

## 7. Conclusión

La Actividad 3 permitió comprobar que el perfilador de MongoDB Community registra información útil para investigar operaciones sobre los datos.

Se identificaron tres acontecimientos: una consulta, una actualización y una eliminación. En cada caso fue posible conocer el usuario, la aplicación, la dirección del cliente, el momento y la instrucción ejecutada.

Sin embargo, se comprobó que `system.profile` no conserva automáticamente los valores anteriores de los documentos modificados o eliminados.

Por lo tanto, el perfilador contribuye a la trazabilidad operativa, pero no sustituye una auditoría histórica completa de los datos.
