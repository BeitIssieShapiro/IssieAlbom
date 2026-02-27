// Logging utilities from IssieDocs

export function trace(a: any, ...optionalParams: any[]) {
  if (__DEV__) {
    console.log(a, ...optionalParams);
  }
}

export function assert(cond: boolean, description: string) {
  if (!cond) {
    console.error('Assertion Failed: ' + description);
  }
}
