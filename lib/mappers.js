// Map DB rows → JSON shape khớp localStorage cũ để frontend không phải đổi nhiều.

function user(r) {
  if (!r) return null;
  return {
    username: r.username,
    fullName: r.full_name,
    role: r.role,
    contact: r.contact,
    phone: r.phone,
    studentCode: r.student_code,
    selectedStudentUsername: r.selected_student_username,
  };
}

function klass(r) {
  if (!r) return null;
  return {
    id: 'class_' + r.id,
    rawId: Number(r.id),
    name: r.name,
    code: r.code,
    teacher: r.teacher,
    status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : null,
  };
}

function enrollment(r) {
  if (!r) return null;
  return {
    id: 'enr_' + r.id,
    rawId: Number(r.id),
    classId: 'class_' + r.class_id,
    studentUsername: r.student,
    enrolledAt: r.enrolled_at ? new Date(r.enrolled_at).getTime() : null,
  };
}

function assignment(r) {
  if (!r) return null;
  return {
    id: 'assign_' + r.id,
    rawId: Number(r.id),
    classId: 'class_' + r.class_id,
    title: r.title,
    description: r.description,
    type: r.type,
    dueAt: r.due_at ? new Date(r.due_at).getTime() : null,
    questions: r.questions || [],
    attachments: r.attachments || [],
    assignmentUrl: r.assignment_url,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : null,
  };
}

function submission(r) {
  if (!r) return null;
  return {
    id: 'sub_' + r.id,
    rawId: Number(r.id),
    assignmentId: 'assign_' + r.assignment_id,
    studentUsername: r.student,
    answers: r.answers || [],
    submissionFile: r.submission_file,
    score: r.score == null ? null : Number(r.score),
    feedback: r.feedback || '',
    submittedAt: r.submitted_at ? new Date(r.submitted_at).getTime() : null,
    gradedAt: r.graded_at ? new Date(r.graded_at).getTime() : null,
  };
}

function lesson(r) {
  if (!r) return null;
  return {
    id: 'lesson_' + r.id,
    rawId: Number(r.id),
    classId: r.class_id ? 'class_' + r.class_id : '',
    title: r.title,
    chapter: r.chapter,
    description: r.description,
    content: r.content,
    resources: r.resources || [],
    duration: r.duration,
    lessonUrl: r.lesson_url,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : null,
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : null,
  };
}

function classPost(r) {
  if (!r) return null;
  return {
    id: 'post_' + r.id,
    rawId: Number(r.id),
    classId: 'class_' + r.class_id,
    title: r.title,
    description: r.description,
    files: r.files || [],
    createdBy: r.created_by,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : null,
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : null,
  };
}

function notification(r) {
  if (!r) return null;
  return {
    id: 'notif_' + r.id,
    rawId: Number(r.id),
    recipientUsername: r.recipient,
    senderUsername: r.sender,
    senderName: r.sender_name,
    title: r.title,
    message: r.message,
    type: r.type,
    read: r.is_read,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : null,
  };
}

function auditLog(r) {
  if (!r) return null;
  return {
    id: 'log_' + r.id,
    rawId: Number(r.id),
    action: r.action,
    details: r.details,
    userId: r.user_id,
    timestamp: r.created_at ? new Date(r.created_at).getTime() : null,
  };
}

function parentStudent(r) {
  if (!r) return null;
  return {
    parentUsername: r.parent,
    studentUsername: r.student,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : null,
  };
}

// Parse string id "class_42" / "assign_42" / "42" → bigint
function parseId(prefixedOrRaw) {
  if (prefixedOrRaw == null) return null;
  const s = String(prefixedOrRaw);
  const idx = s.lastIndexOf('_');
  const num = idx >= 0 ? s.slice(idx + 1) : s;
  const n = Number(num);
  return Number.isFinite(n) && n > 0 ? n : null;
}

module.exports = {
  user, klass, enrollment, assignment, submission, lesson,
  classPost, notification, auditLog, parentStudent, parseId,
};
