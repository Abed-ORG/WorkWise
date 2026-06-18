import { Router, Request, Response } from 'express';
import { projectsController } from './projects.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { invitationEmailLimiter } from '../../middleware/email-rate-limit.middleware';
import {
  createProjectValidation,
  updateProjectValidation,
  inviteMemberValidation,
  updateMemberRoleValidation,
  startSprintValidation,
  saveProjectDocumentValidation,
  createProjectDocumentValidation,
  updateProjectDocumentValidation,
  documentIdValidation,
} from './projects.validation';

const router = Router();

router.use(authenticate);

// Static invitation paths must be declared before the dynamic /:projectId path.
router.get('/invitations/me', (req: Request, res: Response) => projectsController.getUserInvitations(req, res));
router.post('/invitations/:invitationId/accept', (req: Request, res: Response) => projectsController.acceptInvitation(req, res));
router.post('/invitations/:invitationId/decline', (req: Request, res: Response) => projectsController.declineInvitation(req, res));

router.post('/', createProjectValidation, (req: Request, res: Response) => projectsController.createProject(req, res));
router.get('/', (req: Request, res: Response) => projectsController.getUserProjects(req, res));
router.get('/:projectId/documents', (req: Request, res: Response) => projectsController.getProjectDocuments(req, res));
router.post('/:projectId/documents', createProjectDocumentValidation, (req: Request, res: Response) => projectsController.createProjectDocument(req, res));
router.get('/:projectId/documents/:documentId', documentIdValidation, (req: Request, res: Response) => projectsController.getProjectDocumentById(req, res));
router.put('/:projectId/documents/:documentId', updateProjectDocumentValidation, (req: Request, res: Response) => projectsController.updateProjectDocumentById(req, res));
router.delete('/:projectId/documents/:documentId', documentIdValidation, (req: Request, res: Response) => projectsController.deleteProjectDocument(req, res));
router.get('/:projectId/sprints/:sprintId/documents', (req: Request, res: Response) => projectsController.getSprintDocuments(req, res));
router.put('/:projectId/sprints/:sprintId/documents', (req: Request, res: Response) => projectsController.updateSprintDocuments(req, res));
router.get('/:projectId', (req: Request, res: Response) => projectsController.getProjectById(req, res));
router.patch('/:projectId', updateProjectValidation, (req: Request, res: Response) => projectsController.updateProject(req, res));
router.delete('/:projectId', (req: Request, res: Response) => projectsController.deleteProject(req, res));
router.get('/:projectId/document', (req: Request, res: Response) => projectsController.getProjectDocument(req, res));
router.put('/:projectId/document', saveProjectDocumentValidation, (req: Request, res: Response) => projectsController.saveProjectDocument(req, res));
router.post('/:projectId/sprints/start', startSprintValidation, (req: Request, res: Response) => projectsController.startSprint(req, res));

router.post('/:projectId/members/invite', invitationEmailLimiter, inviteMemberValidation, (req: Request, res: Response) => projectsController.inviteMember(req, res));
router.get('/:projectId/members/invitations', (req: Request, res: Response) => projectsController.getProjectInvitations(req, res));
router.patch('/:projectId/members/:memberId/role', updateMemberRoleValidation, (req: Request, res: Response) => projectsController.updateMemberRole(req, res));
router.delete('/:projectId/members/:memberId', (req: Request, res: Response) => projectsController.removeMember(req, res));

export default router;
