import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReservaModal from './ReservaModal';

vi.mock('../api', () => ({
  createReserva: vi.fn(),
  createReservaRecorrente: vi.fn(),
  getDisponibilidade: vi.fn(() => Promise.resolve({ horarios: [] })),
  deleteReservasByGrupo: vi.fn(),
}));

const salas = [{ id: 1, nome: 'Sala A' }];
const currentUser = { nome: 'Ana', email: 'ana@x.com' };

describe('ReservaModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não renderiza nada quando isOpen é false', () => {
    const { container } = render(
      <ReservaModal
        isOpen={false}
        onClose={() => {}}
        salas={salas}
        currentUser={currentUser}
        userRole="lider_de_grupo"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('exibe erro ao tentar enviar sem selecionar uma sala', async () => {
    const { container } = render(
      <ReservaModal
        isOpen={true}
        onClose={() => {}}
        salas={salas}
        currentUser={currentUser}
        userRole="lider_de_grupo"
      />
    );

    // fireEvent.click no botão "Confirmar reserva" é bloqueado pela validação
    // nativa HTML5 do jsdom (campos <select required> e <input required> vazios
    // impedem o evento submit de disparar). Disparamos o submit diretamente no
    // <form> para acionar o handleSubmit do React e validar a regra de negócio.
    fireEvent.submit(container.querySelector('form'));

    expect(await screen.findByText('Selecione uma sala.')).toBeInTheDocument();
  });

  it('chama onClose ao clicar em Cancelar', () => {
    const onClose = vi.fn();
    render(
      <ReservaModal
        isOpen={true}
        onClose={onClose}
        salas={salas}
        currentUser={currentUser}
        userRole="lider_de_grupo"
      />
    );

    fireEvent.click(screen.getByText('Cancelar'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
