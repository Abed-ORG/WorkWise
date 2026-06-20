import { body } from "express-validator";

export const taskBreakdownValidation = [
  body("featureDescription")
    .trim()
    .notEmpty()
    .withMessage("Feature description is required")
    .isLength({ max: 4000 })
    .withMessage("Feature description must be under 4000 characters"),
  body("projectContext")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 4000 })
    .withMessage("Project context must be under 4000 characters"),
];

export const acceptanceCriteriaValidation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Task title is required")
    .isLength({ max: 200 })
    .withMessage("Task title must be under 200 characters"),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("Task description is required")
    .isLength({ max: 4000 })
    .withMessage("Task description must be under 4000 characters"),
];

