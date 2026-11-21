import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { SessaoExpirada } from './api';

/** Carrega dados; sessão expirada leva ao login, outros erros ficam em `erro`. */
export function useDados<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recarregar = useCallback(() => {
    setErro(null);
    return fn()
      .then(setDados)
      .catch((e: Error) => (e instanceof SessaoExpirada ? router.replace('/login') : setErro(e.message)));
  }, deps);
  useEffect(() => {
    recarregar();
  }, [recarregar]);
  return { dados, erro, recarregar };
}

/** Para ações (enviar formulário etc.). */
export function tratarErro(e: unknown) {
  if (e instanceof SessaoExpirada) {
    router.replace('/login');
    return;
  }
  Alert.alert('Não foi possível concluir', (e as Error).message);
}
