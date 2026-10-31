import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, Icon, type IconName } from '../icons';

export interface MenuItem {
  label: string;
  icon?: IconName;
  danger?: boolean;
  onClick: () => void;
}

export interface MenuAnchor {
  x: number;
  y: number;
  /** the menu's right edge sits at x (for menus opened from a button on the right) */
  alignRight?: boolean;
}

/** Popup menu used for message actions, the ⋮ menus and the profile menu. */
export function ContextMenu({
  anchor,
  items,
  onClose,
  profile,
}: {
  anchor: MenuAnchor;
  items: MenuItem[];
  onClose: () => void;
  /** shows who is logged in at the top of the menu (name only) */
  profile?: { id: string; name: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; origin: string } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    let left = anchor.alignRight ? anchor.x - width : anchor.x;
    let top = anchor.y;
    const flipX = anchor.alignRight;
    let flipY = false;
    if (left + width > innerWidth - pad) left = innerWidth - width - pad;
    if (left < pad) left = pad;
    if (top + height > innerHeight - pad) {
      top = Math.max(pad, anchor.y - height);
      flipY = true;
    }
    setPlace({ left, top, origin: `${flipY ? 'bottom' : 'top'} ${flipX ? 'right' : 'left'}` });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="menu-backdrop"
      onPointerDown={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={ref}
        className="menu"
        role="menu"
        style={{ left: place?.left ?? -9999, top: place?.top ?? -9999, transformOrigin: place?.origin, opacity: place ? 1 : 0 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {profile && (
          <div className="menu-profile">
            <Avatar id={profile.id} name={profile.name} size={40} />
            <span>{profile.name}</span>
          </div>
        )}
        {items.map((item) => (
          <button
            key={item.label}
            role="menuitem"
            className={`menu-item${item.danger ? ' danger' : ''}`}
            onClick={() => {
              onClose();
              item.onClick();
            }}
          >
            {item.icon && <Icon name={item.icon} size={20} />}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
