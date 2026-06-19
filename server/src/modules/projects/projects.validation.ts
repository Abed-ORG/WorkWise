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

export const createSprintValidation = [
  param('projectId').notEmpty().withMessage('Project ID is required'),
  body('name')
    .trim()
    .notEmpty().withMessage('Sprint name is required')
    .isLength({ max: 100 }).withMessage('Sprint name must be under 100 characters'),
  body('startDate')
    .optional()
    .isISO8601().withMessage('Start date must be a valid date'),
  body('endDate')
    .optional()
    .isISO8601().withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      const startDate = req.body?.startDate;
      if (startDate && value && new Date(value) < new Date(startDate)) {
        throw new Error('End date must be on or after start date');
      }
      return true;
    }),
  body('goal')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Sprint goal must be under 500 characters'),
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