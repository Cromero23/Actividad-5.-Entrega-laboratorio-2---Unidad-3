# LAB-02 — Trazabilidad en MongoDB Community

**Materia:** Gestión de Seguridad y Desempeño de Bases de Datos  
**Unidad:** III — Auditoría, trazabilidad y gobierno práctico de datos  
**Motor:** MongoDB Community Edition 7.0.45  
**Modalidad:** Práctica individual  
**Fecha:** 16 de noviembre de 2026

## 1. Descripción

Este laboratorio analiza las capacidades y limitaciones de trazabilidad de MongoDB Community Edition mediante el perfilador de base de datos (`system.profile`) y la bitácora del servidor `mongod`.

Se simularon modificaciones sobre los registros de clientes de la empresa Comercializadora Norte S.A. de C.V., incluyendo cambios de RFC, operaciones de consulta, eliminación de documentos, intentos de autenticación y modificaciones temporales de privilegios.

El objetivo fue identificar qué eventos pueden reconstruirse mediante los registros disponibles y cuáles requieren mecanismos adicionales de auditoría.

## 2. Entorno utilizado

| Componente | Configuración |
|---|---|
| Sistema operativo | Windows 10 Pro de 64 bits |
| Virtualización | Docker Desktop con WSL 2 |
| Motor | MongoDB Community Edition 7.0.45 |
| Imagen Docker | `mongo:7.0-jammy` |
| Contenedor | `dba-u3-mongo` |
| Puerto | `127.0.0.1:27017` |
| Volumen de datos | `dba-u3-mongo-data` |
| MongoDB Shell local | `mongosh 2.4.2` |
| Base de datos principal | `comercial` |
| Colección | `clientes` |
| Base de datos auxiliar | `auditoria` |

### Despliegue del servidor

Se utilizó un contenedor Docker con autenticación habilitada y almacenamiento persistente.

Comando utilizado para crear el entorno:

```powershell
docker run -d --name dba-u3-mongo -p 127.0.0.1:27017:27017 -v dba-u3-mongo-data:/data/db mongo:7.0-jammy --auth
```

El puerto quedó disponible únicamente mediante la dirección local `127.0.0.1`.

El volumen `dba-u3-mongo-data` permite conservar los datos cuando se reinicia el contenedor.

**Nota:** el comando anterior documenta el despliegue realizado. No debe ejecutarse nuevamente si el contenedor ya existe.

### Usuarios de la práctica

Se utilizaron dos cuentas principales:

- `admin`: cuenta administrativa autenticada en la base `admin`.
- `app_ventas`: cuenta de aplicación autenticada en `comercial`, con el rol `readWrite`.

Durante la Actividad 7 se agregó temporalmente el rol `dbAdmin` a `app_ventas`, que posteriormente fue revocado.

Las contraseñas no se incluyen en el repositorio.

## 3. Conexión al servidor

Para conectarse como administrador desde PowerShell:

```powershell
mongosh "mongodb://127.0.0.1:27017/comercial?authSource=admin" --username admin --password
```

La contraseña se introduce de manera interactiva.

Para consultar la versión del servidor:

```javascript
db.version()
```

La versión observada durante la práctica fue `7.0.45`.

## 4. Mecanismos de trazabilidad utilizados

### 4.1 Perfilador de MongoDB

Se utilizó `db.setProfilingLevel()` para evaluar tres configuraciones:

- **Nivel 0:** perfilador desactivado.
- **Nivel 2:** registro de todas las operaciones perfilables.
- **Nivel 1 con filtro:** registro de las operaciones `insert`, `update` y `remove`.

Durante las pruebas se registraron operaciones `query`, `update` y `remove` ejecutadas desde la cuenta `app_ventas`.

Los documentos permitieron identificar información como usuario, operación, aplicación, cliente y fecha.

### 4.2 Bitácora del servidor

La bitácora de `mongod` se consultó mediante:

```javascript
db.adminCommand({ getLog: "global" })
```

También se utilizó una función auxiliar para interpretar sus mensajes en formato JSON.

Se observaron eventos de autenticación exitosa, intentos fallidos y cambios en la configuración del perfilador.

En este despliegue se utilizaron los registros emitidos por el contenedor Docker.

### 4.3 Control compensatorio de privilegios

Debido a que MongoDB Community no cuenta con auditoría nativa, se implementó un control compensatorio basado en instantáneas.

Estas se almacenaron en:

`auditoria.instantaneas_privilegios`

La comparación permitió identificar que `app_ventas` pasó temporalmente de `readWrite` a `readWrite` más `dbAdmin`.

Sin embargo, las instantáneas no permiten atribuir por sí solas quién realizó el cambio.

## 5. Resultados principales

Se obtuvieron los siguientes resultados:

1. MongoDB Community no dispone de auditoría nativa de seguridad.
2. Una modificación realizada con el perfilador desactivado no dejó evidencia suficiente para atribuirla.
3. El perfilador en nivel 2 registró consultas, modificaciones y eliminaciones realizadas por `app_ventas`.
4. La bitácora permitió identificar autenticaciones exitosas y fallidas.
5. Los cambios de configuración del perfilador se correlacionaron con la sesión administrativa mediante `ctx`.
6. La comparación de instantáneas permitió identificar cambios de privilegios, pero no atribuirlos.
7. El nivel de perfilado volvió a `0` después de reiniciar el contenedor.
8. Los dos documentos presentes en `system.profile` permanecieron almacenados después del reinicio.
9. Se exportaron las evidencias y se calcularon hashes SHA-256 para verificar su integridad.

## 6. Estructura del laboratorio

```text
LAB-02/
├── README.md
├── informe.md
├── scripts/
│   └── comandos-mongosh.js
└── evidencias/
    ├── 01-edicion-y-limitacion.md
    ├── 02-incidente-sin-perfilado.md
    ├── 03-perfilador.md
    ├── 04-filtro.md
    ├── 05-accesos-mongod.md
    ├── 06-correlacion.md
    ├── 07-privilegios-control-compensatorio.md
    ├── 08-conservacion.md
    ├── 09-comparacion.md
    ├── 10-respuesta-direccion.md
    ├── system-profile.json
    ├── bitacora-mongod.log
    └── hashes.sha256
```

El archivo `scripts/comandos-mongosh.js` documenta los comandos relevantes utilizados durante la práctica. No debe ejecutarse automáticamente sobre una base de datos en producción.

## 7. Conservación de evidencias

Los archivos exportados son:

- `system-profile.json`: copia de eventos del perfilador.
- `bitacora-mongod.log`: copia de la bitácora del servidor anterior al reinicio.
- `hashes.sha256`: huellas criptográficas de ambas evidencias.

El archivo `system-profile.json` conserva cinco documentos exportados previamente, mientras que después del reinicio la colección activa `system.profile` conservaba dos documentos.

Estas cantidades corresponden a momentos distintos de la práctica.

Para comprobar la integridad de un archivo se puede recalcular su SHA-256 y compararlo con el valor guardado en `hashes.sha256`.

## 8. Limitaciones identificadas

MongoDB Community no ofrece la auditoría nativa de seguridad disponible en MongoDB Enterprise o en los despliegues compatibles de MongoDB Atlas.

El perfilador fue diseñado principalmente para analizar operaciones y desempeño, no para proporcionar auditoría formal.

Entre las limitaciones identificadas se encuentran la ausencia de un historial automático de valores anteriores, la imposibilidad de atribuir determinados cambios administrativos mediante los registros consultados y los riesgos de conservación de información.

Las instantáneas constituyen un control compensatorio, pero no sustituyen un mecanismo completo de auditoría.

## 9. Conclusión

El laboratorio permitió comprender que generar registros operativos no es lo mismo que contar con auditoría de seguridad.

MongoDB Community aporta información útil mediante el perfilador y la bitácora de `mongod`, pero presenta limitaciones para atribuir cambios administrativos y reconstruir determinados incidentes.

La conservación de evidencias, la protección de los archivos exportados y los controles compensatorios mejoran la capacidad de investigación.

Para organizaciones que requieren trazabilidad formal de privilegios, se recomienda evaluar mecanismos de auditoría nativa y políticas específicas de conservación.
