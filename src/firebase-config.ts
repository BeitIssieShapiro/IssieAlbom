import { firebaseInit } from '@beitissieshapiro/issie-shared';
import { debugToken } from './common/debug-token';

export function initializeFirebase(): void {
  firebaseInit(debugToken);
}
