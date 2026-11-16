# Actividad 4 — Reducir el volumen del perfilador con un filtro

**Laboratorio:** LAB-02 — Trazabilidad en MongoDB Community  
**Materia:** Gestión de Seguridad y Desempeño de Bases de Datos  
**Unidad:** III — Auditoría, trazabilidad y gobierno práctico de datos  
**Fecha:** 16 de noviembre de 2026  
**Motor:** MongoDB Community Edition 7.0.45  
**Base de datos:** `comercial`  
**Entorno:** Docker Desktop en Windows

## 1. Objetivo

Configurar el perfilador de MongoDB para registrar únicamente operaciones de modificación y comprobar que las consultas de lectura quedan excluidas, reduciendo el volumen de información almacenada en `system.profile`.

## 2. Conservación de los registros anteriores

Antes de limpiar `system.profile`, se exportaron cinco documentos mediante `mongoexport` al archivo `evidencias/system-profile.json`.

Se comprobó que la exportación contenía las operaciones `query`, `update` y `remove` realizadas durante la Actividad 3 por el usuario `app_ventas@comercial`.

De esta forma, se conservaron las evidencias anteriores antes de eliminar la colección del perfilador.

## 3. Configuración del filtro

Desde la sesión del administrador, en la base de datos `comercial`, se ejecutaron:

```javascript
db.setProfilingLevel(0)

db.system.profile.drop()

db.setProfilingLevel(1, {
  filter: {
    op: { $in: ["insert", "update", "remove"] }
  }
})

db.getProfilingStatus()
```

La eliminación de `system.profile` devolvió `true`.

La configuración final del perfilador fue:

```javascript
{
  was: 1,
  slowms: 100,
  sampleRate: 1,
  filter: {
    op: { '$in': ['insert', 'remove', 'update'] }
  },
  note: 'When a filter expression is set, slowms and sampleRate are not used for profiling and slow-query log lines.',
  ok: 1
}
```

El nivel `1` quedó activo con un filtro sobre las operaciones `insert`, `update` y `remove`. Al existir un filtro, MongoDB no utiliza los valores `slowms` y `sampleRate` para seleccionar las operaciones perfiladas.

## 4. Prueba de funcionamiento

La sesión del usuario `app_ventas` ejecutó primero una lectura:

```javascript
db.clientes.find({ _id: 1 }).toArray()
```

La consulta devolvió el documento de Ana López, cuyo teléfono inicial era `6671234567`.

Posteriormente se ejecutó:

```javascript
db.clientes.updateOne(
  { _id: 1 },
  { $set: { telefono: "6670000000" } }
)
```

El resultado confirmó:

```javascript
{
  acknowledged: true,
  matchedCount: 1,
  modifiedCount: 1,
  upsertedCount: 0
}
```

## 5. Verificación en system.profile

Desde la sesión del administrador se ejecutó:

```javascript
db.system.profile.find(
  { ns: "comercial.clientes" },
  {
    op: 1,
    command: 1,
    user: 1,
    appName: 1,
    ts: 1,
    _id: 0
  }
).sort({ ts: 1 }).toArray()
```

Se obtuvo un único registro correspondiente a la actualización.

| Campo | Resultado |
|---|---|
| Operación | `update` |
| Documento | `_id: 1` |
| Campo modificado | `telefono` |
| Nuevo valor | `6670000000` |
| Usuario | `app_ventas@comercial` |
| Aplicación | `app-ventas-web` |
| Momento UTC | 2026-11-16 13:08:46.640 |
| Consultas `query` registradas | Ninguna |

El resultado confirma que el filtro registró la actualización, mientras que la consulta previa no apareció entre los eventos obtenidos.

## 6. Preguntas de la actividad

### 1. ¿Qué perdiste de evidencia al aplicar el filtro? ¿Qué ganaste?

Se perdió la capacidad de registrar consultas de lectura ordinarias, ya que la operación `query` no está incluida en el filtro.

Esto limita la posibilidad de investigar quién consultó determinados documentos, qué filtros utilizó o cuándo accedió a la información.

A cambio, se consiguió reducir el volumen de registros almacenados en `system.profile` y concentrar la información en las operaciones de inserción, actualización y eliminación.

Esta configuración puede disminuir el consumo de almacenamiento y facilitar el análisis de modificaciones, aunque no sustituye una auditoría de seguridad completa.

### 2. ¿Qué filtro usarías si solo interesaran operaciones sobre la colección clientes?

Se podría utilizar el siguiente filtro:

```javascript
db.setProfilingLevel(1, {
  filter: {
    ns: "comercial.clientes"
  }
})
```

Con este filtro, el perfilador seleccionaría operaciones cuyo espacio de nombres fuera exactamente `comercial.clientes`, independientemente del tipo de operación.

Si además interesaran únicamente las modificaciones realizadas sobre esa colección, utilizaría:

```javascript
db.setProfilingLevel(1, {
  filter: {
    ns: "comercial.clientes",
    op: { $in: ["insert", "update", "remove"] }
  }
})
```

Este segundo ejemplo combina el criterio de colección con el tipo de operación.

Los ejemplos anteriores son propuestas de configuración y no se ejecutaron durante esta actividad. La configuración aplicada y verificada fue el filtro por operaciones de modificación.

## 7. Conclusión

La Actividad 4 permitió comprobar que el perfilador de MongoDB Community puede configurarse para seleccionar determinados tipos de operaciones.

La prueba demostró que la actualización del teléfono de Ana López quedó registrada, mientras que la consulta de lectura previa no apareció en `system.profile`.

Se concluye que un filtro adecuado permite concentrar las evidencias en operaciones relevantes y reducir el volumen de registros, aunque implica renunciar a información sobre las operaciones excluidas.
