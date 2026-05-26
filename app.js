(function () {
    'use strict';

    // ============ HTTP HELPER ============
    async function api(path, opts) {
        opts = opts || {};
        const init = {
            credentials: 'include',
            headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
            method: opts.method || (opts.body ? 'POST' : 'GET'),
        };
        if (opts.body !== undefined && typeof opts.body !== 'string') {
            init.body = JSON.stringify(opts.body);
        } else if (opts.body !== undefined) {
            init.body = opts.body;
        }
        const res = await fetch('/api' + path, init);
        let data = null;
        const text = await res.text();
        if (text) { try { data = JSON.parse(text); } catch { data = text; } }
        if (!res.ok) {
            const err = new Error((data && data.message) || res.statusText || 'Request failed');
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    function qs(obj) {
        if (!obj) return '';
        const parts = Object.entries(obj)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v));
        return parts.length ? '?' + parts.join('&') : '';
    }

    // ============ AUTH / SESSION ============
    let _meCache = null;
    let _mePromise = null;

    async function getCurrentUser() {
        if (_meCache !== null) return _meCache;
        if (_mePromise) return _mePromise;
        _mePromise = api('/auth/me').then(u => { _meCache = u; return u; }).catch(() => { _meCache = null; return null; });
        const result = await _mePromise;
        _mePromise = null;
        return result;
    }

    function clearSessionCache() { _meCache = null; _mePromise = null; }
    function setCurrentUser(user) { _meCache = user || null; }

    async function authenticate(identifier, password, role) {
        try {
            const user = await api('/auth/login', { method: 'POST', body: { identifier, password, role } });
            _meCache = user;
            return { ok: true, user };
        } catch (err) {
            return { ok: false, message: (err.data && err.data.message) || err.message || 'Đăng nhập thất bại' };
        }
    }

    async function registerAccount(payload) {
        try {
            const user = await api('/auth/register', { method: 'POST', body: payload });
            _meCache = user;
            return { ok: true, user };
        } catch (err) {
            return { ok: false, message: (err.data && err.data.message) || err.message || 'Đăng ký thất bại' };
        }
    }

    async function logout() {
        try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
        clearSessionCache();
    }

    async function ensureRoleAccess(expectedRole, fallbackUrl) {
        const user = await getCurrentUser();
        if (!user) { window.location.href = fallbackUrl || 'login.html'; return false; }
        if (expectedRole && user.role !== expectedRole) { window.location.href = getRoleHome(user.role); return false; }
        document.body.classList.remove('loading');
        return true;
    }

    // ============ USERS ============
    function getUsers(filter)   { return api('/users' + qs(filter)); }
    function getAllUsers()      { return getUsers(); }
    function getUserByUsername(username) { return api('/users/' + encodeURIComponent(username)); }
    function updateUser(username, updates) { return api('/users/' + encodeURIComponent(username), { method: 'PATCH', body: updates }); }
    function deleteUser(username) { return api('/users/' + encodeURIComponent(username), { method: 'DELETE' }); }
    function createUser(payload) { return api('/users', { method: 'POST', body: payload }); }

    // ============ CLASSES ============
    function getClasses()             { return api('/classes'); }
    function getClassById(classId)    { return api('/classes/' + encodeURIComponent(stripPrefix(classId))); }
    function getClassByCode(code)     {
        return api('/classes' + qs({ code })).then(list => (Array.isArray(list) && list[0]) || null);
    }
    function getTeacherClasses(teacher) { return api('/classes' + qs({ teacher })); }
    function createClass(name, code, teacherUsername) {
        return api('/classes', { method: 'POST', body: { name, code, teacher: teacherUsername } });
    }
    function updateClass(classId, updates) {
        return api('/classes/' + encodeURIComponent(stripPrefix(classId)), { method: 'PATCH', body: updates });
    }
    function deleteClass(classId) {
        return api('/classes/' + encodeURIComponent(stripPrefix(classId)), { method: 'DELETE' });
    }

    // ============ ENROLLMENTS ============
    function getClassStudents(classId) {
        return api('/classes/' + encodeURIComponent(stripPrefix(classId)) + '/enrollments');
    }
    function getStudentClasses(studentUsername) {
        return api('/users/' + encodeURIComponent(studentUsername) + '/classes');
    }
    async function enrollStudent(classId, studentUsername) {
        try {
            const enrollment = await api(
                '/classes/' + encodeURIComponent(stripPrefix(classId)) + '/enrollments',
                { method: 'POST', body: { studentUsername } }
            );
            return { ok: true, enrollment };
        } catch (err) {
            return { ok: false, message: (err.data && err.data.message) || err.message || 'Tham gia lớp thất bại' };
        }
    }
    function removeStudentEnrollment(classId, studentUsername) {
        return api('/classes/' + encodeURIComponent(stripPrefix(classId)) + '/enrollments/' + encodeURIComponent(studentUsername), { method: 'DELETE' });
    }

    // ============ ASSIGNMENTS ============
    function getAssignments(classId) {
        return api('/assignments' + qs(classId ? { classId: stripPrefix(classId) } : {}));
    }
    function getAssignmentById(assignmentId) {
        return api('/assignments/' + encodeURIComponent(stripPrefix(assignmentId)));
    }
    function createAssignment(classId, assignmentData) {
        return api('/assignments', { method: 'POST', body: Object.assign({ classId: stripPrefix(classId) }, assignmentData) });
    }
    function updateAssignment(assignmentId, updates) {
        return api('/assignments/' + encodeURIComponent(stripPrefix(assignmentId)), { method: 'PATCH', body: updates });
    }
    function deleteAssignment(assignmentId) {
        return api('/assignments/' + encodeURIComponent(stripPrefix(assignmentId)), { method: 'DELETE' });
    }

    // ============ SUBMISSIONS ============
    function getSubmissions(assignmentId) {
        if (!assignmentId) throw new Error('assignmentId is required');
        return api('/assignments/' + encodeURIComponent(stripPrefix(assignmentId)) + '/submissions');
    }
    function getStudentSubmissions(studentUsername, assignmentId) {
        const q = assignmentId ? { assignmentId: stripPrefix(assignmentId) } : {};
        return api('/users/' + encodeURIComponent(studentUsername) + '/submissions' + qs(q));
    }
    function submitAssignment(assignmentId, _studentUsername, answers, submissionFile) {
        return api('/assignments/' + encodeURIComponent(stripPrefix(assignmentId)) + '/submissions', {
            method: 'POST',
            body: { answers, submissionFile },
        });
    }
    function gradeSubmission(submissionId, score, feedback) {
        return api('/submissions/' + encodeURIComponent(stripPrefix(submissionId)), {
            method: 'PATCH', body: { score, feedback },
        });
    }

    // ============ LESSONS ============
    function getLessons(filter) { return api('/lessons' + qs(filter)); }
    function getLessonById(lessonId) { return api('/lessons/' + encodeURIComponent(stripPrefix(lessonId))); }
    function getLessonsByChapter(chapter) { return api('/lessons' + qs({ chapter })); }
    function createLesson(title, chapter, description, content, resources, duration, lessonUrl, classId) {
        return api('/lessons', {
            method: 'POST',
            body: { title, chapter, description, content, resources, duration, lessonUrl, classId: classId ? stripPrefix(classId) : undefined },
        });
    }
    function updateLesson(lessonId, updates) {
        const body = Object.assign({}, updates);
        if (body.classId) body.classId = stripPrefix(body.classId);
        return api('/lessons/' + encodeURIComponent(stripPrefix(lessonId)), { method: 'PATCH', body });
    }
    function deleteLesson(lessonId) {
        return api('/lessons/' + encodeURIComponent(stripPrefix(lessonId)), { method: 'DELETE' });
    }

    // ============ CLASS POSTS ============
    function getClassPostsByClassId(classId) {
        return api('/classes/' + encodeURIComponent(stripPrefix(classId)) + '/posts');
    }
    function getClassPostById(postId) {
        return api('/posts/' + encodeURIComponent(stripPrefix(postId)));
    }
    function createClassPost(classId, title, description, files, _createdBy) {
        return api('/classes/' + encodeURIComponent(stripPrefix(classId)) + '/posts', {
            method: 'POST', body: { title, description, files },
        });
    }
    function updateClassPost(postId, updates) {
        return api('/posts/' + encodeURIComponent(stripPrefix(postId)), { method: 'PATCH', body: updates });
    }
    function deleteClassPost(postId) {
        return api('/posts/' + encodeURIComponent(stripPrefix(postId)), { method: 'DELETE' });
    }

    // ============ PROGRESS ============
    function getClassProgress(classId) {
        return api('/classes/' + encodeURIComponent(stripPrefix(classId)) + '/progress');
    }
    async function calculateStudentProgress(studentUsername, classId) {
        const list = await getClassProgress(classId);
        return list.find(p => p.studentUsername === studentUsername) || null;
    }

    // ============ NOTIFICATIONS ============
    function getNotifications(userUsername) {
        return api('/notifications' + qs(userUsername ? { recipient: userUsername } : {}));
    }
    function getSentNotifications(senderUsername) {
        return api('/notifications' + qs({ sender: senderUsername }));
    }
    function addNotification(recipientUsername, title, message, type, _senderUsername, senderName) {
        return api('/notifications', {
            method: 'POST',
            body: { recipientUsername, title, message, type, senderName },
        });
    }
    function markNotificationAsRead(notificationId) {
        return api('/notifications/' + encodeURIComponent(stripPrefix(notificationId)) + '/read', { method: 'PATCH' });
    }

    // ============ AUDIT ============
    function getAuditLogs(limit) { return api('/audit' + qs(limit ? { limit } : {})); }

    // ============ STATS ============
    function getTeacherStats(teacher) { return api('/stats/teacher' + qs(teacher ? { teacher } : {})); }
    function getAdminStats() { return api('/stats/admin'); }

    // ============ PARENT-STUDENT ============
    function getStudentsByParent(parentUsername) {
        return api('/parent-students' + qs({ parent: parentUsername }));
    }
    function getStudentParents(studentUsername) {
        return api('/parent-students' + qs({ student: studentUsername }));
    }
    function linkParentStudent(payload) {
        return api('/parent-students', { method: 'POST', body: payload });
    }
    function unlinkParentStudent(parentUsername, studentUsername) {
        return api('/parent-students/' + encodeURIComponent(studentUsername) + qs({ parent: parentUsername }), { method: 'DELETE' });
    }
    function getParentSession() { return api('/parent/session'); }
    function setParentSession(studentUsername) {
        return api('/parent/session', { method: 'PUT', body: { studentUsername } });
    }

    // ============ UPLOADS ============
    async function uploadFile(file) {
        const url = '/api/uploads' + qs({ name: file.name });
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            const err = new Error((data && data.message) || 'Upload thất bại');
            err.status = res.status;
            throw err;
        }
        return data; // { url, pathname, name, size, type }
    }

    // ============ UTILITIES ============
    function stripPrefix(id) {
        if (id == null) return '';
        const s = String(id);
        const idx = s.lastIndexOf('_');
        return idx >= 0 ? s.slice(idx + 1) : s;
    }

    function normalize(value) { return String(value || '').trim().toLowerCase(); }

    function getRoleLabel(role) {
        return ({ admin: 'Admin', teacher: 'Giáo viên', parent: 'Phụ huynh', student: 'Học sinh' })[role] || 'Người dùng';
    }

    function getRoleHome(role) {
        return ({
            admin: 'dashboard.html',
            teacher: 'teacher-dashboard.html',
            parent: 'parent-dashboard.html',
            student: 'student-home.html',
        })[role] || 'index.html';
    }

    function initials(name) {
        const source = String(name || '').trim();
        if (!source) return 'G';
        return source.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
    }

    function bindLogout(selector) {
        const element = document.querySelector(selector);
        if (!element) return;
        element.addEventListener('click', async (event) => {
            event.preventDefault();
            await logout();
            window.location.href = 'login.html';
        });
    }

    function updateText(selector, value) {
        const element = document.querySelector(selector);
        if (element) element.textContent = value;
    }

    function buildGlobalNav() {
        if (document.querySelector('.global-nav')) return;
        if (!document.body.classList.contains('dashboard-page')) return;

        const path = window.location.pathname.split('/').pop() || 'index.html';
        let items = [];

        if (path.startsWith('student-') || path === 'student-home.html') {
            items = [
                { label: 'Trang chủ', href: 'index.html' },
                { label: 'Cổng học sinh', href: 'student-home.html' },
                { label: 'Tham gia lớp', href: 'student-join-class.html' },
                { label: 'Học bài', href: 'student-learn.html' },
                { label: 'Làm bài', href: 'student-practice.html' },
                { label: 'Kết quả', href: 'student-results.html' },
                { label: 'Tiến độ', href: 'student-progress.html' },
            ];
        } else if (path.startsWith('teacher-') || path === 'teacher-dashboard.html') {
            items = [
                { label: 'Trang chủ', href: 'index.html' },
                { label: 'Cổng giáo viên', href: 'teacher-dashboard.html' },
                { label: 'Học sinh', href: 'teacher-students.html' },
                { label: 'Bài giảng', href: 'teacher-manage-lessons.html' },
                { label: 'Giao bài', href: 'teacher-assignments.html' },
                { label: 'Chấm điểm', href: 'teacher-grading.html' },
                { label: 'Theo dõi', href: 'teacher-tracking.html' },
                { label: 'Thống kê', href: 'teacher-stats.html' },
            ];
        } else if (path.startsWith('parent-') || path === 'parent-dashboard.html') {
            items = [
                { label: 'Trang chủ', href: 'index.html' },
                { label: 'Cổng phụ huynh', href: 'parent-dashboard.html' },
                { label: 'Kết quả', href: 'parent-results.html' },
                { label: 'Tiến độ', href: 'parent-progress.html' },
                { label: 'Bài tập sắp tới', href: 'parent-upcoming.html' },
                { label: 'Thông báo', href: 'parent-notifications.html' },
                { label: 'Liên hệ', href: 'parent-contact.html' },
            ];
        } else if (path.startsWith('admin-') || path === 'dashboard.html') {
            items = [
                { label: 'Trang chủ', href: 'index.html' },
                { label: 'Cổng admin', href: 'dashboard.html' },
                { label: 'Tài khoản', href: 'admin-accounts.html' },
                { label: 'Lớp học', href: 'admin-classes.html' },
                { label: 'Dữ liệu', href: 'admin-audit.html' },
                { label: 'Thống kê', href: 'admin-stats.html' },
            ];
        }
        if (!items.length) return;

        const nav = document.createElement('header');
        nav.className = 'global-nav';
        const brand = document.createElement('a');
        brand.className = 'global-brand';
        brand.href = 'index.html';
        brand.innerHTML = '<img src="logo.png" alt="GeoConnect 6"><span>GeoConnect 6</span>';
        const menu = document.createElement('nav');
        menu.className = 'global-menu';
        menu.innerHTML = items.map(it => `<a href="${it.href}">${it.label}</a>`).join('');
        menu.querySelectorAll('a').forEach(link => {
            if (link.getAttribute('href') === path) link.classList.add('active');
        });
        nav.appendChild(brand);
        nav.appendChild(menu);
        document.body.insertBefore(nav, document.body.firstChild);
    }

    // ============ EXPORT ============
    window.GeoConnectApp = {
        // HTTP helper
        api,
        uploadFile,
        // Auth
        getCurrentUser,
        setCurrentUser,
        clearSessionCache,
        logout,
        authenticate,
        registerAccount,
        ensureRoleAccess,
        getRoleLabel,
        getRoleHome,
        // Users
        getUsers,
        getAllUsers,
        getUserByUsername,
        updateUser,
        deleteUser,
        createUser,
        // Classes
        getClasses,
        getClassById,
        getClassByCode,
        getTeacherClasses,
        createClass,
        updateClass,
        deleteClass,
        // Enrollments
        getClassStudents,
        getStudentClasses,
        enrollStudent,
        removeStudentEnrollment,
        // Assignments
        getAssignments,
        getAssignmentById,
        createAssignment,
        updateAssignment,
        deleteAssignment,
        // Submissions
        getSubmissions,
        getStudentSubmissions,
        submitAssignment,
        gradeSubmission,
        // Lessons
        getLessons,
        getLessonById,
        getLessonsByChapter,
        createLesson,
        updateLesson,
        deleteLesson,
        // Class posts
        getClassPostsByClassId,
        getClassPostById,
        createClassPost,
        updateClassPost,
        deleteClassPost,
        // Progress
        getClassProgress,
        calculateStudentProgress,
        // Notifications
        getNotifications,
        getSentNotifications,
        addNotification,
        markNotificationAsRead,
        // Audit
        getAuditLogs,
        // Stats
        getTeacherStats,
        getAdminStats,
        // Parent-student
        getStudentsByParent,
        getStudentParents,
        linkParentStudent,
        unlinkParentStudent,
        getParentSession,
        setParentSession,
        // Utilities
        initials,
        normalize,
        bindLogout,
        updateText,
        buildGlobalNav,
        stripPrefix,
    };

    document.addEventListener('DOMContentLoaded', function () {
        buildGlobalNav();
    });
})();
