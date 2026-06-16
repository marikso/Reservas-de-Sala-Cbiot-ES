import { describe, it, expect, beforeEach } from 'vitest';
import { getToken, setToken, removeToken } from './api';

describe('gerenciamento de token de autenticação', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('retorna null quando não há token salvo', () => {
    expect(getToken()).toBeNull();
  });

  it('salva e recupera o token', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');
  });

  it('remove o token salvo', () => {
    setToken('abc123');
    removeToken();
    expect(getToken()).toBeNull();
  });
});
