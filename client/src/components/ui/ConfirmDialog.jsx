import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Button } from './Button.jsx';
import { Modal } from './Modal.jsx';

const ConfirmContext = createContext(null);

/**
 * Confirmación para acciones destructivas o irreversibles.
 *   const confirm = useConfirm();
 *   if (await confirm({ title: '¿Archivar a Laura Pérez?', confirmLabel: 'Archivar', danger: true })) …
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setState(opts);
      }),
    [],
  );

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => close(false)}
        title={state?.title}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {state?.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus>
              {state?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-ink-2">{state?.description}</div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
