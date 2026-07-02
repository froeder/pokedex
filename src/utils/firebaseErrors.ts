export function getFirebaseErrorCode(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }

  return undefined;
}

export function isPermissionError(error: unknown) {
  const code = getFirebaseErrorCode(error);
  return (
    code === 'permission-denied' ||
    code === 'firestore/permission-denied' ||
    code === 'functions/permission-denied'
  );
}

export function getFriendlyFirebaseError(error: unknown) {
  if (isPermissionError(error)) {
    return 'Permissão negada no Firestore. Publique as regras com `firebase deploy --only firestore:rules` ou rode `npm run emulators` para desenvolvimento local.';
  }

  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a operação.';
}
