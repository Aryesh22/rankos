/**
 * User roles across RankOS. `student` is the default for self-registration.
 * `admin` is privileged and can never be self-assigned during registration.
 */
export const ROLES = Object.freeze({
  STUDENT: "student",
  PARENT: "parent",
  TEACHER: "teacher",
  ADMIN: "admin",
});

/** All role values as an array (handy for Mongoose enums / Zod). */
export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

/** Roles a user is allowed to pick when registering (admin excluded). */
export const SELF_ASSIGNABLE_ROLES = Object.freeze([
  ROLES.STUDENT,
  ROLES.PARENT,
  ROLES.TEACHER,
]);

export default ROLES;
