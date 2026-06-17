import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { projectsService } from './projects.service';
import { Role } from '@prisma/client';

export class ProjectsController {

  // ── Create Project ─────────────────────────────────────────
  async createProject(req: Request, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, key, description } = req.body;
      const creatorId = String((req as any).user?.userId);

      const project = await projectsService.createProject({
        name,
        key: key.toUpperCase(),
        description,
        creatorId,
      });

      return res.status(201).json({ success: true, data: project });
    } catch (error: any) {
      if (error.message === 'PROJECT_KEY_EXISTS') {
        return res.status(409).json({ success: false, message: 'Project key already exists' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── Get User Projects ──────────────────────────────────────
  async getUserProjects(req: Request, res: Response) {
    try {
      const userId = String((req as any).user?.userId);
      const projects = await projectsService.getUserProjects(userId);
      return res.status(200).json({ success: true, data: projects });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── Get Project By ID ──────────────────────────────────────
  async getProjectById(req: Request, res: Response) {
    try {
      const projectId = String(req.params['projectId']);
      const userId = String((req as any).user?.userId);

      const project = await projectsService.getProjectById(projectId, userId);
      return res.status(200).json({ success: true, data: project });
    } catch (error: any) {
      if (error.message === 'PROJECT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── Update Project ─────────────────────────────────────────
  async updateProject(req: Request, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const projectId = String(req.params['projectId']);
      const userId = String((req as any).user?.userId);
      const { name, description } = req.body;

      const project = await projectsService.updateProject(projectId, userId, {
        name,
        description,
      });

      return res.status(200).json({ success: true, data: project });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        return res.status(403).json({ success: false, message: 'Only admins can update the project' });
      }
      if (error.message === 'PROJECT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── Delete Project ─────────────────────────────────────────
  async deleteProject(req: Request, res: Response) {
    try {
      const projectId = String(req.params['projectId']);
      const userId = String((req as any).user?.userId);

      await projectsService.deleteProject(projectId, userId);
      return res.status(200).json({ success: true, message: 'Project deleted successfully' });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        return res.status(403).json({ success: false, message: 'Only admins can delete the project' });
      }
      if (error.message === 'PROJECT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── Invite Member ──────────────────────────────────────────
  async inviteMember(req: Request, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const projectId = String(req.params['projectId']);
      const senderId = String((req as any).user?.userId);
      const { email, role } = req.body;

      const invitation = await projectsService.inviteMember(projectId, senderId, {
        email,
        role: role as Role,
      });

      return res.status(201).json({ success: true, data: invitation });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        return res.status(403).json({ success: false, message: 'Only admins can invite members' });
      }
      if (error.message === 'INVITATION_ALREADY_PENDING') {
        return res.status(409).json({ success: false, message: 'Invitation already pending for this email' });
      }
      if (error.message === 'USER_ALREADY_MEMBER') {
        return res.status(409).json({ success: false, message: 'User is already a member of this project' });
      }
      if (error.message === 'MAIL_NOT_CONFIGURED') {
        return res.status(503).json({ success: false, message: 'Email delivery is not configured yet' });
      }
      if (error.message === 'EMAIL_DELIVERY_FAILED') {
        return res.status(502).json({ success: false, message: 'The invitation email could not be delivered' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── Get Project Invitations ────────────────────────────────
  async getProjectInvitations(req: Request, res: Response) {
    try {
      const projectId = String(req.params['projectId']);
      const userId = String((req as any).user?.userId);

      const invitations = await projectsService.getProjectInvitations(projectId, userId);
      return res.status(200).json({ success: true, data: invitations });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        return res.status(403).json({ success: false, message: 'Only admins can view invitations' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── Get User Invitations ───────────────────────────────────
  async getUserInvitations(req: Request, res: Response) {
    try {
      const userId = String((req as any).user?.userId);
      const invitations = await projectsService.getUserInvitations(userId);
      return res.status(200).json({ success: true, data: invitations });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── Accept Invitation ──────────────────────────────────────
  async acceptInvitation(req: Request, res: Response) {
    try {
      const invitationId = String(req.params['invitationId']);
      const userId = String((req as any).user?.userId);

      const project = await projectsService.acceptInvitation(invitationId, userId);
      return res.status(200).json({ success: true, data: project });
    } catch (error: any) {
      if (error.message === 'INVITATION_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Invitation not found' });
      }
      if (error.message === 'INVITATION_NOT_FOR_USER') {
        return res.status(403).json({ success: false, message: 'This invitation is not for you' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── Decline Invitation ─────────────────────────────────────
  async declineInvitation(req: Request, res: Response) {
    try {
      const invitationId = String(req.params['invitationId']);
      const userId = String((req as any).user?.userId);

      await projectsService.declineInvitation(invitationId, userId);
      return res.status(200).json({ success: true, message: 'Invitation declined' });
    } catch (error: any) {
      if (error.message === 'INVITATION_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Invitation not found' });
      }
      if (error.message === 'INVITATION_NOT_FOR_USER') {
        return res.status(403).json({ success: false, message: 'This invitation is not for you' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async startSprint(req: Request, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const projectId = String(req.params['projectId']);
      const userId = String((req as any).user?.userId);
      const sprint = await projectsService.startSprint(projectId, userId, req.body);
      return res.status(201).json({ success: true, data: sprint });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        return res.status(403).json({ success: false, message: 'Only project admins can start sprints' });
      }
      if (error.message === 'ACTIVE_SPRINT_EXISTS') {
        return res.status(409).json({ success: false, message: 'This project already has an active sprint' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async getProjectDocuments(req: Request, res: Response) {
    try {
      const projectId = String(req.params['projectId']);
      const userId = String((req as any).user?.userId);
      const documents = await projectsService.getProjectDocuments(projectId, userId);
      return res.status(200).json({ success: true, data: documents });
    } catch (error: any) {
      if (error.message === 'PROJECT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async createProjectDocument(req: Request, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const projectId = String(req.params['projectId']);
      const userId = String((req as any).user?.userId);
      const document = await projectsService.createProjectDocument(projectId, userId, {
        title: req.body.title,
        content: req.body.content,
      });
      return res.status(201).json({ success: true, data: document });
    } catch (error: any) {
      if (error.message === 'PROJECT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async getProjectDocumentById(req: Request, res: Response) {
    try {
      const projectId = String(req.params['projectId']);
      const documentId = String(req.params['documentId']);
      const userId = String((req as any).user?.userId);
      const document = await projectsService.getProjectDocumentById(projectId, userId, documentId);
      return res.status(200).json({ success: true, data: document });
    } catch (error: any) {
      if (error.message === 'PROJECT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      if (error.message === 'DOCUMENT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Document not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async updateProjectDocumentById(req: Request, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const projectId = String(req.params['projectId']);
      const documentId = String(req.params['documentId']);
      const userId = String((req as any).user?.userId);
      const document = await projectsService.updateProjectDocument(projectId, userId, documentId, {
        title: req.body.title,
        content: req.body.content,
      });
      return res.status(200).json({ success: true, data: document });
    } catch (error: any) {
      if (error.message === 'PROJECT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      if (error.message === 'DOCUMENT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Document not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async deleteProjectDocument(req: Request, res: Response) {
    try {
      const projectId = String(req.params['projectId']);
      const documentId = String(req.params['documentId']);
      const userId = String((req as any).user?.userId);
      await projectsService.deleteProjectDocument(projectId, userId, documentId);
      return res.status(200).json({ success: true, message: 'Document deleted successfully' });
    } catch (error: any) {
      if (error.message === 'PROJECT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      if (error.message === 'DOCUMENT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Document not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async getProjectDocument(req: Request, res: Response) {
    try {
      const projectId = String(req.params['projectId']);
      const userId = String((req as any).user?.userId);
      const document = await projectsService.getProjectDocument(projectId, userId);
      return res.status(200).json({ success: true, data: document });
    } catch (error: any) {
      if (error.message === 'PROJECT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async saveProjectDocument(req: Request, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const projectId = String(req.params['projectId']);
      const userId = String((req as any).user?.userId);
      const document = await projectsService.saveProjectDocument(projectId, userId, {
        title: req.body.title,
        content: req.body.content,
      });
      return res.status(200).json({ success: true, data: document });
    } catch (error: any) {
      if (error.message === 'PROJECT_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── Update Member Role ─────────────────────────────────────
  async updateMemberRole(req: Request, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const projectId = String(req.params['projectId']);
      const memberId = String(req.params['memberId']);
      const requesterId = String((req as any).user?.userId);
      const { role } = req.body;

      const member = await projectsService.updateMemberRole(
        projectId,
        requesterId,
        memberId,
        role as Role
      );

      return res.status(200).json({ success: true, data: member });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        return res.status(403).json({ success: false, message: 'Only admins can change member roles' });
      }
      if (error.message === 'MEMBER_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── Remove Member ──────────────────────────────────────────
  async removeMember(req: Request, res: Response) {
    try {
      const projectId = String(req.params['projectId']);
      const memberId = String(req.params['memberId']);
      const requesterId = String((req as any).user?.userId);

      await projectsService.removeMember(projectId, requesterId, memberId);
      return res.status(200).json({ success: true, message: 'Member removed successfully' });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        return res.status(403).json({ success: false, message: 'Only admins can remove members' });
      }
      if (error.message === 'CANNOT_REMOVE_SELF') {
        return res.status(400).json({ success: false, message: 'You cannot remove yourself from the project' });
      }
      if (error.message === 'MEMBER_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

export const projectsController = new ProjectsController();
