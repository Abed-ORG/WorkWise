import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import Breadcrumbs from '../components/Breadcrumbs';
import { BurndownChart, ContributionMetrics, VelocityChart } from '../components/ProjectAnalyticsWidgets';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import { Button, Select, Spinner } from '../components/ui';
import { getProjectActivityFeed } from '../services/activityService';
import { getProjectById, getProjectSprints } from '../services/projectService';
import { getProjectTasks } from '../services/taskService';
import { queryKeys, queryTimes } from '../services/queryOptions';
import {
  type BurndownPoint,
  type ContributionMetric,
  type VelocityPoint,
  buildBurndownData,
  buildContributionMetrics,
  buildVelocityData,
  calculateAverageVelocity,
  calculateProjectHealth,
} from '../utils/projectAnalytics';
import type { ProjectHealth } from '../utils/projectAnalytics';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project';
}

function formatFilenameDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildAnalyticsExportBaseName({
  projectKey,
  projectName,
  sprintName,
  startDate,
  endDate,
}: {
  projectKey?: string;
  projectName: string;
  sprintName?: string;
  startDate: string;
  endDate: string;
}) {
  const projectPart = slugify(projectKey || projectName);
  const sprintPart = sprintName ? slugify(sprintName) : 'all-sprints';
  const datePart = startDate || endDate
    ? slugify(`${startDate || 'any-start'} to ${endDate || 'any-end'}`)
    : formatFilenameDate();

  return `workwise-analytics-${projectPart}-${sprintPart}-${datePart}`;
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatGeneratedDate() {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date());
}

function buildAnalyticsCsv(
  projectName: string,
  burndownPoints: BurndownPoint[],
  velocityPoints: VelocityPoint[],
  averageVelocity: number,
  contributionMetrics: ContributionMetric[]
) {
  return toCsv([
    ['Section', 'Name', 'Metric', 'Value', 'Extra'],
    ...burndownPoints.flatMap((point) => [
      ['Burndown', point.label, 'Ideal remaining tasks', point.ideal, ''],
      ['Burndown', point.label, 'Actual remaining tasks', point.actual, ''],
    ]),
    ...velocityPoints.map((point) => ['Velocity', point.sprintName, 'Completed tasks', point.completed, `Sprint ID: ${point.sprintId}`]),
    ['Velocity', projectName, 'Average completed tasks', averageVelocity.toFixed(1), ''],
    ...contributionMetrics.flatMap((metric) => [
      ['Team Contribution', metric.name, 'Tasks completed', metric.tasksCompleted, metric.role],
      ['Team Contribution', metric.name, 'Comments made', metric.commentsMade, metric.role],
      ['Team Contribution', metric.name, 'PRs merged', metric.prsMerged, metric.role],
    ]),
  ]);
}

function createAnalyticsPdfReport({
  projectName,
  projectKey,
  selectedSprintName,
  startDate,
  endDate,
  burndownPoints,
  velocityPoints,
  averageVelocity,
  contributionMetrics,
  projectHealth,
}: {
  projectName: string;
  projectKey?: string;
  selectedSprintName?: string;
  startDate: string;
  endDate: string;
  burndownPoints: BurndownPoint[];
  velocityPoints: VelocityPoint[];
  averageVelocity: number;
  contributionMetrics: ContributionMetric[];
  projectHealth: ProjectHealth;
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 54;
  const ink: [number, number, number] = [32, 32, 32];
  const muted: [number, number, number] = [109, 110, 105];
  const subtle: [number, number, number] = [133, 135, 128];
  const border: [number, number, number] = [222, 223, 217];
  const soft: [number, number, number] = [247, 247, 244];
  const yellow: [number, number, number] = [255, 209, 0];
  let y = margin;

  function addPage() {
    doc.addPage();
    y = margin;
    drawPageHeader();
  }

  function ensureSpace(height: number) {
    if (y + height <= pageHeight - bottomMargin) return;
    addPage();
  }

  function drawPageHeader() {
    doc.setFillColor(...yellow);
    doc.rect(0, 0, pageWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...ink);
    doc.text('WorkWise Analytics', margin, 24);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...subtle);
    doc.text(projectName, pageWidth - margin, 24, { align: 'right' });
  }

  function addWrappedText(text: string, x: number, width: number, size = 10, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = ink) {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, width);
    doc.text(lines, x, y);
    y += lines.length * (size + 4);
  }

  function addText(text: string, size = 10, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = ink) {
    const lines = doc.splitTextToSize(text, contentWidth);
    ensureSpace(lines.length * (size + 4));
    addWrappedText(text, margin, contentWidth, size, style, color);
  }

  function addSection(title: string, explanation: string, minHeight = 90) {
    ensureSpace(minHeight);
    y += y === margin ? 4 : 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...ink);
    doc.text(title, margin, y);
    y += 16;
    doc.setDrawColor(...yellow);
    doc.setLineWidth(2.5);
    doc.line(margin, y, margin + 104, y);
    y += 14;
    addText(explanation, 9, 'normal', muted);
    y += 4;
  }

  function addInsightCards(cards: Array<{ label: string; value: string | number; note: string }>) {
    const gap = 10;
    const cardWidth = (contentWidth - gap * 3) / 4;
    const cardHeight = 72;
    ensureSpace(cardHeight + 12);
    cards.forEach((card, index) => {
      const x = margin + index * (cardWidth + gap);
      doc.setFillColor(...soft);
      doc.setDrawColor(...border);
      doc.roundedRect(x, y, cardWidth, cardHeight, 8, 8, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...ink);
      doc.text(String(card.value), x + 12, y + 26);
      doc.setFontSize(8);
      doc.setTextColor(...subtle);
      doc.text(card.label.toUpperCase(), x + 12, y + 43);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text(doc.splitTextToSize(card.note, cardWidth - 24), x + 12, y + 58);
    });
    y += cardHeight + 6;
  }

  function addNote(text: string) {
    ensureSpace(46);
    doc.setFillColor(255, 248, 184);
    doc.setDrawColor(255, 209, 0);
    doc.roundedRect(margin, y, contentWidth, 42, 8, 8, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...ink);
    doc.text(doc.splitTextToSize(text, contentWidth - 24), margin + 12, y + 17);
    y += 52;
  }

  function addExecutiveSummary(text: string) {
    const boxPadding = 14;
    const textWidth = contentWidth - boxPadding * 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(text, textWidth);
    const boxHeight = Math.max(78, lines.length * 13 + 44);
    y += 16;
    ensureSpace(boxHeight + 12);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...border);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 10, 10, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text('Executive summary', margin + 14, y + 22);
    doc.setDrawColor(...yellow);
    doc.setLineWidth(2);
    doc.line(margin + 14, y + 29, margin + 118, y + 29);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...muted);
    doc.text(lines, margin + boxPadding, y + 48, { maxWidth: textWidth });
    y += boxHeight + 10;
  }

  function addTable(headers: string[], rows: Array<Array<string | number>>, widths?: number[]) {
    const columnWidths = widths && widths.length === headers.length
      ? widths.map((width) => contentWidth * width)
      : headers.map(() => contentWidth / headers.length);
    const rowPadding = 7;
    const lineHeight = 11;

    function drawHeader() {
      drawRow(headers, true);
    }

    function drawRow(values: Array<string | number>, header = false) {
      const cells = values.map((value, index) => doc.splitTextToSize(String(value), columnWidths[index] - rowPadding * 2));
      const rowHeight = Math.max(26, Math.max(...cells.map((cell) => cell.length)) * lineHeight + rowPadding * 2);
      if (!header && y + rowHeight > pageHeight - bottomMargin) {
        addPage();
        drawHeader();
      } else {
        ensureSpace(rowHeight);
      }

      doc.setFillColor(header ? yellow[0] : soft[0], header ? yellow[1] : soft[1], header ? yellow[2] : soft[2]);
      doc.setDrawColor(...border);
      doc.rect(margin, y, contentWidth, rowHeight, 'FD');
      doc.setFont('helvetica', header ? 'bold' : 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...ink);

      let x = margin;
      cells.forEach((cell, index) => {
        if (index > 0) doc.line(x, y, x, y + rowHeight);
        doc.text(cell, x + rowPadding, y + rowPadding + 9);
        x += columnWidths[index];
      });
      y += rowHeight;
    }

    drawHeader();
    if (rows.length === 0) {
      drawRow(['No data available', ...Array(Math.max(0, headers.length - 1)).fill('')]);
      return;
    }
    rows.forEach((row) => drawRow(row));
  }

  function drawLineChart(points: BurndownPoint[]) {
    const chartHeight = 180;
    ensureSpace(chartHeight + 36);
    const x = margin;
    const width = contentWidth;
    const top = y;
    const plotLeft = x + 36;
    const plotRight = x + width - 12;
    const plotTop = top + 16;
    const plotBottom = top + chartHeight - 28;
    const maxValue = Math.max(1, ...points.flatMap((point) => [point.ideal, point.actual]));

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...border);
    doc.roundedRect(x, top, width, chartHeight, 8, 8, 'FD');
    doc.setDrawColor(218, 219, 213);
    doc.line(plotLeft, plotBottom, plotRight, plotBottom);
    doc.line(plotLeft, plotTop, plotLeft, plotBottom);

    if (points.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...muted);
      doc.text('No burndown data available for the selected sprint.', x + 16, top + 44);
      y += chartHeight + 12;
      return;
    }

    function pointXY(point: BurndownPoint, index: number, key: 'ideal' | 'actual') {
      const step = points.length > 1 ? (plotRight - plotLeft) / (points.length - 1) : 0;
      return {
        x: plotLeft + step * index,
        y: plotBottom - (point[key] / maxValue) * (plotBottom - plotTop),
      };
    }

    (['ideal', 'actual'] as const).forEach((key) => {
      doc.setDrawColor(key === 'ideal' ? 133 : 255, key === 'ideal' ? 135 : 209, key === 'ideal' ? 128 : 0);
      doc.setLineWidth(key === 'ideal' ? 1.5 : 2.4);
      points.forEach((point, index) => {
        if (index === 0) return;
        const previous = pointXY(points[index - 1], index - 1, key);
        const current = pointXY(point, index, key);
        doc.line(previous.x, previous.y, current.x, current.y);
      });
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...subtle);
    doc.text(points[0].label, plotLeft, plotBottom + 16);
    doc.text(points[points.length - 1].label, plotRight, plotBottom + 16, { align: 'right' });
    doc.setTextColor(...ink);
    doc.text('Ideal', plotRight - 88, plotTop + 8);
    doc.setTextColor(150, 123, 0);
    doc.text('Actual', plotRight - 42, plotTop + 8);
    y += chartHeight + 12;
  }

  function drawBarChart(points: VelocityPoint[]) {
    const chartHeight = 180;
    ensureSpace(chartHeight + 36);
    const x = margin;
    const width = contentWidth;
    const top = y;
    const plotLeft = x + 32;
    const plotRight = x + width - 14;
    const plotTop = top + 18;
    const plotBottom = top + chartHeight - 30;
    const maxValue = Math.max(1, ...points.map((point) => point.completed), averageVelocity);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...border);
    doc.roundedRect(x, top, width, chartHeight, 8, 8, 'FD');
    doc.setDrawColor(218, 219, 213);
    doc.line(plotLeft, plotBottom, plotRight, plotBottom);
    doc.line(plotLeft, plotTop, plotLeft, plotBottom);

    if (points.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...muted);
      doc.text('No completed sprint velocity data is available yet.', x + 16, top + 44);
      y += chartHeight + 12;
      return;
    }

    const gap = 8;
    const barWidth = Math.max(12, ((plotRight - plotLeft) - gap * (points.length - 1)) / points.length);
    points.forEach((point, index) => {
      const barHeight = (point.completed / maxValue) * (plotBottom - plotTop);
      const barX = plotLeft + index * (barWidth + gap);
      const barY = plotBottom - barHeight;
      doc.setFillColor(...yellow);
      doc.rect(barX, barY, barWidth, barHeight, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...muted);
      doc.text(String(point.completed), barX + barWidth / 2, barY - 4, { align: 'center' });
    });

    const averageY = plotBottom - (averageVelocity / maxValue) * (plotBottom - plotTop);
    doc.setDrawColor(...ink);
    doc.setLineWidth(1);
    doc.line(plotLeft, averageY, plotRight, averageY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...ink);
    doc.text(`Average ${averageVelocity.toFixed(1)}`, plotRight, averageY - 4, { align: 'right' });
    y += chartHeight + 12;
  }

  const totalContributionActivity = contributionMetrics.reduce((total, metric) => (
    total + metric.tasksCompleted + metric.commentsMade + metric.prsMerged
  ), 0);

  drawPageHeader();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...ink);
  doc.text('WorkWise Analytics Report', margin, y);
  y += 30;
  addText(projectName, 14, 'bold');
  addText(`Project key: ${projectKey || 'N/A'} | Sprint: ${selectedSprintName || 'All sprint activity'} | Range: ${startDate ? formatReportDate(startDate) : 'Any start'} to ${endDate ? formatReportDate(endDate) : 'Any end'} | Generated: ${formatGeneratedDate()}`, 9, 'normal', muted);
  y += 10;
  addInsightCards([
    { label: 'Open tasks', value: projectHealth.openTasks, note: 'Remaining work across the project.' },
    { label: 'Overdue', value: projectHealth.overdueTasks, note: projectHealth.overdueTasks ? 'Needs attention.' : 'No overdue work.' },
    { label: 'Sprint progress', value: `${projectHealth.sprintProgress}%`, note: 'Done in active sprint.' },
    { label: 'Avg velocity', value: averageVelocity.toFixed(1), note: 'Completed tasks per finished sprint.' },
  ]);
  addExecutiveSummary(
    `Summary: ${projectHealth.overdueTasks ? `${projectHealth.overdueTasks} overdue task${projectHealth.overdueTasks === 1 ? '' : 's'} should be reviewed.` : 'No overdue work is currently flagged.'} ${burndownPoints.length ? 'The burndown chart compares ideal remaining work against actual remaining work.' : 'No burndown data is available for the current sprint selection.'} ${totalContributionActivity ? 'Team Contribution shows recorded delivery and collaboration activity.' : 'No team contribution activity has been recorded for the current filter set.'}`,
  );

  addSection('Project Health Summary', 'A quick snapshot of remaining work, deadline pressure, and active sprint progress.', 170);
  addTable(
    ['Metric', 'Value'],
    [
      ['Open tasks', projectHealth.openTasks],
      ['Overdue tasks', projectHealth.overdueTasks],
      ['Sprint progress', `${projectHealth.sprintProgress}%`],
      ['Upcoming deadlines', projectHealth.upcomingDeadlines.length],
    ]
  );
  if (projectHealth.upcomingDeadlines.length > 0) {
    y += 8;
    addTable(
      ['Upcoming task', 'Due date', 'Status'],
      projectHealth.upcomingDeadlines.map((task) => [
        task.title,
        task.dueDate ? formatReportDate(task.dueDate) : 'No due date',
        task.status.replaceAll('_', ' '),
      ])
    );
  }

  addSection('Burndown', 'Visual comparison of ideal sprint pace versus actual remaining work, followed by the underlying daily data.', 250);
  drawLineChart(burndownPoints);
  addTable(
    ['Day', 'Ideal remaining', 'Actual remaining'],
    burndownPoints.map((point) => [point.label, point.ideal, point.actual]),
    [0.4, 0.3, 0.3]
  );

  addSection('Velocity', 'Completed tasks per finished sprint. The average line helps anchor future sprint planning.', 250);
  drawBarChart(velocityPoints);
  addTable(
    ['Sprint', 'Completed tasks'],
    [
      ...velocityPoints.map((point) => [point.sprintName, point.completed] as [string, number]),
      ['Average completed tasks', averageVelocity.toFixed(1)],
    ],
    [0.68, 0.32]
  );

  addSection('Team Contribution', 'Recorded delivery and collaboration signals for the selected sprint/date filters. Use this as context, not as a scoreboard.', 150);
  if (totalContributionActivity === 0) {
    addNote('No contribution activity was recorded for the current filters. Try widening the date range or selecting a sprint with completed tasks, comments, or PR activity.');
  } else {
    addTable(
      ['Member', 'Role', 'Tasks done', 'Comments', 'PRs merged'],
      contributionMetrics.map((metric) => [
        metric.name,
        metric.role.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()),
        metric.tasksCompleted,
        metric.commentsMade,
        metric.prsMerged,
      ]),
      [0.34, 0.18, 0.16, 0.16, 0.16]
    );
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(133, 135, 128);
    doc.text(`WorkWise | Page ${page} of ${pageCount}`, margin, pageHeight - 24);
  }

  return doc;
}

export default function ProjectAnalyticsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId ?? ''),
    queryFn: () => getProjectById(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.projectDetail,
  });
  const sprintsQuery = useQuery({
    queryKey: queryKeys.projectSprints(projectId ?? ''),
    queryFn: () => getProjectSprints(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.sprints,
  });
  const tasksQuery = useQuery({
    queryKey: queryKeys.projectTasks(projectId ?? ''),
    queryFn: () => getProjectTasks(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.tasks,
  });
  const activitiesQuery = useQuery({
    queryKey: queryKeys.projectActivity(projectId ?? ''),
    queryFn: () => getProjectActivityFeed(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.activity,
  });

  const project = projectQuery.data ?? null;
  const sprints = Array.isArray(sprintsQuery.data) ? sprintsQuery.data : [];
  const tasks = Array.isArray(tasksQuery.data) ? tasksQuery.data : [];
  const activities = Array.isArray(activitiesQuery.data) ? activitiesQuery.data : [];
  const loading = projectQuery.isLoading || sprintsQuery.isLoading || tasksQuery.isLoading || activitiesQuery.isLoading;
  const sprintFilterOptions = sprints.map((sprint) => ({ value: sprint.id, label: sprint.name }));

  useEffect(() => {
    if (projectQuery.isError || sprintsQuery.isError || tasksQuery.isError) navigate('/projects', { replace: true });
  }, [navigate, projectQuery.isError, sprintsQuery.isError, tasksQuery.isError]);

  useEffect(() => {
    if (selectedSprintId || sprints.length === 0) return;
    const activeSprint = sprints.find((sprint) => sprint.isActive) ?? sprints[0];
    setSelectedSprintId(activeSprint?.id ?? '');
  }, [selectedSprintId, sprints]);

  const selectedSprint = useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? sprints.find((sprint) => sprint.isActive) ?? sprints[0],
    [selectedSprintId, sprints]
  );

  const burndownPoints = useMemo(
    () => (selectedSprint ? buildBurndownData(selectedSprint, tasks) : []),
    [selectedSprint, tasks]
  );

  const velocityPoints = useMemo(() => buildVelocityData(sprints, tasks), [sprints, tasks]);
  const averageVelocity = useMemo(() => calculateAverageVelocity(velocityPoints), [velocityPoints]);

  const contributionMetrics = useMemo(
    () => buildContributionMetrics(project?.members ?? [], tasks, activities, {
      sprintId: selectedSprintId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [activities, endDate, project?.members, selectedSprintId, startDate, tasks]
  );

  const projectHealth = useMemo(
    () => (project ? calculateProjectHealth(project, tasks) : null),
    [project, tasks]
  );

  function handleExportCsv() {
    if (!project) return;
    const exportBaseName = buildAnalyticsExportBaseName({
      projectKey: project.key,
      projectName: project.name,
      sprintName: selectedSprintId ? selectedSprint?.name : undefined,
      startDate,
      endDate,
    });
    const csv = buildAnalyticsCsv(project.name, burndownPoints, velocityPoints, averageVelocity, contributionMetrics);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportBaseName}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleExportPdf() {
    if (!project || !projectHealth) return;
    const exportBaseName = buildAnalyticsExportBaseName({
      projectKey: project.key,
      projectName: project.name,
      sprintName: selectedSprintId ? selectedSprint?.name : undefined,
      startDate,
      endDate,
    });
    const report = createAnalyticsPdfReport({
      projectName: project.name,
      projectKey: project.key,
      selectedSprintName: selectedSprintId ? selectedSprint?.name : undefined,
      startDate,
      endDate,
      burndownPoints,
      velocityPoints,
      averageVelocity,
      contributionMetrics,
      projectHealth,
    });
    report.save(`${exportBaseName}.pdf`);
  }

  if (loading) return <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Loading analytics...</p></div>;
  if (!project || !projectId) return null;

  return (
    <>
      <Breadcrumbs items={[
        { label: 'Projects', to: '/projects' },
        { label: project.name, to: `/projects/${projectId}` },
        { label: 'Analytics' },
      ]} />

      <PageHeader
        eyebrow={project.key}
        title="Project analytics"
        description="Burndown, sprint velocity, and contribution signals for this workspace."
        actions={<>
          <Button variant="secondary" onClick={handleExportCsv}><Icon name="download" size={16} /> CSV</Button>
          <Button variant="secondary" onClick={handleExportPdf}><Icon name="document" size={16} /> PDF</Button>
          <Button variant="secondary" onClick={() => navigate(`/projects/${projectId}/sprints`)}><Icon name="activity" size={16} /> Sprints</Button>
        </>}
      />

      <section className="app-card card-padding analytics-filter-card">
        <div className="section-heading">
          <div>
            <h2>Filters</h2>
            <p>Scope contribution metrics by sprint or by a date range.</p>
          </div>
        </div>
        <div className="analytics-filter-grid">
          <Select
            label="Sprint"
            placeholder="All sprint activity"
            options={sprintFilterOptions}
            value={selectedSprintId}
            onChange={(event) => setSelectedSprintId(event.target.value)}
          />
          <label className="field">
            <span className="field-label">From</span>
            <input className="field-control analytics-date-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">To</span>
            <input className="field-control analytics-date-input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="analytics-grid">
        <article className="app-card card-padding analytics-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Sprint burndown</p>
              <h2>{selectedSprint?.name ?? 'No sprint selected'}</h2>
              <p>Ideal pace against actual remaining work across sprint days.</p>
              <p className="analytics-guidance">Use this to spot whether the sprint is burning down steadily or carrying work late into the timeline.</p>
            </div>
          </div>
          {selectedSprint ? <BurndownChart points={burndownPoints} /> : <p className="field-help">Create a sprint to show burndown data.</p>}
        </article>

        <article className="app-card card-padding analytics-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Velocity</p>
              <h2>Completed sprint output</h2>
              <p>Completed tasks per finished sprint with the team average.</p>
              <p className="analytics-guidance">Use this to understand how much work the team usually finishes so future sprint plans stay realistic.</p>
            </div>
          </div>
          <VelocityChart points={velocityPoints} average={averageVelocity} />
        </article>
      </section>

      <section className="app-card card-padding analytics-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Team contribution</p>
            <h2>Workload distribution</h2>
            <p>Completed tasks, comments, and recorded PR merges per project member.</p>
            <p className="analytics-guidance">Use this as a participation signal, not a scoreboard; it highlights where collaboration may need balancing.</p>
          </div>
        </div>
        <ContributionMetrics metrics={contributionMetrics} />
      </section>
    </>
  );
}
