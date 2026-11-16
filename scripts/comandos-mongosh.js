
/*
 * LAB-02 — Trazabilidad en MongoDB Community
 * Unidad III — Gestion de Seguridad y Desempeno de Bases de Datos
 * Fecha: 16 de noviembre de 2026
 * Motor: MongoDB Community 7.0.45
 * Base de datos: comercial
 *
 * PROPOSITO:
 * Documentar los comandos utilizados en las actividades 1 a 8.
 *
 * SEGURIDAD:
 * - La parte ejecutable es solo de consulta.
 * - Los comandos que modificaron datos, roles o configuraciones
 *   se conservan comentados para evitar repetir el laboratorio.
 * - No se incluyen contrasenas.
 *
 * Ejecutar solo con una cuenta administradora autorizada.
 */

// ============================================================
// 1. COMPROBACION DEL ENTORNO
// ============================================================

if (db.getName() !== "comercial") {
  throw new Error("Conectarse primero a la base comercial.");
}

print("=== LAB-02: VERIFICACION DEL ENTORNO ===");

print("Version:");
printjson(db.version());

print("Modulos:");
printjson(db.adminCommand({ buildInfo: 1 }).modules);

print("Configuracion de arranque:");
printjson(db.serverCmdLineOpts().parsed);


// ============================================================
// 2. PERFILADOR: ESTADO Y EVIDENCIA
// ============================================================

print("\n=== ESTADO DEL PERFILADOR ===");
printjson(db.getProfilingStatus());

print("\n=== REGISTROS ACTUALES DE SYSTEM.PROFILE ===");
printjson(
  db.system.profile.find(
    { ns: "comercial.clientes" },
    {
      _id: 0,
      op: 1,
      ns: 1,
      user: 1,
      client: 1,
      appName: 1,
      ts: 1,
      millis: 1,
      nreturned: 1,
      nModified: 1,
      ndeleted: 1
    }
  ).sort({ ts: 1 }).toArray()
);

/*
 * ACTIVIDAD 2 — INCIDENTE SIN PERFILADO
 *
 * Comandos ejecutados durante la practica:
 *
 * db.setProfilingLevel(0);
 *
 * Como app_ventas:
 * db.clientes.updateOne(
 *   { _id: 3 },
 *   { $set: { rfc: "GAMA780912XXX" } }
 * );
 *
 * Verificaciones:
 * db.system.profile.countDocuments();
 *
 * Resultado observado: 0 documentos.
 */


/*
 * ACTIVIDAD 3 — PERFILADOR EN NIVEL 2
 *
 * Como administrador:
 * db.setProfilingLevel(2);
 * db.getProfilingStatus();
 *
 * Como app_ventas:
 * db.clientes.find(
 *   { ciudad: "Culiacán" },
 *   { nombre: 1, ciudad: 1 }
 * ).toArray();
 *
 * db.clientes.updateOne(
 *   { _id: 3 },
 *   { $set: { rfc: "GAMA780912XYZ" } }
 * );
 *
 * db.clientes.deleteOne({ _id: 2 });
 *
 * Resultados registrados en la exportacion:
 * - query:  2026-11-16T12:50:27.257Z
 * - update: 2026-11-16T12:50:54.350Z
 * - remove: 2026-11-16T12:51:33.972Z
 *
 * Se conservaron en evidencias/system-profile.json.
 */


/*
 * ACTIVIDAD 4 — PERFILADOR CON FILTRO
 *
 * Los siguientes comandos se realizaron durante la practica.
 * NO volver a ejecutarlos sobre las evidencias actuales:
 *
 * db.setProfilingLevel(0);
 * db.system.profile.drop();
 *
 * db.setProfilingLevel(1, {
 *   filter: {
 *     op: { $in: ["insert", "update", "remove"] }
 *   }
 * });
 *
 * Como app_ventas:
 * db.clientes.find({ _id: 1 }).toArray();
 *
 * db.clientes.updateOne(
 *   { _id: 1 },
 *   { $set: { telefono: "6670000000" } }
 * );
 *
 * Se comprobo que la lectura no aparecio en el
 * perfilador filtrado, pero la actualizacion si.
 */


// ============================================================
// 3. BITACORA DE MONGOD
// ============================================================

function bitacora() {
  return db.adminCommand({ getLog: "global" }).log.map(
    linea => JSON.parse(linea)
  );
}

const eventos = bitacora();

print("\n=== MENSAJES DISPONIBLES EN GETLOG ===");
printjson(eventos.length);

print("\n=== AUTENTICACIONES FALLIDAS ===");
printjson(
  eventos
    .filter(e =>
      e.c === "ACCESS" &&
      e.msg === "Failed to authenticate"
    )
    .map(e => ({
      t: e.t,
      ctx: e.ctx,
      user: e.attr?.user,
      result: e.attr?.result,
      error: e.attr?.error
    }))
);

print("\n=== AUTENTICACIONES EXITOSAS DE APP_VENTAS ===");
printjson(
  eventos
    .filter(e =>
      e.msg === "Successfully authenticated" &&
      e.attr?.user === "app_ventas"
    )
    .map(e => ({
      t: e.t,
      ctx: e.ctx,
      user: e.attr?.user,
      client: e.attr?.client
    }))
);


/*
 * ACTIVIDAD 5 — PRUEBAS DE AUTENTICACION
 *
 * Se realizaron desde PowerShell usando mongosh:
 * - Intento con contrasena incorrecta.
 * - Intento con usuario inexistente.
 * - Autenticacion valida de app_ventas.
 *
 * Las credenciales no se guardan en este script.
 *
 * Los resultados originales estan documentados en:
 * evidencias/05-accesos-mongod.md
 */


// ============================================================
// 4. CAMBIOS DE CONFIGURACION Y CORRELACION
// ============================================================

print("\n=== CAMBIOS DE CONFIGURACION DEL PERFILADOR ===");
printjson(
  eventos
    .filter(e => e.msg === "Profiler settings changed")
    .map(e => ({
      t: e.t,
      ctx: e.ctx,
      from: e.attr?.from,
      to: e.attr?.to,
      db: e.attr?.db
    }))
);

print("\n=== AUTENTICACIONES DEL ADMINISTRADOR ===");
printjson(
  eventos
    .filter(e =>
      e.msg === "Successfully authenticated" &&
      e.attr?.user === "admin"
    )
    .map(e => ({
      t: e.t,
      ctx: e.ctx,
      user: e.attr?.user,
      db: e.attr?.db,
      client: e.attr?.client
    }))
);

/*
 * ACTIVIDAD 6 — CORRELACION
 *
 * Antes del reinicio se identifico:
 * - Profiler settings changed: ctx = conn13
 * - Successfully authenticated: ctx = conn13
 * - Usuario autenticado: admin
 *
 * Esta correlacion corresponde a una misma
 * ejecucion del servidor. Los numeros conn
 * pueden reutilizarse despues de un reinicio.
 */


// ============================================================
// 5. INSTANTANEAS DE PRIVILEGIOS
// ============================================================

print("\n=== ROLES ACTUALES DE APP_VENTAS ===");
printjson(db.getUser("app_ventas").roles);

print("\n=== INSTANTANEAS DE PRIVILEGIOS ===");
printjson(
  db.getSiblingDB("auditoria")
    .instantaneas_privilegios
    .find(
      {},
      {
        _id: 0,
        momento: 1,
        tomada_por: 1,
        usuarios: 1
      }
    )
    .sort({ momento: 1 })
    .toArray()
);

/*
 * ACTIVIDAD 7 — CAMBIOS DE PRIVILEGIOS
 *
 * Primera instantanea:
 *
 * db.getSiblingDB("auditoria")
 *   .instantaneas_privilegios.insertOne({
 *     momento: new Date(),
 *     tomada_por:
 *       db.runCommand({ connectionStatus: 1 })
 *         .authInfo.authenticatedUsers,
 *     usuarios: db.getUsers().users.map(u => ({
 *       user: u.user,
 *       db: u.db,
 *       roles: u.roles
 *     }))
 *   });
 *
 * Despues se ejecutaron:
 *
 * db.setProfilingLevel(2);
 *
 * db.grantRolesToUser(
 *   "app_ventas",
 *   [{ role: "dbAdmin", db: "comercial" }]
 * );
 *
 * Consultas de evidencia:
 *
 * db.system.profile.countDocuments({
 *   "command.grantRolesToUser": { $exists: true }
 * });
 *
 * bitacora().filter(
 *   e => JSON.stringify(e).includes("grantRoles")
 * ).length;
 *
 * Ambas consultas devolvieron 0.
 *
 * Se tomo una segunda instantanea con el mismo
 * insertOne mostrado anteriormente.
 *
 * Se comprobaron dos estados:
 * - Antes: readWrite.
 * - Despues: readWrite + dbAdmin.
 *
 * Finalmente se ejecuto:
 *
 * db.revokeRolesFromUser(
 *   "app_ventas",
 *   [{ role: "dbAdmin", db: "comercial" }]
 * );
 *
 * db.getUser("app_ventas").roles;
 *
 * Resultado final: solamente readWrite.
 *
 * Se restauro temporalmente el perfilador a:
 *
 * db.setProfilingLevel(1, {
 *   filter: {
 *     op: { $in: ["insert", "update", "remove"] }
 *   }
 * });
 */


// ============================================================
// 6. CONSERVACION DE EVIDENCIAS
// ============================================================

/*
 * ACTIVIDAD 8 — CONSERVACION
 *
 * Antes del reinicio:
 * - Se exporto system.profile a system-profile.json.
 * - Se exporto getLog a bitacora-mongod.log.
 * - Se calcularon hashes SHA-256.
 *
 * Posteriormente, desde PowerShell:
 *
 * docker restart dba-u3-mongo
 *
 * Tras el reinicio:
 * db.getProfilingStatus();                // was: 0
 * db.system.profile.countDocuments();     // 2
 * db.adminCommand({ getLog: "global" })
 *   .log.length;                           // 91
 *
 * La bitacora exportada contenia 464 lineas.
 * La exportacion JSON habia conservado 5
 * documentos del perfilador, antes de que
 * su coleccion fuera reiniciada en la actividad 4.
 *
 * NOTA:
 * Estos resultados son historicos. Las consultas
 * actuales pueden devolver cifras diferentes.
 */


// ============================================================
// 7. CIERRE
// ============================================================

print("\n=== FIN DE LAS CONSULTAS DE VERIFICACION ===");
print("No se modificaron documentos, roles ni configuraciones.");
