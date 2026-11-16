# Actividad 1 — Lo que no existe en MongoDB Community

**Laboratorio:** LAB-02 — Trazabilidad en MongoDB Community  
**Materia:** Gestión de Seguridad y Desempeño de Bases de Datos  
**Unidad:** III — Auditoría, trazabilidad y gobierno práctico de datos  
**Fecha:** 16 de noviembre de 2026  
**Motor:** MongoDB Community Edition 7.0.45  
**Base de datos:** `comercial`  
**Entorno:** Docker Desktop en Windows

## Objetivo

Identificar la edición de MongoDB utilizada, comprobar la configuración de seguridad del servidor y reconocer las limitaciones de auditoría nativa presentes en MongoDB Community Edition.

## 1. Comprobación de la versión y edición

Desde una sesión autenticada como administrador en la base de datos `comercial`, se ejecutaron las siguientes instrucciones:

```javascript
db.version()
db.adminCommand({ buildInfo: 1 }).modules
db.serverCmdLineOpts().parsed
```

Los resultados obtenidos fueron:

```javascript
"7.0.45"

[]

{
  net: { bindIp: "*" },
  security: { authorization: "enabled" }
}
```

La versión identificada es MongoDB 7.0.45.

La lista de módulos vacía y la imagen utilizada, `mongo:7.0-jammy`, son consistentes con una instalación de MongoDB Community Edition. No se encuentra habilitado el módulo Enterprise.

La opción `security.authorization: "enabled"` confirma que el servidor tiene habilitado el control de acceso.

La configuración `bindIp: "*"` corresponde al interior del contenedor. Docker publica el servicio únicamente en `127.0.0.1:27017` del equipo anfitrión.

## 2. Comprobación de la bitácora del servidor

En Windows PowerShell se ejecutaron:

```powershell
docker logs --tail 8 dba-u3-mongo

docker inspect --format '{{.HostConfig.LogConfig.Type}}' dba-u3-mongo
```

El controlador identificado fue:

```text
local
```

Mediante `docker logs` se observaron mensajes JSON de las categorías `NETWORK`, `ACCESS` y `WTCHKPT`.

Entre los acontecimientos registrados se encontraron conexiones aceptadas, metadatos del cliente `mongosh` y operaciones internas del motor WiredTiger.

En este despliegue, MongoDB emite sus mensajes al flujo de salida del contenedor y Docker los conserva mediante su controlador `local`. La bitácora puede consultarse con `docker logs`.

Este mecanismo permite examinar acontecimientos del servidor, aunque no constituye una auditoría nativa completa de todas las operaciones sobre los datos.

## 3. Preguntas de la actividad

### 1. ¿Qué edición de MongoDB estás usando? ¿Qué evidencia lo demuestra?

Se utiliza **MongoDB 7.0.45 Community Edition** dentro de un contenedor Docker.

La consulta `db.adminCommand({ buildInfo: 1 }).modules` devolvió un arreglo vacío (`[]`), lo que indica que no se encuentra cargado el módulo Enterprise.

Adicionalmente, el servidor se ejecuta mediante la imagen oficial `mongo:7.0-jammy`.

Por lo tanto, no se dispone de las funciones de auditoría nativa reservadas a otras ediciones o servicios.

### 2. ¿A dónde escribe tu servidor su bitácora? ¿Cómo lo sabes?

En este despliegue, los mensajes de `mongod` se emiten a la salida del contenedor Docker.

Docker utiliza el controlador de registros `local`, confirmado mediante `docker inspect`.

Se comprobó que los mensajes podían recuperarse con `docker logs --tail 8 dba-u3-mongo`.

De esta manera, se identificaron mensajes estructurados en JSON que describen conexiones, acceso e información del funcionamiento interno del servidor.

### 3. Según REF-U3-04, ¿qué cuatro categorías de eventos registraría la auditoría nativa?

La auditoría nativa de MongoDB Enterprise y las modalidades compatibles de Atlas puede registrar:

1. Cambios de esquema y operaciones administrativas relacionadas.
2. Eventos de conjuntos de réplicas y clústeres fragmentados.
3. Eventos de autenticación y autorización.
4. Operaciones CRUD, cuando se habilita la configuración de auditoría correspondiente, como `auditAuthorizationSuccess`.

Estas capacidades no deben confundirse con el perfilador de MongoDB Community.

### 4. ¿Qué tendría que evaluar una organización antes de licenciar Enterprise o migrar a Atlas solo para obtener auditoría?

La organización debería evaluar sus necesidades reales de auditoría, los requisitos legales y de cumplimiento, los eventos que necesita registrar y los riesgos que debe investigar.

También tendría que comparar los costos de licencias, infraestructura, almacenamiento, retención de registros y operación continua.

En una migración a Atlas sería necesario considerar la ubicación de los datos, las responsabilidades de seguridad, los controles de acceso y los requisitos de disponibilidad.

La decisión debería basarse en las necesidades del negocio y en si las capacidades adicionales justifican su costo, no únicamente en la posibilidad de generar más registros.

## 4. Conclusión

La Actividad 1 permitió comprobar que MongoDB Community Edition ofrece mecanismos de registro del servidor, pero no incluye la auditoría nativa disponible en las ediciones compatibles de Enterprise y Atlas.

Se confirmó que el servidor tiene habilitada la autenticación y que su bitácora puede consultarse mediante Docker.

Para las siguientes actividades se utilizarán `system.profile` y los mensajes de `mongod`, reconociendo expresamente las limitaciones de ambos mecanismos para reconstruir incidentes de seguridad.
