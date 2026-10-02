import { Compass, Home, ShieldX } from 'lucide-react';
import { Button, EmptyState } from '../../components/ui/index.js';

export function ForbiddenPage() {
  return (
    <EmptyState
      icon={ShieldX}
      title="No tienes acceso a esta sección"
      description="Si necesitas entrar, pide a un administrador que revise los permisos de tu rol."
      action={
        <Button to="/" variant="secondary" icon={Home}>
          Ir al inicio
        </Button>
      }
    />
  );
}

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="No encontramos esta página"
      description="Puede que el enlace sea incorrecto o que el registro ya no exista."
      action={
        <Button to="/" variant="secondary" icon={Home}>
          Ir al inicio
        </Button>
      }
    />
  );
}
