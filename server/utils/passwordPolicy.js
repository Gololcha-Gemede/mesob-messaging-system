function validatePassword(password, { required = true } = {}) {
  const value = typeof password === 'string' ? password : '';

  if (!value) {
    return required ? 'Password is required.' : '';
  }

  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (value.length > 128) return 'Password must be 128 characters or fewer.';
  if (!/[a-z]/.test(value)) return 'Password must include a lowercase letter.';
  if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter.';
  if (!/\d/.test(value)) return 'Password must include a number.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must include a symbol.';

  return '';
}

module.exports = { validatePassword };
