# Informe final — LAB-02: Trazabilidad en MongoDB Community

**Materia:** Gestión de Seguridad y Desempeño de Bases de Datos  
**Unidad:** III — Auditoría, trazabilidad y gobierno práctico de datos  
**Laboratorio:** LAB-02 — Trazabilidad en MongoDB Community  
**Fecha:** 16 de noviembre de 2026  
**Motor:** MongoDB Community Edition 7.0.45  
**Modalidad:** Práctica individual

---

## Introducción

La auditoría y la trazabilidad son elementos fundamentales para la seguridad y administración de bases de datos, debido a que permiten investigar accesos, modificaciones y posibles incidentes que afectan la integridad de la información.

En este laboratorio se analizaron las capacidades de MongoDB Community Edition mediante el perfilador de base de datos y la bitácora de `mongod`, utilizando como escenario la empresa Comercializadora Norte S.A. de C.V.

El ejercicio se centró en identificar quién modificó el RFC de una clienta, desde qué aplicación se realizó la operación, qué información quedó registrada y cuáles son las limitaciones de los mecanismos disponibles.

También se analizaron cambios de privilegios, la conservación de evidencias y las diferencias entre MongoDB Community, PostgreSQL y las ediciones de MongoDB con auditoría nativa.

## 1. Despliegue, edición y limitación

El servidor MongoDB se desplegó mediante Docker Desktop en Windows 10 Pro, utilizando WSL 2.

Se empleó la imagen `mongo:7.0-jammy`, con un contenedor denominado `dba-u3-mongo`, el puerto `27017` vinculado a la dirección local `127.0.0.1` y un volumen persistente para almacenar los datos.

La versión identificada mediante `db.version()` fue MongoDB 7.0.45.

Se configuró autenticación y se utilizaron dos cuentas: `admin`, para tareas administrativas, y `app_ventas`, con permisos `readWrite` sobre la base `comercial`.

Para identificar la edición y configuración del servidor se ejecutaron consultas como `db.version()`, `db.adminCommand({buildInfo:1})` y `db.serverCmdLineOpts()`.

La información obtenida mostró que el servidor ejecutaba MongoDB Community, con la autorización habilitada y sin los módulos de auditoría correspondientes a Enterprise.

La principal limitación identificada es que MongoDB Community no dispone de auditoría nativa de seguridad. Por lo tanto, se trabajó con el perfilador `system.profile` y la bitácora del servidor.

Estos mecanismos permiten obtener información operativa, pero no ofrecen una cobertura equivalente a la auditoría nativa de MongoDB Enterprise o Atlas.

## 2. Perfilador: configuración, interpretación y costo

Se utilizaron diferentes niveles de perfilado para evaluar qué operaciones podían registrarse.

Inicialmente se desactivó el perfilador mediante `db.setProfilingLevel(0)`.

Mientras el nivel era `0`, se modificó el RFC de María García, identificada con `_id: 3`. Sin embargo, la consulta de `system.profile` no encontró documentos y la búsqueda correspondiente en la bitácora tampoco proporcionó evidencia de la actualización.

Posteriormente se activó el nivel `2` mediante `db.setProfilingLevel(2)`.

En esta configuración se realizaron operaciones de consulta, modificación y eliminación utilizando la cuenta `app_ventas`.

El perfilador registró los siguientes eventos:

| Operación | Fecha y hora UTC | Resultado |
|---|---|---|
| `query` | 16/11/2026, 12:50:27.257 | Consulta que devolvió 3 documentos |
| `update` | 16/11/2026, 12:50:54.350 | Modificación del RFC de María García |
| `remove` | 16/11/2026, 12:51:33.972 | Eliminación del documento `_id: 2` |

Los registros permitieron identificar el usuario `app_ventas@comercial`, la aplicación `app-ventas-web`, el cliente `172.17.0.1` y el momento de las operaciones.

Posteriormente se configuró el perfilador en nivel `1` utilizando un filtro para las operaciones `insert`, `update` y `remove`.

Se comprobó que una consulta no generaba un documento correspondiente al filtro, mientras que una modificación del teléfono del cliente `_id: 1` sí quedó registrada.

Esta configuración permitió reducir el volumen de información.

**Costo del perfilador:** mantener el nivel `2` implica procesar y almacenar información sobre todas las operaciones perfilables. Esto puede incrementar el consumo de recursos, afectar el desempeño y registrar filtros que contengan datos personales.

Por lo tanto, el nivel `2` resulta útil para investigaciones y diagnósticos controlados, pero no debe utilizarse indiscriminadamente como sustituto de una solución de auditoría.

## 3. Bitácora de `mongod`: ubicación, accesos y cambios de configuración

En nuestro despliegue Docker, los mensajes del servidor se emitieron mediante la salida del contenedor y se consultaron con `docker logs`.

También se consultaron desde MongoDB mediante el comando `db.adminCommand({getLog:"global"})`.

Durante el laboratorio se realizaron pruebas de autenticación.

Se observaron eventos relacionados con:

- Acceso exitoso de `app_ventas`.
- Intento fallido utilizando una contraseña incorrecta.
- Intento fallido utilizando un usuario inexistente.

La bitácora permitió diferenciar los motivos de error a partir de la información interna registrada por el servidor.

También se identificaron mensajes `Profiler settings changed`, relacionados con modificaciones de configuración.

Se observaron tres eventos:

| Momento UTC | Cambio |
|---|---|
| 12:46:57.522 | Nivel `0` a nivel `2` |
| 13:03:21.160 | Nivel `2` a nivel `0` |
| 13:05:07.376 | Nivel `0` a nivel `1` con filtro |

Estos registros compartían el identificador de conexión `conn13`.

Mediante la correlación de ese identificador con un evento de autenticación exitosa se identificó que la conexión correspondía al usuario `admin`.

La correlación demuestra que la bitácora puede aportar información relevante para atribuir determinados cambios de configuración a una conexión autenticada.

Sin embargo, el identificador de conexión debe interpretarse dentro de una misma ejecución del servidor, porque puede reutilizarse después de un reinicio.

## 4. Privilegios: evidencia disponible, control compensatorio y limitaciones

Se realizó una modificación temporal de privilegios sobre el usuario `app_ventas`.

Inicialmente, dicho usuario contaba únicamente con el rol `readWrite` sobre `comercial`.

Posteriormente se ejecutó `grantRolesToUser()` para agregar temporalmente `dbAdmin`.

La operación se completó correctamente, pero la búsqueda correspondiente en `system.profile` devolvió `0` registros.

También se buscó la cadena `grantRoles` en la bitácora consultada y se obtuvieron `0` coincidencias.

Por lo tanto, no se encontró evidencia directa del cambio mediante los dos mecanismos consultados.

Como control compensatorio se almacenaron dos instantáneas en `auditoria.instantaneas_privilegios`.

| Instantánea | Momento UTC | Roles |
|---|---|---|
| Antes | 13:20:15.672 | `readWrite` |
| Después | 13:24:51.589 | `readWrite`, `dbAdmin` |

La comparación permitió identificar la incorporación del rol adicional.

No obstante, las instantáneas solamente muestran los estados observados en dos momentos diferentes. No permiten conocer con certeza quién ejecutó el cambio ni su instante exacto.

Al finalizar la prueba, el rol `dbAdmin` fue revocado y se comprobó que `app_ventas` conservaba únicamente `readWrite`.

La práctica demostró que las instantáneas pueden ayudar a detectar modificaciones de privilegios, pero no equivalen a un mecanismo de auditoría de seguridad.

## 5. Conservación: riesgos y exportación de evidencias

Durante la actividad de conservación se identificaron riesgos asociados al almacenamiento limitado del perfilador y a la naturaleza temporal de los mensajes disponibles mediante `getLog`.

Para proteger las evidencias se generaron los siguientes archivos:

| Archivo | Finalidad |
|---|---|
| `system-profile.json` | Conservar documentos exportados del perfilador |
| `bitacora-mongod.log` | Conservar mensajes del servidor antes del reinicio |
| `hashes.sha256` | Registrar las huellas criptográficas de ambos archivos |

La bitácora exportada tuvo un tamaño de 185,981 bytes y contenía 464 líneas.

También se calcularon hashes SHA-256 para ambos archivos, permitiendo verificar posteriormente su integridad.

Después se reinició el contenedor con `docker restart dba-u3-mongo`.

Al conectarse nuevamente se observó que:

- El perfilador había regresado al nivel `0`.
- La colección `system.profile` conservaba 2 documentos.
- La nueva consulta de `getLog` contenía 91 mensajes.

Estos resultados demostraron que la configuración temporal del perfilador no persistió después del reinicio, aunque sus documentos almacenados permanecieron.

También se confirmó la importancia de exportar la bitácora antes del reinicio, debido a que el historial en memoria de `getLog` comienza nuevamente.

La conservación de evidencias exige no solamente guardar registros, sino también protegerlos contra alteraciones y comprobar su integridad.

## 6. Comparación entre PostgreSQL y MongoDB

En el Laboratorio 01 se utilizó PostgreSQL mediante bitácoras y disparadores. En el Laboratorio 02 se analizó MongoDB Community mediante el perfilador y la bitácora de `mongod`.

La comparación mostró diferencias importantes.

| Característica | PostgreSQL | MongoDB Community | MongoDB Enterprise/Atlas |
|---|---|---|---|
| Registro de accesos | Disponible mediante bitácoras | Disponible mediante bitácora de `mongod` | Disponible mediante auditoría nativa |
| Operaciones sobre datos | Bitácoras y disparadores configurados | Perfilador activo | Eventos auditables configurados |
| Valores anteriores | Posibles mediante disparadores | No disponibles automáticamente en `system.profile` | No disponibles automáticamente mediante la auditoría nativa |
| Cambios de privilegios | Registrables mediante configuración de bitácoras | Sin evidencia directa en los mecanismos consultados | Auditoría nativa de eventos administrativos |
| Conservación | Depende de la configuración y rotación | Requiere controlar el tamaño e historial disponible | Depende del destino y la política de conservación |

En PostgreSQL se implementó una estrategia que permitió conservar valores anteriores y posteriores mediante disparadores.

En MongoDB Community se obtuvo trazabilidad de determinadas operaciones, pero no un historial automático de valores anteriores.

La principal limitación observada en MongoDB Community fue la falta de evidencia atribuible para determinados cambios de privilegios.

La información correspondiente a MongoDB Enterprise/Atlas se basa en sus capacidades documentadas; no se realizó una implementación práctica de esa auditoría durante el laboratorio.

## 7. Recomendación para una organización

Para una organización que necesite auditar formalmente los cambios de privilegios en MongoDB, recomendaría evaluar MongoDB Enterprise o un despliegue compatible de Atlas con auditoría nativa habilitada.

Esta recomendación se fundamenta en los resultados obtenidos durante el laboratorio.

**Hechos verificados:**

- MongoDB Community no proporcionó auditoría nativa.
- El perfilador registró determinadas operaciones de consulta y modificación.
- La bitácora permitió identificar autenticaciones y cambios de configuración.
- El cambio temporal de privilegios no apareció en las búsquedas realizadas.
- Las instantáneas detectaron diferencias de roles, pero no identificaron al responsable.
- La configuración del perfilador volvió al nivel `0` tras reiniciar el servidor.

**Capacidades que deben evaluarse:**

La auditoría nativa de MongoDB Enterprise/Atlas permite registrar eventos de seguridad, incluidos cambios administrativos y de autorización, según las opciones y filtros configurados.

Sin embargo, su implementación y cobertura deben comprobarse en el entorno específico de la organización. Esta capacidad no se probó directamente en nuestro laboratorio.

Si una organización permanece en MongoDB Community, recomendaría utilizar controles compensatorios, como instantáneas periódicas de privilegios, revisión de bitácoras, conservación externa de evidencias y procedimientos autorizados para modificar usuarios y roles.

Estos controles reducirían algunos riesgos, pero no deberían presentarse como equivalentes a una auditoría nativa.

---

## 8. Preguntas de reflexión

### 8.1 ¿Por qué el perfilador no equivale a una auditoría de seguridad?

Porque su finalidad principal es analizar operaciones y desempeño, no garantizar un registro completo de los eventos de seguridad.

En nuestra práctica, el perfilador permitió identificar consultas y modificaciones, pero no proporcionó evidencia del cambio de privilegios realizado mediante `grantRolesToUser()`.

Además, puede desactivarse, aplicar filtros y almacenar información dentro de una colección de capacidad limitada.

Por ello, no puede garantizar por sí solo la cobertura, atribución y conservación que requiere una auditoría formal.

### 8.2 ¿Por qué el perfilador sigue siendo útil para la trazabilidad?

Porque proporciona información técnica que ayuda a reconstruir determinadas operaciones ejecutadas sobre una base de datos.

En la Actividad 3 identificamos el usuario `app_ventas@comercial`, la aplicación `app-ventas-web`, la dirección del cliente y la fecha de una modificación del RFC.

Estos datos permitieron establecer qué cuenta ejecutó la operación registrada y desde qué aplicación.

Aunque no constituye auditoría de seguridad, el perfilador aporta información valiosa para investigar el comportamiento de una aplicación y analizar incidentes.

### 8.3 ¿Qué riesgo existe al registrar filtros que contienen información personal?

El principal riesgo es que los filtros de consultas pueden incluir información personal y terminar almacenados dentro de `system.profile`.

Por ejemplo, una consulta podría utilizar un RFC, correo electrónico u otro identificador como condición de búsqueda.

Al activar el nivel `2`, aumenta la cantidad de información registrada y, por tanto, la posibilidad de que datos personales queden expuestos en documentos del perfilador.

Esto exige controlar el acceso a `system.profile`, limitar el tiempo de conservación de los registros y evitar compartir evidencias que contengan información personal innecesaria.

### 8.4 ¿En qué se diferencia detectar un cambio de identificar al responsable?

Detectar un cambio significa comprobar que algo fue modificado entre dos momentos.

Atribuirlo significa disponer de evidencia suficiente para identificar la cuenta o entidad que ejecutó la operación.

En nuestra práctica, las instantáneas permitieron detectar que `app_ventas` recibió temporalmente `dbAdmin`.

Sin embargo, esos documentos no demostraron quién ejecutó `grantRolesToUser()`.

La diferencia es importante porque conocer el estado anterior y posterior no equivale a contar con un registro de auditoría de la operación.

### 8.5 ¿Por qué es importante que un DBA reconozca las limitaciones de sus herramientas?

Porque el administrador de bases de datos tiene la responsabilidad de informar con precisión qué puede y qué no puede demostrar mediante la evidencia disponible.

Afirmar que una operación fue auditada cuando no existen registros suficientes puede provocar conclusiones incorrectas durante una investigación.

Reconocer las limitaciones permite proponer controles adicionales, mejorar las configuraciones y seleccionar tecnologías adecuadas para los requisitos de la organización.

En este laboratorio aprendimos que una respuesta técnicamente correcta puede consistir en reconocer que no hay evidencia suficiente para atribuir un evento.

---

## 9. Conclusión general

El Laboratorio 02 permitió comprender las diferencias entre trazabilidad operativa y auditoría de seguridad en MongoDB Community Edition.

Mediante el perfilador fue posible identificar operaciones de consulta, modificación y eliminación, mientras que la bitácora de `mongod` permitió analizar autenticaciones y cambios de configuración.

Sin embargo, también se identificaron limitaciones relevantes, especialmente al investigar cambios de privilegios y recuperar valores anteriores de los documentos.

La implementación de instantáneas permitió detectar diferencias en los roles de un usuario, pero no proporcionó una atribución completa de los cambios.

Asimismo, las pruebas de conservación demostraron la importancia de exportar oportunamente las evidencias y proteger su integridad mediante hashes criptográficos.

Como aprendizaje principal, se concluye que la seguridad de una base de datos no depende únicamente de habilitar mecanismos de registro. También requiere comprender su cobertura, interpretar correctamente los eventos y establecer procedimientos de conservación adecuados.

Reconocer las limitaciones de una herramienta permite realizar investigaciones más confiables y emitir recomendaciones técnicas fundamentadas.

