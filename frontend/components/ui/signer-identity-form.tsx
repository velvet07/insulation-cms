'use client';

import { useState, useCallback } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Shield, ArrowRight, X } from 'lucide-react';

interface SignerIdentityFormProps {
  signerRole: 'contractor' | 'client';
  defaultName?: string;
  defaultEmail?: string;
  onSubmit: (data: { name: string; email: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ROLE_LABELS: Record<'contractor' | 'client', string> = {
  contractor: 'Fővállalkozó (Kivitelező)',
  client: 'Ügyfél (Megrendelő)',
};

export function SignerIdentityForm({
  signerRole,
  defaultName = '',
  defaultEmail = '',
  onSubmit,
  onCancel,
  isLoading = false,
}: SignerIdentityFormProps) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const validate = useCallback((): boolean => {
    const newErrors: { name?: string; email?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'A név megadása kötelező';
    } else if (name.trim().length < 2) {
      newErrors.name = 'A név legalább 2 karakter legyen';
    }

    if (!email.trim()) {
      newErrors.email = 'Az e-mail cím megadása kötelező';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Érvénytelen e-mail cím';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, email]);

  const handleSubmit = useCallback(() => {
    if (validate()) {
      onSubmit({ name: name.trim(), email: email.trim() });
    }
  }, [validate, onSubmit, name, email]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="border rounded-lg p-6 bg-white dark:bg-gray-800 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h4 className="text-md font-semibold">{ROLE_LABELS[signerRole]} adatai</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Digitális aláíráshoz szükséges azonosító adatok
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`signer-name-${signerRole}`}>Név *</Label>
          <Input
            id={`signer-name-${signerRole}`}
            type="text"
            placeholder="Teljes név"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            aria-invalid={!!errors.name}
            className={errors.name ? 'border-red-500 focus:border-red-500' : ''}
          />
          {errors.name && (
            <p className="text-xs text-red-500">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`signer-email-${signerRole}`}>E-mail cím *</Label>
          <Input
            id={`signer-email-${signerRole}`}
            type="email"
            placeholder="pelda@email.hu"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            aria-invalid={!!errors.email}
            className={errors.email ? 'border-red-500 focus:border-red-500' : ''}
          />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email}</p>
          )}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Az aláírás az Ön nevéhez és e-mail címéhez lesz kötve (eIDAS AES digitális aláírás).
          A tanúsítvány tartalmazza ezeket az adatokat, és a PDF kriptográfiailag védett lesz.
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="mr-2 h-4 w-4" />
          Mégse
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading}>
          <ArrowRight className="mr-2 h-4 w-4" />
          Tovább az aláíráshoz
        </Button>
      </div>
    </div>
  );
}
