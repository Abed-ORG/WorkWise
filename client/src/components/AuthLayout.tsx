import type { ReactNode } from 'react';
import Brand from './Brand';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';
import teamHero from '../assets/workwise-team-hero.png';

interface AuthLayoutProps {
  children: ReactNode;
  compact?: boolean;
}

const team = ['YF', 'HD', 'TM'];

export default function AuthLayout({ children, compact = false }: AuthLayoutProps) {
  return (
    <main className={`auth-page auth-page-premium${compact ? ' auth-page-compact' : ''}`}>
      <div className="auth-logo-intro" aria-hidden="true">
        <div className="auth-logo-intro-inner"><Brand tagline /></div>
        <span className="auth-logo-trace" />
      </div>

      <img className="auth-team-photo" src={teamHero} alt="A coordinated team planning work together" />
      <div className="auth-team-photo-shade" aria-hidden="true" />

      <section className="auth-panel auth-form-panel">
        <div className="auth-panel-glow" aria-hidden="true" />
        <div className="auth-panel-controls"><ThemeToggle /></div>
        <div className="auth-card animate-enter-delay">
          <div className="auth-mobile-brand"><Brand tagline /></div>
          {children}
        </div>
        <p className="auth-form-foot">Focused work. Clear progress. Better teams.</p>
      </section>

      <section className="auth-story auth-workspace-story" aria-label="WorkWise workspace preview">
        <div className="auth-ambient" aria-hidden="true">
          <span className="auth-orb auth-orb-one" />
          <span className="auth-orb auth-orb-two" />
          <span className="auth-orbit auth-orbit-one" />
          <span className="auth-orbit auth-orbit-two" />
          <span className="auth-spark auth-spark-one" />
          <span className="auth-spark auth-spark-two" />
          <span className="auth-spark auth-spark-three" />
          <span className="auth-spark auth-spark-four" />
        </div>

        <div className="auth-story-top"><Brand tagline /></div>

        <div className="auth-workspace-scene" aria-hidden="true">
          <div className="scene-window">
            <div className="scene-window-bar">
              <span className="scene-window-brand"><Brand compact /></span>
              <span className="scene-search"><Icon name="search" size={13} /> Search work</span>
              <span className="scene-avatar">YF</span>
            </div>
            <div className="scene-layout">
              <aside className="scene-sidebar">
                <span className="is-active"><Icon name="home" size={14} /></span>
                <span><Icon name="folder" size={14} /></span>
                <span><Icon name="tasks" size={14} /></span>
                <span><Icon name="team" size={14} /></span>
              </aside>
              <div className="scene-content">
                <div className="scene-heading"><span>Project pulse</span><i /></div>
                <div className="scene-stats"><span /><span /><span /></div>
                <div className="scene-board">
                  <div><b>To do</b><span className="scene-task scene-task-one">Design auth flow<i /></span></div>
                  <div><b>In progress</b><span className="scene-task scene-task-two">Build workspace<i /></span></div>
                  <div><b>Done</b><span className="scene-task scene-task-three">Plan sprint<i /></span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="scene-float-card scene-review-card">
            <span className="scene-card-icon"><Icon name="check" size={15} /></span>
            <span><strong>Review with team</strong><small>Today, 10:30 AM</small></span>
            <i />
          </div>

          <div className="scene-float-card scene-progress-card">
            <div className="scene-progress-head"><span>Weekly progress</span><strong>78%</strong></div>
            <div className="scene-progress-track"><i /></div>
            <div className="scene-progress-foot">
              <span className="scene-team-stack">{team.map((member) => <i key={member}>{member}</i>)}</span>
              <span>12 tasks moved</span>
            </div>
          </div>

          <div className="scene-float-card scene-ai-card">
            <span className="scene-ai-icon"><Icon name="sparkles" size={17} /></span>
            <span><strong>Plan with clarity</strong><small>Next steps are ready</small></span>
          </div>
        </div>

        <div className="auth-copy auth-scene-copy">
          <p className="auth-scene-kicker">One intelligent workspace</p>
          <h2>Turn teamwork into <span>momentum.</span></h2>
          <p>Projects, priorities, and people stay in sync from the first idea to the final task.</p>
        </div>

        <div className="auth-proof">
          <div className="proof-avatars" aria-hidden="true">
            {team.map((member) => <span className="proof-avatar" key={member}>{member}</span>)}
          </div>
          Designed for teams that move with purpose.
        </div>
      </section>
    </main>
  );
}
