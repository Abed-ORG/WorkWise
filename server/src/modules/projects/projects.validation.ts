import { body, param } from 'express-validator';

export const createProjectValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Project name is required')
    .isLength({ max: 100 }).withMessage('Project name must be under 100 characters'),

  body('key')
    .trim()
    .notEmpty().withMessage('Project key is required')
    .isUppercase().withMessage('Project key must be uppercase')
    .isLength({ min: 2, max: 5 }).withMessage('Project key must be 2-5 characters')
    .matches(/^[A-Z]+$/).withMessage('Project key must contain only letters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must be under 500 characters'),
];

export const updateProjectValidation = [
  param('projectId')
    .notEmpty().withMessage('Project ID is required'),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Project name must be under 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must be under 500 characters'),
];

export const inviteMemberValidation = [
  param('projectId')
    .notEmpty().withMessage('Project ID is required'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address'),

  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['ADMIN', 'DEVELOPER', 'VIEWER']).withMessage('Invalid role'),
];

export const updateMemberRoleValidation = [
  param('projectId')
    .notEmpty().withMessage('Project ID is required'),

  param('memberId')
    .notEmpty().withMessage('Member ID is required'),

  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['ADMIN', 'DEVELOPER', 'VIEWER']).withMessage('Invalid role'),
];

export const startSprintValidation = [
  param('projectId').notEmpty().withMessage('Project ID is required'),
  body('name')
    .trim()
    .notEmpty().withMessage('Sprint name is required')
    .isLength({ max: 100 }).withMessage('Sprint name must be under 100 characters'),
  body('goal')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Sprint goal must be under 500 characters'),
];

export const documentIdValidation = [
  param('projectId').notEmpty().withMessage('Project ID is required'),
  param('documentId').notEmpty().withMessage('Document ID is required'),
];

export const saveProjectDocumentValidation = [
  param('projectId').notEmpty().withMessage('Project ID is required'),
  body('title')
    .trim()
    .notEmpty().withMessage('Document title is required')
    .isLength({ max: 150 }).withMessage('Document title must be under 150 characters'),
  body('content')
    .optional({ nullable: true })
    .isString().withMessage('Document content must be text'),
];

export const createProjectDocumentValidation = saveProjectDocumentValidation;

export const updateProjectDocumentValidation = [
  ...documentIdValidation,
  body('title')
    .trim()
    .notEmpty().withMessage('Document title is required')
    .isLength({ max: 150 }).withMessage('Document title must be under 150 characters'),
  body('content')
    .optional({ nullable: true })
    .isString().withMessage('Document content must be text'),
];
