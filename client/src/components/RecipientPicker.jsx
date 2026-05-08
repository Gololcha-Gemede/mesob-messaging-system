import { useMemo, useRef, useState } from 'react';

export default function RecipientPicker({
  users,
  selectedIds,
  onChange,
  placeholder = 'Search recipients by username',
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const blurTimer = useRef(null);

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
      const name = (user.name || '').toLowerCase();
      return !q || name.includes(q);
    });
  }, [users, selectedIdSet, query]);

  const addRecipient = (id) => {
    const nextId = String(id);
    if (!selectedIdSet.has(nextId)) {
      onChange([...selectedIds, nextId]);
    }
    setQuery('');
    setIsOpen(true);
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

  return (
    <div className="recipient-picker">
      <div className="recipient-picker-control">
        {selectedUsers.map((user) => (
          <span className="recipient-chip" key={user.id}>
            {user.name}
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
          className="recipient-picker-input"
          type="text"
          value={query}
          placeholder={selectedUsers.length ? '' : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>
      {isOpen && (
        <div className="recipient-picker-menu">
          {filteredUsers.length ? (
            filteredUsers.map((user) => (
              <button
                type="button"
                className="recipient-option"
                key={user.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addRecipient(user.id)}
              >
                <span>{user.name}</span>
                <small>{user.email}</small>
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
