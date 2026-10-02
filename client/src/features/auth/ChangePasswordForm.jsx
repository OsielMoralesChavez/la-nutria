import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { Alert, Button, Field, Input, useToast } from '../../components/ui/index.js';
import { Logo } from '../../layouts/Logo.jsx';
import { api } from '../../lib/http.js';
import { useAuth } from './AuthProvider.jsx';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Requerida'),
    newPassword: z.string().min(10, 'Mínimo 10 caracteres').max(128),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'No coincide' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Debe ser distinta de la actual' });

export function ChangePasswordForm({ onDone }) {
  const toast = useToast();
  const { reloadUser } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      await api.patch('/auth/password', { currentPassword, newPassword });
      await reloadUser();
      reset();
      toast.success('Contraseña actualizada. Cerramos tus otras sesiones abiertas.');
      onDone?.();
    } catch (err) {
      const fields = err.fieldErrors ?? {};
      if (Object.keys(fields).length) Object.entries(fields).forEach(([f, m]) => setError(f, { message: m }));
      else setError('root', { message: err.message });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {errors.root && <Alert tone="error">{errors.root.message}</Alert>}
      <Field label="Contraseña actual" error={errors.currentPassword?.message}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" {...register('currentPassword')} />}
      </Field>
      <Field label="Nueva contraseña" hint="Mínimo 10 caracteres. Usa una frase fácil de recordar." error={errors.newPassword?.message}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('newPassword')} />}
      </Field>
      <Field label="Confirmar nueva contraseña" error={errors.confirm?.message}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('confirm')} />}
      </Field>
      <Button type="submit" icon={KeyRound} loading={isSubmitting}>
        Cambiar contraseña
      </Button>
    </form>
  );
}

/** Pantalla obligatoria cuando el usuario entra con contraseña temporal. */
export function ForcedPasswordChangePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="glass-strong rounded-2xl border border-white/60 p-6 shadow-[var(--shadow-pop)]">
          <h1 className="text-lg font-semibold text-ink">Crea tu contraseña</h1>
          <p className="mb-4 mt-1 text-sm text-ink-3">Entraste con una contraseña temporal. Por seguridad, define una nueva para continuar.</p>
          <ChangePasswordForm onDone={() => navigate('/', { replace: true })} />
        </div>
        <button type="button" onClick={logout} className="mx-auto mt-4 block text-sm text-ink-3 hover:text-ink">
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
