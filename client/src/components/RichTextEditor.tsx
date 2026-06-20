import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import Link from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

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
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, disabled = false }: RichTextEditorProps) {
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
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

    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    const { from, to } = editor.state.selection;

    if (from === to) {
      window.alert('Select text first to add a link.');
      editor.chain().focus().run();
      return;
    }

    const url = window.prompt('Enter URL');

    if (!url?.trim()) {
      editor.chain().focus().run();
      return;
    }

    const trimmedUrl = url.trim();
    const normalizedUrl = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;

    editor.chain().focus().setTextSelection({ from, to }).setLink({ href: normalizedUrl }).run();
  }

  function toggleList(type: 'bullet' | 'ordered') {
    if (!editor) return;

    if (type === 'bullet') {
      editor.chain().focus().toggleBulletList().run();
    } else {
      editor.chain().focus().toggleOrderedList().run();
    }

    setListMenuOpen(false);
  }

  const listActive = Boolean(editor?.isActive('bulletList') || editor?.isActive('orderedList'));

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" aria-label="Documentation formatting toolbar">
        <div className="rich-text-toolbar-group">
          <ToolbarButton title="Heading 1" disabled={!editor || disabled} active={editor?.isActive('heading', { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolbarButton>
          <ToolbarButton title="Heading 2" disabled={!editor || disabled} active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
        </div>
        <div className="rich-text-toolbar-group">
          <ToolbarButton title="Bold" disabled={!editor || disabled} active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}><strong>Bold</strong></ToolbarButton>
          <ToolbarButton title="Italic" disabled={!editor || disabled} active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}><em>Italic</em></ToolbarButton>
        </div>
        <div className="rich-text-toolbar-group">
          <div className="rich-text-dropdown">
            <button
              type="button"
              className={`rich-text-toolbar-button rich-text-dropdown-trigger${listActive ? ' is-active' : ''}`}
              disabled={!editor || disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setListMenuOpen((open) => !open)}
              title="List"
              aria-expanded={listMenuOpen}
              aria-haspopup="menu"
            >
              List <span className="rich-text-dropdown-caret">v</span>
            </button>
            {listMenuOpen && (
              <div className="rich-text-dropdown-menu" role="menu">
                <button
                  type="button"
                  className={`rich-text-dropdown-item${editor?.isActive('bulletList') ? ' is-selected' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => toggleList('bullet')}
                  role="menuitem"
                >
                  Bullet list
                </button>
                <button
                  type="button"
                  className={`rich-text-dropdown-item${editor?.isActive('orderedList') ? ' is-selected' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => toggleList('ordered')}
                  role="menuitem"
                >
                  Numbered list
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="rich-text-toolbar-group">
          <ToolbarButton title="Code block" disabled={!editor || disabled} active={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>Code</ToolbarButton>
          <ToolbarButton title="Link" disabled={!editor || disabled} active={editor?.isActive('link')} onClick={handleLinkClick}>Link</ToolbarButton>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
