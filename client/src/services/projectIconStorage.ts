const storageKey = 'workwise-project-icons';

function readIcons(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Record<string, string>; }
  catch { return {}; }
}

export function saveProjectIcon(projectId: string, icon: string) {
  localStorage.setItem(storageKey, JSON.stringify({ ...readIcons(), [projectId]: icon }));
}

export function getProjectIcon(projectId: string, fallback = '📁') {
  return readIcons()[projectId] ?? fallback;
}
