import bcrypt from 'bcrypt';
import { getMySqlPool } from '../config/mysql.js';

async function run() {
  const pool = getMySqlPool();
  const [rows] = await pool.query('SELECT student_number, password_hash FROM users') as any;
  for (const r of rows) {
    const matchesPassword = await bcrypt.compare('Password', r.password_hash);
    const matchesWrong = await bcrypt.compare('wrongpassword123', r.password_hash);
    console.log({
      student_number: r.student_number,
      hash_length: r.password_hash.length,
      hash_prefix: r.password_hash.substring(0, 10),
      matchesPassword,
      matchesWrong,
    });
  }
  await pool.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
