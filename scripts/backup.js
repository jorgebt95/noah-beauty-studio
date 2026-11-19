// Respaldo de la base de datos: node scripts/backup.js /carpeta/de/respaldos  (guarda 30 días)
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const out = path.resolve(process.argv[2] || path.join(DATA_DIR, 'backups'));
fs.mkdirSync(out, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const db = new Database(path.join(DATA_DIR, 'noah.db'), { readonly: true });
db.backup(path.join(out, `noah-${stamp}.db`))
  .then(() => {
    const limit = Date.now() - 30 * 86400000;
    for (const f of fs.readdirSync(out)) {
      const p = path.join(out, f);
      if (/^noah-\d{4}-\d{2}-\d{2}\.db$/.test(f) && fs.statSync(p).mtimeMs < limit) fs.unlinkSync(p);
    }
    // copia las fotos nuevas (las que ya están respaldadas no se vuelven a copiar)
    const up = path.join(DATA_DIR, 'uploads'), dst = path.join(out, 'uploads');
    if (fs.existsSync(up)) {
      fs.mkdirSync(dst, { recursive: true });
      for (const f of fs.readdirSync(up)) if (!fs.existsSync(path.join(dst, f))) fs.copyFileSync(path.join(up, f), path.join(dst, f));
    }
    console.log('Respaldo listo:', stamp);
  })
  .catch(e => { console.error(e); process.exit(1); });
