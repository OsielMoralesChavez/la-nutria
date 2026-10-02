import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { Logo } from '../../layouts/Logo.jsx';
import { Alert, Button, Field, Input } from '../../components/ui/index.js';
import { useAuth } from './AuthProvider.jsx';

const schema = z.object({
  email: z.email('Escribe un correo válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});

export function LoginPage() {
  const { login, status, expired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  if (status === 'authenticated') return <Navigate to={location.state?.from?.pathname ?? '/'} replace />;

  const onSubmit = async (values) => {
    setError(null);
    try {
      const user = await login(values);
      navigate(user.mustChangePassword ? '/cambiar-contrasena' : location.state?.from?.pathname ?? '/', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <p className="mt-3 text-sm text-ink-3">Gestión y seguimiento nutricional</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="glass-strong space-y-4 rounded-2xl border border-white/60 p-6 shadow-[var(--shadow-pop)]">
          <h1 className="text-lg font-semibold text-ink">Iniciar sesión</h1>
          {expired && !error && <Alert tone="info">Tu sesión expiró. Vuelve a iniciar sesión.</Alert>}
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Correo" error={errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="username" autoFocus {...register('email')} />}
          </Field>
          <Field label="Contraseña" error={errors.password?.message}>
            {(p) => (
              <div className="relative">
                <Input {...p} type={show ? 'text' : 'password'} autoComplete="current-password" className="pr-10" {...register('password')} />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-3 hover:text-ink"
                >
                  {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                </button>
              </div>
            )}
          </Field>
          <Button type="submit" className="w-full" icon={LogIn} loading={isSubmitting}>
            Entrar
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-ink-3">¿Olvidaste tu contraseña? Pide a un administrador que la restablezca.</p>
      </div>
    </main>
  );
}
