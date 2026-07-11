// Deletes the duplicate "G8 Learner" accounts created by the enrollment
// sync loop on 2026-07-10. The students row cascades from users.
//   npx tsx scripts/delete-loop-students.mts
import { closePool, execute, queryRows } from '../src/config/db.js';

const countRows = await queryRows<{ total: number }>(
  `SELECT COUNT(*) AS total
   FROM users u
   INNER JOIN students s ON s.user_id = u.id
   WHERE u.role = 'student'
     AND s.first_name = 'G8'
     AND s.last_name = 'Learner'`
);
console.log(`Loop-created G8 Learner accounts found: ${countRows[0]?.total}`);

const result = await execute(
  `DELETE u
   FROM users u
   INNER JOIN students s ON s.user_id = u.id
   WHERE u.role = 'student'
     AND s.first_name = 'G8'
     AND s.last_name = 'Learner'`
);
console.log(`Deleted users: ${result.affectedRows}`);

const remaining = await queryRows<{ total: number }>(
  `SELECT COUNT(*) AS total FROM users WHERE role = 'student'`
);
console.log(`Students remaining: ${remaining[0]?.total}`);

await closePool();
