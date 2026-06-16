import { type ReactNode, useEffect, useState } from 'react';
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
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

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
