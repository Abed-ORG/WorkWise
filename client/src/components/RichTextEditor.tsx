import { type ReactNode, useEffect, useRef, useState } from 'react';
import Image from '@tiptap/extension-image';
import type { Editor } from '@tiptap/react';
import Link from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

interface ToolbarButtonProps {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}

type TextStyleOption = 'normal' | 'small' | 'heading1' | 'heading2' | 'heading3' | 'quote' | 'codeBlock';
type DropdownName = 'textStyle' | 'color' | 'emoji' | 'table' | null;
type ColorOption = {
  label: string;
  value: 'default' | 'yellow' | 'red' | 'green' | 'blue' | 'purple' | 'gray';
  color: string | null;
};

const TEXT_STYLE_OPTIONS: Array<{ label: string; value: TextStyleOption }> = [
  { label: 'Normal text', value: 'normal' },
  { label: 'Small text', value: 'small' },
  { label: 'Heading 1', value: 'heading1' },
  { label: 'Heading 2', value: 'heading2' },
  { label: 'Heading 3', value: 'heading3' },
  { label: 'Quote', value: 'quote' },
  { label: 'Code block', value: 'codeBlock' },
];

const COLOR_OPTIONS: ColorOption[] = [
  { label: 'Default', value: 'default', color: null },
  { label: 'Yellow', value: 'yellow', color: '#b38600' },
  { label: 'Red', value: 'red', color: '#d92d20' },
  { label: 'Green', value: 'green', color: '#16803c' },
  { label: 'Blue', value: 'blue', color: '#2563eb' },
  { label: 'Purple', value: 'purple', color: '#7c3aed' },
  { label: 'Gray', value: 'gray', color: '#64748b' },
];

const QUICK_EMOJIS = ['😀', '👍', '✅', '🔥', '🚀', '⭐', '⚠️', '❌', '💡', '🎯'];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function looksLikeMarkdown(value: string) {
  const text = value.trim();

  if (!text) return false;

  return [
    /^#{1,3}\s+\S/m,
    /(^|\n)\s*[-*]\s+\S/,
    /(^|\n)\s*\d+\.\s+\S/,
    /\*\*[^*\n][\s\S]*?\*\*/,
    /(^|[^*])\*[^*\n]+\*(?!\*)/,
    /`[^`\n]+`/,
    /```[\s\S]*?```/,
    /\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)/i,
  ].some((pattern) => pattern.test(text));
}

function markdownInlineToHtml(value: string) {
  const codePlaceholders: string[] = [];
  let html = escapeHtml(value).replace(/`([^`\n]+)`/g, (_match, code: string) => {
    const token = `@@CODE_${codePlaceholders.length}@@`;
    codePlaceholders.push(`<code>${code}</code>`);
    return token;
  });

  html = html
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/gi, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

  codePlaceholders.forEach((codeHtml, index) => {
    html = html.replace(`@@CODE_${index}@@`, codeHtml);
  });

  return html;
}

function markdownToHtml(value: string) {
  const normalized = value.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) index += 1;
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length === 1 ? 1 : 2;
      blocks.push(`<h${level}>${markdownInlineToHtml(heading[2].trim())}</h${level}>`);
      index += 1;
      continue;
    }

    const unorderedItems: string[] = [];
    while (index < lines.length) {
      const item = lines[index].match(/^\s*[-*]\s+(.+)$/);
      if (!item) break;
      unorderedItems.push(`<li>${markdownInlineToHtml(item[1].trim())}</li>`);
      index += 1;
    }
    if (unorderedItems.length > 0) {
      blocks.push(`<ul>${unorderedItems.join('')}</ul>`);
      continue;
    }

    const orderedItems: string[] = [];
    while (index < lines.length) {
      const item = lines[index].match(/^\s*\d+\.\s+(.+)$/);
      if (!item) break;
      orderedItems.push(`<li>${markdownInlineToHtml(item[1].trim())}</li>`);
      index += 1;
    }
    if (orderedItems.length > 0) {
      blocks.push(`<ol>${orderedItems.join('')}</ol>`);
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const currentLine = lines[index];
      if (!currentLine.trim()) break;
      if (/^(#{1,3})\s+/.test(currentLine) || /^\s*[-*]\s+/.test(currentLine) || /^\s*\d+\.\s+/.test(currentLine) || currentLine.trim().startsWith('```')) break;
      paragraphLines.push(currentLine.trim());
      index += 1;
    }

    blocks.push(`<p>${paragraphLines.map(markdownInlineToHtml).join('<br>')}</p>`);
  }

  return blocks.join('');
}

function ToolbarButton({ active = false, children, disabled = false, onClick, title }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={`rich-text-toolbar-button${active ? ' is-active' : ''}`}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

type ToolbarIconName =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'bulletList'
  | 'orderedList'
  | 'checkList'
  | 'link'
  | 'image'
  | 'codeBlock'
  | 'table'
  | 'undo'
  | 'redo'
  | 'color'
  | 'emoji';

function ToolbarIcon({ name }: { name: ToolbarIconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.9 } as const;

  const paths: Record<ToolbarIconName, ReactNode> = {
    bold: <path d="M8 5h5.2a3.2 3.2 0 0 1 0 6.4H8Zm0 6.4h6a3.3 3.3 0 0 1 0 6.6H8Z" />,
    italic: <><path d="M10 5h8" /><path d="M6 19h8" /><path d="m14 5-4 14" /></>,
    underline: <><path d="M7 5v6a5 5 0 0 0 10 0V5" /><path d="M6 21h12" /></>,
    bulletList: <><path d="M9 7h10" /><path d="M9 12h10" /><path d="M9 17h10" /><circle cx="5" cy="7" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="5" cy="17" r="1" /></>,
    orderedList: <><path d="M10 7h9" /><path d="M10 12h9" /><path d="M10 17h9" /><path d="M5 6h1v3" /><path d="M4.5 9h2" /><path d="M4.5 11.5h1.7L4.5 14h2" /><path d="M4.5 16h2v3h-2" /><path d="M4.5 17.5h1.5" /></>,
    checkList: <><path d="m4 7 1.5 1.5L8 6" /><path d="m4 13 1.5 1.5L8 12" /><path d="m4 19 1.5 1.5L8 18" /><path d="M11 7h9" /><path d="M11 13h9" /><path d="M11 19h9" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l1.4-1.4a5 5 0 0 0-7.1-7.1l-.8.8" /><path d="M14 11a5 5 0 0 0-7.1 0l-1.4 1.4a5 5 0 0 0 7.1 7.1l.8-.8" /></>,
    image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m6 17 4.2-4.2a1.5 1.5 0 0 1 2.1 0L17 17" /><path d="m14 15 1.2-1.2a1.5 1.5 0 0 1 2.1 0L20 16.5" /></>,
    codeBlock: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="m10 10-2 2 2 2" /><path d="m14 10 2 2-2 2" /></>,
    table: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 10h16" /><path d="M10 5v14" /><path d="M15 5v14" /></>,
    undo: <><path d="m9 7-4 4 4 4" /><path d="M5 11h9a5 5 0 0 1 5 5v1" /></>,
    redo: <><path d="m15 7 4 4-4 4" /><path d="M19 11h-9a5 5 0 0 0-5 5v1" /></>,
    color: <><path d="M7 20h10" /><path d="m9 16 3-11 3 11" /><path d="M10.2 12h3.6" /></>,
    emoji: <><circle cx="12" cy="12" r="8" /><path d="M9 10h.01" /><path d="M15 10h.01" /><path d="M8.8 14a4 4 0 0 0 6.4 0" /></>,
  };

  return (
    <svg className="rich-text-toolbar-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...common}>
      {paths[name]}
    </svg>
  );
}

export default function RichTextEditor({ value, onChange, disabled = false }: RichTextEditorProps) {
  const [openDropdown, setOpenDropdown] = useState<DropdownName>(null);
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TextStyle,
      FontSize,
      Color,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'rich-text-image',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'rich-text-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'rich-text-editor-content',
      },
      handlePaste: (_view, event) => {
        const pastedText = event.clipboardData?.getData('text/plain');

        if (!pastedText || !looksLikeMarkdown(pastedText)) {
          return false;
        }

        event.preventDefault();
        editorRef.current?.chain().focus().insertContent(markdownToHtml(pastedText)).run();
        return true;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [editor, value]);

  function handleLinkClick() {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const currentHref = editor.getAttributes('link').href as string | undefined;

    if (from === to && !currentHref) {
      window.alert('Select text first to add a link.');
      editor.chain().focus().run();
      return;
    }

    const url = window.prompt('Enter URL. Leave empty to remove the link.', currentHref ?? '');

    if (!url?.trim()) {
      if (currentHref) {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
      } else {
        editor.chain().focus().run();
      }
      return;
    }

    const trimmedUrl = url.trim();
    const normalizedUrl = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;

    const command = editor.chain().focus();
    if (currentHref) {
      command.extendMarkRange('link').setLink({ href: normalizedUrl }).run();
    } else {
      command.setTextSelection({ from, to }).setLink({ href: normalizedUrl }).run();
    }
  }

  function handleImageInsert() {
    if (!editor) return;

    const src = window.prompt('Image URL');

    if (!src?.trim()) {
      editor.chain().focus().run();
      return;
    }

    const alt = window.prompt('Alt text', '') ?? '';
    editor.chain().focus().setImage({ src: src.trim(), alt: alt.trim() }).run();
  }

  function applyTextStyle(style: TextStyleOption) {
    if (!editor) return;

    const chain = editor.chain().focus();

    if (style === 'normal') chain.unsetFontSize().setParagraph().run();
    if (style === 'small') chain.setParagraph().setFontSize('13px').run();
    if (style === 'heading1') chain.unsetFontSize().setHeading({ level: 1 }).run();
    if (style === 'heading2') chain.unsetFontSize().setHeading({ level: 2 }).run();
    if (style === 'heading3') chain.unsetFontSize().setHeading({ level: 3 }).run();
    if (style === 'quote') chain.unsetFontSize().toggleBlockquote().run();
    if (style === 'codeBlock') chain.unsetFontSize().toggleCodeBlock().run();

    setOpenDropdown(null);
  }

  function applyTextColor(option: ColorOption) {
    if (!editor) return;

    const chain = editor.chain().focus();
    if (option.color) {
      chain.setColor(option.color).run();
    } else {
      chain.unsetColor().run();
    }

    setOpenDropdown(null);
  }

  function insertEmoji(emoji: string) {
    editor?.chain().focus().insertContent(emoji).run();
    setOpenDropdown(null);
  }

  function toggleDropdown(name: DropdownName) {
    setOpenDropdown((current) => (current === name ? null : name));
  }

  function runTableCommand(command: () => void) {
    command();
    setOpenDropdown(null);
  }

  function getCurrentTextStyleLabel() {
    if (editor?.isActive('heading', { level: 1 })) return 'Heading 1';
    if (editor?.isActive('heading', { level: 2 })) return 'Heading 2';
    if (editor?.isActive('heading', { level: 3 })) return 'Heading 3';
    if (editor?.isActive('blockquote')) return 'Quote';
    if (editor?.isActive('codeBlock')) return 'Code block';
    if ((editor?.getAttributes('textStyle').fontSize as string | undefined) === '13px') return 'Small text';
    return 'Normal text';
  }

  function isTextStyleSelected(option: TextStyleOption) {
    if (!editor) return false;

    if (option === 'normal') return getCurrentTextStyleLabel() === 'Normal text';
    if (option === 'small') return getCurrentTextStyleLabel() === 'Small text';
    if (option === 'heading1') return editor.isActive('heading', { level: 1 });
    if (option === 'heading2') return editor.isActive('heading', { level: 2 });
    if (option === 'heading3') return editor.isActive('heading', { level: 3 });
    if (option === 'quote') return editor.isActive('blockquote');
    return editor.isActive('codeBlock');
  }

  function getCurrentColor() {
    return (editor?.getAttributes('textStyle').color as string | undefined) ?? null;
  }

  function getCurrentColorOption() {
    const currentColor = getCurrentColor();
    return COLOR_OPTIONS.find((option) => option.color?.toLowerCase() === currentColor?.toLowerCase()) ?? COLOR_OPTIONS[0];
  }

  const editingDisabled = !editor || disabled;
  const inTable = Boolean(editor?.isActive('table'));

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" aria-label="Documentation formatting toolbar">
        <div className="rich-text-toolbar-group">
          <div className="rich-text-dropdown">
            <button
              type="button"
              className="rich-text-toolbar-button rich-text-dropdown-trigger rich-text-dropdown-trigger-wide"
              disabled={editingDisabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => toggleDropdown('textStyle')}
              title="Text style"
              aria-label="Text style"
              aria-expanded={openDropdown === 'textStyle'}
              aria-haspopup="menu"
            >
              <span>{getCurrentTextStyleLabel()}</span>
              <span className="rich-text-dropdown-caret">v</span>
            </button>
            {openDropdown === 'textStyle' && (
              <div className="rich-text-dropdown-menu rich-text-style-menu" role="menu">
                {TEXT_STYLE_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={`rich-text-dropdown-item rich-text-style-item rich-text-style-item-${option.value}${isTextStyleSelected(option.value) ? ' is-selected' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyTextStyle(option.value)}
                    role="menuitem"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="rich-text-toolbar-group">
          <ToolbarButton title="Bold" disabled={editingDisabled} active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}><ToolbarIcon name="bold" /></ToolbarButton>
          <ToolbarButton title="Italic" disabled={editingDisabled} active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}><ToolbarIcon name="italic" /></ToolbarButton>
          <ToolbarButton title="Underline" disabled={editingDisabled} active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}><ToolbarIcon name="underline" /></ToolbarButton>
          <div className="rich-text-dropdown">
            <button
              type="button"
              className={`rich-text-toolbar-button rich-text-icon-dropdown-trigger${getCurrentColor() ? ' is-active' : ''}`}
              disabled={editingDisabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => toggleDropdown('color')}
              title="Text color"
              aria-label="Text color"
              aria-expanded={openDropdown === 'color'}
              aria-haspopup="menu"
            >
              <span className="rich-text-color-button-mark" style={getCurrentColor() ? { color: getCurrentColor() ?? undefined } : undefined}>
                <ToolbarIcon name="color" />
              </span>
              <span className="rich-text-dropdown-caret">v</span>
            </button>
            {openDropdown === 'color' && (
              <div className="rich-text-dropdown-menu rich-text-color-menu" role="menu" aria-label="Text color presets">
                {COLOR_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={`rich-text-color-swatch-button${getCurrentColorOption().value === option.value ? ' is-selected' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyTextColor(option)}
                    role="menuitem"
                    title={option.label}
                    aria-label={option.label}
                  >
                    <span className="rich-text-color-swatch" style={option.color ? { background: option.color } : undefined} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="rich-text-toolbar-group">
          <ToolbarButton title="Bulleted list" disabled={editingDisabled} active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}><ToolbarIcon name="bulletList" /></ToolbarButton>
          <ToolbarButton title="Numbered list" disabled={editingDisabled} active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ToolbarIcon name="orderedList" /></ToolbarButton>
          <ToolbarButton title="Checklist" disabled={editingDisabled} active={editor?.isActive('taskList')} onClick={() => editor?.chain().focus().toggleTaskList().run()}><ToolbarIcon name="checkList" /></ToolbarButton>
        </div>
        <div className="rich-text-toolbar-group">
          <ToolbarButton title="Link" disabled={editingDisabled} active={editor?.isActive('link')} onClick={handleLinkClick}><ToolbarIcon name="link" /></ToolbarButton>
          <ToolbarButton title="Image" disabled={editingDisabled} active={editor?.isActive('image')} onClick={handleImageInsert}><ToolbarIcon name="image" /></ToolbarButton>
          <ToolbarButton title="Code block" disabled={editingDisabled} active={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><ToolbarIcon name="codeBlock" /></ToolbarButton>
        </div>
        <div className="rich-text-toolbar-group">
          <div className="rich-text-dropdown">
            <button
              type="button"
              className="rich-text-toolbar-button"
              disabled={editingDisabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => toggleDropdown('emoji')}
              title="Emoji"
              aria-label="Emoji"
              aria-expanded={openDropdown === 'emoji'}
              aria-haspopup="menu"
            >
              <ToolbarIcon name="emoji" />
            </button>
            {openDropdown === 'emoji' && (
              <div className="rich-text-dropdown-menu rich-text-emoji-menu" role="menu" aria-label="Quick emojis">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    className="rich-text-emoji-button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertEmoji(emoji)}
                    role="menuitem"
                    title={`Insert ${emoji}`}
                    aria-label={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="rich-text-toolbar-group">
          <div className="rich-text-dropdown">
            <button
              type="button"
              className={`rich-text-toolbar-button rich-text-icon-dropdown-trigger${inTable ? ' is-active' : ''}`}
              disabled={editingDisabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => toggleDropdown('table')}
              title="Table"
              aria-label="Table"
              aria-expanded={openDropdown === 'table'}
              aria-haspopup="menu"
            >
              <ToolbarIcon name="table" />
              <span className="rich-text-dropdown-caret">v</span>
            </button>
            {openDropdown === 'table' && (
              <div className="rich-text-dropdown-menu rich-text-dropdown-menu-wide" role="menu">
                <button type="button" className="rich-text-dropdown-item" onMouseDown={(event) => event.preventDefault()} onClick={() => runTableCommand(() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())} role="menuitem">Insert table</button>
                <button type="button" className="rich-text-dropdown-item" disabled={!inTable} onMouseDown={(event) => event.preventDefault()} onClick={() => runTableCommand(() => editor?.chain().focus().addRowAfter().run())} role="menuitem">Add row</button>
                <button type="button" className="rich-text-dropdown-item" disabled={!inTable} onMouseDown={(event) => event.preventDefault()} onClick={() => runTableCommand(() => editor?.chain().focus().addColumnAfter().run())} role="menuitem">Add column</button>
                <button type="button" className="rich-text-dropdown-item" disabled={!inTable} onMouseDown={(event) => event.preventDefault()} onClick={() => runTableCommand(() => editor?.chain().focus().deleteRow().run())} role="menuitem">Delete row</button>
                <button type="button" className="rich-text-dropdown-item" disabled={!inTable} onMouseDown={(event) => event.preventDefault()} onClick={() => runTableCommand(() => editor?.chain().focus().deleteColumn().run())} role="menuitem">Delete column</button>
                <button type="button" className="rich-text-dropdown-item is-danger" disabled={!inTable} onMouseDown={(event) => event.preventDefault()} onClick={() => runTableCommand(() => editor?.chain().focus().deleteTable().run())} role="menuitem">Delete table</button>
              </div>
            )}
          </div>
        </div>
        <div className="rich-text-toolbar-group">
          <ToolbarButton title="Undo" disabled={editingDisabled || !editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}><ToolbarIcon name="undo" /></ToolbarButton>
          <ToolbarButton title="Redo" disabled={editingDisabled || !editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}><ToolbarIcon name="redo" /></ToolbarButton>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
