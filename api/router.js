// Single catch-all router cho /api/* — Vercel Hobby plan giới hạn 12 functions/deployment.
// Các handler thật ở /handlers/ (ngoài /api/) để Vercel KHÔNG đếm chúng là functions.
// File này + /api/uploads.js là 2 functions duy nhất Vercel deploy.

// Static require giúp Vercel @vercel/nft tracer bundle các handler vào lambda.
const authLogin    = require('../handlers/auth/login.js');
const authRegister = require('../handlers/auth/register.js');
const authLogout   = require('../handlers/auth/logout.js');
const authMe       = require('../handlers/auth/me.js');

const usersIndex          = require('../handlers/users/index.js');
const usersByUsername     = require('../handlers/users/[username].js');
const usersClasses        = require('../handlers/users/[username]/classes.js');
const usersSubmissions    = require('../handlers/users/[username]/submissions.js');

const classesIndex            = require('../handlers/classes/index.js');
const classesById             = require('../handlers/classes/[id].js');
const classesEnrollments      = require('../handlers/classes/[id]/enrollments/index.js');
const classesEnrollmentByUser = require('../handlers/classes/[id]/enrollments/[username].js');
const classesPosts            = require('../handlers/classes/[id]/posts/index.js');
const classesProgress         = require('../handlers/classes/[id]/progress.js');

const assignmentsIndex       = require('../handlers/assignments/index.js');
const assignmentsById        = require('../handlers/assignments/[id].js');
const assignmentsSubmissions = require('../handlers/assignments/[id]/submissions.js');

const submissionsById = require('../handlers/submissions/[id].js');

const lessonsIndex = require('../handlers/lessons/index.js');
const lessonsById  = require('../handlers/lessons/[id].js');

const notificationsIndex = require('../handlers/notifications/index.js');
const notificationsRead  = require('../handlers/notifications/[id]/read.js');

const parentSession        = require('../handlers/parent/session.js');
const parentStudentsIndex  = require('../handlers/parent-students/index.js');
const parentStudentByName  = require('../handlers/parent-students/[student].js');

const postsById  = require('../handlers/posts/[id].js');
const auditIndex = require('../handlers/audit/index.js');

const statsTeacher = require('../handlers/stats/teacher.js');
const statsAdmin   = require('../handlers/stats/admin.js');

// Order matters: longer/more-specific patterns trước.
const routes = [
  // auth
  { pattern: /^\/api\/auth\/login\/?$/,    fn: authLogin },
  { pattern: /^\/api\/auth\/register\/?$/, fn: authRegister },
  { pattern: /^\/api\/auth\/logout\/?$/,   fn: authLogout },
  { pattern: /^\/api\/auth\/me\/?$/,       fn: authMe },

  // users
  { pattern: /^\/api\/users\/([^\/]+)\/classes\/?$/,     params: ['username'], fn: usersClasses },
  { pattern: /^\/api\/users\/([^\/]+)\/submissions\/?$/, params: ['username'], fn: usersSubmissions },
  { pattern: /^\/api\/users\/([^\/]+)\/?$/,              params: ['username'], fn: usersByUsername },
  { pattern: /^\/api\/users\/?$/,                                              fn: usersIndex },

  // classes
  { pattern: /^\/api\/classes\/([^\/]+)\/enrollments\/([^\/]+)\/?$/, params: ['id', 'username'], fn: classesEnrollmentByUser },
  { pattern: /^\/api\/classes\/([^\/]+)\/enrollments\/?$/,           params: ['id'], fn: classesEnrollments },
  { pattern: /^\/api\/classes\/([^\/]+)\/posts\/?$/,                 params: ['id'], fn: classesPosts },
  { pattern: /^\/api\/classes\/([^\/]+)\/progress\/?$/,              params: ['id'], fn: classesProgress },
  { pattern: /^\/api\/classes\/([^\/]+)\/?$/,                        params: ['id'], fn: classesById },
  { pattern: /^\/api\/classes\/?$/,                                                  fn: classesIndex },

  // assignments
  { pattern: /^\/api\/assignments\/([^\/]+)\/submissions\/?$/, params: ['id'], fn: assignmentsSubmissions },
  { pattern: /^\/api\/assignments\/([^\/]+)\/?$/,              params: ['id'], fn: assignmentsById },
  { pattern: /^\/api\/assignments\/?$/,                                        fn: assignmentsIndex },

  // submissions
  { pattern: /^\/api\/submissions\/([^\/]+)\/?$/, params: ['id'], fn: submissionsById },

  // lessons
  { pattern: /^\/api\/lessons\/([^\/]+)\/?$/, params: ['id'], fn: lessonsById },
  { pattern: /^\/api\/lessons\/?$/,                           fn: lessonsIndex },

  // notifications
  { pattern: /^\/api\/notifications\/([^\/]+)\/read\/?$/, params: ['id'], fn: notificationsRead },
  { pattern: /^\/api\/notifications\/?$/,                                 fn: notificationsIndex },

  // parent
  { pattern: /^\/api\/parent\/session\/?$/, fn: parentSession },

  // parent-students
  { pattern: /^\/api\/parent-students\/([^\/]+)\/?$/, params: ['student'], fn: parentStudentByName },
  { pattern: /^\/api\/parent-students\/?$/,                                fn: parentStudentsIndex },

  // posts
  { pattern: /^\/api\/posts\/([^\/]+)\/?$/, params: ['id'], fn: postsById },

  // audit
  { pattern: /^\/api\/audit\/?$/, fn: auditIndex },

  // stats
  { pattern: /^\/api\/stats\/teacher\/?$/, fn: statsTeacher },
  { pattern: /^\/api\/stats\/admin\/?$/,   fn: statsAdmin },
];

module.exports = async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const pathname = u.pathname;

  for (const route of routes) {
    const m = pathname.match(route.pattern);
    if (!m) continue;

    const query = {};
    u.searchParams.forEach((v, k) => { query[k] = v; });
    if (route.params) {
      route.params.forEach((name, i) => { query[name] = decodeURIComponent(m[i + 1]); });
    }
    req.query = query;

    return route.fn(req, res);
  }

  res.status(404).json({ message: 'Endpoint không tồn tại: ' + pathname });
};
