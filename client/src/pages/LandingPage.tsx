import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import Brand from '../components/Brand';
import Icon, { type IconName } from '../components/Icon';
import ThemeToggle from '../components/ThemeToggle';

type WorkflowItem = {
  label: string;
  detail: string;
  icon: IconName;
};

type Solution = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: IconName;
  accent: string;
  bullets: string[];
};

type Template = {
  id: string;
  title: string;
  label: string;
  description: string;
  icon: IconName;
  points: string[];
};

const workflow: WorkflowItem[] = [
  { label: 'Create workspace', detail: 'Set the project goal', icon: 'folder' },
  { label: 'Plan sprint', detail: 'Prioritize the next move', icon: 'calendar' },
  { label: 'Move work live', detail: 'Realtime board updates', icon: 'board' },
  { label: 'Keep context', detail: 'Docs, comments, and feed', icon: 'sparkles' },
];

const columns = [
  { title: 'Backlog', tasks: ['Shape onboarding', 'Write project brief'] },
  { title: 'In progress', tasks: ['Build sprint board'] },
  { title: 'Review', tasks: ['Invite flow QA'] },
];

const solutions: Solution[] = [
  {
    id: 'projects',
    eyebrow: 'WorkWise projects',
    title: 'Dream it, plan it, launch it.',
    body: 'Start with a clean workspace, a project key, teammates, roles, and one place where every task belongs.',
    icon: 'folder',
    accent: '#FFEE32',
    bullets: ['Project dashboard', 'Role-based members', 'Workspace invitations'],
  },
  {
    id: 'board',
    eyebrow: 'Kanban delivery',
    title: 'See work move, not just sit.',
    body: 'Backlog, To Do, In Progress, Review, and Done columns keep the project board readable for every teammate.',
    icon: 'board',
    accent: '#FFD100',
    bullets: ['Drag and drop status', 'Priority signals', 'Assigned work cards'],
  },
  {
    id: 'sync',
    eyebrow: 'Realtime teamwork',
    title: 'Stay in sync without refreshing.',
    body: 'Socket-powered updates, notifications, and project rooms help teammates react to task changes as they happen.',
    icon: 'bell',
    accent: '#D6D6D6',
    bullets: ['Live board events', 'Unread notification bell', 'Project-specific rooms'],
  },
  {
    id: 'context',
    eyebrow: 'Project memory',
    title: 'Keep the why beside the work.',
    body: 'Documents, comments, and activity feed entries preserve decisions so the team can follow the story of a project.',
    icon: 'activity',
    accent: '#FFEE32',
    bullets: ['Comment threads', 'Activity timeline', 'Project notes'],
  },
];

const templates: Template[] = [
  {
    id: 'scrum',
    title: 'Scrum planning',
    label: 'Sprint-ready teams',
    description: 'Plan delivery cycles, pull tasks from the backlog, and keep the sprint goal visible.',
    icon: 'calendar',
    points: ['Create a project', 'Build a backlog', 'Start a focused sprint', 'Review progress in the board'],
  },
  {
    id: 'kanban',
    title: 'Kanban board',
    label: 'Continuous delivery',
    description: 'Visualize work from backlog to done with cards, priorities, assignees, and live status updates.',
    icon: 'board',
    points: ['Backlog to Done columns', 'Drag cards between states', 'See owner and priority at a glance'],
  },
  {
    id: 'backlog',
    title: 'Task backlog',
    label: 'Work queue control',
    description: 'Create, assign, sort, and prioritize the work that will feed project boards and sprints.',
    icon: 'tasks',
    points: ['Task creation modal', 'Assignee and due date fields', 'Bulk planning surface'],
  },
  {
    id: 'activity',
    title: 'Activity hub',
    label: 'Team awareness',
    description: 'Track task moves, comments, sprint events, and notifications without leaving the project.',
    icon: 'activity',
    points: ['Project feed', 'Notification center', 'Comment history'],
  },
];

function SolutionPreview({ solution }: { solution: Solution }) {
  return (
    <div className={`solution-preview solution-preview-${solution.id}`} style={{ '--solution-accent': solution.accent } as CSSProperties}>
      <div className="solution-preview-top">
        <Brand compact />
        <span><Icon name="search" size={13} /> Search work</span>
        <i>WW</i>
      </div>
      <div className="solution-preview-body">
        <aside>
          {solutions.map((item) => (
            <b className={item.id === solution.id ? 'active' : ''} key={item.id}>
              <Icon name={item.icon} size={15} />
            </b>
          ))}
        </aside>
        <section>
          <div className="solution-preview-title">
            <span><Icon name={solution.icon} size={18} /></span>
            <div>
              <small>{solution.eyebrow}</small>
              <strong>{solution.title}</strong>
            </div>
          </div>

          {solution.id === 'context' ? (
            <div className="solution-timeline">
              {['Task created by Yehia', 'Comment added by Hadi', 'Sprint started by Taimour'].map((item) => (
                <span key={item}><i />{item}<em>now</em></span>
              ))}
            </div>
          ) : (
            <div className="solution-board">
              {['Backlog', 'To Do', 'In Progress'].map((column, index) => (
                <div className="solution-column" key={column}>
                  <header>{column}<em>{index + 1}</em></header>
                  <p>{solution.bullets[index] ?? solution.title}</p>
                  <i />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <div className="solution-floating-card">
        <span><Icon name={solution.icon} size={15} /></span>
        <strong>{solution.bullets[0]}</strong>
        <small>Updated live in WorkWise</small>
      </div>
    </div>
  );
}

function TemplatePreview({ template }: { template: Template }) {
  if (template.id === 'kanban') {
    return (
      <div className="template-mini-window template-mini-kanban">
        <header>
          <Brand compact />
          <span>Kanban board</span>
        </header>
        <div className="template-kanban-board">
          {['Backlog', 'To Do', 'In Progress', 'Review'].map((column, index) => (
            <div className="template-kanban-column" key={column}>
              <strong>{column}</strong>
              <span className={index === 1 ? 'is-dragging' : ''}>
                <i>{index + 1}</i>
                {template.points[index] ?? 'Move work forward'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (template.id === 'backlog') {
    return (
      <div className="template-mini-window template-mini-backlog">
        <header>
          <Brand compact />
          <span>Task backlog</span>
        </header>
        <div className="template-backlog-table">
          {template.points.map((point, index) => (
            <span key={point} style={{ '--delay': `${index * 0.14}s` } as CSSProperties}>
              <i>{index + 1}</i>
              <strong>{point}</strong>
              <em>{index === 0 ? 'High' : index === 1 ? 'Owner' : 'Batch'}</em>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (template.id === 'activity') {
    return (
      <div className="template-mini-window template-mini-activity">
        <header>
          <Brand compact />
          <span>Activity hub</span>
        </header>
        <div className="template-activity-feed">
          {template.points.map((point, index) => (
            <span key={point} style={{ '--delay': `${index * 0.14}s` } as CSSProperties}>
              <i><Icon name={index === 1 ? 'bell' : index === 2 ? 'activity' : 'check'} size={14} /></i>
              <strong>{point}</strong>
              <small>{index === 0 ? 'Project timeline' : index === 1 ? 'Unread alerts' : 'Task context'}</small>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="template-mini-window template-mini-scrum">
      <header>
        <Brand compact />
        <span>Scrum planning</span>
      </header>
      <div className="template-mini-board">
        {template.points.slice(0, 4).map((point, index) => (
          <div className="template-mini-card" key={point} style={{ '--delay': `${index * 0.14}s` } as CSSProperties}>
            <i>{index + 1}</i>
            <strong>{point}</strong>
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [activeSolutionIndex, setActiveSolutionIndex] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const solutionShellRef = useRef<HTMLDivElement | null>(null);
  const activeSolution = solutions[activeSolutionIndex];

  useEffect(() => {
    let frame = 0;

    const updateActiveSolution = () => {
      frame = 0;
      const shell = solutionShellRef.current;
      if (!shell) return;

      const rect = shell.getBoundingClientRect();
      const scrollDistance = Math.max(1, rect.height - window.innerHeight);
      const rawProgress = (-rect.top + window.innerHeight * 0.2) / scrollDistance;
      const isNearSection = rawProgress > -0.12 && rawProgress < 1.12;

      if (!isNearSection) return;

      const progress = Math.min(0.999, Math.max(0, rawProgress));
      const nextIndex = Math.min(solutions.length - 1, Math.floor(progress * solutions.length));
      setActiveSolutionIndex((current) => (current === nextIndex ? current : nextIndex));
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveSolution);
    };

    updateActiveSolution();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, []);

  useEffect(() => {
    if (!selectedTemplate) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedTemplate]);

  return (
    <main className="landing-page">
      <div className="auth-logo-intro landing-logo-intro" aria-hidden="true">
        <div className="auth-logo-intro-inner"><Brand tagline /></div>
        <span className="auth-logo-trace" />
      </div>

      <div className="landing-ambient" aria-hidden="true">
        <span className="landing-orbit landing-orbit-one" />
        <span className="landing-orbit landing-orbit-two" />
        <span className="landing-glow landing-glow-one" />
        <span className="landing-glow landing-glow-two" />
        <span className="landing-spark landing-spark-one" />
        <span className="landing-spark landing-spark-two" />
        <span className="landing-spark landing-spark-three" />
      </div>

      <header className="landing-nav">
        <Brand tagline />
        <nav aria-label="Landing sections">
          <a href="#workflow">Workflow</a>
          <a href="#solutions">Solutions</a>
          <a href="#templates">Templates</a>
        </nav>
        <div className="landing-nav-actions">
          <ThemeToggle />
          <Link to="/login" className="landing-login">Log in</Link>
          <Link to="/register" className="btn btn-primary">Create account</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-copy animate-enter">
          <p className="landing-kicker">Plan smart. Work wise.</p>
          <h1>Turn every project into visible <span>momentum.</span></h1>
          <p>
            WorkWise brings tasks, sprints, teammates, documents, notifications, and project activity
            into one beautiful workspace built for focused development teams.
          </p>
          <div className="landing-cta-row">
            <Link to="/register" className="btn btn-primary landing-cta">
              Get started <Icon name="arrow-right" size={17} />
            </Link>
            <Link to="/login" className="btn btn-secondary landing-cta">
              I already have an account
            </Link>
          </div>
          <div className="landing-proof">
            <span className="landing-avatar-stack" aria-hidden="true">
              <i>YF</i><i>HD</i><i>TM</i>
            </span>
            <span>Built for teams that need calm progress, not noisy chaos.</span>
          </div>
        </div>

        <div className="landing-stage" aria-label="Animated WorkWise workflow preview">
          <div className="landing-product-frame">
            <div className="landing-frame-bar">
              <Brand compact />
              <span><Icon name="search" size={13} /> Search work</span>
              <i>FY</i>
            </div>
            <div className="landing-frame-body">
              <aside>
                <b><Icon name="home" size={14} /></b>
                <b><Icon name="folder" size={14} /></b>
                <b><Icon name="tasks" size={14} /></b>
                <b><Icon name="bell" size={14} /></b>
              </aside>
              <section>
                <div className="landing-pulse-row">
                  <span><strong>4</strong><small>Projects</small></span>
                  <span><strong>18</strong><small>Open tasks</small></span>
                  <span><strong>6</strong><small>Updates</small></span>
                </div>
                <div className="landing-mini-board">
                  {columns.map((column) => (
                    <div className="landing-mini-column" key={column.title}>
                      <header>{column.title}<em>{column.tasks.length}</em></header>
                      {column.tasks.map((task) => <span key={task}>{task}<i /></span>)}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <div className="landing-float landing-float-task">
            <span><Icon name="check" size={15} /></span>
            <strong>Task moved live</strong>
            <small>Review to Done</small>
          </div>
          <div className="landing-float landing-float-bell">
            <span><Icon name="bell" size={15} /></span>
            <strong>3 new updates</strong>
            <small>Assignments and comments</small>
          </div>
          <div className="landing-float landing-float-feed">
            <span><Icon name="activity" size={15} /></span>
            <strong>Activity captured</strong>
            <small>Every move has context</small>
          </div>
        </div>
      </section>

      <section className="landing-workflow" id="workflow">
        <div className="landing-section-heading">
          <p className="landing-kicker">From idea to delivery</p>
          <h2>A workflow your team can actually feel.</h2>
        </div>
        <div className="landing-flow-line">
          {workflow.map((step, index) => (
            <article className="landing-flow-step" key={step.label} style={{ '--delay': `${index * 0.13}s` } as CSSProperties}>
              <span><Icon name={step.icon} size={20} /></span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-solutions" id="solutions">
        <div className="landing-section-heading landing-section-heading-center">
          <p className="landing-kicker">Teamwork solutions for high-performing teams</p>
          <h2>One workspace, four ways to keep delivery moving.</h2>
        </div>
        <div className="landing-solutions-shell" ref={solutionShellRef}>
          <div className="landing-solution-copy-stack">
            {solutions.map((solution, index) => (
              <article
                className={`landing-solution-panel ${index === activeSolutionIndex ? 'is-active' : ''}`}
                data-solution-index={index}
                key={solution.id}
              >
                <span className="landing-solution-icon"><Icon name={solution.icon} size={22} /></span>
                <p className="landing-kicker">{solution.eyebrow}</p>
                <h3>{solution.title}</h3>
                <p>{solution.body}</p>
                <ul>
                  {solution.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              </article>
            ))}
          </div>
          <div className="landing-solution-sticky">
            <SolutionPreview solution={activeSolution} />
          </div>
        </div>
      </section>

      <section className="landing-template-section" id="templates">
        <div className="landing-section-heading landing-section-heading-center">
          <p className="landing-kicker">Get started with a template</p>
          <h2>Choose the WorkWise flow that matches your team.</h2>
        </div>
        <div className="landing-template-grid">
          {templates.map((template) => (
            <button className="landing-template-card" key={template.id} type="button" onClick={() => setSelectedTemplate(template)}>
              <span><Icon name={template.icon} size={24} /></span>
              <small>{template.label}</small>
              <h3>{template.title}</h3>
              <p>{template.description}</p>
            </button>
          ))}
        </div>

        {selectedTemplate ? (
          <div className="landing-template-modal-backdrop" role="presentation" onClick={() => setSelectedTemplate(null)}>
            <section
              className={`landing-template-modal landing-template-modal-${selectedTemplate.id}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="template-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button className="landing-template-modal-close" type="button" onClick={() => setSelectedTemplate(null)} aria-label="Close template preview">
                <Icon name="close" size={18} />
              </button>
              <div className="landing-template-modal-copy">
                <p className="landing-kicker">{selectedTemplate.label}</p>
                <h3 id="template-modal-title">{selectedTemplate.title} workflow</h3>
                <p>{selectedTemplate.description}</p>
                <ol>
                  {selectedTemplate.points.map((point, index) => (
                    <li key={point} style={{ '--delay': `${index * 0.12}s` } as CSSProperties}>{point}</li>
                  ))}
                </ol>
              </div>
              <div className="landing-template-modal-visual" aria-hidden="true">
                <TemplatePreview template={selectedTemplate} />
              </div>
            </section>
          </div>
        ) : null}
      </section>

      <section className="landing-momentum" id="momentum">
        <div>
          <p className="landing-kicker">One intelligent workspace</p>
          <h2>Less searching. More shipping.</h2>
          <p>
            A project board for action, a backlog for control, documentation for memory,
            and realtime updates so the room stays in sync.
          </p>
        </div>
        <Link to="/register" className="btn btn-primary landing-cta">
          Create your WorkWise account <Icon name="arrow-right" size={17} />
        </Link>
      </section>

      <footer className="landing-footer">
        <Brand tagline />
        <p>Contact us at <a href="mailto:workwise.team@gmail.com">workwise.team@gmail.com</a></p>
      </footer>
    </main>
  );
}
