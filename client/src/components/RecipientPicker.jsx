import { useId, useMemo, useRef, useState } from 'react';

export default function RecipientPicker({
  users,
  selectedIds,
  onChange,
  placeholder = 'Search recipients by name, email, or department',
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimer = useRef(null);
  const inputId = useId();
  const listboxId = useId();

  const selectedIdSet = useMemo(
    () => new Set(selectedIds.map((id) => String(id))),
    [selectedIds]
  );

  const selectedUsers = useMemo(
    () => users.filter((user) => selectedIdSet.has(String(user.id))),
    [users, selectedIdSet]
  );

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (selectedIdSet.has(String(user.id))) return false;
      const department = String(user.department_name || '').toLowerCase();
      const name = (user.name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      return !q || name.includes(q) || email.includes(q) || department.includes(q);
    });
  }, [users, selectedIdSet, query]);

  const addRecipient = (id) => {
    if (!id) return;
    const nextId = String(id);
    if (!selectedIdSet.has(nextId)) {
      onChange([...selectedIds, nextId]);
    }
    setQuery('');
    setIsOpen(true);
    setActiveIndex(0);
  };

  const removeRecipient = (id) => {
    const nextId = String(id);
    onChange(selectedIds.filter((selectedId) => String(selectedId) !== nextId));
  };

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => setIsOpen(false), 120);
  };

  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setIsOpen(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' && !query && selectedIds.length) {
      removeRecipient(selectedIds[selectedIds.length - 1]);
      return;
    }

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (!filteredUsers.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filteredUsers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addRecipient(filteredUsers[activeIndex]?.id);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="recipient-picker">
      <div className="recipient-picker-control" onClick={() => document.getElementById(inputId)?.focus()}>
        {selectedUsers.map((user) => (
          <span className="recipient-chip" key={user.id}>
            {user.name}
            {user.department_name ? <small>{user.department_name}</small> : null}
            <button
              type="button"
              className="recipient-chip-remove"
              onClick={() => removeRecipient(user.id)}
              aria-label={`Remove ${user.name}`}
            >
              x
            </button>
          </span>
        ))}
        <input
          id={inputId}
          className="recipient-picker-input"
          type="text"
          role="combobox"
          value={query}
          placeholder={selectedUsers.length ? '' : placeholder}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-activedescendant={isOpen && filteredUsers[activeIndex] ? `${listboxId}-${filteredUsers[activeIndex].id}` : undefined}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>
      {isOpen && (
        <div className="recipient-picker-menu" id={listboxId} role="listbox" aria-label="Recipient suggestions">
          {filteredUsers.length ? (
            filteredUsers.map((user, index) => (
              <button
                type="button"
                id={`${listboxId}-${user.id}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`recipient-option${index === activeIndex ? ' recipient-option--active' : ''}`}
                key={user.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addRecipient(user.id)}
              >
                <span>{user.name}</span>
                <small>{[user.email, user.department_name].filter(Boolean).join(' - ')}</small>
              </button>
            ))
          ) : (
            <div className="recipient-option-empty">No recipients found</div>
          )}
        </div>
      )}
    </div>
  );
}
